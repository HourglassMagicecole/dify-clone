from collections.abc import Generator
from typing import Any

from requests.exceptions import HTTPError, ReadTimeout
from yfinance import Ticker

from core.tools.builtin_tool.tool import BuiltinTool
from core.tools.entities.tool_entities import ToolInvokeMessage


class YahooFinanceSearchTickerTool(BuiltinTool):
    def _invoke(
        self,
        user_id: str,
        tool_parameters: dict[str, Any],
        conversation_id: str | None = None,
        app_id: str | None = None,
        message_id: str | None = None,
    ) -> Generator[ToolInvokeMessage, None, None]:
        """
        Invoke Yahoo Finance ticker search tool.

        Args:
            user_id: User ID
            tool_parameters: Tool parameters with 'symbol'
            conversation_id: Conversation ID (optional)
            app_id: App ID (optional)
            message_id: Message ID (optional)

        Yields:
            ToolInvokeMessage: Ticker information
        """
        query = tool_parameters.get("symbol", "")
        if not query:
            yield self.create_text_message("Please input symbol")
            return

        try:
            yield self.create_json_message(self.run(ticker=query))
        except (HTTPError, ReadTimeout):
            yield self.create_text_message("There is an internet connection problem. Please try again later.")

    def run(self, ticker: str) -> dict[str, Any]:
        """Get ticker information from Yahoo Finance."""
        return Ticker(ticker).info
