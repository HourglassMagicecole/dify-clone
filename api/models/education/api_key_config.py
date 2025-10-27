"""Admin API key configuration model for managing shared LLM provider keys (Story 1.8)."""

from datetime import datetime

import sqlalchemy as sa
from sqlalchemy import Boolean, DateTime, ForeignKey, Index, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from models.base import Base
from models.types import StringUUID


class AdminAPIKeyConfig(Base):
    """
    Admin API key configuration model for managing shared LLM provider API keys.

    This model stores encrypted API keys for centralized management by administrators.
    Quota management has been deferred to Phase 5.

    Attributes:
        id: Unique identifier (UUID)
        key_name: Name of the API key
        provider: LLM provider (e.g., "openai", "anthropic", "google", "azure_openai", "cohere")
        api_key_encrypted: Encrypted API key (using Fernet encryption)
        is_active: Whether the API key is active
        priority: Priority level ("primary", "secondary", "tertiary")
        created_by: Reference to account that created the key (owner)
        created_at: Creation timestamp
        updated_at: Last update timestamp
    """

    __tablename__ = "admin_api_key_configs"
    __table_args__ = (
        sa.PrimaryKeyConstraint("id", name="admin_api_key_config_pkey"),
        Index("idx_provider_active", "provider", "is_active"),
    )

    # Supported providers and priorities (Story 1.8)
    # Note: Azure OpenAI requires additional configuration (endpoint, deployment)
    # and will be supported in a future story
    SUPPORTED_PROVIDERS = ["openai", "anthropic", "google", "cohere"]
    SUPPORTED_PRIORITIES = ["primary", "secondary", "tertiary"]

    id: Mapped[str] = mapped_column(StringUUID, server_default=sa.text("uuid_generate_v4()"))
    key_name: Mapped[str] = mapped_column(String(100), nullable=False)
    provider: Mapped[str] = mapped_column(String(50), nullable=False)
    api_key_encrypted: Mapped[str] = mapped_column(String(500), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False, server_default=sa.text("true"))
    priority: Mapped[str] = mapped_column(String(20), nullable=False, server_default=sa.text("'secondary'"))
    created_by: Mapped[str] = mapped_column(StringUUID, ForeignKey("accounts.id", ondelete="CASCADE"), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, server_default=func.now(), onupdate=func.now()
    )

    # Relationships
    creator: Mapped["Account"] = relationship("Account", foreign_keys=[created_by])  # type: ignore[name-defined]

    def __repr__(self) -> str:
        """Return string representation of the admin API key config."""
        return f"<AdminAPIKeyConfig(id={self.id}, key_name={self.key_name}, provider={self.provider})>"

    def __str__(self) -> str:
        """Return user-friendly string representation."""
        return f"{self.key_name} - {self.provider}"

    def get_masked_key(self, decrypted_key: str) -> str:
        """
        API Key 마스킹 (처음 7자 + **** + 마지막 4자).

        Args:
            decrypted_key: 복호화된 평문 API Key

        Returns:
            마스킹된 API Key
        """
        if len(decrypted_key) <= 11:
            return "****" + decrypted_key[-4:]
        return decrypted_key[:7] + "****" + decrypted_key[-4:]

    def validate_provider(self) -> None:
        """
        Validate provider value.

        Raises:
            ValueError: If provider is not supported
        """
        if self.provider not in self.SUPPORTED_PROVIDERS:
            raise ValueError(f"Unsupported provider: {self.provider}")

    def validate_priority(self) -> None:
        """
        Validate priority value.

        Raises:
            ValueError: If priority is invalid
        """
        if self.priority not in self.SUPPORTED_PRIORITIES:
            raise ValueError(f"Invalid priority: {self.priority}")
