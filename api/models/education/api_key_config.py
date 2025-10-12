"""Admin API key configuration model for managing shared LLM provider keys."""

from datetime import datetime

import sqlalchemy as sa
from sqlalchemy import Boolean, DateTime, ForeignKey, Index, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from models.base import Base
from models.types import StringUUID


class AdminAPIKeyConfig(Base):
    """
    Admin API key configuration model for managing shared LLM provider API keys.

    This model stores encrypted API keys that can be shared across students
    in an education session, with quota management.

    Attributes:
        id: Unique identifier (UUID)
        key_name: Name of the API key
        provider: LLM provider (e.g., "openai", "anthropic", "google")
        api_key_encrypted: Encrypted API key (using Fernet encryption)
        is_active: Whether the API key is active
        quota_limit: Daily token limit (optional)
        quota_used: Current quota usage
        last_reset_at: Last quota reset timestamp
        created_by: Reference to account that created the key (optional)
        created_at: Creation timestamp
        updated_at: Last update timestamp
    """

    __tablename__ = "admin_api_key_configs"
    __table_args__ = (
        sa.PrimaryKeyConstraint("id", name="admin_api_key_config_pkey"),
        Index("idx_provider_active", "provider", "is_active"),
    )

    id: Mapped[str] = mapped_column(StringUUID, server_default=sa.text("uuid_generate_v4()"))
    key_name: Mapped[str] = mapped_column(String(100), nullable=False)
    provider: Mapped[str] = mapped_column(String(50), nullable=False)
    api_key_encrypted: Mapped[str] = mapped_column(String(500), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False, server_default=sa.text("true"))
    quota_limit: Mapped[int | None] = mapped_column(Integer, nullable=True)
    quota_used: Mapped[int] = mapped_column(Integer, default=0, nullable=False, server_default=sa.text("0"))
    last_reset_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, server_default=func.now())
    created_by: Mapped[str | None] = mapped_column(
        StringUUID, ForeignKey("accounts.id", ondelete="SET NULL"), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, server_default=func.now(), onupdate=func.now()
    )

    # Relationships
    creator: Mapped["Account | None"] = relationship("Account", foreign_keys=[created_by])  # type: ignore[name-defined]

    def __repr__(self) -> str:
        """Return string representation of the admin API key config."""
        return f"<AdminAPIKeyConfig(id={self.id}, key_name={self.key_name}, provider={self.provider})>"
