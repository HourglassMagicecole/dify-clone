"""MarkItDown tool for converting files to markdown format."""

import base64
import os
import re
import tempfile
from collections.abc import Generator
from typing import Any

from markitdown import MarkItDown

from core.file.file_manager import download
from core.tools.builtin_tool.tool import BuiltinTool
from core.tools.entities.tool_entities import ToolInvokeMessage


class MarkitdownTool(BuiltinTool):
    """
    A tool for converting various file formats to markdown.
    """

    def _invoke(
        self,
        user_id: str,
        tool_parameters: dict[str, Any],
        conversation_id: str | None = None,
        app_id: str | None = None,
        message_id: str | None = None,
    ) -> Generator[ToolInvokeMessage, None, None]:
        """
        Invoke MarkItDown conversion tool.

        Args:
            user_id: User ID
            tool_parameters: Tool parameters with 'files'
            conversation_id: Conversation ID (optional)
            app_id: App ID (optional)
            message_id: Message ID (optional)

        Yields:
            ToolInvokeMessage: Conversion results or error messages
        """
        files = tool_parameters.get("files", [])

        # Handle empty files array
        if not files:
            yield self.create_text_message("No files provided")
            return

        results = []

        # Process each file
        for idx, file in enumerate(files):
            # Handle both File objects and base64 strings
            if isinstance(file, str):
                # Base64 string from frontend
                file_blob, file_extension, filename = self._parse_base64_file(file, idx)
            else:
                # File object - download the file content
                file_blob = download(file)
                file_extension = file.extension or ".tmp"
                filename = file.filename or f"file_{idx}"

            try:
                with tempfile.NamedTemporaryFile(delete=False, suffix=file_extension) as temp_file:
                    temp_file.write(file_blob)
                    temp_file_path = temp_file.name

                try:
                    md = MarkItDown()
                    result = md.convert(temp_file_path)

                    if result and hasattr(result, "text_content"):
                        results.append({"filename": filename, "content": result.text_content})
                    else:
                        error_msg = f"Conversion failed for file {filename}. Result: {result}"
                        yield self.create_text_message(text=error_msg)

                finally:
                    if os.path.exists(temp_file_path):
                        os.unlink(temp_file_path)

            except Exception as e:
                error_msg = f"Error processing file {filename}: {e!s}"
                yield self.create_text_message(text=error_msg)

        # Return text results based on number of files processed
        if len(results) == 0:
            yield self.create_text_message("No files were successfully processed")
        elif len(results) == 1:
            yield self.create_text_message(results[0]["content"])
        else:
            combined_content = ""
            for idx, result in enumerate(results, 1):
                combined_content += f"\n{'=' * 50}\n"
                combined_content += f"File {idx}: {result['filename']}\n"
                combined_content += f"{'=' * 50}\n\n"
                combined_content += result["content"]
                combined_content += "\n\n"

            yield self.create_text_message(combined_content.strip())

    def _parse_base64_file(self, base64_string: str, index: int) -> tuple[bytes, str, str]:
        """
        Parse base64 file string from frontend.

        Args:
            base64_string: Base64 data URL (e.g., "data:application/msword;base64,...")
            index: File index for default naming

        Returns:
            Tuple of (file_blob, file_extension, filename)
        """
        # Extract MIME type and base64 data
        # Format: data:mime/type;base64,actual_base64_data
        match = re.match(r"data:([^;]+);base64,(.+)", base64_string)
        if not match:
            raise ValueError("Invalid base64 file format")

        mime_type = match.group(1)
        base64_data = match.group(2)

        # Decode base64
        file_blob = base64.b64decode(base64_data)

        # Map MIME type to file extension
        mime_to_ext = {
            # Office documents
            "application/msword": ".doc",
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document": ".docx",
            "application/vnd.ms-excel": ".xls",
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": ".xlsx",
            "application/vnd.ms-powerpoint": ".ppt",
            "application/vnd.openxmlformats-officedocument.presentationml.presentation": ".pptx",
            # PDF
            "application/pdf": ".pdf",
            # Images
            "image/png": ".png",
            "image/jpeg": ".jpg",
            "image/jpg": ".jpg",
            "image/gif": ".gif",
            # Text
            "text/plain": ".txt",
            "text/html": ".html",
            "text/csv": ".csv",
            "text/markdown": ".md",
        }

        file_extension = mime_to_ext.get(mime_type, ".tmp")
        filename = f"file_{index + 1}{file_extension}"

        return file_blob, file_extension, filename
