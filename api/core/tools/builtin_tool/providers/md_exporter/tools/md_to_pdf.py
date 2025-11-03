from collections.abc import Generator
from io import BytesIO
from typing import Any

from core.tools.builtin_tool.tool import BuiltinTool
from core.tools.entities.tool_entities import ToolInvokeMessage

from ..utils.file_utils import get_meta_data
from ..utils.logger_utils import get_logger
from ..utils.md_utils import MarkdownUtils
from ..utils.mimetype_utils import MimeType
from ..utils.param_utils import get_md_text


class MarkdownToPdfTool(BuiltinTool):
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
        from xhtml2pdf import pisa  # pyright: ignore[reportMissingTypeStubs]

        # get parameters
        md_text = get_md_text(tool_parameters, is_strip_wrapper=True)
        try:
            html_str = self._convert_to_html(md_text)
            pdf_buffer = BytesIO()
            pisa_status = pisa.CreatePDF(
                src=html_str,
                dest=pdf_buffer,
                encoding="utf-8",
            )
            if pisa_status.err:
                raise ValueError(f"PDF creation failed with error code: {pisa_status.err}")
            result_file_bytes = pdf_buffer.getvalue()
        except Exception as e:
            self.logger.exception("Failed to convert file")
            yield self.create_text_message(f"Failed to convert markdown text to PDF file, error: {str(e)}")
            return

        # Generate default filename if not provided
        output_filename = tool_parameters.get("output_filename") or "document"

        yield self.create_blob_message(
            blob=result_file_bytes,
            meta=get_meta_data(
                mime_type=MimeType.PDF,
                output_filename=output_filename,
            ),
        )
        return

    @staticmethod
    def _convert_to_html(md_text: str) -> str:
        # convert markdown to html
        html_str = MarkdownUtils.convert_markdown_to_html(md_text)

        if not MarkdownUtils.contains_chinese(md_text) and not MarkdownUtils.contains_japanese(md_text):
            return html_str

        # prepend additional CSS style

        # known available asian fonts in PDF by default (Acrobat Reader)
        # https://xhtml2pdf.readthedocs.io/en/latest/reference.html#asian-fonts-support
        # TODO: make font list configurable
        font_families = ",".join(
            [
                "Sans-serif",  # for English
                "STSong-Light",  # for Simplified Chinese
                "MSung-Light",  # for Traditional Chinese
                "HeiseiMin-W3",  # for Japanese
            ]
        )
        css_style = f"""
        <style>
            html {{
                -pdf-word-wrap: CJK;
                font-family:  "{font_families}"; 
            }}
        </style>
        """

        result = f"""
        {css_style}
        {html_str}
        """
        return result
