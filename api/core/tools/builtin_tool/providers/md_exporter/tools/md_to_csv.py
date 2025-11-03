from collections.abc import Generator
from typing import Any, Optional

from core.tools.builtin_tool.tool import BuiltinTool
from core.tools.entities.tool_entities import ToolInvokeMessage

from ..utils.file_utils import get_meta_data
from ..utils.logger_utils import get_logger
from ..utils.mimetype_utils import MimeType
from ..utils.param_utils import get_md_text
from ..utils.table_utils import TableParser


class MarkdownToCsvTool(BuiltinTool):
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
        output_filename = tool_parameters.get("output_filename")

        # parse markdown to tables
        tables = TableParser.parse_md_to_tables(self.logger, md_text)

        for i, table in enumerate(tables):
            try:
                csv_str = table.to_csv(index=False, encoding="utf-8")
                csv_output_encoding = "utf-8" if csv_str.isascii() else "utf-8-sig"
                result_file_bytes = csv_str.encode(csv_output_encoding)

                # Generate default filename if not provided
                base_filename = output_filename or "table"
                result_filename: Optional[str] = None
                if len(tables) > 1:
                    result_filename = f"{base_filename}_{i + 1}"
                else:
                    result_filename = base_filename

                yield self.create_blob_message(
                    blob=result_file_bytes,
                    meta=get_meta_data(
                        mime_type=MimeType.CSV,
                        output_filename=result_filename,
                    ),
                )
            except Exception as e:
                self.logger.exception("Failed to convert to CSV file")
                yield self.create_text_message(f"Failed to convert markdown text to CSV file, error: {str(e)}")
                return
