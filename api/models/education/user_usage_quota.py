"""User Usage Quota model for per-user usage limits."""

from datetime import UTC, datetime
from decimal import Decimal

import sqlalchemy as sa
from sqlalchemy import Boolean, DateTime, ForeignKey, Index, Integer, Numeric, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from models.base import Base
from models.types import StringUUID


class UserUsageQuota(Base):
    """
    User Usage Quota model for managing per-user usage limits.

    This ensures fair resource distribution among users within a session.

    Attributes:
        id: Unique identifier (UUID)
        tenant_id: Reference to tenant
        session_id: Reference to education session
        account_id: Reference to user account
        model_provider: Provider name or "all" for aggregate limit
        quota_limit: Maximum allowed usage in USD
        period: Reset period (daily, session, monthly)
        current_usage: Current accumulated usage in USD
        warning_threshold: Percentage threshold for warning (default: 70)
        last_reset_at: Last reset timestamp
        override_until: Temporary override expiration (nullable)
        is_blocked: Whether the user is blocked due to quota
        is_active: Whether this quota is active
        created_by: Account that created this quota
        created_at: Creation timestamp
        updated_at: Last update timestamp
    """

    __tablename__ = "user_usage_quotas"
    __table_args__ = (
        sa.PrimaryKeyConstraint("id", name="user_usage_quota_pkey"),
        Index("idx_user_quota_session_account", "session_id", "account_id"),
        Index("idx_user_quota_account_provider", "account_id", "model_provider"),
    )

    id: Mapped[str] = mapped_column(StringUUID, server_default=sa.text("uuid_generate_v4()"))
    tenant_id: Mapped[str] = mapped_column(StringUUID, ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False)
    session_id: Mapped[str] = mapped_column(
        StringUUID, ForeignKey("education_sessions.id", ondelete="CASCADE"), nullable=False
    )
    account_id: Mapped[str] = mapped_column(StringUUID, ForeignKey("accounts.id", ondelete="CASCADE"), nullable=False)

    model_provider: Mapped[str] = mapped_column(String(50), nullable=False, server_default=sa.text("'all'"))

    quota_limit: Mapped[Decimal] = mapped_column(Numeric(15, 4), nullable=False)
    period: Mapped[str] = mapped_column(String(20), nullable=False, server_default=sa.text("'monthly'"))

    current_usage: Mapped[Decimal] = mapped_column(Numeric(15, 4), nullable=False, server_default=sa.text("0"))

    warning_threshold: Mapped[int] = mapped_column(Integer, nullable=False, server_default=sa.text("70"))

    last_reset_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, server_default=sa.func.now())

    override_until: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    is_blocked: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default=sa.text("false"))

    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default=sa.text("true"))

    created_by: Mapped[str] = mapped_column(StringUUID, ForeignKey("accounts.id", ondelete="CASCADE"), nullable=False)

    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, server_default=sa.func.now())

    updated_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, server_default=sa.func.now(), onupdate=sa.func.now()
    )

    # Relationships
    session: Mapped["EducationSession"] = relationship(  # type: ignore[name-defined]
        "EducationSession", foreign_keys=[session_id]
    )
    account: Mapped["Account"] = relationship(  # type: ignore[name-defined]
        "Account", foreign_keys=[account_id]
    )
    creator: Mapped["Account"] = relationship(  # type: ignore[name-defined]
        "Account", foreign_keys=[created_by]
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

    @property
    def is_override_active(self) -> bool:
        """Check if temporary override is currently active."""
        if self.override_until is None:
            return False
        return datetime.now(UTC) < self.override_until

    def __repr__(self) -> str:
        """Return string representation of the user usage quota."""
        return (
            f"<UserUsageQuota(account_id={self.account_id}, provider={self.model_provider}, "
            f"usage=${self.current_usage}/${self.quota_limit})>"
        )
