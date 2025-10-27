"""Tests for APIKeyEncryptionService (Story 1.8 - Task 14.1)."""

from unittest.mock import patch

import pytest

from services.education_management.encryption_service import APIKeyEncryptionService


@pytest.fixture(scope="module", autouse=True)
def mock_encryption_key():
    """Mock encryption key for all tests."""
    # Valid Fernet key for testing (32 bytes, URL-safe base64 encoded)
    from cryptography.fernet import Fernet

    test_key = Fernet.generate_key().decode("utf-8")
    with patch("services.education_management.encryption_service.dify_config") as mock_config:
        mock_config.API_KEY_ENCRYPTION_KEY = test_key
        yield mock_config


class TestAPIKeyEncryptionService:
    """Test encryption and decryption of API keys."""

    def test_encrypt_decrypt_success(self):
        """Test successful encryption and decryption."""
        # Arrange
        service = APIKeyEncryptionService()
        original_key = "sk-proj-test1234567890abcdefghijklmnopqrstuvwxyz"

        # Act
        encrypted = service.encrypt(original_key)
        decrypted = service.decrypt(encrypted)

        # Assert
        assert decrypted == original_key, "Decrypted key should match original"
        assert encrypted != original_key, "Encrypted key should differ from original"
        assert len(encrypted) > len(original_key), "Encrypted key should be longer"

    def test_encrypt_different_results(self):
        """Test that encrypting the same key twice produces different results (due to IV)."""
        # Arrange
        service = APIKeyEncryptionService()
        original_key = "sk-proj-test1234567890"

        # Act
        encrypted1 = service.encrypt(original_key)
        encrypted2 = service.encrypt(original_key)

        # Assert
        assert encrypted1 != encrypted2, "Encrypted results should differ (IV)"
        assert service.decrypt(encrypted1) == original_key
        assert service.decrypt(encrypted2) == original_key

    def test_encrypt_empty_string(self):
        """Test encrypting an empty string."""
        # Arrange
        service = APIKeyEncryptionService()
        original_key = ""

        # Act
        encrypted = service.encrypt(original_key)
        decrypted = service.decrypt(encrypted)

        # Assert
        assert decrypted == original_key
        assert encrypted != original_key

    def test_decrypt_invalid_data_raises_error(self):
        """Test that decrypting invalid data raises an error."""
        # Arrange
        from services.education_management.encryption_service import DecryptionError

        service = APIKeyEncryptionService()
        invalid_encrypted = "invalid_encrypted_data"

        # Act & Assert
        with pytest.raises(DecryptionError):
            service.decrypt(invalid_encrypted)

    def test_validate_encryption_key_success(self):
        """Test successful validation of encryption key."""
        # Arrange
        service = APIKeyEncryptionService()

        # Act
        is_valid = service.validate_encryption_key()

        # Assert
        assert is_valid is True, "Encryption key should be valid"

    def test_encrypt_long_api_key(self):
        """Test encrypting a very long API key."""
        # Arrange
        service = APIKeyEncryptionService()
        long_key = "sk-proj-" + "a" * 200

        # Act
        encrypted = service.encrypt(long_key)
        decrypted = service.decrypt(encrypted)

        # Assert
        assert decrypted == long_key
        assert encrypted != long_key
