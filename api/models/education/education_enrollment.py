"""
Education enrollment model for managing session participants.
"""

import uuid
from datetime import datetime
from typing import TYPE_CHECKING, Optional

import sqlalchemy as sa
from sqlalchemy import DateTime, ForeignKey, String, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from models.base import Base

if TYPE_CHECKING:
    from .education_session import EducationSession


class EducationEnrollment(Base):
    """
    Education enrollment management table.

    This table manages session participants with user_id+session_id unique constraint.
    Tracks enrollment status and participation metadata.
    """

    __tablename__ = "education_enrollments"

    # Primary key
    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, comment="Enrollment unique identifier"
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

    # Enrollment metadata
    enrollment_status: Mapped[str] = mapped_column(
        String(20),
        default="enrolled",
        nullable=False,
        comment="Enrollment status: enrolled, completed, dropped, suspended",
    )

    # Role in session
    role: Mapped[str] = mapped_column(
        String(20), default="participant", nullable=False, comment="Role in session: participant, instructor, assistant"
    )

    # Timestamps
    enrolled_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False, comment="Enrollment timestamp"
    )

    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
        comment="Last update timestamp",
    )

    completed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), comment="Completion timestamp")

    # Participation tracking
    last_activity_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), comment="Last activity timestamp"
    )

    notes: Mapped[Optional[str]] = mapped_column(String(500), comment="Additional notes about enrollment")

    # Relationships
    session: Mapped["EducationSession"] = relationship("EducationSession", back_populates="enrollments")

    # Constraints
    __table_args__ = (
        UniqueConstraint("user_id", "session_id", name="uq_education_enrollments_user_session"),
        sa.Index("ix_education_enrollments_user_id", "user_id"),
        sa.Index("ix_education_enrollments_session_id", "session_id"),
        sa.Index("ix_education_enrollments_status", "enrollment_status"),
    )

    def __repr__(self) -> str:
        return f"<EducationEnrollment(id={self.id}, user_id={self.user_id}, session_id={self.session_id})>"

    def __str__(self) -> str:
        return f"Enrollment: User {self.user_id} in Session {self.session_id}"

    @property
    def is_active(self) -> bool:
        """Check if enrollment is currently active."""
        return self.enrollment_status == "enrolled"

    @property
    def is_completed(self) -> bool:
        """Check if enrollment is completed."""
        return self.enrollment_status == "completed"

    @property
    def is_instructor(self) -> bool:
        """Check if user is instructor in this session."""
        return self.role == "instructor"

    def mark_completed(self) -> None:
        """Mark enrollment as completed."""
        self.enrollment_status = "completed"
        self.completed_at = datetime.utcnow()
