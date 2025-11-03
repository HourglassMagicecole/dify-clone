from collections.abc import Generator
from datetime import datetime
from typing import Any

from requests.exceptions import ConnectionError, HTTPError, ReadTimeout
from yfinance import download  # pyright: ignore[reportMissingTypeStubs]

from core.tools.builtin_tool.tool import BuiltinTool
from core.tools.entities.tool_entities import ToolInvokeMessage


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
            time_range[0] = "1800-01-01"

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

            yield self.create_json_message({"analytics": summary_data})

        except (HTTPError, ReadTimeout, ConnectionError):
            yield self.create_text_message(f"Failed to fetch data for symbol {symbol}")
        except Exception:
            yield self.create_text_message("An unexpected error occurred while processing the data")
