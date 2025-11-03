import logging
import os
from collections.abc import Generator
from pathlib import Path
from tempfile import NamedTemporaryFile
from typing import Any, Optional

from core.file import File
from core.tools.builtin_tool.tool import BuiltinTool
from core.tools.entities.tool_entities import ToolInvokeMessage

from ..utils.file_utils import get_meta_data
from ..utils.mimetype_utils import MimeType
from ..utils.pandoc_utils import pandoc_convert_file
from ..utils.param_utils import get_md_text


class MarkdownToDocxTool(BuiltinTool):
    logger = logging.getLogger(__name__)

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
        md_text = get_md_text(tool_parameters, is_strip_wrapper=True)
        docx_template_file: Optional[File] = tool_parameters.get("docx_template_file")
        temp_pptx_template_file_path: Optional[str] = None
        if docx_template_file and not isinstance(docx_template_file, File):
            raise ValueError("Not a valid file for pptx template file")

        try:
            if docx_template_file:
                temp_pptx_template_file = NamedTemporaryFile(delete=False)
                temp_pptx_template_file.write(docx_template_file.blob)
                temp_pptx_template_file.close()
                temp_pptx_template_file_path = temp_pptx_template_file.name

            current_script_folder = os.path.split(os.path.realpath(__file__))[0]
            if temp_pptx_template_file_path:
                template_docx_file = temp_pptx_template_file_path
            else:
                template_docx_file = f"{current_script_folder}/template/docx_template.docx"

            # Options for pandoc
            # https://pandoc.org/MANUAL.html#options
            extra_args = [
                "--reference-doc",
                template_docx_file,
            ]
            result_file_bytes = pandoc_convert_file(md_text, dst_format="docx", extra_args=extra_args)

            # Generate default filename if not provided
            output_filename = tool_parameters.get("output_filename") or "converted"

            yield self.create_blob_message(
                blob=result_file_bytes,
                meta=get_meta_data(
                    mime_type=MimeType.DOCX,
                    output_filename=output_filename,
                ),
            )
        except Exception as e:
            self.logger.exception("Failed to convert markdown text to DOCX file")
            yield self.create_text_message(f"Failed to convert markdown text to DOCX file, error: {str(e)}")
            raise e
        finally:
            if temp_pptx_template_file_path:
                Path(temp_pptx_template_file_path).unlink()
