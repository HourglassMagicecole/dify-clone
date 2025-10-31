import json
from collections.abc import Generator
from typing import Any

import requests

from core.tools.builtin_tool.tool import BuiltinTool
from core.tools.entities.tool_entities import ToolInvokeMessage


class OpenweatherTool(BuiltinTool):
    def _invoke(
        self,
        user_id: str,
        tool_parameters: dict[str, Any],
        conversation_id: str | None = None,
        app_id: str | None = None,
        message_id: str | None = None,
    ) -> Generator[ToolInvokeMessage, None, None]:
        """
        Invoke OpenWeather tool.

        Args:
            user_id: User ID
            tool_parameters: Tool parameters with 'city', 'units', 'lang'
            conversation_id: Conversation ID (optional)
            app_id: App ID (optional)
            message_id: Message ID (optional)

        Yields:
            ToolInvokeMessage: Weather data
        """
        city = tool_parameters.get("city", "")
        if not city:
            yield self.create_text_message("Please tell me your city")
            return

        if "api_key" not in self.runtime.credentials or not self.runtime.credentials.get("api_key"):
            yield self.create_text_message("OpenWeather API key is required.")
            return

        units = tool_parameters.get("units", "metric")
        lang = tool_parameters.get("lang", "zh_cn")

        try:
            url = "https://api.openweathermap.org/data/2.5/weather"
            params = {
                "q": city,
                "appid": self.runtime.credentials.get("api_key"),
                "units": units,
                "lang": lang,
            }
            response = requests.get(url, params=params, timeout=30)

            if response.status_code == 200:
                data = response.json()
                yield self.create_text_message(json.dumps(data, ensure_ascii=False, indent=2))
            else:
                error_message = {"error": f"failed:{response.status_code}", "data": response.text}
                yield self.create_text_message(json.dumps(error_message))
        except Exception as e:
            yield self.create_text_message(f"OpenWeather API error: {e}")
