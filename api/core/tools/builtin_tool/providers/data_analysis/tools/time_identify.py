from collections.abc import Generator
from typing import Any

from core.tools.builtin_tool.tool import BuiltinTool
from core.tools.entities.tool_entities import ToolInvokeMessage

from ..utils.digitforce_api import DigitForceApi


class TimeIdentifyTool(BuiltinTool):
    def _invoke(
        self,
        user_id: str,
        tool_parameters: dict[str, Any],
        conversation_id: str | None = None,
        app_id: str | None = None,
        message_id: str | None = None,
    ) -> Generator[ToolInvokeMessage]:
        try:
            api_key = self.runtime.credentials["digitforce_api_key"]
            query = tool_parameters["query"]
            if len(query) > 10000:
                yield self.create_json_message(
                    {"message": "The query is too long. Please check if you have entered any incorrect variables"}
                )
            result = DigitForceApi(api_key).dify_api_post({"query": query}, "TimeIdentify")
            if result:
                yield self.create_json_message(result)
            else:
                yield self.create_json_message({"message": "response is empty"})
        except Exception as e:
            yield self.create_text_message(str(e))
