"""Tests for UserToolConfigService (Story 2.1B - Session 7)."""

from unittest.mock import MagicMock, patch

import pytest

from services.education_management.user_tool_config_service import UserToolConfigService


@pytest.fixture(autouse=True)
def mock_encryption_service():
    """Auto-mock encryption service for all tests."""
    with patch("services.education_management.user_tool_config_service.APIKeyEncryptionService") as mock:
        mock_instance = MagicMock()
        mock_instance.encrypt.return_value = "encrypted_api_key"
        mock_instance.decrypt.return_value = "decrypted_api_key"
        mock.return_value = mock_instance
        yield mock


class TestUserToolConfigService:
    """Test User Tool Config CRUD operations."""

    @patch("services.education_management.user_tool_config_service.db")
    def test_create_user_tool_config_success(self, mock_db):
        """Test successful user tool config creation."""
        # Arrange
        service = UserToolConfigService()
        mock_query = MagicMock()
        mock_query.filter.return_value.first.return_value = None  # No existing config
        mock_db.session.query.return_value = mock_query

        # Act
        result = service.create_user_tool_config(
            user_id="user-123",
            provider="google",
            api_key="test_api_key_123",
            config_json={"timeout": 30},
        )

        # Assert
        assert result.user_id == "user-123"
        assert result.provider == "google"
        assert result.api_key_encrypted == "encrypted_api_key"
        assert result.config_json == {"timeout": 30}
        assert result.is_active is True
        service.encryption_service.encrypt.assert_called_once_with("test_api_key_123")
        mock_db.session.add.assert_called_once()
        mock_db.session.commit.assert_called_once()

    @patch("services.education_management.user_tool_config_service.db")
    def test_create_user_tool_config_duplicate(self, mock_db):
        """Test user tool config creation with duplicate provider."""
        # Arrange
        service = UserToolConfigService()
        mock_existing_config = MagicMock()
        mock_query = MagicMock()
        mock_query.filter.return_value.first.return_value = mock_existing_config
        mock_db.session.query.return_value = mock_query

        # Act & Assert
        with pytest.raises(ValueError, match="already exists"):
            service.create_user_tool_config(
                user_id="user-123",
                provider="google",
                api_key="test_api_key",
            )

    def test_create_user_tool_config_invalid_provider(self):
        """Test user tool config creation with invalid provider."""
        # Arrange
        service = UserToolConfigService()

        # Act & Assert
        with pytest.raises(ValueError, match="Unsupported provider"):
            service.create_user_tool_config(
                user_id="user-123",
                provider="invalid_provider",
                api_key="test_api_key",
            )

    @patch("services.education_management.user_tool_config_service.db")
    def test_get_user_tool_config_success(self, mock_db):
        """Test successful user tool config retrieval."""
        # Arrange
        service = UserToolConfigService()
        mock_config = MagicMock()
        mock_config.user_id = "user-123"
        mock_config.provider = "google"
        mock_query = MagicMock()
        mock_query.filter.return_value.first.return_value = mock_config
        mock_db.session.query.return_value = mock_query

        # Act
        result = service.get_user_tool_config(
            user_id="user-123",
            provider="google",
        )

        # Assert
        assert result == mock_config
        mock_db.session.query.assert_called_once()

    @patch("services.education_management.user_tool_config_service.db")
    def test_get_user_tool_config_not_found(self, mock_db):
        """Test user tool config retrieval when not found."""
        # Arrange
        service = UserToolConfigService()
        mock_query = MagicMock()
        mock_query.filter.return_value.first.return_value = None
        mock_db.session.query.return_value = mock_query

        # Act
        result = service.get_user_tool_config(
            user_id="user-123",
            provider="google",
        )

        # Assert
        assert result is None

    @patch("services.education_management.user_tool_config_service.db")
    def test_list_user_tool_configs(self, mock_db):
        """Test listing user tool configs."""
        # Arrange
        service = UserToolConfigService()
        mock_config1 = MagicMock()
        mock_config2 = MagicMock()
        mock_query = MagicMock()
        mock_query.filter.return_value.all.return_value = [mock_config1, mock_config2]
        mock_db.session.query.return_value = mock_query

        # Act
        result = service.list_user_tool_configs(user_id="user-123")

        # Assert
        assert len(result) == 2
        assert result == [mock_config1, mock_config2]

    @patch("services.education_management.user_tool_config_service.db")
    def test_list_user_tool_configs_with_filters(self, mock_db):
        """Test listing user tool configs with provider filter."""
        # Arrange
        service = UserToolConfigService()
        mock_config = MagicMock()
        # Need 3 filter chains: user_id, provider, is_active
        mock_result = MagicMock()
        mock_result.all.return_value = [mock_config]
        mock_query3 = MagicMock()
        mock_query3.filter.return_value = mock_result
        mock_query2 = MagicMock()
        mock_query2.filter.return_value = mock_query3
        mock_query = MagicMock()
        mock_query.filter.return_value = mock_query2
        mock_db.session.query.return_value = mock_query

        # Act
        result = service.list_user_tool_configs(
            user_id="user-123",
            provider="google",
            is_active=True,
        )

        # Assert
        assert len(result) == 1

    @patch("services.education_management.user_tool_config_service.db")
    def test_update_user_tool_config_success(self, mock_db):
        """Test successful user tool config update."""
        # Arrange
        service = UserToolConfigService()
        mock_config = MagicMock()
        mock_config.id = "config-123"
        mock_config.user_id = "user-123"
        mock_query = MagicMock()
        mock_query.filter.return_value.first.return_value = mock_config
        mock_db.session.query.return_value = mock_query

        # Act
        result = service.update_user_tool_config(
            config_id="config-123",
            user_id="user-123",
            api_key="new_api_key",
            config_json={"timeout": 60},
            is_active=False,
        )

        # Assert
        assert result == mock_config
        assert mock_config.api_key_encrypted == "encrypted_api_key"
        assert mock_config.config_json == {"timeout": 60}
        assert mock_config.is_active is False
        service.encryption_service.encrypt.assert_called_once_with("new_api_key")
        mock_db.session.commit.assert_called_once()

    @patch("services.education_management.user_tool_config_service.db")
    def test_update_user_tool_config_not_found(self, mock_db):
        """Test user tool config update when config not found."""
        # Arrange
        service = UserToolConfigService()
        mock_query = MagicMock()
        mock_query.filter.return_value.first.return_value = None
        mock_db.session.query.return_value = mock_query

        # Act & Assert
        with pytest.raises(ValueError, match="not found"):
            service.update_user_tool_config(
                config_id="config-123",
                user_id="user-123",
                api_key="new_api_key",
            )

    @patch("services.education_management.user_tool_config_service.db")
    def test_update_user_tool_config_wrong_user(self, mock_db):
        """Test user tool config update by wrong user."""
        # Arrange
        service = UserToolConfigService()
        mock_config = MagicMock()
        mock_config.user_id = "user-456"  # Different user
        mock_query = MagicMock()
        mock_query.filter.return_value.first.return_value = mock_config
        mock_db.session.query.return_value = mock_query

        # Act & Assert
        with pytest.raises(ValueError, match="does not own"):
            service.update_user_tool_config(
                config_id="config-123",
                user_id="user-123",
                api_key="new_api_key",
            )

    @patch("services.education_management.user_tool_config_service.db")
    def test_delete_user_tool_config_success(self, mock_db):
        """Test successful user tool config deletion."""
        # Arrange
        service = UserToolConfigService()
        mock_config = MagicMock()
        mock_config.id = "config-123"
        mock_config.user_id = "user-123"
        mock_config.provider = "google"
        mock_query = MagicMock()
        mock_query.filter.return_value.first.return_value = mock_config
        mock_db.session.query.return_value = mock_query

        # Act
        service.delete_user_tool_config(
            config_id="config-123",
            user_id="user-123",
        )

        # Assert
        mock_db.session.delete.assert_called_once_with(mock_config)
        mock_db.session.commit.assert_called_once()

    @patch("services.education_management.user_tool_config_service.db")
    def test_delete_user_tool_config_not_found(self, mock_db):
        """Test user tool config deletion when config not found."""
        # Arrange
        service = UserToolConfigService()
        mock_query = MagicMock()
        mock_query.filter.return_value.first.return_value = None
        mock_db.session.query.return_value = mock_query

        # Act & Assert
        with pytest.raises(ValueError, match="not found"):
            service.delete_user_tool_config(
                config_id="config-123",
                user_id="user-123",
            )

    @patch("services.education_management.user_tool_config_service.db")
    def test_delete_user_tool_config_wrong_user(self, mock_db):
        """Test user tool config deletion by wrong user."""
        # Arrange
        service = UserToolConfigService()
        mock_config = MagicMock()
        mock_config.user_id = "user-456"  # Different user
        mock_query = MagicMock()
        mock_query.filter.return_value.first.return_value = mock_config
        mock_db.session.query.return_value = mock_query

        # Act & Assert
        with pytest.raises(ValueError, match="does not own"):
            service.delete_user_tool_config(
                config_id="config-123",
                user_id="user-123",
            )

    @patch("services.education_management.user_tool_config_service.db")
    def test_get_decrypted_key_success(self, mock_db):
        """Test successful API key decryption."""
        # Arrange
        service = UserToolConfigService()
        mock_config = MagicMock()
        mock_config.user_id = "user-123"
        mock_config.api_key_encrypted = "encrypted_api_key"
        mock_query = MagicMock()
        mock_query.filter.return_value.first.return_value = mock_config
        mock_db.session.query.return_value = mock_query

        # Act
        result = service.get_decrypted_key(
            config_id="config-123",
            user_id="user-123",
        )

        # Assert
        assert result == "decrypted_api_key"
        service.encryption_service.decrypt.assert_called_once_with("encrypted_api_key")

    @patch("services.education_management.user_tool_config_service.db")
    def test_get_decrypted_key_wrong_user(self, mock_db):
        """Test API key decryption by wrong user."""
        # Arrange
        service = UserToolConfigService()
        mock_config = MagicMock()
        mock_config.user_id = "user-456"  # Different user
        mock_query = MagicMock()
        mock_query.filter.return_value.first.return_value = mock_config
        mock_db.session.query.return_value = mock_query

        # Act & Assert
        with pytest.raises(ValueError, match="does not own"):
            service.get_decrypted_key(
                config_id="config-123",
                user_id="user-123",
            )
