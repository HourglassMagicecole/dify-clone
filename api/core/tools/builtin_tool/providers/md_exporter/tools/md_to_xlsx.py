from collections.abc import Generator
from pathlib import Path
from tempfile import NamedTemporaryFile
from typing import Any

import pandas as pd

from core.tools.builtin_tool.tool import BuiltinTool
from core.tools.entities.tool_entities import ToolInvokeMessage

from ..utils.file_utils import get_meta_data
from ..utils.logger_utils import get_logger
from ..utils.mimetype_utils import MimeType
from ..utils.param_utils import get_md_text, get_param_value
from ..utils.table_utils import SUGGESTED_SHEET_NAME, TableParser


class MarkdownToXlsxTool(BuiltinTool):
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
        force_text_value: bool = get_param_value(tool_parameters, "force_text_value", "true").lower() == "true"

        # parse markdown to tables
        tables = TableParser.parse_md_to_tables(self.logger, md_text=md_text, force_value_to_str=force_text_value)

        # generate XLSX file
        try:
            with NamedTemporaryFile(suffix=".xlsx", delete=True) as temp_xlsx_file:
                with pd.ExcelWriter(temp_xlsx_file) as writer:
                    for i, table in enumerate(tables):
                        sheet_name = table.attrs.get(SUGGESTED_SHEET_NAME, f"Sheet{i + 1}")
                        table.to_excel(writer, sheet_name=sheet_name, index=False, na_rep="")
                        writer.sheets[sheet_name].autofit(max_width=200)

                result_file_bytes = Path(temp_xlsx_file.name).read_bytes()

            # Generate default filename if not provided
            output_filename = tool_parameters.get("output_filename") or "spreadsheet"

            yield self.create_blob_message(
                blob=result_file_bytes,
                meta=get_meta_data(
                    mime_type=MimeType.XLSX,
                    output_filename=output_filename,
                ),
            )
        except Exception as e:
            self.logger.exception("Failed to convert file")
            yield self.create_text_message(f"Failed to convert markdown text to XLSX file, error: {str(e)}")
            return
