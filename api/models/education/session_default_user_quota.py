"""Session Default User Quota model for automatic quota assignment to new members."""

from datetime import datetime
from decimal import Decimal

import sqlalchemy as sa
from sqlalchemy import DateTime, ForeignKey, Index, Integer, Numeric, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from models.base import Base
from models.types import StringUUID


class SessionDefaultUserQuota(Base):
    """
    Session Default User Quota model for storing default quota settings.

    When a new member is added to a session, these defaults are automatically
    applied to create UserUsageQuota entries for the new member.

    Attributes:
        id: Unique identifier (UUID)
        tenant_id: Reference to tenant
        session_id: Reference to education session
        model_provider: Provider name (openai, anthropic, google, etc.)
        quota_limit: Default quota limit in USD for new members
        warning_threshold: Percentage threshold for warning (default: 70)
        created_at: Creation timestamp
        updated_at: Last update timestamp
    """

    __tablename__ = "session_default_user_quotas"
    __table_args__ = (
        sa.PrimaryKeyConstraint("id", name="session_default_user_quota_pkey"),
        Index("idx_session_default_quota_session_provider", "session_id", "model_provider", unique=True),
    )

    id: Mapped[str] = mapped_column(StringUUID, server_default=sa.text("uuid_generate_v4()"))
    tenant_id: Mapped[str] = mapped_column(StringUUID, ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False)
    session_id: Mapped[str] = mapped_column(
        StringUUID, ForeignKey("education_sessions.id", ondelete="CASCADE"), nullable=False
    )

    model_provider: Mapped[str] = mapped_column(String(50), nullable=False)

    quota_limit: Mapped[Decimal] = mapped_column(Numeric(15, 4), nullable=False)

    warning_threshold: Mapped[int] = mapped_column(Integer, nullable=False, server_default=sa.text("70"))

    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, server_default=sa.func.now())

    updated_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, server_default=sa.func.now(), onupdate=sa.func.now()
    )

    # Relationships
    session: Mapped["EducationSession"] = relationship(  # type: ignore[name-defined]
        "EducationSession", foreign_keys=[session_id]
    )

    def __repr__(self) -> str:
        """Return string representation of the session default user quota."""
        return (
            f"<SessionDefaultUserQuota(session_id={self.session_id}, "
            f"provider={self.model_provider}, limit=${self.quota_limit})>"
        )
