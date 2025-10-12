"""Unit tests for AdminAPIKeyConfig model."""

from datetime import datetime

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
    quota_limit = 100000
    quota_used = 5000
    last_reset_at = datetime(2025, 10, 1)
    created_by = "admin-account-id"

    # Act
    config = AdminAPIKeyConfig(
        id=config_id,
        key_name=key_name,
        provider=provider,
        api_key_encrypted=api_key_encrypted,
        is_active=is_active,
        quota_limit=quota_limit,
        quota_used=quota_used,
        last_reset_at=last_reset_at,
        created_by=created_by,
    )

    # Assert
    assert config.id == config_id
    assert config.key_name == key_name
    assert config.provider == provider
    assert config.api_key_encrypted == api_key_encrypted
    assert config.is_active == is_active
    assert config.quota_limit == quota_limit
    assert config.quota_used == quota_used
    assert config.last_reset_at == last_reset_at
    assert config.created_by == created_by


def test_admin_api_key_config_tablename():
    """Test AdminAPIKeyConfig table name."""
    # Assert
    assert AdminAPIKeyConfig.__tablename__ == "admin_api_key_configs"


def test_admin_api_key_config_nullable_quota_limit():
    """Test AdminAPIKeyConfig with nullable quota_limit."""
    # Arrange & Act
    config = AdminAPIKeyConfig(
        id="config-unlimited",
        key_name="Unlimited Key",
        provider="google",
        api_key_encrypted="encrypted_data",
        is_active=True,
        quota_limit=None,  # Nullable - unlimited
        quota_used=0,
        last_reset_at=datetime.now(),
        created_by=None,  # Nullable
    )

    # Assert
    assert config.quota_limit is None
    assert config.created_by is None


def test_admin_api_key_config_different_providers():
    """Test AdminAPIKeyConfig with different LLM providers."""
    # Arrange & Act
    openai_config = AdminAPIKeyConfig(
        id="openai-1",
        key_name="OpenAI Key",
        provider="openai",
        api_key_encrypted="enc_openai",
        is_active=True,
        quota_limit=50000,
        quota_used=0,
        last_reset_at=datetime.now(),
    )

    anthropic_config = AdminAPIKeyConfig(
        id="anthropic-1",
        key_name="Anthropic Key",
        provider="anthropic",
        api_key_encrypted="enc_anthropic",
        is_active=True,
        quota_limit=100000,
        quota_used=0,
        last_reset_at=datetime.now(),
    )

    google_config = AdminAPIKeyConfig(
        id="google-1",
        key_name="Google Key",
        provider="google",
        api_key_encrypted="enc_google",
        is_active=False,
        quota_limit=None,
        quota_used=0,
        last_reset_at=datetime.now(),
    )

    # Assert
    assert openai_config.provider == "openai"
    assert anthropic_config.provider == "anthropic"
    assert google_config.provider == "google"
    assert google_config.is_active is False
