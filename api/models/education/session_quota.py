"""Session Quota model for session-wide usage limits."""

from datetime import datetime
from decimal import Decimal

import sqlalchemy as sa
from sqlalchemy import Boolean, DateTime, ForeignKey, Index, Integer, Numeric, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from models.base import Base
from models.types import StringUUID


class SessionQuota(Base):
    """
    Session Quota model for managing session-wide usage limits.

    This is the "safety net" - if the entire session exceeds this limit,
    all users in the session are blocked.

    Attributes:
        id: Unique identifier (UUID)
        tenant_id: Reference to tenant
        session_id: Reference to education session
        model_provider: Provider name or "all" for aggregate limit
        quota_limit: Maximum allowed usage in USD
        period: Reset period (daily, session, monthly)
        current_usage: Current accumulated usage in USD
        warning_threshold: Percentage threshold for warning (default: 70)
        last_reset_at: Last reset timestamp
        is_blocked: Whether the session is blocked due to quota
        is_active: Whether this quota is active
        created_at: Creation timestamp
        updated_at: Last update timestamp
    """

    __tablename__ = "session_quotas"
    __table_args__ = (
        sa.PrimaryKeyConstraint("id", name="session_quota_pkey"),
        Index("idx_session_quota_session_provider", "session_id", "model_provider"),
    )

    id: Mapped[str] = mapped_column(StringUUID, server_default=sa.text("uuid_generate_v4()"))
    tenant_id: Mapped[str] = mapped_column(StringUUID, ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False)
    session_id: Mapped[str] = mapped_column(
        StringUUID, ForeignKey("education_sessions.id", ondelete="CASCADE"), nullable=False
    )

    model_provider: Mapped[str] = mapped_column(
        String(50), nullable=False, server_default=sa.text("'all'")
    )  # all, openai, anthropic, google, etc.

    quota_limit: Mapped[Decimal] = mapped_column(Numeric(15, 4), nullable=False)
    period: Mapped[str] = mapped_column(
        String(20), nullable=False, server_default=sa.text("'monthly'")
    )  # daily, session, monthly

    current_usage: Mapped[Decimal] = mapped_column(Numeric(15, 4), nullable=False, server_default=sa.text("0"))

    warning_threshold: Mapped[int] = mapped_column(Integer, nullable=False, server_default=sa.text("70"))

    last_reset_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, server_default=sa.func.now())

    is_blocked: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default=sa.text("false"))

    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default=sa.text("true"))

    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, server_default=sa.func.now())

    updated_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, server_default=sa.func.now(), onupdate=sa.func.now()
    )

    # Relationships
    session: Mapped["EducationSession"] = relationship(  # type: ignore[name-defined]
        "EducationSession", foreign_keys=[session_id]
    )

    @property
    def usage_percentage(self) -> float:
        """Calculate current usage as a percentage of quota limit."""
        if self.quota_limit == 0:
            return 100.0
        return float(self.current_usage / self.quota_limit * 100)

    @property
    def is_warning(self) -> bool:
        """Check if usage has reached warning threshold."""
        return self.usage_percentage >= self.warning_threshold

    @property
    def is_exceeded(self) -> bool:
        """Check if usage has exceeded quota limit."""
        return self.current_usage >= self.quota_limit

    def __repr__(self) -> str:
        """Return string representation of the session quota."""
        return (
            f"<SessionQuota(session_id={self.session_id}, provider={self.model_provider}, "
            f"usage=${self.current_usage}/${self.quota_limit})>"
        )
