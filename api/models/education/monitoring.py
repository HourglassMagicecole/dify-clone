"""Session monitoring model for tracking student activity and usage metrics."""

from datetime import datetime

import sqlalchemy as sa
from sqlalchemy import DateTime, ForeignKey, Index, Integer, String, func
from sqlalchemy.dialects.postgresql import JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship

from models.base import Base
from models.types import StringUUID


class SessionMonitoring(Base):
    """
    Session monitoring model for tracking student activity and usage metrics.

    This model records various metrics such as API calls, token usage, errors,
    and login events for students in an education session.

    Attributes:
        id: Unique identifier (UUID)
        session_id: Reference to education session
        account_id: Reference to student account (optional, can be NULL)
        metric_type: Type of metric (e.g., "api_call", "token_usage", "error", "login")
        metric_value: Numeric value of the metric
        metric_metadata: Additional metadata as JSON (optional, stored as 'metadata' in DB)
                        Typed as dict[str, object] to avoid Any type while supporting flexible JSON data
        recorded_at: When the metric was recorded
        created_at: Creation timestamp
    """

    __tablename__ = "session_monitoring"
    __table_args__ = (
        sa.PrimaryKeyConstraint("id", name="session_monitoring_pkey"),
        Index("idx_session_recorded", "session_id", "recorded_at"),
        Index("idx_metric_recorded", "metric_type", "recorded_at"),
    )

    id: Mapped[str] = mapped_column(StringUUID, server_default=sa.text("uuid_generate_v4()"))
    session_id: Mapped[str] = mapped_column(
        StringUUID, ForeignKey("education_sessions.id", ondelete="CASCADE"), nullable=False
    )
    account_id: Mapped[str | None] = mapped_column(
        StringUUID, ForeignKey("accounts.id", ondelete="SET NULL"), nullable=True
    )
    metric_type: Mapped[str] = mapped_column(String(50), nullable=False)
    metric_value: Mapped[int] = mapped_column(Integer, nullable=False)
    metric_metadata: Mapped[dict[str, object] | None] = mapped_column("metadata", JSON, nullable=True)
    recorded_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, server_default=func.now())

    # Relationships
    session: Mapped["EducationSession"] = relationship("EducationSession", foreign_keys=[session_id])  # type: ignore[name-defined]
    account: Mapped["Account | None"] = relationship("Account", foreign_keys=[account_id])  # type: ignore[name-defined]

    def __repr__(self) -> str:
        """Return string representation of the session monitoring record."""
        return (
            f"<SessionMonitoring(id={self.id}, session_id={self.session_id}, "
            f"metric_type={self.metric_type}, metric_value={self.metric_value})>"
        )
