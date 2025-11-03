from collections.abc import Generator
from enum import StrEnum
from typing import Any, Optional

from core.tools.builtin_tool.tool import BuiltinTool
from core.tools.entities.tool_entities import ToolInvokeMessage

from ..utils.file_utils import get_meta_data
from ..utils.logger_utils import get_logger
from ..utils.mimetype_utils import MimeType
from ..utils.param_utils import get_md_text
from ..utils.table_utils import TableParser


class JsonOutputStyle(StrEnum):
    JSONL = "jsonl"
    JSON_ARRAY = "json"


class MarkdownToJsonTool(BuiltinTool):
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
        output_style = tool_parameters.get("output_style", JsonOutputStyle.JSONL)

        # parse markdown to tables
        tables = TableParser.parse_md_to_tables(self.logger, md_text)

        for i, table in enumerate(tables):
            try:
                indent, object_per_line = self.get_json_sytles(output_style)
                json_str = table.to_json(
                    index=False, orient="records", force_ascii=False, indent=indent, lines=object_per_line
                )
                result_file_bytes = json_str.encode("utf-8")

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
                        mime_type=MimeType.JSON,
                        output_filename=result_filename,
                    ),
                )
            except Exception as e:
                self.logger.exception("Failed to convert to JSON file")
                yield self.create_text_message(f"Failed to convert markdown text to JSON file, error: {str(e)}")
                return

    def get_json_sytles(self, output_style) -> tuple[int, bool]:
        """
        :return: indent, object_per_line
        """
        match output_style:
            case JsonOutputStyle.JSONL:
                return 0, True
            case _:
                return 0, True
