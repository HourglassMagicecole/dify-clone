import io
import logging
from collections.abc import Generator
from decimal import Decimal
from typing import Any

from core.model_manager import ModelManager
from core.model_runtime.entities.model_entities import ModelPropertyKey, ModelType
from core.plugin.entities.parameters import PluginParameterOption
from core.tools.builtin_tool.tool import BuiltinTool
from core.tools.entities.common_entities import I18nObject
from core.tools.entities.tool_entities import ToolInvokeMessage, ToolParameter
from services.model_provider_service import ModelProviderService

logger = logging.getLogger(__name__)


class TTSTool(BuiltinTool):
    def _invoke(
        self,
        user_id: str,
        tool_parameters: dict[str, Any],
        conversation_id: str | None = None,
        app_id: str | None = None,
        message_id: str | None = None,
    ) -> Generator[ToolInvokeMessage, None, None]:
        # Get model parameter or use default (first available model)
        model_param = tool_parameters.get("model")
        if not model_param:
            available_models = self.get_available_models()
            if not available_models:
                raise ValueError("No TTS models available. Please configure a TTS model in Settings → Model Provider.")
            # Use first available model as default
            default_provider, default_model, _ = available_models[0]
            model_param = f"{default_provider}#{default_model}"
            logger.info("No model specified, using default: %s", model_param)

        model_parts = model_param.split("#")
        if len(model_parts) != 2:
            raise ValueError(
                f"Invalid model format: '{model_param}'. Expected format: 'provider#model'. "
                "Please select a valid TTS model from the options."
            )

        provider, model = model_parts
        voice = tool_parameters.get(f"voice#{provider}#{model}")
        model_manager = ModelManager()
        if not self.runtime:
            raise ValueError("Runtime is required")
        model_instance = model_manager.get_model_instance(
            tenant_id=self.runtime.tenant_id or "",
            provider=provider,
            model_type=ModelType.TTS,
            model=model,
        )
        if not voice:
            voices = model_instance.get_tts_voices()
            if voices:
                voice = voices[0].get("value")
                if not voice:
                    raise ValueError("Sorry, no voice available.")
            else:
                raise ValueError("Sorry, no voice available.")
        text_content: str = tool_parameters.get("text") or ""  # type: ignore
        logger.info("TTS invoked: provider=%s, model=%s, chars=%d", provider, model, len(text_content))
        tts = model_instance.invoke_tts(
            content_text=text_content,
            user=user_id,
            tenant_id=self.runtime.tenant_id,
            voice=voice,  # type: ignore
        )
        buffer = io.BytesIO()
        for chunk in tts:
            buffer.write(chunk)

        wav_bytes = buffer.getvalue()

        # Record TTS usage
        self._record_tts_usage(
            provider=provider,
            model=model,
            char_count=len(text_content),
            audio_bytes_size=len(wav_bytes),
            app_id=app_id,
            conversation_id=conversation_id,
            message_id=message_id,
        )

        yield self.create_text_message("Audio generated successfully")
        yield self.create_blob_message(
            blob=wav_bytes,
            meta={"mime_type": "audio/x-wav"},
        )

    def _record_tts_usage(
        self,
        provider: str,
        model: str,
        char_count: int,
        audio_bytes_size: int,
        app_id: str | None,
        conversation_id: str | None,
        message_id: str | None,
    ) -> None:
        """Record TTS usage for this tool invocation."""
        try:
            from extensions.ext_database import db
            from models.model import App, Conversation
            from services.api_usage_tracking_service import ApiUsageTrackingService

            if not self.runtime:
                return

            # Estimate audio duration in minutes from WAV bytes
            # Assuming 24kHz, 16-bit mono PCM (OpenAI TTS default)
            # bytes_per_second = 24000 * 2 = 48000
            audio_seconds = audio_bytes_size / 48000
            audio_minutes = Decimal(audio_seconds) / Decimal(60)

            # Get account_id from conversation
            account_id: str | None = None
            if conversation_id:
                conv = db.session.query(Conversation).filter(Conversation.id == conversation_id).first()
                if conv and conv.from_account_id:
                    account_id = str(conv.from_account_id)

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

            ApiUsageTrackingService.record_tts_usage(
                session=db.session,  # type: ignore[arg-type]
                tenant_id=self.runtime.tenant_id or "",
                model_provider=provider,
                model_id=model,
                char_count=char_count,
                audio_minutes=audio_minutes,
                app_id=app_id,
                app_name=app_name,
                account_id=effective_account_id,
                session_id=session_id,
                conversation_id=conversation_id,
                message_id=message_id,
                invoke_source=invoke_source,
            )
        except Exception:
            logger.exception("Failed to record TTS usage for tool")

    def get_available_models(self) -> list[tuple[str, str, list[Any]]]:
        if not self.runtime:
            raise ValueError("Runtime is required")
        model_provider_service = ModelProviderService()
        tid: str = self.runtime.tenant_id or ""
        models = model_provider_service.get_models_by_model_type(tenant_id=tid, model_type="tts")
        items = []
        for provider_model in models:
            provider = provider_model.provider
            for model in provider_model.models:
                voices = model.model_properties.get(ModelPropertyKey.VOICES, [])
                items.append((provider, model.model, voices))
        return items

    def get_runtime_parameters(
        self,
        conversation_id: str | None = None,
        app_id: str | None = None,
        message_id: str | None = None,
    ) -> list[ToolParameter]:
        parameters = []

        options = []
        for provider, model, voices in self.get_available_models():
            option = PluginParameterOption(value=f"{provider}#{model}", label=I18nObject(en_US=f"{model}({provider})"))
            options.append(option)
            parameters.append(
                ToolParameter(
                    name=f"voice#{provider}#{model}",
                    label=I18nObject(en_US=f"Voice of {model}({provider})"),
                    human_description=I18nObject(en_US=f"Select a voice for {model} model"),
                    placeholder=I18nObject(en_US="Select a voice"),
                    type=ToolParameter.ToolParameterType.SELECT,
                    form=ToolParameter.ToolParameterForm.FORM,
                    options=[
                        PluginParameterOption(value=voice.get("mode"), label=I18nObject(en_US=voice.get("name")))
                        for voice in voices
                    ],
                )
            )

        # Set default model if available
        default_model = options[0].value if options else None

        parameters.insert(
            0,
            ToolParameter(
                name="model",
                label=I18nObject(en_US="Model", zh_Hans="Model"),
                human_description=I18nObject(
                    en_US="All available TTS models. You can config model in the Model Provider of Settings.",
                    zh_Hans="所有可用的 TTS 模型。你可以在设置中的모델供应商里配置。",
                ),
                type=ToolParameter.ToolParameterType.SELECT,
                form=ToolParameter.ToolParameterForm.FORM,
                required=False,
                default=default_model,
                placeholder=I18nObject(en_US="Select a model", zh_Hans="选择模型"),
                options=options,
            ),
        )
        return parameters
