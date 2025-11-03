import re
import zipfile
from collections.abc import Generator
from pathlib import Path
from tempfile import NamedTemporaryFile
from typing import Any

import httpx
import markdown
from bs4 import BeautifulSoup

from core.tools.builtin_tool.tool import BuiltinTool
from core.tools.entities.tool_entities import ToolInvokeMessage

from ..utils.file_utils import get_meta_data
from ..utils.logger_utils import get_logger
from ..utils.mimetype_utils import MimeType
from ..utils.param_utils import get_md_text, get_param_value


class MarkdownToLinkedImageTool(BuiltinTool):
    logger = get_logger(__name__)
    markdown_image_pattern = re.compile(r"!\[.*?]\(.*?\)")

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
        image_urls = self.extract_image_urls(md_text)

        images_for_zip = []
        for url in image_urls:
            try:
                response = httpx.get(url, timeout=120)
                if response.status_code != 200:
                    yield self.create_text_message(
                        f"Failed to download image from URL: {url}, HTTP status code: {response.status_code}"
                    )
                    continue
                if is_compress.lower() == "true":
                    images_for_zip.append(
                        {
                            "blob": response.content,
                            "meta": {
                                "mime_type": response.headers["Content-Type"] or MimeType.PNG,
                            },
                        }
                    )
                else:
                    yield self.create_blob_message(
                        blob=response.content, meta={"mime_type": response.headers["Content-Type"] or MimeType.PNG}
                    )
            except:
                yield self.create_text_message(f"Failed to download image from URL: {url}")
                continue

        if is_compress.lower() == "true":
            with (
                NamedTemporaryFile(suffix=".zip", delete=True) as temp_zip_file,
                zipfile.ZipFile(temp_zip_file.name, mode="w", compression=zipfile.ZIP_DEFLATED) as zip_file,
            ):
                for idx, code_block in enumerate(images_for_zip, 1):
                    blob = code_block["blob"]
                    meta = code_block["meta"]
                    mime_type = meta["mime_type"]
                    suffix = MimeType.get_extension(mime_type)
                    with NamedTemporaryFile(delete=True) as temp_file:
                        temp_file.write(blob)
                        temp_file.flush()
                        zip_file.write(temp_file.name, arcname=f"image_{idx}{suffix}")
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

    def extract_image_urls(self, md_text: str) -> list[str]:
        html = markdown.markdown(text=md_text, extensions=["extra", "toc"])

        image_urls: list[str] = []
        try:
            soup = BeautifulSoup(html, "html.parser")
            img_tags = soup.find_all("img")
            image_urls = [img.get("src") for img in img_tags if img.get("src")]
        except:
            self.logger.exception("Failed to extract image URLs from markdown text by html parser")

            match_image_tags = re.findall(self.markdown_image_pattern, md_text)
            for img in match_image_tags:
                # => ![](xxx.png)
                # <= xxx.png
                url = re.findall(r"\((.*?)\)", img)[0]
                image_urls.append(url)

        result_image_urls = []
        for url in image_urls:
            if not url or not url.lower().startswith("http") or url in result_image_urls:
                continue
            else:
                result_image_urls.append(url)

        return result_image_urls
