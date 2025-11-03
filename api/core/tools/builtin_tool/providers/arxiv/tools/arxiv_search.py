"""arXiv search tool for finding academic papers."""

import logging
from collections.abc import Generator
from typing import Any

import arxiv  # pyright: ignore[reportMissingTypeStubs]
from pydantic import BaseModel

from core.tools.builtin_tool.tool import BuiltinTool
from core.tools.entities.tool_entities import ToolInvokeMessage

logger = logging.getLogger(__name__)


class ArxivAPIWrapper(BaseModel):
    """
    Wrapper around ArxivAPI.

    To use, you should have the ``arxiv`` python package installed.
    https://lukasschwab.me/arxiv.py/index.html
    This wrapper will use the Arxiv API to conduct searches and
    fetch document summaries. By default, it will return the document summaries
    of the top-k results.
    It limits the Document content by doc_content_chars_max.
    Set doc_content_chars_max=None if you don't want to limit the content size.

    Args:
        top_k_results: number of the top-scored document used for the arxiv tool
        ARXIV_MAX_QUERY_LENGTH: the cut limit on the query used for the arxiv tool.
        load_max_docs: a limit to the number of loaded documents
        load_all_available_meta:
            if True: the `metadata` of the loaded Documents contains all available
            meta info (see https://lukasschwab.me/arxiv.py/index.html#Result),
            if False: the `metadata` contains only the published date, title,
            authors and summary.
        doc_content_chars_max: an optional cut limit for the length of a document's
            content
    """

    arxiv_search: type[arxiv.Search] = arxiv.Search  #: :meta private:
    arxiv_http_error: tuple[type[Exception], ...] = (
        arxiv.ArxivError,
        arxiv.UnexpectedEmptyPageError,
        arxiv.HTTPError,
    )
    top_k_results: int = 3
    ARXIV_MAX_QUERY_LENGTH: int = 300
    load_max_docs: int = 100
    load_all_available_meta: bool = False
    doc_content_chars_max: int | None = 4000

    def run(self, query: str) -> str:
        """
        Perform an arxiv search and return a single string
        with the publish date, title, authors, and summary
        for each article separated by two newlines.

        If an error occurs or no documents found, error text
        is returned instead. Wrapper for
        https://lukasschwab.me/arxiv.py/index.html#Search

        Args:
            query: a plaintext search query

        Returns:
            str: Search results or error message
        """
        try:
            results = self.arxiv_search(  # type: ignore
                query[: self.ARXIV_MAX_QUERY_LENGTH], max_results=self.top_k_results
            ).results()
        except self.arxiv_http_error as ex:
            return f"Arxiv exception: {ex}"

        docs = [
            f"Published: {result.updated.date()}\n"
            f"Title: {result.title}\n"
            f"Authors: {', '.join(a.name for a in result.authors)}\n"
            f"Summary: {result.summary}"
            for result in results
        ]

        if docs:
            return "\n\n".join(docs)[: self.doc_content_chars_max]
        else:
            return "No good Arxiv Result was found"


class ArxivSearchTool(BuiltinTool):
    """
    A tool for searching articles on Arxiv.
    """

    def _invoke(
        self,
        user_id: str,
        tool_parameters: dict[str, Any],
        conversation_id: str | None = None,
        app_id: str | None = None,
        message_id: str | None = None,
    ) -> Generator[ToolInvokeMessage, None, None]:
        """
        Invoke the Arxiv search tool.

        Args:
            user_id: User ID
            tool_parameters: Tool parameters with 'query'
            conversation_id: Conversation ID (optional)
            app_id: App ID (optional)
            message_id: Message ID (optional)

        Yields:
            ToolInvokeMessage: Search results or error message
        """
        query = tool_parameters.get("query", "")

        if not query:
            yield self.create_text_message("Please input query")
            return

        arxiv_wrapper = ArxivAPIWrapper()
        response = arxiv_wrapper.run(query)

        yield self.create_text_message(response)
