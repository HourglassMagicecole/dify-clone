"""Unit tests for ``YahooFinanceAnalyticsTool.run``.

Guards against regressions in the hotfix that added quarterly financials and
EPS history/estimates to the tool's JSON payload (see story
``_bmad-output/stories/hotfix_20260417_yahoo-analytics-quarterly-financials.md``).

All yfinance network calls are mocked — these tests must never touch the
network.
"""

from __future__ import annotations

from datetime import datetime, timedelta
from typing import Any
from unittest.mock import MagicMock, patch

import numpy as np
import pandas as pd
import pytest

from core.tools.__base.tool_runtime import ToolRuntime
from core.tools.builtin_tool.providers.yahoo.tools.analytics import YahooFinanceAnalyticsTool
from core.tools.entities.common_entities import I18nObject
from core.tools.entities.tool_entities import ToolEntity, ToolIdentity

_ANALYTICS_PATH = "core.tools.builtin_tool.providers.yahoo.tools.analytics"


@pytest.fixture
def tool() -> YahooFinanceAnalyticsTool:
    entity = ToolEntity(
        identity=ToolIdentity(
            author="test",
            name="yahoo_finance_analytics",
            label=I18nObject(en_US="Analytics"),
            provider="yahoo",
        ),
        parameters=[],
        description=None,
        has_runtime_parameters=False,
    )
    runtime = ToolRuntime(tenant_id="test-tenant")
    return YahooFinanceAnalyticsTool(provider="yahoo", entity=entity, runtime=runtime)


def _price_dataframe() -> pd.DataFrame:
    """Minimal OHLCV frame that mirrors the multi-column shape yfinance returns.

    yfinance.download returns a frame whose columns are a MultiIndex like
    (field, symbol); the existing code calls ``.mean().iloc[0]`` / ``.max().iloc[0]``
    which only works when each field still wraps a Series. Two columns per
    field keeps those calls happy while the underlying values stay
    deterministic.
    """
    index = pd.date_range("2026-01-01", periods=4, freq="D")
    data = {
        ("Close", "TEST"): [10.0, 11.0, 12.0, 13.0],
        ("Open", "TEST"): [9.0, 10.5, 11.5, 12.5],
        ("High", "TEST"): [10.5, 11.5, 12.5, 13.5],
        ("Low", "TEST"): [9.5, 10.0, 11.0, 12.0],
        ("Volume", "TEST"): [1000.0, 1100.0, 1200.0, 1300.0],
    }
    frame = pd.DataFrame(data, index=index)
    frame.columns = pd.MultiIndex.from_tuples(list(frame.columns))
    return frame


def _build_quarterly_income_stmt(with_nans: bool = False) -> pd.DataFrame:
    """Row-labelled quarterly income statement (line items x quarter columns)."""
    columns = [
        pd.Timestamp("2025-12-31"),
        pd.Timestamp("2025-09-30"),
        pd.Timestamp("2025-06-30"),
        pd.Timestamp("2025-03-31"),
    ]
    operating_income = [2.5e12, 2.3e12, 2.1e12, 1.9e12]
    basic_eps = [2909.0, 2650.0, 2480.0, 2200.0]
    if with_nans:
        operating_income[1] = np.nan
        basic_eps[2] = np.nan

    rows = {
        "Total Revenue": [80e12, 78e12, 76e12, 74e12],
        "Operating Income": operating_income,
        "Net Income": [2.0e12, 1.8e12, 1.7e12, 1.5e12],
        "Basic EPS": basic_eps,
        "Diluted EPS": [2850.0, 2600.0, 2430.0, 2150.0],
    }
    return pd.DataFrame(rows, index=columns).T


def _build_earnings_dates() -> pd.DataFrame:
    """Earnings dates frame: index = earnings date, columns = EPS fields.

    Mix of past (for ``reported``) and future (for ``upcoming``) rows.
    """
    now = datetime.now()
    index = [
        now - timedelta(days=1),  # most recent past
        now - timedelta(days=95),
        now - timedelta(days=190),
        now - timedelta(days=280),
        now - timedelta(days=370),  # past, extra (should be trimmed to 4)
        now + timedelta(days=15),  # upcoming (nearest)
        now + timedelta(days=110),  # upcoming (further)
    ]
    rows = [
        {"EPS Estimate": 2325.47, "Reported EPS": 2909.0, "Surprise(%)": 25.09},
        {"EPS Estimate": 2200.0, "Reported EPS": 2650.0, "Surprise(%)": 20.45},
        {"EPS Estimate": 2100.0, "Reported EPS": 2480.0, "Surprise(%)": 18.10},
        {"EPS Estimate": 1900.0, "Reported EPS": 2200.0, "Surprise(%)": 15.78},
        {"EPS Estimate": 1800.0, "Reported EPS": 2100.0, "Surprise(%)": 16.66},
        {"EPS Estimate": 5088.89, "Reported EPS": np.nan, "Surprise(%)": np.nan},
        {"EPS Estimate": 5500.0, "Reported EPS": np.nan, "Surprise(%)": np.nan},
    ]
    return pd.DataFrame(rows, index=pd.DatetimeIndex(index, name="Earnings Date"))


def _build_mock_ticker(
    quarterly_df: pd.DataFrame | None,
    earnings_df: pd.DataFrame | None,
    raise_on_earnings: bool = False,
) -> MagicMock:
    """Shape a MagicMock so attribute access mirrors the real ``yfinance.Ticker``."""
    mock = MagicMock()
    if quarterly_df is None:
        mock.quarterly_income_stmt = pd.DataFrame()
    else:
        mock.quarterly_income_stmt = quarterly_df

    if raise_on_earnings:
        type(mock).earnings_dates = property(lambda self: (_ for _ in ()).throw(RuntimeError("boom")))
    elif earnings_df is None:
        mock.earnings_dates = pd.DataFrame()
    else:
        mock.earnings_dates = earnings_df
    return mock


def _run_tool(tool: YahooFinanceAnalyticsTool) -> dict[str, Any]:
    """Drive ``tool.run`` and return the single JSON payload it yields."""
    messages = list(tool.run(symbol="TEST", start_date="2026-01-01", end_date="2026-01-05"))
    assert len(messages) == 1, f"expected 1 message, got {len(messages)}"
    payload = messages[0].message.json_object  # type: ignore[attr-defined]
    assert isinstance(payload, dict)
    return payload


def test_run_returns_analytics_quarterly_and_earnings_sections(tool: YahooFinanceAnalyticsTool) -> None:
    """Happy path: all three sections present with expected values."""
    quarterly = _build_quarterly_income_stmt()
    earnings = _build_earnings_dates()
    mock_ticker = _build_mock_ticker(quarterly, earnings)

    with (
        patch(f"{_ANALYTICS_PATH}.download", return_value=_price_dataframe()),
        patch(f"{_ANALYTICS_PATH}.Ticker", return_value=mock_ticker),
    ):
        payload = _run_tool(tool)

    # Existing analytics key survives (regression guard for price statistics).
    assert "analytics" in payload
    assert isinstance(payload["analytics"], list)
    assert len(payload["analytics"]) >= 1
    first_segment = payload["analytics"][0]
    assert "Average Close" in first_segment
    assert "Start Date" in first_segment

    # New quarterly_financials: 4 quarters, newest first, with all 5 metrics.
    assert payload["quarterly_financials"] == [
        {
            "period_end": "2025-12-31",
            "total_revenue": 80e12,
            "operating_income": 2.5e12,
            "net_income": 2.0e12,
            "basic_eps": 2909.0,
            "diluted_eps": 2850.0,
        },
        {
            "period_end": "2025-09-30",
            "total_revenue": 78e12,
            "operating_income": 2.3e12,
            "net_income": 1.8e12,
            "basic_eps": 2650.0,
            "diluted_eps": 2600.0,
        },
        {
            "period_end": "2025-06-30",
            "total_revenue": 76e12,
            "operating_income": 2.1e12,
            "net_income": 1.7e12,
            "basic_eps": 2480.0,
            "diluted_eps": 2430.0,
        },
        {
            "period_end": "2025-03-31",
            "total_revenue": 74e12,
            "operating_income": 1.9e12,
            "net_income": 1.5e12,
            "basic_eps": 2200.0,
            "diluted_eps": 2150.0,
        },
    ]

    # EPS history: reported trimmed to 4 (newest first), upcoming trimmed/sorted.
    earnings_section = payload["earnings_history_and_estimates"]
    assert len(earnings_section["reported"]) == 4
    assert earnings_section["reported"][0]["reported_eps"] == 2909.0
    assert earnings_section["reported"][0]["eps_estimate"] == 2325.47
    assert earnings_section["reported"][0]["surprise_pct"] == 25.09

    assert len(earnings_section["upcoming"]) == 2
    # Nearest future event should come first.
    assert earnings_section["upcoming"][0]["eps_estimate"] == 5088.89
    assert earnings_section["upcoming"][1]["eps_estimate"] == 5500.0
    # Upcoming entries must not leak reported_eps when it was NaN.
    assert "reported_eps" not in earnings_section["upcoming"][0]


def test_run_skips_nan_fields_in_quarterly(tool: YahooFinanceAnalyticsTool) -> None:
    """NaN cells are dropped from the per-quarter dict, not emitted as null."""
    quarterly = _build_quarterly_income_stmt(with_nans=True)
    mock_ticker = _build_mock_ticker(quarterly, earnings_df=None)

    with (
        patch(f"{_ANALYTICS_PATH}.download", return_value=_price_dataframe()),
        patch(f"{_ANALYTICS_PATH}.Ticker", return_value=mock_ticker),
    ):
        payload = _run_tool(tool)

    quarters = payload["quarterly_financials"]
    # 2025-09-30 had NaN operating_income; 2025-06-30 had NaN basic_eps.
    q2 = next(q for q in quarters if q["period_end"] == "2025-09-30")
    assert "operating_income" not in q2
    assert q2["net_income"] == 1.8e12

    q3 = next(q for q in quarters if q["period_end"] == "2025-06-30")
    assert "basic_eps" not in q3
    assert q3["diluted_eps"] == 2430.0


def test_run_omits_quarterly_section_when_dataframe_empty(tool: YahooFinanceAnalyticsTool) -> None:
    """Empty quarterly DataFrame -> section omitted, analytics still returned."""
    mock_ticker = _build_mock_ticker(quarterly_df=pd.DataFrame(), earnings_df=None)

    with (
        patch(f"{_ANALYTICS_PATH}.download", return_value=_price_dataframe()),
        patch(f"{_ANALYTICS_PATH}.Ticker", return_value=mock_ticker),
    ):
        payload = _run_tool(tool)

    assert "analytics" in payload
    assert "quarterly_financials" not in payload
    # Empty earnings DataFrame -> section also omitted.
    assert "earnings_history_and_estimates" not in payload


def test_run_omits_earnings_section_when_access_raises(tool: YahooFinanceAnalyticsTool) -> None:
    """An exception on ``earnings_dates`` must not break the whole payload."""
    quarterly = _build_quarterly_income_stmt()
    mock_ticker = _build_mock_ticker(quarterly, earnings_df=None, raise_on_earnings=True)

    with (
        patch(f"{_ANALYTICS_PATH}.download", return_value=_price_dataframe()),
        patch(f"{_ANALYTICS_PATH}.Ticker", return_value=mock_ticker),
    ):
        payload = _run_tool(tool)

    assert "analytics" in payload
    assert "quarterly_financials" in payload
    assert "earnings_history_and_estimates" not in payload
