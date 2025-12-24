import io
import logging
from collections.abc import Generator
from decimal import Decimal
from typing import Any

from core.file.enums import FileType
from core.file.file_manager import download
from core.model_manager import ModelManager
from core.model_runtime.entities.model_entities import ModelType
from core.plugin.entities.parameters import PluginParameterOption
from core.tools.builtin_tool.tool import BuiltinTool
from core.tools.entities.common_entities import I18nObject
from core.tools.entities.tool_entities import ToolInvokeMessage, ToolParameter
from services.model_provider_service import ModelProviderService

logger = logging.getLogger(__name__)


class ASRTool(BuiltinTool):
    def _invoke(
        self,
        user_id: str,
        tool_parameters: dict[str, Any],
        conversation_id: str | None = None,
        app_id: str | None = None,
        message_id: str | None = None,
    ) -> Generator[ToolInvokeMessage, None, None]:
        file_param = tool_parameters.get("audio_file")
        if not file_param:
            yield self.create_text_message("Audio file is required for speech-to-text conversion")
            return

        # Handle both single file and list of files (system-files sends a list)
        files = file_param if isinstance(file_param, list) else [file_param]

        # Get requested model and all available models for fallback
        requested_model = tool_parameters.get("model")
        if requested_model:
            provider, model = requested_model.split("#")
        else:
            # Use first available model if not specified
            available = self.get_available_models()
            if not available:
                yield self.create_text_message("No STT models available")
                return
            provider, model = available[0]

        logger.info("STT invoked: provider=%s, model=%s, files=%d", provider, model, len(files))

        # Process all files
        results = []
        for idx, file in enumerate(files, 1):
            # Accept only AUDIO type files (mp3, wav)
            if file.type != FileType.AUDIO:  # type: ignore
                yield self.create_text_message(f"File {idx} is not a valid audio file")
                continue

            audio_content = download(file)  # type: ignore
            file_extension = file.extension or ".mp3"  # type: ignore

            # Try transcription with fallback to other models
            text, used_provider, used_model = self._transcribe_with_fallback(
                audio_content=audio_content,
                file_extension=file_extension,
                user_id=user_id,
                primary_provider=provider,
                primary_model=model,
            )

            if text is None:
                yield self.create_text_message(
                    f"File {idx}: Failed to transcribe with all available models. "
                    "The audio format may not be supported."
                )
                continue

            # Record STT usage with the model that actually succeeded
            self._record_stt_usage(
                provider=used_provider,
                model=used_model,
                file_size=len(audio_content),
                app_id=app_id,
                conversation_id=conversation_id,
                message_id=message_id,
            )

            # Include file name if available, otherwise use index
            file_name = getattr(file, "filename", None) or f"File {idx}"
            results.append(f"[{file_name}]: {text}")

        # Return all results combined
        if results:
            yield self.create_text_message("\n\n".join(results))

    def _transcribe_with_fallback(
        self,
        audio_content: bytes,
        file_extension: str,
        user_id: str,
        primary_provider: str,
        primary_model: str,
    ) -> tuple[str | None, str, str]:
        """
        Try to transcribe audio with the primary model, falling back to other models on failure.

        Returns:
            Tuple of (transcribed_text, used_provider, used_model).
            If all models fail, returns (None, "", "").
        """
        model_manager = ModelManager()

        # Build list of models to try: primary first, then others
        available_models = self.get_available_models()
        models_to_try = [(primary_provider, primary_model)]

        for prov, mod in available_models:
            if (prov, mod) != (primary_provider, primary_model):
                models_to_try.append((prov, mod))

        last_error: Exception | None = None

        for prov, mod in models_to_try:
            try:
                model_instance = model_manager.get_model_instance(
                    tenant_id=self.runtime.tenant_id,
                    provider=prov,
                    model_type=ModelType.SPEECH2TEXT,
                    model=mod,
                )

                # Create fresh BytesIO for each attempt
                audio_binary = io.BytesIO(audio_content)
                audio_binary.name = f"temp{file_extension}"

                text = model_instance.invoke_speech2text(
                    file=audio_binary,
                    user=user_id,
                )

                if (prov, mod) != (primary_provider, primary_model):
                    logger.info(
                        "STT fallback succeeded: primary=%s#%s failed, used=%s#%s",
                        primary_provider,
                        primary_model,
                        prov,
                        mod,
                    )

                return text, prov, mod

            except Exception as e:
                last_error = e
                logger.warning("STT model %s#%s failed: %s. Trying next model...", prov, mod, str(e)[:100])
                continue

        # All models failed
        if last_error:
            logger.error("All STT models failed. Last error: %s", str(last_error))

        return None, "", ""

    def _record_stt_usage(
        self,
        provider: str,
        model: str,
        file_size: int,
        app_id: str | None,
        conversation_id: str | None,
        message_id: str | None,
    ) -> None:
        """Record STT usage for this tool invocation."""
        try:
            from extensions.ext_database import db
            from models.model import App, Conversation
            from services.api_usage_tracking_service import ApiUsageTrackingService

            # Estimate audio duration in minutes (rough estimate based on file size)
            # Assuming average bitrate of 128kbps for MP3
            estimated_minutes = Decimal(file_size) / Decimal(128 * 1024 / 8 * 60)

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

            ApiUsageTrackingService.record_stt_usage(
                session=db.session,  # type: ignore[arg-type]
                tenant_id=self.runtime.tenant_id,
                model_provider=provider,
                model_id=model,
                estimated_minutes=estimated_minutes,
                app_id=app_id,
                app_name=app_name,
                account_id=effective_account_id,
                session_id=session_id,
                conversation_id=conversation_id,
                message_id=message_id,
                invoke_source=invoke_source,
            )
        except Exception:
            logger.exception("Failed to record STT usage for tool")

    def get_available_models(self) -> list[tuple[str, str]]:
        model_provider_service = ModelProviderService()
        models = model_provider_service.get_models_by_model_type(
            tenant_id=self.runtime.tenant_id, model_type="speech2text"
        )
        items = []
        for provider_model in models:
            provider = provider_model.provider
            for model in provider_model.models:
                items.append((provider, model.model))
        return items

    def get_runtime_parameters(
        self,
        conversation_id: str | None = None,
        app_id: str | None = None,
        message_id: str | None = None,
    ) -> list[ToolParameter]:
        parameters = []

        # Add audio_file parameter (system-files type for auto-injection)
        parameters.append(
            ToolParameter(
                name="audio_file",
                label=I18nObject(en_US="Audio File", zh_Hans="音频文件", ko_KR="오디오 파일"),
                human_description=I18nObject(
                    en_US="The audio file to be converted.",
                    zh_Hans="要转换的音频文件。",
                    ko_KR="변환할 오디오 파일입니다.",
                ),
                type=ToolParameter.ToolParameterType.SYSTEM_FILES,
                form=ToolParameter.ToolParameterForm.LLM,
                required=False,
            )
        )

        options = []
        for provider, model in self.get_available_models():
            option = PluginParameterOption(value=f"{provider}#{model}", label=I18nObject(en_US=f"{model}({provider})"))
            options.append(option)

        # Set default model if available
        default_model = options[0].value if options else None

        parameters.append(
            ToolParameter(
                name="model",
                label=I18nObject(en_US="Model", zh_Hans="Model"),
                human_description=I18nObject(
                    en_US="All available ASR models. You can config model in the Model Provider of Settings.",
                    zh_Hans="所有可用的 ASR 模型。你可以在设置中的模델供应商里配置。",
                ),
                type=ToolParameter.ToolParameterType.SELECT,
                form=ToolParameter.ToolParameterForm.FORM,
                required=False,
                default=default_model,
                options=options,
            )
        )
        return parameters
