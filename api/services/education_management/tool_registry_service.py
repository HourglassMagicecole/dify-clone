"""Tool Registry Service for managing educational tools."""

import base64
import logging
import uuid
from enum import StrEnum
from typing import Any

logger = logging.getLogger(__name__)

from core.app.entities.app_invoke_entities import InvokeFrom
from core.file.enums import FileTransferMethod, FileType
from core.file.models import File
from core.tools.__base.tool_runtime import ToolRuntime
from core.tools.entities.tool_entities import ToolInvokeFrom, ToolInvokeMessage
from core.tools.tool_manager import ToolManager
from extensions.ext_database import db
from extensions.ext_storage import storage
from models.education.api_key_config import AdminAPIKeyConfig
from models.education.user_tool_config import UserToolConfig
from services.education_management.api_key_service import APIKeyService
from services.education_management.user_tool_config_service import UserToolConfigService


class ToolAPIKeyType(StrEnum):
    """
    Tool API Key requirement types.

    Defines how each tool provider obtains API keys:
    - LLM_PROVIDER: Uses AdminAPIKeyConfig (shared by tenant owner, used for LLM model providers)
    - TOOL_PROVIDER: Uses UserToolConfig (each user provides their own API key)
    - NO_API_KEY: No API key required
    """

    LLM_PROVIDER = "llm_provider"  # Type A: TTS/STT/DALL-E (AdminAPIKeyConfig)
    TOOL_PROVIDER = "tool_provider"  # Type B: Google/OpenWeather/Wikipedia/Yahoo (UserToolConfig)
    NO_API_KEY = "no_api_key"  # Type C: Calculator/JSON Parser/WebScraper/Time


class ToolRegistryService:
    """
    Service for managing educational tool registry.

    Provides methods to:
    - List available educational tools
    - Get detailed information about specific tools
    - Test tools with sample parameters
    - Check tool availability (API key requirements)
    """

    # Tool provider to API Key type mapping
    PROVIDER_API_KEY_TYPE_MAP: dict[str, ToolAPIKeyType] = {
        # Type A: LLM Providers (AdminAPIKeyConfig - shared by tenant owner)
        "audio": ToolAPIKeyType.LLM_PROVIDER,  # TTS/STT from OpenAI
        "openai_tool": ToolAPIKeyType.LLM_PROVIDER,  # DALL-E, etc.
        # Type B: Tool Providers (UserToolConfig - each user provides their own)
        "google": ToolAPIKeyType.TOOL_PROVIDER,  # Google Search API (SerpAPI)
        "openweather": ToolAPIKeyType.TOOL_PROVIDER,  # OpenWeather API
        "data_analysis": ToolAPIKeyType.TOOL_PROVIDER,  # DigitForce API
        # Type C: No API Key Required
        "edu_tools": ToolAPIKeyType.NO_API_KEY,  # Calculator, JSON Parser, URL Scraper
        "webscraper": ToolAPIKeyType.NO_API_KEY,  # URL scraping
        "time": ToolAPIKeyType.NO_API_KEY,  # Time/date tools
        "wikipedia": ToolAPIKeyType.NO_API_KEY,  # Wikipedia (no API key needed)
        "yahoo": ToolAPIKeyType.NO_API_KEY,  # Yahoo Finance (no API key needed)
        "maths": ToolAPIKeyType.NO_API_KEY,  # Math expression evaluation
        "json_process": ToolAPIKeyType.NO_API_KEY,  # JSON manipulation
        "arxiv": ToolAPIKeyType.NO_API_KEY,  # ArXiv paper search
        "google_translate": ToolAPIKeyType.NO_API_KEY,  # Google Translate (public API)
        "markitdown": ToolAPIKeyType.NO_API_KEY,  # File format conversion
        "data_alchemy": ToolAPIKeyType.NO_API_KEY,  # Chart generation (uses LLM only)
        "md_exporter": ToolAPIKeyType.NO_API_KEY,  # Markdown export to various formats
    }

    # Provider to AdminAPIKeyConfig provider name mapping (for Type A only)
    # Maps tool provider name to the corresponding LLM provider in AdminAPIKeyConfig
    ADMIN_API_KEY_PROVIDER_MAP: dict[str, str] = {
        "audio": "openai",  # TTS/STT uses OpenAI provider
        "openai_tool": "openai",  # DALL-E uses OpenAI provider
    }

    @staticmethod
    def list_edu_tools(tenant_id: str, user_id: str | None = None) -> list[dict[str, Any]]:
        """
        List all educational tools available for the tenant and user.

        Returns tools from the edu_tools provider and other allowed providers
        (webscraper, audio, time, google, openweather, wikipedia, yahoo).

        Args:
            tenant_id: The tenant ID
            user_id: The user ID (optional, used for checking user-specific tool configs)

        Returns:
            list[dict[str, Any]]: List of tool provider dictionaries with tools
        """
        # Get all hardcoded builtin tool providers (skip plugin providers to avoid daemon errors)
        all_providers = list(ToolManager.list_hardcoded_providers())

        # Filter for educational tools
        # Include: Select Dify providers and converted built-in tools
        allowed_providers = [
            # "edu_tools",  # Removed: Replaced by json_process and webscraper
            "webscraper",  # URL 스크래핑 (replaces edu_tools url_scraper)
            "audio",  # TTS/STT
            "time",  # 시간 관련 도구
            "google",  # Google 검색
            "openai_tool",  # OpenAI 도구 (DALL-E)
            "openweather",  # 날씨 정보
            "wikipedia",  # Wikipedia 검색
            "yahoo",  # Yahoo 도구
            # Session 8: Built-in tools from ext_tools/ conversion (30 tools total)
            "maths",  # NumExpr 수식 평가
            "json_process",  # JSONPath 기반 JSON 조작 (4 tools, replaces edu_tools json_parser)
            "arxiv",  # 학술 논문 검색
            "google_translate",  # 무료 Google Translate API
            "markitdown",  # 파일 → Markdown 변환
            "data_alchemy",  # 차트 자동 생성 (2 tools with LLM)
            "data_analysis",  # DigitForce API 기반 데이터 분석 (6 tools)
            "md_exporter",  # Markdown → 5가지 포맷 (DOCX, PPTX, XLSX, HTML, MD)
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
                # Exclude unimplemented or unwanted tools
                excluded_tools = [
                    "gpt_image_edit",  # Not implemented yet
                    "gpt_image_generate",  # Redundant (overlaps with DALL-E 2/3)
                    "deep_research",  # Not suitable for educational testing
                    # md_exporter: Hide unnecessary conversion tools (keep only 5 main formats)
                    "md_to_csv",  # CSV export (hidden)
                    "md_to_xml",  # XML export (hidden)
                    "md_to_json",  # JSON export (hidden)
                    "md_to_html_text",  # HTML text export (hidden)
                    "md_to_latex",  # LaTeX export (hidden)
                    "md_to_codeblock",  # Codeblock extraction (hidden)
                    "md_to_pdf",  # PDF export (hidden)
                    "md_to_linked_image",  # Image file extraction (hidden)
                    "md_to_png",  # PNG image extraction (hidden)
                    # time: Hide timestamp conversion tools (keep current_time, timezone_conversion, weekday)
                    "localtime_to_timestamp",  # Local time to timestamp (hidden)
                    "timestamp_to_localtime",  # Timestamp to local time (hidden)
                    # data_alchemy: Hide LLM-based chart tool (requires model-selector UI)
                    "rookie_data_alchemy",  # LLM-based chart generation (hidden, use chart_auto_generator instead)
                    # data_analysis: Hide complex or unreliable tools
                    "time_identify",  # Time identification (hidden, inconsistent results)
                    "query_database",  # Database query (hidden, requires DB connection details)
                    "merge_to_multisheet",  # Multi-sheet Excel merge (hidden, requires multiple file upload)
                    "data_visualization",  # Data visualization (hidden, use data_alchemy instead)
                ]

                for tool in provider_controller.tools:
                    tool_name = tool.entity.identity.name

                    # Skip excluded tools
                    if tool_name in excluded_tools:
                        continue

                    # Check tool availability (API key requirements)
                    availability = ToolRegistryService.check_tool_availability(
                        tenant_id=tenant_id,
                        provider=provider_name,
                        tool_name=tool_name,
                        user_id=user_id,
                    )

                    tool_dict = {
                        "name": tool_name,
                        "label": tool.entity.identity.label.model_dump()  # pyright: ignore[reportOptionalMemberAccess]
                        if hasattr(tool.entity.identity.label, "model_dump")
                        else tool.entity.identity.label,
                        "description": tool.entity.description.model_dump(),  # pyright: ignore[reportOptionalMemberAccess]
                        "icon": tool.entity.identity.icon,
                        "available": availability["available"],
                        "unavailable_reason": availability.get("reason"),
                        "api_key_type": availability.get("api_key_type"),
                        "requires_user_key": availability.get("requires_user_key"),
                        "user_has_key": availability.get("user_has_key"),
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
            "label": tool.entity.identity.label.model_dump()  # pyright: ignore[reportOptionalMemberAccess]
            if hasattr(tool.entity.identity.label, "model_dump")  # pyright: ignore[reportOptionalMemberAccess]
            else tool.entity.identity.label,  # pyright: ignore[reportOptionalMemberAccess]
            "description": tool.entity.description.model_dump(),  # pyright: ignore[reportOptionalMemberAccess]
            "parameters": [
                {
                    "name": param.name,
                    "type": param.type.value,
                    "required": param.required,
                    "label": param.label.model_dump() if hasattr(param.label, "model_dump") else param.label,
                    "description": param.human_description.model_dump()  # pyright: ignore[reportOptionalMemberAccess]
                    if hasattr(param.human_description, "model_dump")
                    else param.human_description,
                    "form": param.form.value,
                    "options": [opt.model_dump() for opt in param.options] if param.options else None,
                    "default": param.default if hasattr(param, "default") else None,
                    "min": param.min if hasattr(param, "min") else None,
                    "max": param.max if hasattr(param, "max") else None,
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
        user_id: str | None = None,
        session_id: str | None = None,
    ) -> dict[str, Any]:
        """
        Test a tool with given parameters.

        Args:
            tenant_id: The tenant ID
            provider: The tool provider name
            tool_name: The tool name
            test_parameters: Parameters to test the tool with
            user_id: The user ID (required for Type B tools)
            session_id: The education session ID (for usage tracking)

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

            # Load credentials based on tool type
            credentials: dict[str, Any] = {}
            api_key_type = ToolRegistryService.PROVIDER_API_KEY_TYPE_MAP.get(provider, ToolAPIKeyType.NO_API_KEY)

            if api_key_type == ToolAPIKeyType.TOOL_PROVIDER:
                # Type B: Load user's API key from UserToolConfig
                if not user_id:
                    return {
                        "success": False,
                        "error": f"Tool '{tool_name}' requires user authentication",
                    }

                user_config = (
                    db.session.query(UserToolConfig)
                    .filter(
                        UserToolConfig.user_id == user_id,
                        UserToolConfig.provider == provider,
                        UserToolConfig.is_active == True,
                    )
                    .first()
                )

                if not user_config:
                    return {
                        "success": False,
                        "error": f"API key not configured for provider '{provider}'",
                    }

                # Decrypt API key
                encryption_service = UserToolConfigService().encryption_service
                decrypted_key = encryption_service.decrypt(user_config.api_key_encrypted)

                # Build credentials dict based on provider requirements
                # Google uses serpapi_api_key
                if provider == "google":
                    credentials["serpapi_api_key"] = decrypted_key
                # OpenWeather uses api_key
                elif provider == "openweather":
                    credentials["api_key"] = decrypted_key
                # DigitForce Data Analysis uses digitforce_api_key
                elif provider == "data_analysis":
                    credentials["digitforce_api_key"] = decrypted_key
                # Wikipedia and Yahoo don't need API keys (but listed as TOOL_PROVIDER for consistency)
                else:
                    # Generic fallback: use provider_api_key
                    credentials[f"{provider}_api_key"] = decrypted_key

            elif api_key_type == ToolAPIKeyType.LLM_PROVIDER:
                # Type A: Load admin API key from AdminAPIKeyConfig
                admin_provider = ToolRegistryService.ADMIN_API_KEY_PROVIDER_MAP.get(provider)

                if not admin_provider:
                    return {
                        "success": False,
                        "error": f"No admin provider mapping found for: {provider}",
                    }

                # Query AdminAPIKeyConfig
                admin_config = (
                    db.session.query(AdminAPIKeyConfig)
                    .filter(
                        AdminAPIKeyConfig.provider == admin_provider,
                        AdminAPIKeyConfig.is_active == True,
                    )
                    .first()
                )

                if not admin_config:
                    return {
                        "success": False,
                        "error": f"Admin API key not configured for provider: {admin_provider}",
                    }

                # Decrypt API key
                encryption_service = APIKeyService().encryption_service
                decrypted_key = encryption_service.decrypt(admin_config.api_key_encrypted)

                # Build credentials dict based on provider
                # OpenAI uses: openai_api_key
                if admin_provider == "openai":
                    credentials["openai_api_key"] = decrypted_key
                # Anthropic uses: anthropic_api_key
                elif admin_provider == "anthropic":
                    credentials["anthropic_api_key"] = decrypted_key
                # Add more providers here as needed (Google, Cohere, etc.)
                else:
                    # Generic fallback
                    credentials[f"{admin_provider}_api_key"] = decrypted_key

            # Type C (NO_API_KEY): Use empty credentials (already initialized)

            # Set tool runtime (required for tools that need tenant_id, credentials, etc.)
            tool.runtime = ToolRuntime(
                tenant_id=tenant_id,
                tool_id=tool_name,
                invoke_from=InvokeFrom.DEBUGGER,
                tool_invoke_from=ToolInvokeFrom.AGENT,
                credentials=credentials,
                runtime_parameters={},
                invoke_source="tool_test",
                account_id=user_id,
                session_id=session_id,
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
                    # Handle BLOB messages (e.g., audio from TTS, DOCX from md_exporter)
                    if message.type == ToolInvokeMessage.MessageType.BLOB:
                        # Extract blob data and encode as base64
                        blob_message = message.message
                        if hasattr(blob_message, "blob"):
                            blob_data = blob_message.blob  # type: ignore
                            # Encode binary data as base64 for JSON serialization
                            base64_data = base64.b64encode(blob_data).decode("utf-8")

                            # Extract metadata from message.meta (not blob_message.meta)
                            mime_type = None
                            filename = None
                            if message.meta:
                                mime_type = message.meta.get("mime_type")
                                filename = message.meta.get("filename")

                            results.append(
                                {
                                    "type": "blob",
                                    "blob_base64": base64_data,
                                    "mime_type": mime_type,
                                    "filename": filename,
                                }
                            )
                        continue

                    # Handle JSON messages (e.g., chart configurations from data_alchemy)
                    if message.type == ToolInvokeMessage.MessageType.JSON:
                        json_message = message.message
                        if hasattr(json_message, "json_object"):
                            results.append(
                                {
                                    "type": "json",
                                    "message": json_message.json_object,  # type: ignore
                                }
                            )
                        continue

                    # Convert message to dict if it's a Pydantic model
                    message_content = message.message
                    if hasattr(message_content, "model_dump"):
                        message_content = message_content.model_dump()  # pyright: ignore[reportOptionalMemberAccess]
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

        # MIME type to extension mapping
        mime_to_ext = {
            # Audio
            "audio/webm": ".webm",
            "audio/wav": ".wav",
            "audio/x-wav": ".wav",
            "audio/mp3": ".mp3",
            "audio/mpeg": ".mp3",
            "audio/ogg": ".ogg",
            "audio/m4a": ".m4a",
            "audio/x-m4a": ".m4a",
            "audio/mp4": ".m4a",
            "audio/aac": ".aac",
            "audio/flac": ".flac",
            "audio/x-flac": ".flac",
            # Video containers that may contain audio only (from browser recording)
            "video/webm": ".webm",
            "video/mp4": ".mp4",
            # Spreadsheet
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": ".xlsx",
            "application/vnd.ms-excel": ".xls",
            "text/csv": ".csv",
            # Document
            "application/pdf": ".pdf",
            "application/msword": ".doc",
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document": ".docx",
            # Image
            "image/jpeg": ".jpg",
            "image/png": ".png",
            "image/gif": ".gif",
            "image/webp": ".webp",
        }

        def determine_file_type(mime_type: str) -> FileType:
            """Determine FileType from MIME type."""
            if mime_type.startswith("audio/") or mime_type in ("video/webm", "video/mp4"):
                return FileType.AUDIO
            elif mime_type.startswith("image/"):
                return FileType.IMAGE
            else:
                return FileType.DOCUMENT

        def process_single_file(data_str: str, param_name: str, default_prefix: str = "file") -> File | None:
            """Process a single base64 file string into a File object."""
            if not data_str.startswith("data:"):
                return None

            try:
                # Parse data URL format: "data:mime/type;base64,..."
                header, base64_data = data_str.split(",", 1)
                mime_type = header.split(";")[0].replace("data:", "")

                # Decode base64
                file_bytes = base64.b64decode(base64_data)

                # Determine file extension and type
                extension = mime_to_ext.get(mime_type, ".bin")
                logger.info(
                    "Processing file: mime_type=%s, extension=%s, size=%d", mime_type, extension, len(file_bytes)
                )
                file_type = determine_file_type(mime_type)

                # Generate unique storage key
                file_id = str(uuid.uuid4())
                storage_key = f"tool_test_{default_prefix}/{file_id}{extension}"

                # Save to storage
                storage.save(storage_key, file_bytes)

                # Create File object
                return File(
                    id=file_id,
                    tenant_id=tenant_id,
                    type=file_type,
                    transfer_method=FileTransferMethod.TOOL_FILE,
                    related_id=file_id,
                    filename=f"{default_prefix}{extension}",
                    extension=extension,
                    mime_type=mime_type,
                    size=len(file_bytes),
                    storage_key=storage_key,
                )
            except Exception as e:
                raise ValueError(f"Failed to process {param_name}: {str(e)}")

        # Process audio_file parameter (used by ASR tool)
        if "audio_file" in processed and isinstance(processed["audio_file"], str):
            try:
                file_obj = process_single_file(processed["audio_file"], "audio_file", "audio")
                if file_obj:
                    processed["audio_file"] = file_obj
            except Exception as e:
                processed["audio_file_error"] = str(e)

        # Process input_file parameter (used by data_analysis, markitdown, etc.)
        if "input_file" in processed and isinstance(processed["input_file"], str):
            try:
                file_obj = process_single_file(processed["input_file"], "input_file", "data")
                if file_obj:
                    processed["input_file"] = file_obj
            except Exception as e:
                processed["input_file_error"] = str(e)

        # Process csv_files parameter (used by merge_to_multisheet)
        if "csv_files" in processed and isinstance(processed["csv_files"], list):
            try:
                file_objects = []
                for idx, file_str in enumerate(processed["csv_files"]):
                    if isinstance(file_str, str):
                        file_obj = process_single_file(file_str, f"csv_files[{idx}]", f"sheet{idx + 1}")
                        if file_obj:
                            file_objects.append(file_obj)
                if file_objects:
                    processed["csv_files"] = file_objects
            except Exception as e:
                processed["csv_files_error"] = str(e)

        return processed

    @staticmethod
    def check_tool_availability(
        tenant_id: str, provider: str, tool_name: str, user_id: str | None = None
    ) -> dict[str, Any]:
        """
        Check if a tool is available (has required API Key if needed).

        Args:
            tenant_id: The tenant ID
            provider: The tool provider name
            tool_name: The tool name
            user_id: The user ID (optional, required for TOOL_PROVIDER type)

        Returns:
            dict[str, Any]: Availability info with keys:
                - available: bool
                - reason: str | None (reason if not available)
                - api_key_type: str (ToolAPIKeyType value)
                - api_key_name: str | None (if API key is configured for LLM_PROVIDER)
                - user_has_key: bool | None (if user has configured key for TOOL_PROVIDER)
        """
        # Get API key type for this provider
        api_key_type = ToolRegistryService.PROVIDER_API_KEY_TYPE_MAP.get(provider, ToolAPIKeyType.NO_API_KEY)

        # Type C: No API Key Required
        if api_key_type == ToolAPIKeyType.NO_API_KEY:
            return {
                "available": True,
                "reason": None,
                "api_key_type": api_key_type.value,
            }

        # Type A: LLM Provider (AdminAPIKeyConfig - shared by tenant owner)
        if api_key_type == ToolAPIKeyType.LLM_PROVIDER:
            # Get the LLM provider name from mapping
            admin_provider = ToolRegistryService.ADMIN_API_KEY_PROVIDER_MAP.get(provider)

            if not admin_provider:
                return {
                    "available": False,
                    "reason": f"No LLM provider mapping found for: {provider}",
                    "api_key_type": api_key_type.value,
                }

            # Check if admin has registered the required API Key
            api_key_config = (
                db.session.query(AdminAPIKeyConfig)
                .filter(
                    AdminAPIKeyConfig.provider == admin_provider,
                    AdminAPIKeyConfig.is_active == True,
                )
                .first()
            )

            if api_key_config:
                return {
                    "available": True,
                    "reason": None,
                    "api_key_type": api_key_type.value,
                    "api_key_name": api_key_config.key_name,
                }
            else:
                return {
                    "available": False,
                    "reason": f"Admin API Key not configured for provider: {admin_provider}",
                    "api_key_type": api_key_type.value,
                }

        # Type B: Tool Provider (UserToolConfig - each user provides their own)
        if api_key_type == ToolAPIKeyType.TOOL_PROVIDER:
            # If user_id is not provided, we can't check user-specific config
            # Return info that user API key is required
            if not user_id:
                return {
                    "available": True,  # Mark as available, but with info about user key requirement
                    "reason": None,
                    "api_key_type": api_key_type.value,
                    "requires_user_key": True,
                }

            # Check if user has configured API key for this provider
            user_config = (
                db.session.query(UserToolConfig)
                .filter(
                    UserToolConfig.user_id == user_id,
                    UserToolConfig.provider == provider,
                    UserToolConfig.is_active == True,
                )
                .first()
            )

            if user_config:
                return {
                    "available": True,
                    "reason": None,
                    "api_key_type": api_key_type.value,
                    "user_has_key": True,
                }
            else:
                return {
                    "available": False,
                    "reason": f"User API Key not configured for provider: {provider}",
                    "api_key_type": api_key_type.value,
                    "user_has_key": False,
                }

        # Unknown type (should not happen)
        return {
            "available": False,
            "reason": f"Unknown API key type for provider: {provider}",
            "api_key_type": "unknown",
        }
