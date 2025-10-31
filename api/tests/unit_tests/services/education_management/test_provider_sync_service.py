"""Unit tests for ProviderSyncService."""

from unittest.mock import MagicMock, patch

import pytest

from services.education_management.provider_sync_service import ProviderSyncService


class TestProviderSyncService:
    """Test Provider Sync Service operations."""

    @pytest.fixture
    def mock_api_key_config(self):
        """Create a mock AdminAPIKeyConfig."""
        config = MagicMock()
        config.id = "test-api-key-id"
        config.key_name = "Test OpenAI Key"
        config.provider = "openai"
        config.is_active = True
        config.api_key_encrypted = "encrypted_key_data"
        return config

    @pytest.fixture
    def mock_inactive_api_key_config(self):
        """Create a mock inactive AdminAPIKeyConfig."""
        config = MagicMock()
        config.id = "test-api-key-id"
        config.key_name = "Test OpenAI Key"
        config.provider = "openai"
        config.is_active = False
        config.api_key_encrypted = "encrypted_key_data"
        return config

    @patch("services.education_management.provider_sync_service.db")
    @patch("services.education_management.provider_sync_service.APIKeyEncryptionService")
    @patch("services.education_management.provider_sync_service.ProviderManager")
    def test_sync_api_key_to_provider_success(
        self,
        mock_provider_manager,
        mock_encryption_service,
        mock_db,
        mock_api_key_config,
    ):
        """Test successful API key sync to provider."""
        # Arrange
        tenant_id = "test-tenant-id"
        api_key_config_id = "test-api-key-id"

        # Mock database query
        mock_db.session.query.return_value.filter_by.return_value.first.return_value = mock_api_key_config

        # Mock encryption service
        mock_encryption_instance = MagicMock()
        mock_encryption_instance.decrypt.return_value = "sk-test-key-12345"
        mock_encryption_service.return_value = mock_encryption_instance

        # Mock provider manager
        mock_provider_config = MagicMock()
        mock_provider_config.create_provider_credential = MagicMock()
        mock_provider_configurations = MagicMock()
        mock_provider_configurations.get.return_value = mock_provider_config

        mock_manager_instance = MagicMock()
        mock_manager_instance.get_configurations.return_value = mock_provider_configurations
        mock_provider_manager.return_value = mock_manager_instance

        # Act
        service = ProviderSyncService()
        # Mock _ensure_provider_credential_linked to avoid database interactions
        service._ensure_provider_credential_linked = MagicMock()

        result = service.sync_api_key_to_provider(
            tenant_id=tenant_id,
            api_key_config_id=api_key_config_id,
        )

        # Assert
        assert result["success"] is True
        assert result["provider"] == "openai"
        assert "synced" in result["message"].lower()

        # Verify create_provider_credential was called
        mock_provider_config.create_provider_credential.assert_called_once()
        call_args = mock_provider_config.create_provider_credential.call_args
        assert call_args[1]["credentials"]["openai_api_key"] == "sk-test-key-12345"
        assert call_args[1]["credential_name"] == "EduAI-Test OpenAI Key"

        # Verify _ensure_provider_credential_linked was called
        service._ensure_provider_credential_linked.assert_called_once_with(tenant_id, "openai", "EduAI-Test OpenAI Key")

    @patch("services.education_management.provider_sync_service.APIKeyEncryptionService")
    @patch("services.education_management.provider_sync_service.db")
    def test_sync_api_key_not_found(self, mock_db, mock_encryption_service):
        """Test sync when API key config not found."""
        # Arrange
        tenant_id = "test-tenant-id"
        api_key_config_id = "non-existent-id"

        # Mock database query to return None
        mock_db.session.query.return_value.filter_by.return_value.first.return_value = None

        # Act & Assert
        service = ProviderSyncService()
        with pytest.raises(ValueError, match="AdminAPIKeyConfig not found"):
            service.sync_api_key_to_provider(
                tenant_id=tenant_id,
                api_key_config_id=api_key_config_id,
            )

    @patch("services.education_management.provider_sync_service.APIKeyEncryptionService")
    @patch("services.education_management.provider_sync_service.db")
    def test_sync_api_key_inactive(self, mock_db, mock_encryption_service, mock_inactive_api_key_config):
        """Test sync when API key is inactive."""
        # Arrange
        tenant_id = "test-tenant-id"
        api_key_config_id = "test-api-key-id"

        # Mock database query
        mock_db.session.query.return_value.filter_by.return_value.first.return_value = mock_inactive_api_key_config

        # Act
        service = ProviderSyncService()
        result = service.sync_api_key_to_provider(
            tenant_id=tenant_id,
            api_key_config_id=api_key_config_id,
        )

        # Assert
        assert result["success"] is False
        assert "not active" in result["message"].lower()

    @patch("services.education_management.provider_sync_service.db")
    @patch("services.education_management.provider_sync_service.APIKeyEncryptionService")
    @patch("services.education_management.provider_sync_service.ProviderManager")
    def test_sync_api_key_provider_failure(
        self,
        mock_provider_manager,
        mock_encryption_service,
        mock_db,
        mock_api_key_config,
    ):
        """Test sync when provider service fails."""
        # Arrange
        tenant_id = "test-tenant-id"
        api_key_config_id = "test-api-key-id"

        # Mock database query
        mock_db.session.query.return_value.filter_by.return_value.first.return_value = mock_api_key_config

        # Mock encryption service
        mock_encryption_instance = MagicMock()
        mock_encryption_instance.decrypt.return_value = "sk-test-key-12345"
        mock_encryption_service.return_value = mock_encryption_instance

        # Mock provider manager to raise exception
        mock_manager_instance = MagicMock()
        mock_manager_instance.get_configurations.side_effect = Exception("Provider error")
        mock_provider_manager.return_value = mock_manager_instance

        # Act
        service = ProviderSyncService()
        result = service.sync_api_key_to_provider(
            tenant_id=tenant_id,
            api_key_config_id=api_key_config_id,
        )

        # Assert
        assert result["success"] is False
        assert "Failed to sync" in result["message"]

    @patch("services.education_management.provider_sync_service.ProviderManager")
    @patch("services.education_management.provider_sync_service.APIKeyEncryptionService")
    def test_build_provider_credentials_openai(self, mock_encryption_service, mock_provider_manager):
        """Test building OpenAI credentials."""
        # Arrange
        service = ProviderSyncService()
        api_key = "sk-test-key-12345"

        # Act
        credentials = service._build_provider_credentials("openai", api_key)

        # Assert
        assert credentials == {"openai_api_key": api_key}

    @patch("services.education_management.provider_sync_service.ProviderManager")
    @patch("services.education_management.provider_sync_service.APIKeyEncryptionService")
    def test_build_provider_credentials_anthropic(self, mock_encryption_service, mock_provider_manager):
        """Test building Anthropic credentials."""
        # Arrange
        service = ProviderSyncService()
        api_key = "sk-ant-test-key"

        # Act
        credentials = service._build_provider_credentials("anthropic", api_key)

        # Assert
        assert credentials == {"anthropic_api_key": api_key}

    @patch("services.education_management.provider_sync_service.ProviderManager")
    @patch("services.education_management.provider_sync_service.APIKeyEncryptionService")
    def test_build_provider_credentials_unsupported(self, mock_encryption_service, mock_provider_manager):
        """Test building credentials for unsupported provider."""
        # Arrange
        service = ProviderSyncService()
        api_key = "test-key"

        # Act & Assert
        with pytest.raises(ValueError, match="Unknown provider"):
            service._build_provider_credentials("unsupported_provider", api_key)

    @patch("services.education_management.provider_sync_service.ProviderManager")
    @patch("services.education_management.provider_sync_service.APIKeyEncryptionService")
    def test_remove_synced_credentials(self, mock_encryption_service, mock_provider_manager, mocker):
        """Test removing synced credentials."""
        # Arrange
        service = ProviderSyncService()
        tenant_id = "test-tenant-id"
        provider = "openai"
        credential_name = "EduAI-TestKey"

        # Mock sqlalchemy.orm.Session (imported inside the function)
        mock_session_instance = mocker.MagicMock()
        mock_session_class = mocker.patch("sqlalchemy.orm.Session")
        mock_session_class.return_value.__enter__.return_value = mock_session_instance

        # Mock db.engine
        mocker.patch("services.education_management.provider_sync_service.db")

        # Mock execute to return None (credential not found)
        mock_execute_result = mocker.MagicMock()
        mock_execute_result.scalar_one_or_none.return_value = None
        mock_session_instance.execute.return_value = mock_execute_result

        # Act
        result = service.remove_synced_credentials(tenant_id, provider, credential_name)

        # Assert
        assert result["success"] is True
        # Credential not found case
        assert "not found" in result["message"].lower() or "removed" in result["message"].lower()

    @patch("services.education_management.provider_sync_service.ProviderManager")
    @patch("services.education_management.provider_sync_service.APIKeyEncryptionService")
    def test_remove_synced_credentials_unsupported_provider(self, mock_encryption_service, mock_provider_manager):
        """Test removing credentials for unsupported provider."""
        # Arrange
        service = ProviderSyncService()
        tenant_id = "test-tenant-id"
        provider = "unsupported_provider"
        credential_name = "EduAI-TestKey"

        # Act
        result = service.remove_synced_credentials(tenant_id, provider, credential_name)

        # Assert
        assert result["success"] is False
        assert "not supported" in result["message"].lower()

    @patch("services.education_management.provider_sync_service.db")
    @patch("services.education_management.provider_sync_service.APIKeyEncryptionService")
    @patch("services.education_management.provider_sync_service.ProviderManager")
    def test_sync_api_key_with_plugin_auto_install_success(
        self,
        mock_provider_manager,
        mock_encryption_service,
        mock_db,
        mock_api_key_config,
    ):
        """Test API key sync with automatic plugin installation when provider not found."""
        # Arrange
        tenant_id = "test-tenant-id"
        api_key_config_id = "test-api-key-id"

        # Mock database query
        mock_db.session.query.return_value.filter_by.return_value.first.return_value = mock_api_key_config

        # Mock encryption service
        mock_encryption_instance = MagicMock()
        mock_encryption_instance.decrypt.return_value = "sk-test-key-12345"
        mock_encryption_service.return_value = mock_encryption_instance

        # Mock provider manager - first call returns no provider, second call returns provider
        mock_provider_config = MagicMock()
        mock_provider_config.create_provider_credential = MagicMock()

        mock_provider_configurations_empty = MagicMock()
        mock_provider_configurations_empty.get.return_value = None  # Provider not found

        mock_provider_configurations_with_provider = MagicMock()
        mock_provider_configurations_with_provider.get.return_value = (
            mock_provider_config  # Provider found after install
        )

        mock_manager_instance = MagicMock()
        mock_manager_instance.get_configurations.side_effect = [
            mock_provider_configurations_empty,  # First call - no provider
            mock_provider_configurations_with_provider,  # Second call after install - provider found
        ]
        mock_provider_manager.return_value = mock_manager_instance

        # Act
        service = ProviderSyncService()
        # Mock plugin installation
        service._install_plugin_if_needed = MagicMock(return_value=True)
        service._ensure_provider_credential_linked = MagicMock()

        result = service.sync_api_key_to_provider(
            tenant_id=tenant_id,
            api_key_config_id=api_key_config_id,
        )

        # Assert
        assert result["success"] is True
        assert result["provider"] == "openai"

        # Verify plugin installation was attempted
        service._install_plugin_if_needed.assert_called_once_with(tenant_id, "openai")

        # Verify provider configurations was called twice
        assert mock_manager_instance.get_configurations.call_count == 2

    @patch("services.education_management.provider_sync_service.db")
    @patch("services.education_management.provider_sync_service.APIKeyEncryptionService")
    @patch("services.education_management.provider_sync_service.ProviderManager")
    def test_sync_api_key_with_plugin_auto_install_failure(
        self,
        mock_provider_manager,
        mock_encryption_service,
        mock_db,
        mock_api_key_config,
    ):
        """Test API key sync when plugin installation fails."""
        # Arrange
        tenant_id = "test-tenant-id"
        api_key_config_id = "test-api-key-id"

        # Mock database query
        mock_db.session.query.return_value.filter_by.return_value.first.return_value = mock_api_key_config

        # Mock encryption service
        mock_encryption_instance = MagicMock()
        mock_encryption_instance.decrypt.return_value = "sk-test-key-12345"
        mock_encryption_service.return_value = mock_encryption_instance

        # Mock provider manager - always returns no provider
        mock_provider_configurations_empty = MagicMock()
        mock_provider_configurations_empty.get.return_value = None

        mock_manager_instance = MagicMock()
        mock_manager_instance.get_configurations.return_value = mock_provider_configurations_empty
        mock_provider_manager.return_value = mock_manager_instance

        # Act
        service = ProviderSyncService()
        # Mock plugin installation to fail
        service._install_plugin_if_needed = MagicMock(return_value=False)

        result = service.sync_api_key_to_provider(
            tenant_id=tenant_id,
            api_key_config_id=api_key_config_id,
        )

        # Assert
        assert result["success"] is False
        assert "not available" in result["message"].lower()

        # Verify plugin installation was attempted
        service._install_plugin_if_needed.assert_called_once_with(tenant_id, "openai")

    @patch("services.education_management.provider_sync_service.ProviderManager")
    @patch("services.education_management.provider_sync_service.APIKeyEncryptionService")
    @patch("services.plugin.plugin_service.PluginService")
    def test_install_plugin_if_needed_success(
        self,
        mock_plugin_service_class,
        mock_encryption_service,
        mock_provider_manager,
    ):
        """Test successful plugin installation."""
        # Arrange
        service = ProviderSyncService()
        tenant_id = "test-tenant-id"
        provider = "anthropic"

        # Mock PluginService.install_from_marketplace_pkg
        mock_plugin_service_class.install_from_marketplace_pkg = MagicMock()

        # Act
        result = service._install_plugin_if_needed(tenant_id, provider)

        # Assert
        assert result is True
        mock_plugin_service_class.install_from_marketplace_pkg.assert_called_once_with(
            tenant_id, ["langgenius/anthropic"]
        )

    @patch("services.education_management.provider_sync_service.ProviderManager")
    @patch("services.education_management.provider_sync_service.APIKeyEncryptionService")
    def test_install_plugin_if_needed_no_mapping(
        self,
        mock_encryption_service,
        mock_provider_manager,
    ):
        """Test plugin installation when no mapping exists."""
        # Arrange
        service = ProviderSyncService()
        tenant_id = "test-tenant-id"
        provider = "unsupported_provider"

        # Act
        result = service._install_plugin_if_needed(tenant_id, provider)

        # Assert
        assert result is False

    @patch("services.education_management.provider_sync_service.ProviderManager")
    @patch("services.education_management.provider_sync_service.APIKeyEncryptionService")
    @patch("services.plugin.plugin_service.PluginService")
    def test_install_plugin_if_needed_installation_error(
        self,
        mock_plugin_service_class,
        mock_encryption_service,
        mock_provider_manager,
    ):
        """Test plugin installation when marketplace service fails."""
        # Arrange
        service = ProviderSyncService()
        tenant_id = "test-tenant-id"
        provider = "google"

        # Mock PluginService to raise exception
        mock_plugin_service_class.install_from_marketplace_pkg = MagicMock(side_effect=Exception("Marketplace error"))

        # Act
        result = service._install_plugin_if_needed(tenant_id, provider)

        # Assert
        assert result is False
