"""Tests for APIKeyService (Story 1.8 - Task 14.2)."""

from unittest.mock import MagicMock, patch

import pytest

from services.education_management.api_key_service import APIKeyService


@pytest.fixture(autouse=True)
def mock_encryption_service():
    """Auto-mock encryption service for all tests."""
    with patch("services.education_management.api_key_service.APIKeyEncryptionService") as mock:
        mock_instance = MagicMock()
        mock_instance.encrypt.return_value = "encrypted_key"
        mock_instance.decrypt.return_value = "decrypted_key"
        mock.return_value = mock_instance
        yield mock


class TestAPIKeyService:
    """Test API Key CRUD operations."""

    @patch("services.education_management.api_key_service.db")
    def test_create_api_key_success(self, mock_db):
        """Test successful API key creation."""
        # Arrange
        service = APIKeyService()
        # Mock priority uniqueness check (no existing key with same priority)
        mock_query = MagicMock()
        mock_query.filter.return_value = mock_query
        mock_query.first.return_value = None
        mock_db.session.query.return_value = mock_query

        # Act
        result = service.create_api_key(
            key_name="Test OpenAI Key",
            provider="openai",
            api_key="sk-test1234567890",
            priority="primary",
            created_by="user-123",
        )

        # Assert
        assert result.key_name == "Test OpenAI Key"
        assert result.provider == "openai"
        assert result.priority == "primary"
        service.encryption_service.encrypt.assert_called_once_with("sk-test1234567890")
        mock_db.session.add.assert_called_once()
        mock_db.session.commit.assert_called_once()

    def test_create_api_key_invalid_provider(self):
        """Test API key creation with invalid provider."""
        # Arrange
        service = APIKeyService()

        # Act & Assert
        with pytest.raises(ValueError, match="Unsupported provider"):
            service.create_api_key(
                key_name="Test",
                provider="invalid_provider",
                api_key="sk-test",
                priority="primary",
                created_by="user-123",
            )

    @patch("services.education_management.api_key_service.db")
    def test_list_api_keys_filters_by_provider(self, mock_db):
        """Test listing API keys with provider filter."""
        # Arrange
        service = APIKeyService()
        mock_execute = MagicMock()
        mock_scalars = MagicMock()
        mock_scalars.all.return_value = []
        mock_execute.scalars.return_value = mock_scalars
        mock_db.session.execute.return_value = mock_execute

        # Act
        result = service.list_api_keys(
            current_user_id="user-123", current_user_role="owner", provider="openai", is_active=True
        )

        # Assert
        assert result == []
        mock_db.session.execute.assert_called_once()

    @patch("services.education_management.api_key_service.db")
    def test_update_api_key_success(self, mock_db):
        """Test successful API key update."""
        # Arrange
        service = APIKeyService()
        mock_key = MagicMock()
        mock_key.id = "key-123"
        mock_key.key_name = "Old Name"
        mock_key.provider = "openai"
        mock_execute = MagicMock()
        mock_execute.scalar_one_or_none.return_value = mock_key
        mock_db.session.execute.return_value = mock_execute
        # Mock priority uniqueness check (no existing key with same priority)
        mock_query = MagicMock()
        mock_query.filter.return_value = mock_query
        mock_query.first.return_value = None
        mock_db.session.query.return_value = mock_query

        # Act
        result = service.update_api_key(
            key_id="key-123",
            key_name="New Name",
            priority="primary",  # primary는 항상 허용 (순서 검증 우회)
        )

        # Assert
        assert result.key_name == "New Name"
        assert result.priority == "primary"
        mock_db.session.commit.assert_called_once()

    @patch("services.education_management.api_key_service.db")
    def test_delete_api_key_success(self, mock_db):
        """Test successful API key deletion."""
        # Arrange
        service = APIKeyService()
        mock_key = MagicMock()
        mock_key.id = "key-123"
        mock_key.provider = "openai"
        mock_key.priority = "tertiary"  # tertiary 삭제 시 승격 불필요
        mock_execute = MagicMock()
        mock_execute.scalar_one_or_none.return_value = mock_key
        mock_db.session.execute.return_value = mock_execute
        # Mock for _promote_lower_priorities (no lower priority keys to promote)
        mock_query = MagicMock()
        mock_query.filter.return_value = mock_query
        mock_query.first.return_value = None
        mock_db.session.query.return_value = mock_query

        # Act
        service.delete_api_key(key_id="key-123")

        # Assert
        mock_db.session.delete.assert_called_once_with(mock_key)

    @patch("services.education_management.api_key_service.db")
    def test_delete_api_key_not_found(self, mock_db):
        """Test deleting non-existent API key."""
        # Arrange
        service = APIKeyService()
        mock_execute = MagicMock()
        mock_execute.scalar_one_or_none.return_value = None
        mock_db.session.execute.return_value = mock_execute

        # Act & Assert
        with pytest.raises(ValueError, match="API Key not found"):
            service.delete_api_key(key_id="non-existent")
