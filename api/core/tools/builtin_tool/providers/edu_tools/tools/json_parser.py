"""JSON Parser tool for parsing and extracting data from JSON strings."""

import json
from collections.abc import Generator
from typing import Any

from core.tools.builtin_tool.tool import BuiltinTool
from core.tools.entities.tool_entities import ToolInvokeMessage
from core.tools.errors import ToolInvokeError


class JsonParserTool(BuiltinTool):
    """
    A tool for parsing JSON strings and extracting data using simple JSONPath expressions.

    Supports:
    - Parsing valid JSON strings
    - Extracting nested fields using dot notation (e.g., "data.name", "users.0.email")
    - Array access using numeric indices

    Examples:
    - json_string: '{"name": "Alice", "age": 30}'
      json_path: "" → Returns entire parsed JSON
    - json_string: '{"data": {"name": "Bob"}}'
      json_path: "data.name" → Returns "Bob"
    - json_string: '{"users": [{"email": "test@example.com"}]}'
      json_path: "users.0.email" → Returns "test@example.com"
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
        Invoke JSON parser tool.

        Args:
            user_id: The user ID
            tool_parameters: Tool parameters containing 'json_string' and optional 'json_path'
            conversation_id: Optional conversation ID
            app_id: Optional app ID
            message_id: Optional message ID

        Yields:
            ToolInvokeMessage: Parsed JSON result or extracted value

        Raises:
            ToolInvokeError: If JSON is invalid or path extraction fails
        """
        # Extract parameters
        json_string = tool_parameters.get("json_string", "")
        json_path = tool_parameters.get("json_path", "").strip()

        # Validate input
        if not json_string:
            yield self.create_text_message("Please provide a JSON string to parse")
            return

        # Parse JSON
        try:
            parsed_data = json.loads(json_string)
        except json.JSONDecodeError as e:
            raise ToolInvokeError(f"Invalid JSON: {e!s}")

        # If no path specified, return entire parsed JSON
        if not json_path:
            result = json.dumps(parsed_data, ensure_ascii=False, indent=2)
            yield self.create_text_message(f"Parsed JSON:\n{result}")
            return

        # Extract data using JSONPath (simple dot notation)
        try:
            result = self._extract_json_path(parsed_data, json_path)

            # Format result
            if isinstance(result, (dict, list)):
                formatted_result = json.dumps(result, ensure_ascii=False, indent=2)
                yield self.create_text_message(f"Extracted value:\n{formatted_result}")
            else:
                # Primitive value
                yield self.create_text_message(f"Extracted value: {result}")

        except KeyError as e:
            raise ToolInvokeError(f"Key not found in JSON: {e!s}")
        except IndexError as e:
            raise ToolInvokeError(f"Index out of range: {e!s}")
        except Exception as e:
            raise ToolInvokeError(f"Failed to extract data: {e!s}")

    def _extract_json_path(self, data: Any, path: str) -> Any:
        """
        Extract data from JSON using simple dot notation path.

        Supports:
        - Dot notation for nested objects: "data.user.name"
        - Array indices: "users.0.email"

        Args:
            data: Parsed JSON data (dict, list, or primitive)
            path: Dot-separated path (e.g., "data.name" or "users.0.email")

        Returns:
            Extracted value

        Raises:
            KeyError: If key not found in dictionary
            IndexError: If array index out of range
            TypeError: If trying to access non-dict/list as dict/list
        """
        if not path:
            return data

        # Split path by dots
        keys = path.split(".")

        current = data
        for key in keys:
            # Check if key is an array index (numeric)
            if key.isdigit():
                index = int(key)
                if not isinstance(current, list):
                    raise TypeError(f"Cannot use index '{key}' on non-list value")
                if index < 0 or index >= len(current):
                    raise IndexError(f"Array index {index} out of range (length: {len(current)})")
                current = current[index]
            else:
                # Dictionary key access
                if not isinstance(current, dict):
                    raise TypeError(f"Cannot access key '{key}' on non-dictionary value")
                if key not in current:
                    raise KeyError(key)
                current = current[key]

        return current
