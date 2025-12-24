import base64
import logging
from collections.abc import Generator
from typing import Any

from openai import OpenAI
from yarl import URL

from core.tools.builtin_tool.tool import BuiltinTool
from core.tools.entities.tool_entities import ToolInvokeMessage

logger = logging.getLogger(__name__)


class GPTImageGenerateTool(BuiltinTool):
    def _invoke(
        self,
        user_id: str,
        tool_parameters: dict[str, Any],
        conversation_id: str | None = None,
        app_id: str | None = None,
        message_id: str | None = None,
    ) -> Generator[ToolInvokeMessage, None, None]:
        """
        Invoke GPT Image Generate tool.

        Args:
            user_id: User ID
            tool_parameters: Tool parameters with 'prompt' and optional settings
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

        generation_args: dict[str, Any] = {
            "model": "dall-e-3",
            "prompt": prompt,
            "response_format": "b64_json",
        }

        # Optional parameters
        size = tool_parameters.get("size", "1024x1024")
        if size != "auto":
            generation_args["size"] = size

        quality = tool_parameters.get("quality", "standard")
        if quality != "auto":
            generation_args["quality"] = quality

        try:
            response = client.images.generate(**generation_args)

            # Record image generation usage
            self._record_image_gen_usage(
                image_count=len(response.data),
                quality=quality if quality != "auto" else "standard",
                resolution=size if size != "auto" else "1024x1024",
                app_id=app_id,
                account_id=user_id,
                conversation_id=conversation_id,
                message_id=message_id,
            )

            for image in response.data:
                if not image.b64_json:
                    continue
                mime_type, blob_image = self._decode_image(image.b64_json)
                yield self.create_blob_message(blob=blob_image, meta={"mime_type": mime_type})

        except Exception as e:
            yield self.create_text_message(f"Failed to generate image: {str(e)}")

    def _record_image_gen_usage(
        self,
        image_count: int,
        quality: str,
        resolution: str,
        app_id: str | None = None,
        account_id: str | None = None,
        conversation_id: str | None = None,
        message_id: str | None = None,
    ) -> None:
        """Record image generation usage."""
        if not self.runtime or not self.runtime.tenant_id:
            return

        try:
            from extensions.ext_database import db
            from models.model import App
            from services.api_usage_tracking_service import ApiUsageTrackingService

            # Get app_name from app_id
            app_name: str | None = None
            if app_id:
                app = db.session.query(App).filter(App.id == app_id).first()
                if app:
                    app_name = app.name

            ApiUsageTrackingService.record_image_gen_usage(
                session=db.session,  # type: ignore[arg-type]
                tenant_id=self.runtime.tenant_id,
                model_provider="openai",
                model_id="dall-e-3",
                image_count=image_count,
                quality=quality,
                resolution=resolution,
                tool_name="gpt_image_generate",
                app_id=app_id,
                app_name=app_name,
                account_id=account_id,
                conversation_id=conversation_id,
                message_id=message_id,
            )
        except Exception:
            logger.exception("Failed to record GPT Image Generate usage")

    @staticmethod
    def _decode_image(base64_image: str) -> tuple[str, bytes]:
        """Decode a base64 encoded image."""
        if not base64_image.startswith("data:image"):
            return ("image/png", base64.b64decode(base64_image))

        mime_type = base64_image.split(";")[0].split(":")[1]
        image_data_base64 = base64_image.split(",")[1]
        decoded_data = base64.b64decode(image_data_base64)
        return (mime_type, decoded_data)
