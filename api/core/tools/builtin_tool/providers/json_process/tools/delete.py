"""JSON delete tool for removing values from JSON data."""

import json
from collections.abc import Generator
from typing import Any

from jsonpath_ng import parse  # pyright: ignore[reportMissingTypeStubs]

from core.tools.builtin_tool.tool import BuiltinTool
from core.tools.entities.tool_entities import ToolInvokeMessage


class JSONDeleteTool(BuiltinTool):
    """
    A tool for deleting values from JSON data.

    Supports JSONPath expressions to target deletion locations.
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
        Invoke JSON delete tool.

        Args:
            user_id: User ID
            tool_parameters: Tool parameters
            conversation_id: Conversation ID (optional)
            app_id: App ID (optional)
            message_id: Message ID (optional)

        Yields:
            ToolInvokeMessage: Result or error message
        """
        content = tool_parameters.get("content", "")
        if not content:
            yield self.create_text_message("Invalid parameter content")
            return

        query = tool_parameters.get("query", "")
        if not query:
            yield self.create_text_message("Invalid parameter query")
            return

        ensure_ascii = tool_parameters.get("ensure_ascii", True)

        try:
            result = self._delete(content, query, ensure_ascii)
            yield self.create_text_message(str(result))
        except Exception as e:
            yield self.create_text_message(f"Failed to delete JSON content: {e!s}")

    def _delete(self, origin_json: str, query: str, ensure_ascii: bool) -> str:
        """Delete value from JSON data."""
        try:
            input_data = json.loads(origin_json)
            expr = parse("$." + query.lstrip("$."))
            matches = expr.find(input_data)

            if not matches:
                return json.dumps(input_data, ensure_ascii=ensure_ascii)

            for match in matches:
                if isinstance(match.context.value, dict):
                    del match.context.value[match.path.fields[-1]]
                elif isinstance(match.context.value, list):
                    match.context.value.remove(match.value)
                else:
                    parent = match.context.parent
                    if parent:
                        del parent.value[match.path.fields[-1]]

            return json.dumps(input_data, ensure_ascii=ensure_ascii)
        except Exception as e:
            raise Exception(f"Delete operation failed: {e!s}") from e
