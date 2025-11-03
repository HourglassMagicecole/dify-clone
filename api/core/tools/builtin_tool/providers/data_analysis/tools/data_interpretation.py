import base64
from collections.abc import Generator
from typing import Any

from core.tools.builtin_tool.tool import BuiltinTool
from core.tools.entities.tool_entities import ToolInvokeMessage
from extensions.ext_storage import storage

from ..utils.digitforce_api import DigitForceApi

MAX_QUERY_LENGTH = 1000
API_MODULE_NAME = "DataInterpretation"


class DataInterpretationTool(BuiltinTool):
    def _invoke(
        self,
        user_id: str,
        tool_parameters: dict[str, Any],
        conversation_id: str | None = None,
        app_id: str | None = None,
        message_id: str | None = None,
    ) -> Generator[ToolInvokeMessage]:
        try:
            # Retrieve the API key
            api_key = self.runtime.credentials["digitforce_api_key"]
            # Extract variables from the tool_parameters
            query = tool_parameters["query"]
            input_data = tool_parameters.get("input_data")
            file = tool_parameters.get("input_file")

            if not input_data and not file:
                yield self.create_text_message("Please provide input_data or file")
                return

            if len(query) > MAX_QUERY_LENGTH:
                yield self.create_text_message(
                    "The query is too long. Please check if you have entered any incorrect variables"
                )
                return

            post_data = {"query": query, "input_data": input_data}
            if file:
                post_data["file_extension"] = file.extension.lower()
                post_data["file_url"] = file.generate_url()
                # Load file from storage and encode as base64
                file_blob = storage.load(file.storage_key)
                if file_blob:
                    post_data["file_blob"] = base64.b64encode(file_blob).decode("utf-8")
                post_data["sheet_name"] = None  # None means read all sheets

            result = DigitForceApi(api_key).dify_api_post(post_data, service_name=API_MODULE_NAME)
            if result:
                # Yield text message with markdown content
                yield self.create_text_message(result)

                # Yield markdown file as downloadable blob
                try:
                    md_bytes = result.encode("utf-8")
                    yield self.create_blob_message(
                        blob=md_bytes,
                        meta={
                            "mime_type": "text/markdown",
                            "filename": "interpretation_result.md",
                        },
                    )
                except Exception as e:
                    yield self.create_text_message(f"markdown download error: {str(e)}")
            else:
                yield self.create_text_message(
                    "Result is empty.Possible data source or code generation issue. Check input data and retry."
                )
        except Exception as e:
            yield self.create_text_message(str(e))
