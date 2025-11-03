"""User tool configuration model for managing user-specific tool API keys and settings."""

from datetime import datetime

import sqlalchemy as sa
from sqlalchemy import Boolean, DateTime, ForeignKey, Index, String, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from models.base import Base
from models.types import StringUUID


class UserToolConfig(Base):
    """
    User tool configuration model for managing user-specific tool provider API keys and settings.

    This model stores encrypted API keys and additional configuration for individual users
    to use with tool providers (e.g., Google Search, OpenWeather).

    Attributes:
        id: Unique identifier (UUID)
        user_id: Reference to the user who owns this configuration
        provider: Tool provider name (e.g., "google", "openweather")
        api_key_encrypted: Encrypted API key (using Fernet encryption)
        config_json: Additional configuration (e.g., endpoint URL, timeout) stored as JSON
        is_active: Whether the configuration is active
        created_at: Creation timestamp
        updated_at: Last update timestamp
    """

    __tablename__ = "user_tool_configs"
    __table_args__ = (
        sa.PrimaryKeyConstraint("id", name="user_tool_config_pkey"),
        Index("idx_user_provider", "user_id", "provider", unique=True),
        Index("idx_user_active", "user_id", "is_active"),
    )

    # Supported tool providers (independent tools, not LLM providers)
    # Only includes providers that require user-specific API keys
    SUPPORTED_PROVIDERS = [
        "google",  # Google Search API (SerpAPI)
        "openweather",  # OpenWeather API
        "data_analysis",  # DigitForce Data Analysis API
    ]

    id: Mapped[str] = mapped_column(StringUUID, server_default=sa.text("uuid_generate_v4()"))
    user_id: Mapped[str] = mapped_column(StringUUID, ForeignKey("accounts.id", ondelete="CASCADE"), nullable=False)
    provider: Mapped[str] = mapped_column(String(50), nullable=False)
    api_key_encrypted: Mapped[str] = mapped_column(String(500), nullable=False)
    config_json: Mapped[dict | None] = mapped_column(
        JSONB,
        nullable=True,
        comment="Additional configuration (e.g., endpoint URL, timeout, custom parameters)",
    )
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False, server_default=sa.text("true"))
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, server_default=func.now(), onupdate=func.now()
    )

    # Relationships
    user: Mapped["Account"] = relationship("Account", foreign_keys=[user_id])  # type: ignore[name-defined]

    def __repr__(self) -> str:
        """Return string representation of the user tool config."""
        return f"<UserToolConfig(id={self.id}, user_id={self.user_id}, provider={self.provider})>"

    def __str__(self) -> str:
        """Return user-friendly string representation."""
        return f"{self.provider} - User {self.user_id}"

    def get_masked_key(self, decrypted_key: str) -> str:
        """
        Mask API Key (first 7 chars + **** + last 4 chars).

        Args:
            decrypted_key: Decrypted plaintext API Key

        Returns:
            Masked API Key
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
