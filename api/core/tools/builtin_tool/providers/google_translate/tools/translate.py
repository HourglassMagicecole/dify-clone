"""Google Translate tool for text translation."""

from collections.abc import Generator
from typing import Any

import requests

from core.tools.builtin_tool.tool import BuiltinTool
from core.tools.entities.tool_entities import ToolInvokeMessage


class GoogleTranslate(BuiltinTool):
    """
    A tool for translating text using Google Translate API.
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
        Invoke Google Translate tool.

        Args:
            user_id: User ID
            tool_parameters: Tool parameters with 'content' and 'dest'
            conversation_id: Conversation ID (optional)
            app_id: App ID (optional)
            message_id: Message ID (optional)

        Yields:
            ToolInvokeMessage: Translation result or error message
        """
        content = tool_parameters.get("content", "")
        if not content:
            yield self.create_text_message("Invalid parameter content")
            return

        dest = tool_parameters.get("dest", "")

        # Handle custom destination language
        if dest == "custom":
            dest = tool_parameters.get("custom_dest", "")
            if not dest:
                yield self.create_text_message("Please provide a custom destination language code")
                return
        elif not dest:
            yield self.create_text_message("Invalid parameter destination language")
            return

        try:
            result = self._translate(content, dest)
            yield self.create_text_message(str(result))
        except Exception as e:
            yield self.create_text_message(f"Translation service error: {e!s}")

    def _translate(self, content: str, dest: str) -> str:
        """
        Translate text using Google Translate API.

        Args:
            content: Text to translate
            dest: Destination language code

        Returns:
            str: Translated text or error message
        """
        try:
            url = "https://translate.googleapis.com/translate_a/single"
            params = {"client": "gtx", "sl": "auto", "tl": dest, "dt": "t", "q": content}
            headers = {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
            }
            response = requests.get(url, params=params, headers=headers, timeout=30)
            response.raise_for_status()  # Raise an exception for bad status codes

            response_json = response.json()
            result = response_json[0]
            translated_text = "".join([item[0] for item in result if item[0]])
            return str(translated_text)
        except requests.exceptions.RequestException as e:
            return f"Network error: {e!s}"
        except (KeyError, IndexError, TypeError) as e:
            return f"Error parsing translation response: {e!s}"
        except Exception as e:
            return f"Unexpected error: {e!s}"
