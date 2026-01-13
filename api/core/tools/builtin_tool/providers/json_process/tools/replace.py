"""JSON replace tool for modifying values in JSON data."""

import json
from collections.abc import Generator
from typing import Any

from jsonpath_ng import parse  # pyright: ignore[reportMissingTypeStubs]

from core.tools.builtin_tool.tool import BuiltinTool
from core.tools.entities.tool_entities import ToolInvokeMessage


class JSONReplaceTool(BuiltinTool):
    """
    A tool for replacing values in JSON data.

    Supports JSONPath expressions and multiple replace modes (pattern, key, value).
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
        Invoke JSON replace tool.

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

        replace_value = tool_parameters.get("replace_value", "")
        if not replace_value:
            yield self.create_text_message("Invalid parameter replace_value")
            return

        replace_model = tool_parameters.get("replace_model", "")
        if not replace_model:
            yield self.create_text_message("Invalid parameter replace_model")
            return

        value_decode = tool_parameters.get("value_decode", False)
        ensure_ascii = tool_parameters.get("ensure_ascii", True)

        try:
            if replace_model == "pattern":
                replace_pattern = tool_parameters.get("replace_pattern", "")
                if not replace_pattern:
                    yield self.create_text_message("Invalid parameter replace_pattern")
                    return
                result = self._replace_pattern(
                    content, query, replace_pattern, replace_value, ensure_ascii, value_decode
                )
            elif replace_model == "key":
                result = self._replace_key(content, query, replace_value, ensure_ascii)
            elif replace_model == "value":
                result = self._replace_value(content, query, replace_value, ensure_ascii, value_decode)
            else:
                yield self.create_text_message(f"Invalid replace_model: {replace_model}")
                return

            yield self.create_text_message(str(result))
        except Exception:
            yield self.create_text_message("Failed to replace JSON content")

    def _replace_pattern(
        self, content: str, query: str, replace_pattern: str, replace_value: str, ensure_ascii: bool, value_decode: bool
    ) -> str:
        """Replace pattern in matched values."""
        try:
            input_data = json.loads(content)
            expr = parse(query)
            matches = expr.find(input_data)

            for match in matches:
                # Convert to string first to handle non-string values (int, float, etc.)
                new_value = str(match.value).replace(replace_pattern, replace_value)
                if value_decode is True:
                    try:
                        new_value = json.loads(new_value)
                    except json.JSONDecodeError:
                        return "Cannot decode replace value to json object"
                match.full_path.update(input_data, new_value)

            return json.dumps(input_data, ensure_ascii=ensure_ascii)
        except Exception as e:
            return str(e)

    def _replace_key(self, content: str, query: str, replace_value: str, ensure_ascii: bool) -> str:
        """Replace key names in matched objects."""
        try:
            input_data = json.loads(content)
            expr = parse(query)
            matches = expr.find(input_data)

            for match in matches:
                parent = match.context.value
                old_key = match.path.fields[0] if hasattr(match.path, "fields") and match.path.fields else None
                if isinstance(parent, dict) and old_key:
                    if old_key in parent:
                        value = parent.pop(old_key)
                        parent[replace_value] = value
                elif isinstance(parent, list) and old_key:
                    for item in parent:
                        if isinstance(item, dict) and old_key in item:
                            value = item.pop(old_key)
                            item[replace_value] = value

            return json.dumps(input_data, ensure_ascii=ensure_ascii)
        except Exception as e:
            return str(e)

    def _replace_value(
        self, content: str, query: str, replace_value: str, ensure_ascii: bool, value_decode: bool
    ) -> str:
        """Replace values in matched locations."""
        try:
            input_data = json.loads(content)
            expr = parse(query)

            if value_decode is True:
                try:
                    replace_value = json.loads(replace_value)
                except json.JSONDecodeError:
                    return "Cannot decode replace value to json object"

            matches = expr.find(input_data)
            for match in matches:
                match.full_path.update(input_data, replace_value)

            return json.dumps(input_data, ensure_ascii=ensure_ascii)
        except Exception as e:
            return str(e)
