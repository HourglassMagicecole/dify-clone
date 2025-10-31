"""Tool Registry Service for managing educational tools."""

import base64
import uuid
from typing import Any

from core.app.entities.app_invoke_entities import InvokeFrom
from core.file.enums import FileTransferMethod, FileType
from core.file.models import File
from core.tools.__base.tool_runtime import ToolRuntime
from core.tools.entities.tool_entities import ToolInvokeFrom, ToolInvokeMessage
from core.tools.tool_manager import ToolManager
from extensions.ext_storage import storage


class ToolRegistryService:
    """
    Service for managing educational tool registry.

    Provides methods to:
    - List available educational tools
    - Get detailed information about specific tools
    - Test tools with sample parameters
    - Check tool availability (API key requirements)
    """

    @staticmethod
    def list_edu_tools(tenant_id: str) -> list[dict[str, Any]]:
        """
        List all educational tools available for the tenant.

        Returns tools from the edu_tools provider and other allowed providers
        (webscraper, audio, time).

        Args:
            tenant_id: The tenant ID

        Returns:
            list[dict[str, Any]]: List of tool provider dictionaries with tools
        """
        # Get all hardcoded builtin tool providers (skip plugin providers to avoid daemon errors)
        all_providers = list(ToolManager.list_hardcoded_providers())

        # Filter for educational tools
        # Include: edu_tools (our custom provider) and select Dify providers
        allowed_providers = [
            "edu_tools",      # 교육용 기본 도구 (calculator, url_scraper, json_parser)
            "webscraper",     # URL 스크래핑
            "audio",          # TTS/STT
            "time",           # 시간 관련 도구
            "google",         # Google 검색
            "openai_tool",    # OpenAI 도구
            "openweather",    # 날씨 정보
            "wikipedia",      # Wikipedia 검색
            "yahoo",          # Yahoo 도구
        ]

        edu_tools: list[dict[str, Any]] = []
        for provider_controller in all_providers:
            provider_name = provider_controller.entity.identity.name

            # Only include allowed providers
            if provider_name in allowed_providers:
                # Convert provider to dict format
                provider_dict = {
                    "name": provider_name,
                    "label": provider_controller.entity.identity.label.model_dump()
                    if hasattr(provider_controller.entity.identity.label, "model_dump")
                    else provider_controller.entity.identity.label,
                    "icon": provider_controller.entity.identity.icon,
                    "tools": [],
                }

                # Add tools with availability information
                for tool in provider_controller.tools:
                    tool_name = tool.entity.identity.name

                    # Check tool availability (API key requirements)
                    availability = ToolRegistryService.check_tool_availability(
                        tenant_id=tenant_id,
                        provider=provider_name,
                        tool_name=tool_name,
                    )

                    tool_dict = {
                        "name": tool_name,
                        "label": tool.entity.identity.label.model_dump()
                        if hasattr(tool.entity.identity.label, "model_dump")
                        else tool.entity.identity.label,
                        "description": tool.entity.description.model_dump(),
                        "icon": tool.entity.identity.icon,
                        "available": availability["available"],
                        "unavailable_reason": availability.get("reason"),
                    }
                    provider_dict["tools"].append(tool_dict)

                edu_tools.append(provider_dict)

        return edu_tools

    @staticmethod
    def get_tool_detail(tenant_id: str, provider: str, tool_name: str) -> dict[str, Any]:
        """
        Get detailed information about a specific tool.

        Args:
            tenant_id: The tenant ID
            provider: The tool provider name (e.g., "edu_tools")
            tool_name: The tool name (e.g., "calculator")

        Returns:
            dict[str, Any]: Tool details including name, label, description, parameters, icon

        Raises:
            Exception: If provider or tool not found
        """
        # Get the tool provider
        tool_provider = ToolManager.get_builtin_provider(
            provider=provider,
            tenant_id=tenant_id,
        )

        # Get the specific tool
        tool = tool_provider.get_tool(tool_name)

        # Extract tool details
        # Note: tool.entity is guaranteed to exist for BuiltinTool
        return {
            "name": tool.entity.identity.name,  # pyright: ignore[reportOptionalMemberAccess]
            "label": tool.entity.identity.label.model_dump()
            if hasattr(tool.entity.identity.label, "model_dump")
            else tool.entity.identity.label,  # pyright: ignore[reportOptionalMemberAccess]
            "description": tool.entity.description.model_dump(),  # pyright: ignore[reportOptionalMemberAccess]
            "parameters": [
                {
                    "name": param.name,
                    "type": param.type.value,
                    "required": param.required,
                    "label": param.label.model_dump() if hasattr(param.label, "model_dump") else param.label,
                    "description": param.human_description.model_dump()
                    if hasattr(param.human_description, "model_dump")
                    else param.human_description,
                    "form": param.form.value,
                    "options": [opt.model_dump() for opt in param.options] if param.options else None,
                }
                for param in tool.entity.parameters or []  # pyright: ignore[reportOptionalMemberAccess]
            ],
            "icon": tool.entity.identity.icon,  # pyright: ignore[reportOptionalMemberAccess]
        }

    @staticmethod
    def test_tool(
        tenant_id: str,
        provider: str,
        tool_name: str,
        test_parameters: dict[str, Any],
    ) -> dict[str, Any]:
        """
        Test a tool with given parameters.

        Args:
            tenant_id: The tenant ID
            provider: The tool provider name
            tool_name: The tool name
            test_parameters: Parameters to test the tool with

        Returns:
            dict[str, Any]: Test result with success status and output/error

        Example:
            >>> result = ToolRegistryService.test_tool(
            ...     tenant_id="tenant-123",
            ...     provider="edu_tools",
            ...     tool_name="calculator",
            ...     test_parameters={"expression": "2 + 2"}
            ... )
            >>> print(result)
            {
                "success": True,
                "results": [{"type": "text", "message": "Result: 4"}]
            }
        """
        try:
            # Get the tool provider
            tool_provider = ToolManager.get_builtin_provider(
                provider=provider,
                tenant_id=tenant_id,
            )

            # Get the specific tool
            tool = tool_provider.get_tool(tool_name)

            if tool is None:
                return {
                    "success": False,
                    "error": f"Tool '{tool_name}' not found in provider '{provider}'",
                }

            # Process file parameters (e.g., audio_file for ASR)
            # Convert base64 data to File objects
            processed_parameters = ToolRegistryService._process_file_parameters(
                test_parameters=test_parameters,
                tenant_id=tenant_id,
            )

            # Set tool runtime (required for tools that need tenant_id, credentials, etc.)
            tool.runtime = ToolRuntime(
                tenant_id=tenant_id,
                tool_id=tool_name,
                invoke_from=InvokeFrom.DEBUGGER,
                tool_invoke_from=ToolInvokeFrom.AGENT,
                credentials={},  # For test purposes, credentials should be loaded from provider config
                runtime_parameters={},
            )

            # Invoke tool with test parameters
            # Note: tool.invoke is guaranteed to exist for BuiltinTool
            result_generator = tool.invoke(  # pyright: ignore[reportOptionalMemberAccess]
                user_id="test_user",
                tool_parameters=processed_parameters,
            )

            # Collect results from generator
            results = []
            for message in result_generator:
                if isinstance(message, ToolInvokeMessage):
                    # Handle BLOB messages (e.g., audio from TTS)
                    if message.type == ToolInvokeMessage.MessageType.BLOB:
                        # Extract blob data and encode as base64
                        blob_message = message.message
                        if hasattr(blob_message, "blob"):
                            blob_data = blob_message.blob  # type: ignore
                            # Encode binary data as base64 for JSON serialization
                            base64_data = base64.b64encode(blob_data).decode("utf-8")
                            results.append(
                                {
                                    "type": "blob",
                                    "blob_base64": base64_data,
                                    "mime_type": blob_message.meta.get("mime_type")
                                    if hasattr(blob_message, "meta")
                                    else None,  # type: ignore
                                }
                            )
                        continue

                    # Convert message to dict if it's a Pydantic model
                    message_content = message.message
                    if hasattr(message_content, "model_dump"):
                        message_content = message_content.model_dump()
                    elif hasattr(message_content, "__dict__"):
                        message_content = message_content.__dict__
                    else:
                        message_content = str(message_content)

                    results.append(
                        {
                            "type": message.type.value,
                            "message": message_content,
                        }
                    )
                else:
                    results.append({"type": "unknown", "message": str(message)})

            return {"success": True, "results": results}

        except Exception as e:
            return {"success": False, "error": str(e)}

    @staticmethod
    def _process_file_parameters(test_parameters: dict[str, Any], tenant_id: str) -> dict[str, Any]:
        """
        Process file parameters by converting base64 data to File objects.

        Args:
            test_parameters: Original test parameters
            tenant_id: The tenant ID

        Returns:
            dict[str, Any]: Processed parameters with File objects

        Example:
            Input: {"audio_file": "data:audio/webm;base64,GkXfo59C..."}
            Output: {"audio_file": File(...)}
        """
        processed = test_parameters.copy()

        # Check for audio_file parameter (used by ASR tool)
        if "audio_file" in processed and isinstance(processed["audio_file"], str):
            audio_data_str = processed["audio_file"]

            # Parse data URL format: "data:audio/webm;base64,..."
            if audio_data_str.startswith("data:"):
                # Extract mime type and base64 data
                try:
                    header, base64_data = audio_data_str.split(",", 1)
                    mime_type = header.split(";")[0].replace("data:", "")

                    # Decode base64
                    audio_bytes = base64.b64decode(base64_data)

                    # Determine file extension from MIME type
                    mime_to_ext = {
                        "audio/webm": ".webm",
                        "audio/wav": ".wav",
                        "audio/mp3": ".mp3",
                        "audio/mpeg": ".mp3",
                        "audio/ogg": ".ogg",
                        "audio/m4a": ".m4a",
                    }
                    extension = mime_to_ext.get(mime_type, ".webm")

                    # Generate unique storage key
                    file_id = str(uuid.uuid4())
                    storage_key = f"tool_test_audio/{file_id}{extension}"

                    # Save to storage
                    storage.save(storage_key, audio_bytes)

                    # Create File object
                    file_obj = File(
                        id=file_id,
                        tenant_id=tenant_id,
                        type=FileType.AUDIO,
                        transfer_method=FileTransferMethod.TOOL_FILE,
                        related_id=file_id,
                        filename=f"test_audio{extension}",
                        extension=extension,
                        mime_type=mime_type,
                        size=len(audio_bytes),
                        storage_key=storage_key,
                    )

                    # Replace with File object
                    processed["audio_file"] = file_obj

                except Exception as e:
                    # If parsing fails, return error in the parameters
                    # Tool will handle the error
                    processed["audio_file_error"] = f"Failed to process audio file: {str(e)}"

        return processed

    @staticmethod
    def check_tool_availability(tenant_id: str, provider: str, tool_name: str) -> dict[str, Any]:
        """
        Check if a tool is available (has required API Key if needed).

        Args:
            tenant_id: The tenant ID
            provider: The tool provider name
            tool_name: The tool name

        Returns:
            dict[str, Any]: Availability info with keys:
                - available: bool
                - reason: str | None (reason if not available)
                - api_key_name: str | None (if API key is configured)
        """
        # Define tool-provider API key requirements
        # Tools that require API keys from AdminAPIKeyConfig
        api_key_requirements: dict[str, str] = {
            "web_search": "google",
            "weather": "openweathermap",
            "tts": "openai",
            "stt": "openai",
            "image_gen": "openai",
            "ocr": "tesseract",
        }

        required_provider_key = api_key_requirements.get(tool_name)

        if not required_provider_key:
            # Tool doesn't require API Key
            return {"available": True, "reason": None}

        # Check if admin has registered the required API Key
        # Import here to avoid circular dependency
        from extensions.ext_database import db
        from models.education.api_key_config import AdminAPIKeyConfig

        api_key_config = (
            db.session.query(AdminAPIKeyConfig)
            .filter(
                AdminAPIKeyConfig.provider == required_provider_key,
                AdminAPIKeyConfig.is_active == True,
            )
            .first()
        )

        if api_key_config:
            return {
                "available": True,
                "reason": None,
                "api_key_name": api_key_config.key_name,
            }
        else:
            return {
                "available": False,
                "reason": f"Required API Key not configured: {required_provider_key}",
            }
