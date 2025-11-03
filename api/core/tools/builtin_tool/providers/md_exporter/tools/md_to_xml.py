from collections.abc import Generator
from typing import Any

import markdown
from lxml import etree, html

from core.tools.builtin_tool.tool import BuiltinTool
from core.tools.entities.tool_entities import ToolInvokeMessage

from ..utils.file_utils import get_meta_data
from ..utils.logger_utils import get_logger
from ..utils.mimetype_utils import MimeType
from ..utils.param_utils import get_md_text


class MarkdownToXmlTool(BuiltinTool):
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
        md_text = get_md_text(tool_parameters, is_strip_wrapper=True)
        try:
            html_str = markdown.markdown(text=md_text, extensions=["extra", "toc"])
            xml_element = html.fromstring(html_str)
            result_file_bytes = etree.tostring(
                element_or_tree=xml_element, xml_declaration=True, pretty_print=True, encoding="UTF-8"
            )
        except Exception as e:
            self.logger.exception("Failed to convert to XML file")
            yield self.create_text_message(f"Failed to convert markdown text to XML file, error: {str(e)}")
            return

        # Generate default filename if not provided
        output_filename = tool_parameters.get("output_filename") or "document"

        yield self.create_blob_message(
            blob=result_file_bytes,
            meta=get_meta_data(
                mime_type=MimeType.XML,
                output_filename=output_filename,
            ),
        )
        return
