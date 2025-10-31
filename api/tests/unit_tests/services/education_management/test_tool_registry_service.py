"""Tests for ToolRegistryService (Story 2.1B - Task 12.3)."""

from unittest.mock import MagicMock, patch

from services.education_management.tool_registry_service import ToolRegistryService


class TestToolRegistryService:
    """Test Tool Registry Service operations."""

    @patch("services.education_management.tool_registry_service.ToolManager")
    def test_list_edu_tools(self, mock_tool_manager):
        """Test listing educational tools."""
        # Arrange
        mock_provider_controller = MagicMock()
        mock_entity = MagicMock()
        mock_identity = MagicMock()
        mock_identity.name = "edu_tools"
        mock_identity.label = MagicMock()
        mock_identity.label.model_dump.return_value = {"en_US": "Educational Tools", "ko_KR": "교육용 도구"}
        mock_identity.icon = "icon.svg"
        mock_entity.identity = mock_identity
        mock_provider_controller.entity = mock_entity

        mock_tool = MagicMock()
        mock_tool_identity = MagicMock()
        mock_tool_identity.name = "calculator"
        mock_tool_identity.label = MagicMock()
        mock_tool_identity.label.model_dump.return_value = {"en_US": "Calculator", "ko_KR": "계산기"}
        mock_tool_identity.icon = "calculator.svg"
        mock_tool_entity = MagicMock()
        mock_tool_entity.identity = mock_tool_identity
        mock_tool_entity.description = MagicMock()
        mock_tool_entity.description.model_dump.return_value = {
            "human": {"en_US": "Calculator", "ko_KR": "계산기"},
            "llm": "A calculator tool",
        }
        mock_tool.entity = mock_tool_entity
        mock_provider_controller.tools = [mock_tool]

        mock_tool_manager.list_hardcoded_providers.return_value = [mock_provider_controller]

        with patch.object(
            ToolRegistryService, "check_tool_availability", return_value={"available": True, "reason": None}
        ):
            # Act
            tools = ToolRegistryService.list_edu_tools(tenant_id="test-tenant-id")

            # Assert
            assert len(tools) > 0
            assert any(tool["name"] == "edu_tools" for tool in tools)
            mock_tool_manager.list_hardcoded_providers.assert_called_once()

    @patch("services.education_management.tool_registry_service.ToolManager")
    def test_get_tool_detail(self, mock_tool_manager):
        """Test getting tool detail."""
        # Arrange
        mock_provider = MagicMock()
        mock_tool = MagicMock()
        mock_entity = MagicMock()
        mock_entity.identity.name = "calculator"
        mock_entity.identity.label = {"en_US": "Calculator", "ko_KR": "계산기"}
        mock_entity.identity.icon = "icon.svg"
        mock_entity.description.model_dump.return_value = {
            "human": {"en_US": "A simple calculator", "ko_KR": "간단한 계산기"},
            "llm": "Calculator tool",
        }

        mock_param = MagicMock()
        mock_param.name = "expression"
        mock_param.type.value = "string"
        mock_param.required = True
        mock_param.label = {"en_US": "Expression", "ko_KR": "수식"}
        mock_param.human_description = {"en_US": "Math expression", "ko_KR": "수학 수식"}
        mock_param.llm_description = "The mathematical expression to evaluate"
        mock_param.form.value = "llm"
        mock_param.options = None

        mock_entity.parameters = [mock_param]
        mock_tool.entity = mock_entity

        mock_provider.get_tool.return_value = mock_tool
        mock_tool_manager.get_builtin_provider.return_value = mock_provider

        # Act
        detail = ToolRegistryService.get_tool_detail(
            tenant_id="test-tenant-id", provider="edu_tools", tool_name="calculator"
        )

        # Assert
        assert detail["name"] == "calculator"
        assert "parameters" in detail
        assert len(detail["parameters"]) > 0
        assert detail["parameters"][0]["name"] == "expression"
        assert detail["parameters"][0]["required"] is True
        mock_tool_manager.get_builtin_provider.assert_called_once_with(
            provider="edu_tools",
            tenant_id="test-tenant-id",
        )

    def test_check_tool_availability_no_api_key_required(self):
        """Test tool availability check for tools that don't require API Key."""
        # Act
        availability = ToolRegistryService.check_tool_availability(
            tenant_id="test-tenant-id", provider="edu_tools", tool_name="calculator"
        )

        # Assert
        assert availability["available"] is True
        assert availability["reason"] is None

    @patch("extensions.ext_database.db")
    def test_check_tool_availability_api_key_configured(self, mock_db):
        """Test tool availability check when API Key is configured."""
        # Arrange
        mock_api_key = MagicMock()
        mock_api_key.key_name = "Primary OpenAI Key"
        mock_api_key.provider = "openai"
        mock_api_key.is_active = True

        mock_query = MagicMock()
        mock_query.filter.return_value.first.return_value = mock_api_key
        mock_db.session.query.return_value = mock_query

        # Act
        availability = ToolRegistryService.check_tool_availability(
            tenant_id="test-tenant-id", provider="edu_tools", tool_name="tts"
        )

        # Assert
        assert availability["available"] is True
        assert availability["reason"] is None
        assert availability["api_key_name"] == "Primary OpenAI Key"

    @patch("extensions.ext_database.db")
    def test_check_tool_availability_api_key_missing(self, mock_db):
        """Test tool availability check when API Key is missing."""
        # Arrange
        mock_query = MagicMock()
        mock_query.filter.return_value.first.return_value = None
        mock_db.session.query.return_value = mock_query

        # Act
        availability = ToolRegistryService.check_tool_availability(
            tenant_id="test-tenant-id", provider="edu_tools", tool_name="tts"
        )

        # Assert
        assert availability["available"] is False
        assert "API Key not configured" in availability["reason"]
        assert "openai" in availability["reason"]

    @patch("services.education_management.tool_registry_service.ToolManager")
    def test_test_tool_success(self, mock_tool_manager):
        """Test successful tool execution."""
        # Arrange
        from core.tools.entities.tool_entities import ToolInvokeMessage

        mock_provider = MagicMock()
        mock_tool = MagicMock()

        # Create actual ToolInvokeMessage instance for proper isinstance check
        mock_message = ToolInvokeMessage(
            type=ToolInvokeMessage.MessageType.TEXT,
            message=ToolInvokeMessage.TextMessage(text="Result: 4"),
        )

        mock_tool.invoke.return_value = [mock_message]
        mock_provider.get_tool.return_value = mock_tool
        mock_tool_manager.get_builtin_provider.return_value = mock_provider

        # Act
        result = ToolRegistryService.test_tool(
            tenant_id="test-tenant-id",
            provider="edu_tools",
            tool_name="calculator",
            test_parameters={"expression": "2 + 2"},
        )

        # Assert
        assert result["success"] is True
        assert len(result["results"]) > 0
        assert result["results"][0]["type"] == "text"

    @patch("services.education_management.tool_registry_service.ToolManager")
    def test_test_tool_error(self, mock_tool_manager):
        """Test tool execution with error."""
        # Arrange
        mock_tool_manager.get_builtin_provider.side_effect = Exception("Tool not found")

        # Act
        result = ToolRegistryService.test_tool(
            tenant_id="test-tenant-id",
            provider="invalid_provider",
            tool_name="calculator",
            test_parameters={"expression": "2 + 2"},
        )

        # Assert
        assert result["success"] is False
        assert "Tool not found" in result["error"]
