import re
import zipfile
from collections.abc import Generator
from pathlib import Path
from tempfile import NamedTemporaryFile
from typing import Any

from core.tools.builtin_tool.tool import BuiltinTool
from core.tools.entities.tool_entities import ToolInvokeMessage

from ..utils.codeblock import CodeBlock
from ..utils.file_utils import get_meta_data
from ..utils.logger_utils import get_logger
from ..utils.mimetype_utils import MimeType
from ..utils.param_utils import get_md_text, get_param_value


class MarkdownToCodeblockTool(BuiltinTool):
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
        is_compress = get_param_value(tool_parameters, "is_compress", "true")

        # extract code blocks
        code_blocks = self.extract_code_blocks(md_text)

        if is_compress.lower() == "true":
            with (
                NamedTemporaryFile(suffix=".zip", delete=True) as temp_zip_file,
                zipfile.ZipFile(temp_zip_file.name, mode="w", compression=zipfile.ZIP_DEFLATED) as zip_file,
            ):
                for idx, code_block in enumerate(code_blocks, 1):
                    suffix = self.get_suffix_by_language(code_block.lang_type)
                    with NamedTemporaryFile(prefix=f"code_{idx}", suffix=suffix, delete=True) as temp_file:
                        temp_file.write(code_block.code_bytes)
                        temp_file.flush()
                        zip_file.write(temp_file.name, arcname=f"code_{idx}{suffix}")
                zip_file.close()
                zip_filename = zip_file.filename
                if zip_filename is None:
                    raise ValueError("Failed to create zip file")
                yield self.create_blob_message(
                    blob=Path(zip_filename).read_bytes(),
                    meta=get_meta_data(
                        mime_type=MimeType.ZIP,
                        output_filename=tool_parameters.get("output_filename"),
                    ),
                )
        else:
            for index, code_block in enumerate(code_blocks):
                base_filename = tool_parameters.get("output_filename") or "code"
                suffix = ("_" + str(index + 1)) if len(code_blocks) > 1 else ""
                yield self.create_blob_message(
                    blob=code_block.code_bytes,
                    meta=get_meta_data(
                        mime_type=self.get_mime_type(code_block.lang_type),
                        output_filename=base_filename + suffix,
                    ),
                )

    @staticmethod
    def extract_code_blocks(text: str) -> list[CodeBlock]:
        code_blocks: list[CodeBlock] = []
        # Extract language type and code content
        pattern = re.compile(r"```([a-zA-Z0-9\+#\-_]*)\s*\n(.*?)\n```", re.DOTALL)

        for match in pattern.finditer(text):
            lang_type = match.group(1).strip() or "text"
            code_content = match.group(2).strip()

            code_blocks.append(CodeBlock(lang_type, code_content))

        return code_blocks

    @staticmethod
    def get_mime_type(lang_type: str) -> MimeType:
        mime_types = {
            "css": MimeType.CSS,
            "csv": MimeType.CSV,
            "python": MimeType.PY,
            "json": MimeType.JSON,
            "javascript": MimeType.JS,
            "bash": MimeType.SH,
            "sh": MimeType.SH,
            "svg": MimeType.SVG,
            "xml": MimeType.XML,
            "html": MimeType.HTML,
            "ruby": MimeType.RUBY,
            "markdown": MimeType.MD,
            "yaml": MimeType.YAML,
            "php": MimeType.PHP,
            "java": MimeType.JAVA,
        }
        return mime_types.get(lang_type.lower(), MimeType.TXT)

    @staticmethod
    def get_suffix_by_language(lang_type: str) -> str:
        suffixes = {
            "css": ".css",
            "csv": ".csv",
            "python": ".py",
            "json": ".json",
            "javascript": ".js",
            "bash": ".sh",
            "sh": ".sh",
            "svg": ".svg",
            "xml": ".xml",
            "html": ".html",
            "markdown": ".md",
            "yaml": ".yaml",
            "ruby": ".rb",
            "php": ".php",
            "java": ".java",
        }
        return suffixes.get(lang_type.lower(), ".txt")
