"""Provider Sync Service for synchronizing AdminAPIKeyConfig with Dify Model Provider system.

This service bridges the educational API Key management (AdminAPIKeyConfig)
with Dify's built-in Model Provider system to enable TTS/STT and other
model-dependent tools to work with centrally managed API keys.
"""

import logging
from typing import Any

from core.provider_manager import ProviderManager
from extensions.ext_database import db
from models.education.api_key_config import AdminAPIKeyConfig
from services.education_management.encryption_service import APIKeyEncryptionService

logger = logging.getLogger(__name__)


class ProviderSyncService:
    """
    Service for synchronizing API keys between AdminAPIKeyConfig and Provider system.

    This service ensures that API keys registered through the educational interface
    are automatically available to Dify's Model Provider system for TTS, STT,
    and other model-dependent tools.
    """

    # Provider mapping: AdminAPIKeyConfig.provider → Dify provider name
    PROVIDER_MAPPING: dict[str, str] = {
        "openai": "openai",
        "anthropic": "anthropic",
        "google": "google",
        "cohere": "cohere",
    }

    # Plugin unique identifier mapping for marketplace installation
    # Format: provider_name → marketplace plugin identifier
    PLUGIN_MAPPING: dict[str, str] = {
        "openai": "langgenius/openai",
        "anthropic": "langgenius/anthropic",
        "google": "langgenius/google",
        "cohere": "langgenius/cohere",
    }

    def __init__(self) -> None:
        """Initialize the sync service."""
        self.encryption_service = APIKeyEncryptionService()
        self.provider_manager = ProviderManager()

    def sync_api_key_to_provider(self, tenant_id: str, api_key_config_id: str) -> dict[str, Any]:
        """
        Sync a single AdminAPIKeyConfig to Dify Provider system.

        Args:
            tenant_id: Tenant ID
            api_key_config_id: AdminAPIKeyConfig ID

        Returns:
            dict with sync status:
                - success: bool
                - message: str
                - provider: str (Dify provider name)

        Raises:
            ValueError: If API Key config not found or provider not supported
        """
        # 1. Get AdminAPIKeyConfig
        api_key_config = db.session.query(AdminAPIKeyConfig).filter_by(id=api_key_config_id).first()

        if not api_key_config:
            raise ValueError(f"AdminAPIKeyConfig not found: {api_key_config_id}")

        if not api_key_config.is_active:
            return {
                "success": False,
                "message": "API Key is not active",
                "provider": api_key_config.provider,
            }

        # 2. Check provider mapping
        dify_provider = self.PROVIDER_MAPPING.get(api_key_config.provider)
        if not dify_provider:
            raise ValueError(f"Provider not supported for sync: {api_key_config.provider}")

        # 3. Decrypt API Key
        decrypted_key = self.encryption_service.decrypt(api_key_config.api_key_encrypted)

        # 4. Prepare credentials for Dify Provider
        credentials = self._build_provider_credentials(dify_provider, decrypted_key)

        # 5. Get provider configuration and create credential
        try:
            # Get all provider configurations
            logger.info(
                "Getting provider configuration: %s (tenant: %s)",
                dify_provider,
                tenant_id,
            )
            provider_configurations = self.provider_manager.get_configurations(tenant_id)

            # Get the specific provider configuration
            provider_configuration = provider_configurations.get(dify_provider)
            if not provider_configuration:
                # Provider not found - attempt to install plugin from marketplace
                logger.warning(
                    "Provider configuration not found: %s (tenant: %s) - attempting plugin installation",
                    dify_provider,
                    tenant_id,
                )

                # Try to install the plugin
                install_success = self._install_plugin_if_needed(tenant_id, dify_provider)

                if install_success:
                    # Retry getting provider configurations after plugin installation
                    logger.info(
                        "Retrying provider configuration retrieval after plugin installation: %s (tenant: %s)",
                        dify_provider,
                        tenant_id,
                    )
                    provider_configurations = self.provider_manager.get_configurations(tenant_id)
                    provider_configuration = provider_configurations.get(dify_provider)

                if not provider_configuration:
                    # Still not available after installation attempt
                    error_msg = (
                        f"Provider '{dify_provider}' not available in Dify"
                        if not install_success
                        else f"Provider '{dify_provider}' plugin installed but configuration still not available"
                    )
                    logger.error(
                        "Provider configuration not found after installation attempt: "
                        "%s (tenant: %s, install_success: %s)",
                        dify_provider,
                        tenant_id,
                        install_success,
                    )
                    return {
                        "success": False,
                        "message": error_msg,
                        "provider": dify_provider,
                    }

            # Create provider credential (will auto-create Provider record if needed)
            logger.info(
                "Creating provider credential: %s (tenant: %s)",
                dify_provider,
                tenant_id,
            )
            credential_name = f"MAI-{api_key_config.key_name}"
            provider_configuration.create_provider_credential(
                credentials=credentials,
                credential_name=credential_name,
            )

            # Ensure Provider record is linked to the new credential
            # (create_provider_credential may not update existing Provider records)
            # This uses Session(db.engine) internally to avoid session isolation issues
            self._ensure_provider_credential_linked(tenant_id, dify_provider, credential_name)

            # Save credential_name to AdminAPIKeyConfig for future updates/deletes
            api_key_config.provider_credential_name = credential_name
            db.session.commit()

            logger.info(
                "Saved provider_credential_name to AdminAPIKeyConfig: %s (key_id: %s)",
                credential_name,
                api_key_config.id,
            )

        except Exception as e:
            logger.error(
                "Failed to sync provider credential: %s (tenant: %s, error: %s)",
                dify_provider,
                tenant_id,
                str(e),
                exc_info=True,
            )
            return {
                "success": False,
                "message": f"Failed to sync to provider: {str(e)}",
                "provider": dify_provider,
            }

        logger.info(
            "Successfully synced API key to provider: %s (tenant: %s, key: %s)",
            dify_provider,
            tenant_id,
            api_key_config.key_name,
        )

        return {
            "success": True,
            "message": "API Key synced to provider successfully",
            "provider": dify_provider,
        }

    def _install_plugin_if_needed(self, tenant_id: str, provider: str) -> bool:
        """
        Install plugin from marketplace if not available.

        Args:
            tenant_id: Tenant ID
            provider: Dify provider name (e.g., "anthropic")

        Returns:
            bool: True if installed successfully, False otherwise
        """
        plugin_identifier = self.PLUGIN_MAPPING.get(provider)
        if not plugin_identifier:
            logger.warning(
                "No plugin mapping found for provider: %s (tenant: %s)",
                provider,
                tenant_id,
            )
            return False

        try:
            from services.plugin.plugin_service import PluginService

            logger.info(
                "Attempting to install plugin from marketplace: %s (tenant: %s, provider: %s)",
                plugin_identifier,
                tenant_id,
                provider,
            )

            # Install plugin from marketplace
            # This will download, verify, and install the plugin
            PluginService.install_from_marketplace_pkg(tenant_id, [plugin_identifier])

            logger.info(
                "Successfully installed plugin: %s (tenant: %s, provider: %s)",
                plugin_identifier,
                tenant_id,
                provider,
            )
            return True

        except Exception as e:
            logger.error(
                "Failed to install plugin: %s (tenant: %s, provider: %s, error: %s)",
                plugin_identifier,
                tenant_id,
                provider,
                str(e),
                exc_info=True,
            )
            return False

    def _build_provider_credentials(self, provider: str, api_key: str) -> dict[str, Any]:
        """
        Build credentials dict for specific provider.

        Args:
            provider: Dify provider name
            api_key: Decrypted API key

        Returns:
            dict: Provider-specific credentials
        """
        if provider == "openai":
            return {
                "openai_api_key": api_key,
            }
        elif provider == "anthropic":
            return {
                "anthropic_api_key": api_key,
            }
        elif provider == "google":
            return {
                "google_api_key": api_key,
            }
        elif provider == "cohere":
            return {
                "api_key": api_key,
            }
        else:
            raise ValueError(f"Unknown provider: {provider}")

    def remove_synced_credentials(self, tenant_id: str, provider: str, credential_name: str) -> dict[str, Any]:
        """
        Remove synced credentials from Provider system.

        This uses the same session creation method as Dify's create_provider_credential()
        to avoid session isolation issues.

        Args:
            tenant_id: Tenant ID
            provider: AdminAPIKeyConfig provider name
            credential_name: Credential name to delete (e.g., "MAI-MyKey")

        Returns:
            dict with removal status
        """
        dify_provider = self.PROVIDER_MAPPING.get(provider)
        if not dify_provider:
            return {
                "success": False,
                "message": f"Provider not supported: {provider}",
            }

        from sqlalchemy import select
        from sqlalchemy.orm import Session

        from models.provider import Provider, ProviderCredential

        # Use Session(db.engine) same as Dify's create_provider_credential()
        # This ensures we can see all committed changes
        logger.info(
            "[DEBUG] Starting remove_synced_credentials: provider=%s, tenant=%s, credential=%s",
            dify_provider,
            tenant_id,
            credential_name,
        )

        with Session(db.engine) as session:
            try:
                # Find the ProviderCredential to delete
                # Note: credential_name is unique (format: "MAI-{key_name}")
                # so we don't need to filter by provider_name
                stmt = select(ProviderCredential).where(
                    ProviderCredential.tenant_id == tenant_id,
                    ProviderCredential.credential_name == credential_name,
                )

                credential = session.execute(stmt).scalar_one_or_none()

                if not credential:
                    logger.warning(
                        "Provider credential not found for deletion: %s (tenant: %s, credential: %s)",
                        dify_provider,
                        tenant_id,
                        credential_name,
                    )
                    return {
                        "success": True,
                        "message": "Credential already removed or not found",
                    }

                credential_id_to_delete = credential.id

                # Find Provider records using this credential
                stmt = select(Provider).where(Provider.credential_id == credential_id_to_delete)
                providers_using_this = session.execute(stmt).scalars().all()

                # Delete the ProviderCredential
                session.delete(credential)
                session.flush()  # Apply deletion before querying for alternatives

                # For each Provider that was using this credential, find an alternative
                for provider_record in providers_using_this:
                    # Find another valid ProviderCredential for the same provider
                    alt_stmt = select(ProviderCredential).where(
                        ProviderCredential.tenant_id == tenant_id,
                        ProviderCredential.provider_name == credential.provider_name,
                        ProviderCredential.id != credential_id_to_delete,
                    )
                    alternative_credential = session.execute(alt_stmt).scalars().first()

                    if alternative_credential:
                        # Link to alternative credential
                        provider_record.credential_id = alternative_credential.id
                        provider_record.is_valid = True
                        logger.info(
                            "Switched Provider to alternative credential: %s → %s",
                            credential_name,
                            alternative_credential.credential_name,
                        )
                    else:
                        # No alternative - mark Provider as invalid
                        provider_record.credential_id = None
                        provider_record.is_valid = False
                        logger.info("No alternative credential found - Provider marked invalid")

                # Commit all changes
                session.commit()

                logger.info(
                    "Successfully removed provider credential: %s (tenant: %s, credential: %s, updated providers: %d)",
                    dify_provider,
                    tenant_id,
                    credential_name,
                    len(providers_using_this),
                )

                return {
                    "success": True,
                    "message": "Provider credentials removed successfully",
                }

            except Exception as e:
                session.rollback()
                logger.error(
                    "Failed to remove synced credentials: %s (tenant: %s, error: %s)",
                    dify_provider,
                    tenant_id,
                    str(e),
                    exc_info=True,
                )
                return {
                    "success": False,
                    "message": f"Failed to remove sync: {str(e)}",
                }

    def _ensure_provider_credential_linked(self, tenant_id: str, dify_provider: str, credential_name: str) -> None:
        """
        Ensure Provider record is properly linked to ProviderCredential.

        This uses the same session creation method as Dify's create_provider_credential()
        to avoid session isolation issues.

        Args:
            tenant_id: Tenant ID
            dify_provider: Dify provider name (e.g., "openai")
            credential_name: Credential name (e.g., "MAI-MyKey")

        Raises:
            Exception: If linking fails
        """
        from sqlalchemy import select
        from sqlalchemy.orm import Session

        from models.provider import Provider, ProviderCredential

        # Use Session(db.engine) same as Dify's create_provider_credential()
        # This ensures we see all committed changes from that function
        with Session(db.engine) as session:
            try:
                # Find the ProviderCredential that was just created
                stmt = select(ProviderCredential).where(
                    ProviderCredential.tenant_id == tenant_id,
                    ProviderCredential.credential_name == credential_name,
                )
                credential = session.execute(stmt).scalar_one_or_none()

                if not credential:
                    logger.warning(
                        "ProviderCredential not found after creation: %s (tenant: %s)",
                        credential_name,
                        tenant_id,
                    )
                    return

                # Find the Provider record - try multiple provider name variations
                # Provider name could be: "openai", "langgenius/openai/openai", or credential's provider_name
                provider_name_to_match = credential.provider_name  # Use the actual provider_name from credential

                stmt = select(Provider).where(
                    Provider.tenant_id == tenant_id,
                    Provider.provider_name == provider_name_to_match,
                )
                provider = session.execute(stmt).scalar_one_or_none()

                if provider:
                    # Update existing Provider record to link the credential
                    if provider.credential_id != credential.id:
                        provider.credential_id = credential.id
                        provider.is_valid = True
                        session.commit()
                        logger.info(
                            "Updated Provider record to link credential: %s (tenant: %s, provider: %s)",
                            credential_name,
                            tenant_id,
                            provider.provider_name,
                        )
                    else:
                        logger.debug(
                            "Provider already linked to credential: %s (tenant: %s)",
                            credential_name,
                            tenant_id,
                        )
                else:
                    logger.warning(
                        "Provider record not found after credential creation: %s (tenant: %s, tried provider_name: %s)",
                        dify_provider,
                        tenant_id,
                        provider_name_to_match,
                    )

            except Exception as e:
                session.rollback()
                logger.error(
                    "Failed to ensure provider credential linkage: %s (tenant: %s, error: %s)",
                    dify_provider,
                    tenant_id,
                    str(e),
                    exc_info=True,
                )
                raise
