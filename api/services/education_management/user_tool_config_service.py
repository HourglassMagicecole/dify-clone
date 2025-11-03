"""User Tool Config Service.

This module provides business logic for user-specific tool configuration management (CRUD).
"""

import logging
import uuid
from typing import Any

from extensions.ext_database import db
from models.education.user_tool_config import UserToolConfig
from services.education_management.encryption_service import APIKeyEncryptionService

logger = logging.getLogger(__name__)


class UserToolConfigService:
    """
    User tool configuration management service.

    Provides CRUD functionality for user-specific tool provider API keys and settings.
    """

    def __init__(self) -> None:
        """Initialize user tool config service with encryption service."""
        self.encryption_service = APIKeyEncryptionService()

    def create_user_tool_config(
        self,
        user_id: str,
        provider: str,
        api_key: str,
        config_json: dict[str, Any] | None = None,
    ) -> UserToolConfig:
        """
        Create user tool configuration (encrypt and save API key).

        Args:
            user_id: User account ID
            provider: Tool provider name (e.g., "google", "openweather")
            api_key: Plaintext API key
            config_json: Additional configuration (e.g., endpoint URL, timeout)

        Returns:
            Created UserToolConfig instance

        Raises:
            ValueError: Invalid provider or duplicate configuration
        """
        # 1. Validation
        if provider not in UserToolConfig.SUPPORTED_PROVIDERS:
            raise ValueError(f"Unsupported provider: {provider}")

        # 2. Check for existing configuration (user + provider must be unique)
        existing_config = (
            db.session.query(UserToolConfig)
            .filter(
                UserToolConfig.user_id == user_id,
                UserToolConfig.provider == provider,
            )
            .first()
        )

        if existing_config:
            raise ValueError(f"Tool configuration for provider '{provider}' already exists for this user")

        # 3. Encrypt API key
        encrypted_key = self.encryption_service.encrypt(api_key)
        logger.info("User tool API key encrypted for provider: %s (user: %s)", provider, user_id)

        # 4. Create model
        user_tool_config = UserToolConfig(
            id=str(uuid.uuid4()),
            user_id=user_id,
            provider=provider,
            api_key_encrypted=encrypted_key,
            config_json=config_json,
            is_active=True,
        )

        # 5. Save
        db.session.add(user_tool_config)
        db.session.commit()

        logger.info("User tool config created successfully: provider=%s, user=%s", provider, user_id)
        return user_tool_config

    def get_user_tool_config(
        self,
        user_id: str,
        provider: str,
    ) -> UserToolConfig | None:
        """
        Get user tool configuration for a specific provider.

        Args:
            user_id: User account ID
            provider: Tool provider name

        Returns:
            UserToolConfig instance or None if not found
        """
        config = (
            db.session.query(UserToolConfig)
            .filter(
                UserToolConfig.user_id == user_id,
                UserToolConfig.provider == provider,
                UserToolConfig.is_active == True,
            )
            .first()
        )

        return config

    def list_user_tool_configs(
        self,
        user_id: str,
        provider: str | None = None,
        is_active: bool | None = None,
    ) -> list[UserToolConfig]:
        """
        List user tool configurations.

        Args:
            user_id: User account ID
            provider: Provider filter (optional)
            is_active: Active status filter (optional)

        Returns:
            List of UserToolConfig instances
        """
        query = db.session.query(UserToolConfig).filter(UserToolConfig.user_id == user_id)

        # Apply filters
        if provider is not None:
            query = query.filter(UserToolConfig.provider == provider)

        if is_active is not None:
            query = query.filter(UserToolConfig.is_active == is_active)

        configs = query.all()
        logger.info("Listed %d user tool configs for user: %s", len(configs), user_id)
        return configs

    def update_user_tool_config(
        self,
        config_id: str,
        user_id: str,
        api_key: str | None = None,
        config_json: dict[str, Any] | None = None,
        is_active: bool | None = None,
    ) -> UserToolConfig:
        """
        Update user tool configuration.

        Args:
            config_id: Configuration ID
            user_id: User account ID (for ownership verification)
            api_key: New plaintext API key (optional)
            config_json: New additional configuration (optional)
            is_active: New active status (optional)

        Returns:
            Updated UserToolConfig instance

        Raises:
            ValueError: Configuration not found or not owned by user
        """
        # 1. Get existing config
        config = db.session.query(UserToolConfig).filter(UserToolConfig.id == config_id).first()

        if not config:
            raise ValueError(f"User tool config not found: {config_id}")

        # 2. Verify ownership
        if config.user_id != user_id:
            raise ValueError(f"User {user_id} does not own this configuration")

        # 3. Update fields
        if api_key is not None:
            encrypted_key = self.encryption_service.encrypt(api_key)
            config.api_key_encrypted = encrypted_key
            logger.info("User tool API key updated for config: %s", config_id)

        if config_json is not None:
            config.config_json = config_json

        if is_active is not None:
            config.is_active = is_active

        # 4. Save
        db.session.commit()

        logger.info("User tool config updated successfully: %s (user: %s)", config_id, user_id)
        return config

    def delete_user_tool_config(
        self,
        config_id: str,
        user_id: str,
    ) -> None:
        """
        Delete user tool configuration.

        Args:
            config_id: Configuration ID
            user_id: User account ID (for ownership verification)

        Raises:
            ValueError: Configuration not found or not owned by user
        """
        # 1. Get existing config
        config = db.session.query(UserToolConfig).filter(UserToolConfig.id == config_id).first()

        if not config:
            raise ValueError(f"User tool config not found: {config_id}")

        # 2. Verify ownership
        if config.user_id != user_id:
            raise ValueError(f"User {user_id} does not own this configuration")

        # 3. Delete
        db.session.delete(config)
        db.session.commit()

        logger.info(
            "User tool config deleted successfully: %s (user: %s, provider: %s)", config_id, user_id, config.provider
        )

    def get_decrypted_key(self, config_id: str, user_id: str) -> str:
        """
        Get decrypted API key.

        Args:
            config_id: Configuration ID
            user_id: User account ID (for ownership verification)

        Returns:
            Decrypted plaintext API key

        Raises:
            ValueError: Configuration not found or not owned by user
        """
        # 1. Get config
        config = db.session.query(UserToolConfig).filter(UserToolConfig.id == config_id).first()

        if not config:
            raise ValueError(f"User tool config not found: {config_id}")

        # 2. Verify ownership
        if config.user_id != user_id:
            raise ValueError(f"User {user_id} does not own this configuration")

        # 3. Decrypt
        decrypted_key = self.encryption_service.decrypt(config.api_key_encrypted)
        return decrypted_key
