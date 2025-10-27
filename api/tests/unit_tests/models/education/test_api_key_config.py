"""Unit tests for AdminAPIKeyConfig model."""

from models.education.api_key_config import AdminAPIKeyConfig


def test_admin_api_key_config_repr():
    """Test __repr__ method of AdminAPIKeyConfig."""
    # Arrange
    config = AdminAPIKeyConfig(
        id="config-id-123",
        key_name="OpenAI Production Key",
        provider="openai",
    )

    # Act
    repr_str = repr(config)

    # Assert
    assert "AdminAPIKeyConfig" in repr_str
    assert "config-id-123" in repr_str
    assert "OpenAI Production Key" in repr_str
    assert "openai" in repr_str


def test_admin_api_key_config_attributes():
    """Test AdminAPIKeyConfig model attributes."""
    # Arrange
    config_id = "config-001"
    key_name = "Anthropic Dev Key"
    provider = "anthropic"
    api_key_encrypted = "encrypted_key_data_here"
    is_active = True
    priority = "primary"
    created_by = "admin-account-id"

    # Act
    config = AdminAPIKeyConfig(
        id=config_id,
        key_name=key_name,
        provider=provider,
        api_key_encrypted=api_key_encrypted,
        is_active=is_active,
        priority=priority,
        created_by=created_by,
    )

    # Assert
    assert config.id == config_id
    assert config.key_name == key_name
    assert config.provider == provider
    assert config.api_key_encrypted == api_key_encrypted
    assert config.is_active == is_active
    assert config.priority == priority
    assert config.created_by == created_by


def test_admin_api_key_config_tablename():
    """Test AdminAPIKeyConfig table name."""
    # Assert
    assert AdminAPIKeyConfig.__tablename__ == "admin_api_key_configs"


def test_admin_api_key_config_priority_field():
    """Test AdminAPIKeyConfig with priority field."""
    # Arrange & Act
    config = AdminAPIKeyConfig(
        id="config-priority-test",
        key_name="Priority Test Key",
        provider="google",
        api_key_encrypted="encrypted_data",
        is_active=True,
        priority="secondary",
        created_by="admin-123",
    )

    # Assert
    assert config.priority == "secondary"
    assert config.created_by == "admin-123"


def test_admin_api_key_config_different_providers():
    """Test AdminAPIKeyConfig with different LLM providers."""
    # Arrange & Act
    openai_config = AdminAPIKeyConfig(
        id="openai-1",
        key_name="OpenAI Key",
        provider="openai",
        api_key_encrypted="enc_openai",
        is_active=True,
        priority="primary",
        created_by="admin-123",
    )

    anthropic_config = AdminAPIKeyConfig(
        id="anthropic-1",
        key_name="Anthropic Key",
        provider="anthropic",
        api_key_encrypted="enc_anthropic",
        is_active=True,
        priority="secondary",
        created_by="admin-123",
    )

    google_config = AdminAPIKeyConfig(
        id="google-1",
        key_name="Google Key",
        provider="google",
        api_key_encrypted="enc_google",
        is_active=False,
        priority="tertiary",
        created_by="admin-123",
    )

    # Assert
    assert openai_config.provider == "openai"
    assert anthropic_config.provider == "anthropic"
    assert google_config.provider == "google"
    assert google_config.is_active is False


# Story 1.8 - Task 14.3: Model method tests


def test_get_masked_key_short():
    """Test get_masked_key() with short API key."""
    # Arrange
    config = AdminAPIKeyConfig(
        id="test-1",
        key_name="Test Key",
        provider="openai",
        api_key_encrypted="encrypted",
        created_by="admin-123",
    )
    short_key = "sk-1234"

    # Act
    masked = config.get_masked_key(short_key)

    # Assert
    assert masked == "****1234"


def test_get_masked_key_long():
    """Test get_masked_key() with long API key."""
    # Arrange
    long_key = "sk-proj-abcdefghijklmnopqrstuvwxyz1234567890ABCDEFGHIJKLMNOP"
    config = AdminAPIKeyConfig(
        id="test-2",
        key_name="Test Key",
        provider="openai",
        api_key_encrypted="encrypted",
        created_by="admin-123",
    )

    # Act
    masked = config.get_masked_key(long_key)

    # Assert
    assert masked.startswith("sk-proj")
    assert "****" in masked
    assert masked.endswith(long_key[-4:])
    assert len(masked) < len(long_key)


def test_validate_provider_valid():
    """Test validate_provider() with valid provider."""
    # Arrange
    config = AdminAPIKeyConfig(
        id="test-3",
        key_name="Test Key",
        provider="openai",
        api_key_encrypted="encrypted",
        created_by="admin-123",
    )

    # Act & Assert - should not raise any exception
    config.validate_provider()  # Should complete without error


def test_validate_priority_valid():
    """Test validate_priority() with valid priority."""
    # Arrange
    config = AdminAPIKeyConfig(
        id="test-4",
        key_name="Test Key",
        provider="openai",
        priority="primary",
        api_key_encrypted="encrypted",
        created_by="admin-123",
    )

    # Act & Assert - should not raise any exception
    config.validate_priority()  # Should complete without error
