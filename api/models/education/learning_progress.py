"""
Learning progress model for tracking student progress.
"""

import uuid
from datetime import datetime
from typing import TYPE_CHECKING, Optional

import sqlalchemy as sa
from sqlalchemy import DateTime, ForeignKey, Numeric, String, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from models.base import Base

if TYPE_CHECKING:
    from .education_session import EducationSession


class LearningProgress(Base):
    """
    Learning progress tracking table.

    This table tracks learning progress with module-based progress rate management.
    Provides detailed tracking of student advancement through educational content.
    """

    __tablename__ = "learning_progress"

    # Primary key
    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, comment="Progress record unique identifier"
    )

    # Foreign keys
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), nullable=False, comment="User ID from account system"
    )

    session_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("education_sessions.id", ondelete="CASCADE"),
        nullable=False,
        comment="Education session ID",
    )

    # Module/Content identification
    module_type: Mapped[str] = mapped_column(
        String(50), nullable=False, comment="Type of module: agent, workflow, rag, template"
    )

    module_id: Mapped[str] = mapped_column(String(100), nullable=False, comment="Module identifier")

    module_name: Mapped[Optional[str]] = mapped_column(String(200), comment="Human-readable module name")

    # Progress tracking
    progress_percentage: Mapped[float] = mapped_column(
        Numeric(5, 2),  # 999.99 format
        default=0.0,
        nullable=False,
        comment="Progress percentage (0.00 to 100.00)",
    )

    status: Mapped[str] = mapped_column(
        String(20),
        default="not_started",
        nullable=False,
        comment="Progress status: not_started, in_progress, completed, failed",
    )

    # Activity tracking
    time_spent_minutes: Mapped[Optional[int]] = mapped_column(
        sa.Integer, default=0, comment="Total time spent in minutes"
    )

    attempts: Mapped[int] = mapped_column(sa.Integer, default=0, nullable=False, comment="Number of attempts")

    # Score tracking
    current_score: Mapped[Optional[float]] = mapped_column(Numeric(5, 2), comment="Current score (0.00 to 100.00)")

    best_score: Mapped[Optional[float]] = mapped_column(Numeric(5, 2), comment="Best score achieved (0.00 to 100.00)")

    # Detailed tracking data
    progress_data: Mapped[Optional[dict]] = mapped_column(JSONB, comment="Detailed progress data in JSON format")

    # Timestamps
    started_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), comment="When user started this module"
    )

    last_activity_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), comment="Last activity timestamp"
    )

    completed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), comment="Completion timestamp")

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False, comment="Record creation timestamp"
    )

    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
        comment="Last update timestamp",
    )

    # Relationships
    session: Mapped["EducationSession"] = relationship("EducationSession")

    # Constraints and indexes
    __table_args__ = (
        UniqueConstraint(
            "user_id", "session_id", "module_type", "module_id", name="uq_learning_progress_user_session_module"
        ),
        sa.Index("ix_learning_progress_user_id", "user_id"),
        sa.Index("ix_learning_progress_session_id", "session_id"),
        sa.Index("ix_learning_progress_module", "module_type", "module_id"),
        sa.Index("ix_learning_progress_status", "status"),
    )

    def __repr__(self) -> str:
        return f"<LearningProgress(id={self.id}, user={self.user_id}, module={self.module_type}:{self.module_id})>"

    def __str__(self) -> str:
        return f"Progress: {self.progress_percentage}% - {self.module_type}:{self.module_id}"

    @property
    def is_completed(self) -> bool:
        """Check if module is completed."""
        return self.status == "completed"

    @property
    def is_in_progress(self) -> bool:
        """Check if module is in progress."""
        return self.status == "in_progress"

    @property
    def completion_rate(self) -> float:
        """Get completion rate as decimal (0.0 to 1.0)."""
        return float(self.progress_percentage) / 100.0

    def mark_started(self) -> None:
        """Mark module as started."""
        if not self.started_at:
            self.started_at = datetime.utcnow()
        self.status = "in_progress"
        self.last_activity_at = datetime.utcnow()

    def update_progress(self, percentage: float, score: Optional[float] = None) -> None:
        """Update progress percentage and optional score."""
        self.progress_percentage = min(100.0, max(0.0, percentage))
        self.last_activity_at = datetime.utcnow()

        if score is not None:
            self.current_score = score
            if self.best_score is None or score > self.best_score:
                self.best_score = score

        # Auto-complete if 100%
        if self.progress_percentage >= 100.0:
            self.mark_completed()

    def mark_completed(self) -> None:
        """Mark module as completed."""
        self.status = "completed"
        self.progress_percentage = 100.0
        self.completed_at = datetime.utcnow()
        self.last_activity_at = datetime.utcnow()
