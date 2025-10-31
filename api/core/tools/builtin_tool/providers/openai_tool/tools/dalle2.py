import base64
from collections.abc import Generator
from typing import Any

from openai import OpenAI
from yarl import URL

from core.tools.builtin_tool.tool import BuiltinTool
from core.tools.entities.tool_entities import ToolInvokeMessage


class DallE2Tool(BuiltinTool):
    def _invoke(
        self,
        user_id: str,
        tool_parameters: dict[str, Any],
        conversation_id: str | None = None,
        app_id: str | None = None,
        message_id: str | None = None,
    ) -> Generator[ToolInvokeMessage, None, None]:
        """
        Invoke DALL-E 2 image generation tool.

        Args:
            user_id: User ID
            tool_parameters: Tool parameters with 'prompt', 'size', 'n'
            conversation_id: Conversation ID (optional)
            app_id: App ID (optional)
            message_id: Message ID (optional)

        Yields:
            ToolInvokeMessage: Generated image
        """
        openai_organization = self.runtime.credentials.get("openai_organization_id") or None
        openai_base_url = self.runtime.credentials.get("openai_base_url") or None

        if openai_base_url:
            openai_base_url = str(URL(openai_base_url) / "v1")

        client = OpenAI(
            api_key=self.runtime.credentials["openai_api_key"],
            base_url=openai_base_url,
            organization=openai_organization,
        )

        prompt = tool_parameters.get("prompt", "")
        if not prompt:
            yield self.create_text_message("Please input prompt")
            return

        size = tool_parameters.get("size", "1024x1024")
        if size not in {"256x256", "512x512", "1024x1024"}:
            yield self.create_text_message("Invalid size")
            return

        n = tool_parameters.get("n", 1)

        response = client.images.generate(
            prompt=prompt,
            model="dall-e-2",
            size=size,
            n=n,
            response_format="b64_json",  # type: ignore
        )

        for image in response.data:
            if not image.b64_json:
                continue
            mime_type, blob_image = self._decode_image(image.b64_json)
            yield self.create_blob_message(blob=blob_image, meta={"mime_type": mime_type})

    @staticmethod
    def _decode_image(base64_image: str) -> tuple[str, bytes]:
        """Decode a base64 encoded image."""
        if not base64_image.startswith("data:image"):
            return ("image/png", base64.b64decode(base64_image))

        mime_type = base64_image.split(";")[0].split(":")[1]
        image_data_base64 = base64_image.split(",")[1]
        decoded_data = base64.b64decode(image_data_base64)
        return (mime_type, decoded_data)
