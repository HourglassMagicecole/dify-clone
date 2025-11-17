import io
from collections.abc import Generator
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

        provider, model = tool_parameters.get("model").split("#")  # type: ignore
        model_manager = ModelManager()
        model_instance = model_manager.get_model_instance(
            tenant_id=self.runtime.tenant_id,
            provider=provider,
            model_type=ModelType.SPEECH2TEXT,
            model=model,
        )

        # Process all files
        results = []
        for idx, file in enumerate(files, 1):
            if file.type != FileType.AUDIO:  # type: ignore
                yield self.create_text_message(f"File {idx} is not a valid audio file")
                continue

            audio_binary = io.BytesIO(download(file))  # type: ignore
            # Use the actual file extension from the uploaded file
            # This fixes the issue where all files were treated as .mp3
            audio_binary.name = f"temp{file.extension}" if file.extension else "temp.mp3"  # type: ignore

            text = model_instance.invoke_speech2text(
                file=audio_binary,
                user=user_id,
            )
            # Include file name if available, otherwise use index
            file_name = getattr(file, "filename", None) or f"File {idx}"
            results.append(f"[{file_name}]: {text}")

        # Return all results combined
        if results:
            yield self.create_text_message("\n\n".join(results))

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
