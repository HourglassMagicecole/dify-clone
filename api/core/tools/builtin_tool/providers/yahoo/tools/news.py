from collections.abc import Generator
from typing import Any

import yfinance  # pyright: ignore[reportMissingTypeStubs]
from requests.exceptions import ConnectionError, HTTPError, ReadTimeout

from core.tools.builtin_tool.tool import BuiltinTool
from core.tools.entities.tool_entities import ToolInvokeMessage


class YahooFinanceNewsTool(BuiltinTool):
    def _invoke(
        self,
        user_id: str,
        tool_parameters: dict[str, Any],
        conversation_id: str | None = None,
        app_id: str | None = None,
        message_id: str | None = None,
    ) -> Generator[ToolInvokeMessage, None, None]:
        """
        Invoke Yahoo Finance news tool.

        Args:
            user_id: User ID
            tool_parameters: Tool parameters with 'symbol'
            conversation_id: Conversation ID (optional)
            app_id: App ID (optional)
            message_id: Message ID (optional)

        Yields:
            ToolInvokeMessage: News data
        """
        query = tool_parameters.get("symbol", "")
        if not query:
            yield self.create_text_message("Please input symbol")
            return

        try:
            yield from self.run(ticker=query)
        except (HTTPError, ReadTimeout):
            yield self.create_text_message("There is an internet connection problem. Please try again later.")

    def run(self, ticker: str) -> Generator[ToolInvokeMessage, None, None]:
        """
        Get news for a given ticker symbol.

        Args:
            ticker: Stock ticker symbol

        Yields:
            ToolInvokeMessage: News items
        """
        company = yfinance.Ticker(ticker)
        try:
            if company.isin is None:
                yield self.create_text_message(f"Company ticker {ticker} not found.")
                return
        except (HTTPError, ReadTimeout, ConnectionError):
            yield self.create_text_message(f"Company ticker {ticker} not found.")
            return

        news_items = []
        try:
            # Extract news items that are STORY type
            raw_news = company.news
            for item in raw_news:
                content = item.get("content", {})
                if content.get("contentType") == "STORY":
                    # Get content from either description or summary
                    article_content = content.get("description", "")
                    if not article_content:
                        article_content = content.get("summary", "")

                    news_items.append(
                        {
                            "title": content.get("title", ""),
                            "content": article_content,
                            "url": content.get("canonicalUrl", {}).get("url", ""),
                            "provider": content.get("provider", {}).get("displayName", ""),
                            "publishDate": content.get("pubDate", ""),
                        }
                    )

        except (HTTPError, ReadTimeout, ConnectionError):
            if not news_items:
                yield self.create_text_message(f"There is nothing about {ticker} ticker")
                return

        if not news_items:
            yield self.create_text_message(f"No news found for company that searched with {ticker} ticker.")
            return

        yield self.create_json_message({"news": news_items})
