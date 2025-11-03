"""JSON parsing tool with JSONPath support."""

import json
from collections.abc import Generator
from typing import Any

from jsonpath_ng import parse  # pyright: ignore[reportMissingTypeStubs]

from core.tools.builtin_tool.tool import BuiltinTool
from core.tools.entities.tool_entities import ToolInvokeMessage


class JSONParseTool(BuiltinTool):
    """
    A tool for parsing JSON content with JSONPath filters.

    Supports JSONPath expressions to extract specific values from JSON data.
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
        Invoke JSON parse tool.

        Args:
            user_id: User ID
            tool_parameters: Tool parameters with 'content', 'json_filter', 'ensure_ascii'
            conversation_id: Conversation ID (optional)
            app_id: App ID (optional)
            message_id: Message ID (optional)

        Yields:
            ToolInvokeMessage: Parsed result or error message
        """
        content = tool_parameters.get("content", "")
        if not content:
            yield self.create_text_message("Invalid parameter content")
            return

        json_filter = tool_parameters.get("json_filter", "")
        if not json_filter:
            yield self.create_text_message("Invalid parameter json_filter")
            return

        ensure_ascii = tool_parameters.get("ensure_ascii", True)

        try:
            result = self._extract(content, json_filter, ensure_ascii)
            yield self.create_text_message(str(result))
        except Exception:
            yield self.create_text_message("Failed to extract JSON content")

    def _extract(self, content: str, json_filter: str, ensure_ascii: bool) -> str:
        """
        Extract values from JSON content using JSONPath filter.

        Args:
            content: JSON string content
            json_filter: JSONPath filter expression
            ensure_ascii: Whether to ensure ASCII encoding in output

        Returns:
            str: Extracted value(s) as string
        """
        try:
            input_data = json.loads(content)
            expr = parse(json_filter)
            result = [match.value for match in expr.find(input_data)]

            if not result:
                return ""

            if len(result) == 1:
                result = result[0]

            if isinstance(result, dict | list):
                return json.dumps(result, ensure_ascii=ensure_ascii)
            elif isinstance(result, str | int | float | bool) or result is None:
                return str(result)
            else:
                return repr(result)
        except Exception as e:
            return str(e)
