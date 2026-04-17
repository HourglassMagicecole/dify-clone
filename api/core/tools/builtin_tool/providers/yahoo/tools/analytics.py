from collections.abc import Generator
from datetime import datetime, timedelta
from operator import itemgetter
from typing import Any

import pandas as pd
from requests.exceptions import ConnectionError, HTTPError, ReadTimeout
from yfinance import Ticker, download  # pyright: ignore[reportMissingTypeStubs]

from core.tools.builtin_tool.tool import BuiltinTool
from core.tools.entities.tool_entities import ToolInvokeMessage

# yfinance quarterly_income_stmt row labels; declared here to keep run() readable.
# Some labels may be absent for a given ticker — we look them up with fallback and
# skip fields we cannot resolve rather than failing the whole response.
_REVENUE_KEYS = ("Total Revenue", "Operating Revenue")
_OPERATING_INCOME_KEYS = ("Operating Income", "Total Operating Income As Reported")
_NET_INCOME_KEYS = ("Net Income", "Net Income Common Stockholders")
_BASIC_EPS_KEYS = ("Basic EPS",)
_DILUTED_EPS_KEYS = ("Diluted EPS",)


class YahooFinanceAnalyticsTool(BuiltinTool):
    def _invoke(
        self,
        user_id: str,
        tool_parameters: dict[str, Any],
        conversation_id: str | None = None,
        app_id: str | None = None,
        message_id: str | None = None,
    ) -> Generator[ToolInvokeMessage, None, None]:
        """
        Invoke Yahoo Finance analytics tool.

        Args:
            user_id: User ID
            tool_parameters: Tool parameters with 'symbol', 'start_date', 'end_date'
            conversation_id: Conversation ID (optional)
            app_id: App ID (optional)
            message_id: Message ID (optional)

        Yields:
            ToolInvokeMessage: Analytics data
        """
        symbol = tool_parameters.get("symbol", "")
        if not symbol:
            yield self.create_text_message("Please input symbol")
            return

        time_range = ["", ""]
        start_date = tool_parameters.get("start_date", "")
        if start_date:
            time_range[0] = start_date
        else:
            time_range[0] = (datetime.now() - timedelta(days=90)).strftime("%Y-%m-%d")

        end_date = tool_parameters.get("end_date", "")
        if end_date:
            time_range[1] = end_date
        else:
            time_range[1] = datetime.now().strftime("%Y-%m-%d")

        try:
            yield from self.run(symbol=symbol, start_date=time_range[0], end_date=time_range[1])
        except (HTTPError, ReadTimeout):
            yield self.create_text_message("There is an internet connection problem. Please try again later.")

    def run(self, symbol: str, start_date: str, end_date: str) -> Generator[ToolInvokeMessage, None, None]:
        """
        Run the analytics calculation for the given symbol and date range.

        Returns price/volume statistics (kept verbatim for backward compatibility)
        plus the most recent quarterly financials and EPS history/estimates when
        yfinance exposes them. Each optional section is emitted only when data
        is actually available — transient yfinance errors for one section never
        block the rest of the payload.

        Args:
            symbol: Stock ticker symbol
            start_date: Start date (YYYY-MM-DD)
            end_date: End date (YYYY-MM-DD)

        Yields:
            ToolInvokeMessage: Analytics summary
        """
        try:
            stock_data = download(symbol, start=start_date, end=end_date)  # type: ignore
            if stock_data is None or stock_data.empty:  # type: ignore
                yield self.create_text_message(f"No data found for symbol {symbol} in the specified date range")
                return

            max_segments = min(15, len(stock_data))
            rows_per_segment = len(stock_data) // (max_segments or 1)
            summary_data = []

            for i in range(max_segments):
                start_idx = i * rows_per_segment
                end_idx = (i + 1) * rows_per_segment if i < max_segments - 1 else len(stock_data)
                segment_data = stock_data.iloc[start_idx:end_idx]

                segment_summary = {
                    "Start Date": segment_data.index[0].strftime("%Y-%m-%d"),
                    "End Date": segment_data.index[-1].strftime("%Y-%m-%d"),
                    "Average Close": float(segment_data["Close"].mean().iloc[0]),
                    "Average Volume": float(segment_data["Volume"].mean().iloc[0]),
                    "Average Open": float(segment_data["Open"].mean().iloc[0]),
                    "Average High": float(segment_data["High"].mean().iloc[0]),
                    "Average Low": float(segment_data["Low"].mean().iloc[0]),
                    "Max Close": float(segment_data["Close"].max().iloc[0]),
                    "Min Close": float(segment_data["Close"].min().iloc[0]),
                    "Max Volume": float(segment_data["Volume"].max().iloc[0]),
                    "Min Volume": float(segment_data["Volume"].min().iloc[0]),
                    "Max Open": float(segment_data["Open"].max().iloc[0]),
                    "Min Open": float(segment_data["Open"].min().iloc[0]),
                    "Max High": float(segment_data["High"].max().iloc[0]),
                    "Min High": float(segment_data["High"].min().iloc[0]),
                    "Min Low": float(segment_data["Low"].min().iloc[0]),
                    "Max Low": float(segment_data["Low"].max().iloc[0]),
                }
                summary_data.append(segment_summary)

            payload: dict[str, Any] = {"analytics": summary_data}

            ticker = Ticker(symbol)  # type: ignore

            quarterly = _extract_quarterly_financials(ticker)
            if quarterly:
                payload["quarterly_financials"] = quarterly

            earnings = _extract_earnings_history_and_estimates(ticker)
            if earnings:
                payload["earnings_history_and_estimates"] = earnings

            yield self.create_json_message(payload)

        except (HTTPError, ReadTimeout, ConnectionError):
            yield self.create_text_message(f"Failed to fetch data for symbol {symbol}")
        except Exception:
            yield self.create_text_message("An unexpected error occurred while processing the data")


def _extract_quarterly_financials(ticker: Any) -> list[dict[str, Any]]:
    """Pull up to the 4 most recent quarters from ``Ticker.quarterly_income_stmt``.

    The DataFrame has row-labels like "Total Revenue" and Timestamp columns. We
    sort columns descending (most recent first) and emit one dict per quarter,
    skipping NaN fields and skipping the whole section if the DataFrame itself
    is missing or raises during access.
    """
    try:
        df = ticker.quarterly_income_stmt
    except Exception:
        return []

    if df is None:
        return []
    try:
        if df.empty:
            return []
    except Exception:
        return []

    try:
        columns = sorted(df.columns, reverse=True)[:4]
    except Exception:
        return []

    quarters: list[dict[str, Any]] = []
    for col in columns:
        try:
            period_end = _format_date(col)
        except Exception:
            continue
        if not period_end:
            continue

        entry: dict[str, Any] = {"period_end": period_end}
        _assign_first_available(entry, "total_revenue", df, col, _REVENUE_KEYS)
        _assign_first_available(entry, "operating_income", df, col, _OPERATING_INCOME_KEYS)
        _assign_first_available(entry, "net_income", df, col, _NET_INCOME_KEYS)
        _assign_first_available(entry, "basic_eps", df, col, _BASIC_EPS_KEYS)
        _assign_first_available(entry, "diluted_eps", df, col, _DILUTED_EPS_KEYS)

        # period_end alone is not informative — drop quarters with no resolved metric.
        if len(entry) > 1:
            quarters.append(entry)

    return quarters


def _extract_earnings_history_and_estimates(ticker: Any) -> dict[str, list[dict[str, Any]]]:
    """Split ``Ticker.earnings_dates`` into recent actuals and upcoming estimates.

    - ``reported``: up to 4 past rows with a non-NaN reported EPS, newest first.
    - ``upcoming``: up to 3 future rows with a non-NaN EPS estimate, soonest first.
    An empty or raising dataset yields an empty dict so the caller omits the key.
    """
    try:
        df = ticker.earnings_dates
    except Exception:
        return {}

    if df is None:
        return {}
    try:
        if df.empty:
            return {}
    except Exception:
        return {}

    # Compare without tz so naive fixtures and tz-aware real data both work.
    now = pd.Timestamp(datetime.now())

    reported: list[dict[str, Any]] = []
    upcoming: list[dict[str, Any]] = []

    try:
        rows = list(df.iterrows())
    except Exception:
        return {}

    for idx, row in rows:
        try:
            earnings_ts = pd.Timestamp(idx)
        except Exception:
            continue

        earnings_date = _format_date(earnings_ts)
        if not earnings_date:
            continue

        # Strip timezone info for a direct comparison.
        compare_ts = earnings_ts.tz_localize(None) if earnings_ts.tzinfo is not None else earnings_ts

        reported_eps = _get_cell(row, "Reported EPS")
        eps_estimate = _get_cell(row, "EPS Estimate")
        surprise_pct = _get_cell(row, "Surprise(%)")

        if compare_ts <= now:
            if reported_eps is None:
                continue
            entry: dict[str, Any] = {"earnings_date": earnings_date, "reported_eps": reported_eps}
            if eps_estimate is not None:
                entry["eps_estimate"] = eps_estimate
            if surprise_pct is not None:
                entry["surprise_pct"] = surprise_pct
            reported.append(entry)
        else:
            if eps_estimate is None:
                continue
            upcoming.append({"earnings_date": earnings_date, "eps_estimate": eps_estimate})

    reported.sort(key=itemgetter("earnings_date"), reverse=True)
    upcoming.sort(key=itemgetter("earnings_date"))

    result: dict[str, list[dict[str, Any]]] = {}
    if reported:
        result["reported"] = reported[:4]
    if upcoming:
        result["upcoming"] = upcoming[:3]
    return result


def _assign_first_available(
    target: dict[str, Any],
    key: str,
    df: Any,
    column: Any,
    candidates: tuple[str, ...],
) -> None:
    for label in candidates:
        if label not in df.index:
            continue
        try:
            value = df.at[label, column]
        except Exception:
            continue
        coerced = _coerce_number(value)
        if coerced is not None:
            target[key] = coerced
            return


def _coerce_number(value: Any) -> float | None:
    if value is None:
        return None
    try:
        if pd.isna(value):
            return None
    except (TypeError, ValueError):
        pass
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def _get_cell(row: Any, key: str) -> float | None:
    try:
        value = row[key]
    except Exception:
        return None
    return _coerce_number(value)


def _format_date(value: Any) -> str:
    try:
        return pd.Timestamp(value).strftime("%Y-%m-%d")
    except Exception:
        return ""
