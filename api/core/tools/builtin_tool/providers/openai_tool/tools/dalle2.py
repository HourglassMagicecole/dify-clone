import base64
import logging
from collections.abc import Generator
from typing import Any

from openai import OpenAI
from yarl import URL

from core.tools.builtin_tool.tool import BuiltinTool
from core.tools.entities.tool_entities import ToolInvokeMessage

logger = logging.getLogger(__name__)


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
            yield self.create_text_message(f"Invalid size: {size}. Expected one of: 256x256, 512x512, 1024x1024")
            return

        n = tool_parameters.get("n", 1)

        response = client.images.generate(
            prompt=prompt,
            model="dall-e-2",
            size=size,
            n=n,
            response_format="b64_json",  # type: ignore
        )

        # Record image generation usage
        self._record_image_gen_usage(
            image_count=len(response.data),
            resolution=size,
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

    def _record_image_gen_usage(
        self,
        image_count: int,
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

            # Use runtime context for tool_test scenarios
            # For tool_test, use runtime.account_id (the actual user) instead of user_id ("test_user")
            if self.runtime and self.runtime.invoke_source == "tool_test":
                effective_account_id = self.runtime.account_id
            else:
                effective_account_id = account_id or (self.runtime.account_id if self.runtime else None)
            invoke_source = self.runtime.invoke_source if self.runtime else None
            session_id = self.runtime.session_id if self.runtime else None

            ApiUsageTrackingService.record_image_gen_usage(
                session=db.session,  # type: ignore[arg-type]
                tenant_id=self.runtime.tenant_id,
                model_provider="openai",
                model_id="dall-e-2",
                image_count=image_count,
                quality="standard",  # DALL-E 2 doesn't have quality option
                resolution=resolution,
                tool_name="dalle2",
                app_id=app_id,
                app_name=app_name,
                account_id=effective_account_id,
                session_id=session_id,
                conversation_id=conversation_id,
                message_id=message_id,
                invoke_source=invoke_source,
            )
        except Exception:
            logger.exception("Failed to record DALL-E 2 usage")

    @staticmethod
    def _decode_image(base64_image: str) -> tuple[str, bytes]:
        """Decode a base64 encoded image."""
        if not base64_image.startswith("data:image"):
            return ("image/png", base64.b64decode(base64_image))

        mime_type = base64_image.split(";")[0].split(":")[1]
        image_data_base64 = base64_image.split(",")[1]
        decoded_data = base64.b64decode(image_data_base64)
        return (mime_type, decoded_data)
