from collections.abc import Generator
from typing import Any

from core.tools.builtin_tool.tool import BuiltinTool
from core.tools.entities.tool_entities import ToolInvokeMessage

from ..utils.file_utils import get_meta_data
from ..utils.logger_utils import get_logger
from ..utils.mimetype_utils import MimeType
from ..utils.pandoc_utils import pandoc_convert_text
from ..utils.param_utils import get_md_text


class MarkdownToHtmlTool(BuiltinTool):
    logger = get_logger(__name__)

    def _invoke(
        self,
        user_id: str,
        tool_parameters: dict[str, Any],
        conversation_id: str | None = None,
        app_id: str | None = None,
        message_id: str | None = None,
    ) -> Generator[ToolInvokeMessage, None, None]:
        """
        invoke tools
        """
        # get parameters
        md_text = get_md_text(tool_parameters)

        try:
            result_file_bytes = pandoc_convert_text(md_text, "html")

            # Generate default filename if not provided
            output_filename = tool_parameters.get("output_filename") or "document"

            yield self.create_blob_message(
                blob=result_file_bytes,
                meta=get_meta_data(
                    mime_type=MimeType.HTML,
                    output_filename=output_filename,
                ),
            )
        except Exception as e:
            self.logger.exception("Failed to convert file")
            yield self.create_text_message(f"Failed to convert markdown text to HTML file, error: {str(e)}")
            raise e
