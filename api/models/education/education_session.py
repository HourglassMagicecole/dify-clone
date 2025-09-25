"""
Education session model for managing educational sessions.
"""

import uuid
from datetime import datetime
from typing import TYPE_CHECKING, Optional

import sqlalchemy as sa
from sqlalchemy import DateTime, String, Text, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship, selectinload

from models.base import Base

if TYPE_CHECKING:
    from .education_enrollment import EducationEnrollment


class EducationSession(Base):
    """
    Education session management table.

    This table manages educational sessions with UUID primary key and unique session codes.
    Provides infrastructure for organizing educational content delivery.
    """

    __tablename__ = "education_sessions"

    # Primary key - UUID for better security and distribution
    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, comment="Session unique identifier"
    )

    # Unique session code for easy reference
    session_code: Mapped[str] = mapped_column(
        String(20), unique=True, nullable=False, index=True, comment="Human-readable session code"
    )

    # Session metadata
    title: Mapped[str] = mapped_column(String(200), nullable=False, comment="Session title")

    description: Mapped[Optional[str]] = mapped_column(Text, comment="Session description")

    # Session configuration - JSONB for flexible configuration
    config: Mapped[Optional[dict]] = mapped_column(JSONB, comment="Session configuration in JSON format")

    # Session status
    status: Mapped[str] = mapped_column(
        String(20), default="draft", nullable=False, comment="Session status: draft, active, completed, archived"
    )

    # Capacity management
    max_participants: Mapped[Optional[int]] = mapped_column(sa.Integer, comment="Maximum number of participants")

    # Timestamps
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False, comment="Session creation timestamp"
    )

    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
        comment="Last update timestamp",
    )

    start_date: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), comment="Session start date")

    end_date: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), comment="Session end date")

    # Created by reference (to existing account system)
    created_by: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), comment="Creator user ID from account system"
    )

    # Relationships
    enrollments: Mapped[list["EducationEnrollment"]] = relationship(
        "EducationEnrollment",
        back_populates="session",
        cascade="all, delete-orphan",
        lazy="selectin",  # Changed from 'dynamic' to 'selectin' to prevent N+1 queries
    )

    def __repr__(self) -> str:
        return f"<EducationSession(id={self.id}, code='{self.session_code}', title='{self.title}')>"

    def __str__(self) -> str:
        return f"Session {self.session_code}: {self.title}"

    @property
    def is_active(self) -> bool:
        """Check if session is currently active."""
        return self.status == "active"

    @property
    def enrollment_count(self) -> int:
        """Get current enrollment count."""
        return len(self.enrollments)

    @property
    def has_capacity(self) -> bool:
        """Check if session has capacity for more participants."""
        if self.max_participants is None:
            return True
        return self.enrollment_count < self.max_participants

    @classmethod
    def get_with_enrollments(cls, session_id: uuid.UUID):
        """
        Get session with enrollments eager loaded to avoid N+1 queries.

        Usage:
            session = EducationSession.get_with_enrollments(session_id)
            # enrollments are already loaded, no additional queries needed
            for enrollment in session.enrollments:
                print(enrollment.user_id)
        """
        from extensions import db

        return db.session.query(cls).options(selectinload(cls.enrollments)).filter(cls.id == session_id).first()
