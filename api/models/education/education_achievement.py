"""
Education achievement model for achievement/badge system.
"""

import uuid
from datetime import datetime
from typing import TYPE_CHECKING, Optional

import sqlalchemy as sa
from sqlalchemy import DateTime, ForeignKey, String, Text, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from models.base import Base

if TYPE_CHECKING:
    from .education_session import EducationSession


class EducationAchievement(Base):
    """
    Education achievement table for achievement/badge system.

    This table manages achievements and badges for educational platform
    to gamify learning experience and track student accomplishments.
    """

    __tablename__ = "education_achievements"

    # Primary key
    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, comment="Achievement unique identifier"
    )

    # User identification
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), nullable=False, comment="User ID from account system"
    )

    # Session context (optional)
    session_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("education_sessions.id", ondelete="SET NULL"),
        comment="Education session ID if session-specific",
    )

    # Achievement definition
    achievement_type: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
        comment="Achievement type: completion, mastery, participation, creativity, collaboration",
    )

    achievement_name: Mapped[str] = mapped_column(String(100), nullable=False, comment="Achievement name/title")

    description: Mapped[Optional[str]] = mapped_column(Text, comment="Achievement description")

    # Badge/Icon information
    badge_icon: Mapped[Optional[str]] = mapped_column(String(100), comment="Badge icon identifier or URL")

    badge_color: Mapped[Optional[str]] = mapped_column(String(20), comment="Badge color (hex code or name)")

    # Achievement criteria
    criteria: Mapped[Optional[dict]] = mapped_column(JSONB, comment="Achievement criteria in JSON format")

    # Achievement details
    details: Mapped[Optional[dict]] = mapped_column(JSONB, comment="Achievement details and metadata")

    # Level and rarity
    level: Mapped[str] = mapped_column(
        String(20),
        default="bronze",
        nullable=False,
        comment="Achievement level: bronze, silver, gold, platinum, diamond",
    )

    rarity: Mapped[str] = mapped_column(
        String(20),
        default="common",
        nullable=False,
        comment="Achievement rarity: common, uncommon, rare, epic, legendary",
    )

    # Points and rewards
    points: Mapped[int] = mapped_column(
        sa.Integer, default=0, nullable=False, comment="Points awarded for this achievement"
    )

    rewards: Mapped[Optional[dict]] = mapped_column(JSONB, comment="Additional rewards in JSON format")

    # Progress tracking
    progress_current: Mapped[int] = mapped_column(
        sa.Integer, default=0, nullable=False, comment="Current progress towards achievement"
    )

    progress_total: Mapped[Optional[int]] = mapped_column(
        sa.Integer, comment="Total progress needed to complete achievement"
    )

    # Status
    status: Mapped[str] = mapped_column(
        String(20),
        default="in_progress",
        nullable=False,
        comment="Achievement status: in_progress, completed, expired, revoked",
    )

    # Timestamps
    started_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), comment="When user started working on this achievement"
    )

    completed_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), comment="When achievement was completed"
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
        comment="Achievement record creation timestamp",
    )

    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
        comment="Last update timestamp",
    )

    expires_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), comment="Achievement expiration timestamp"
    )

    # Verification
    verified_by: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), comment="User ID who verified the achievement"
    )

    verification_data: Mapped[Optional[dict]] = mapped_column(JSONB, comment="Verification data and evidence")

    # Relationships
    session: Mapped[Optional["EducationSession"]] = relationship("EducationSession")

    # Indexes
    __table_args__ = (
        sa.Index("ix_education_achievements_user_id", "user_id"),
        sa.Index("ix_education_achievements_session_id", "session_id"),
        sa.Index("ix_education_achievements_type", "achievement_type"),
        sa.Index("ix_education_achievements_status", "status"),
        sa.Index("ix_education_achievements_level", "level"),
        sa.Index("ix_education_achievements_rarity", "rarity"),
    )

    def __repr__(self) -> str:
        return f"<EducationAchievement(id={self.id}, user={self.user_id}, name='{self.achievement_name}')>"

    def __str__(self) -> str:
        return f"Achievement: {self.achievement_name} ({self.level}/{self.rarity})"

    @property
    def is_completed(self) -> bool:
        """Check if achievement is completed."""
        return self.status == "completed"

    @property
    def is_in_progress(self) -> bool:
        """Check if achievement is in progress."""
        return self.status == "in_progress"

    @property
    def progress_percentage(self) -> float:
        """Get progress as percentage."""
        if not self.progress_total or self.progress_total == 0:
            return 0.0
        return min(100.0, (self.progress_current / self.progress_total) * 100.0)

    def update_progress(self, progress: int, auto_complete: bool = True) -> None:
        """Update progress towards achievement."""
        self.progress_current = min(progress, self.progress_total or progress)

        if auto_complete and self.progress_total and self.progress_current >= self.progress_total:
            self.complete()

    def complete(self) -> None:
        """Mark achievement as completed."""
        self.status = "completed"
        self.completed_at = datetime.utcnow()
        if self.progress_total:
            self.progress_current = self.progress_total

    def revoke(self, reason: Optional[str] = None) -> None:
        """Revoke the achievement."""
        self.status = "revoked"
        if reason:
            if not self.details:
                self.details = {}
            self.details["revocation_reason"] = reason

    @classmethod
    def get_user_achievements(
        cls, user_id: uuid.UUID, status: Optional[str] = None, session_id: Optional[uuid.UUID] = None
    ) -> list["EducationAchievement"]:
        """Get achievements for a user."""
        # This would be implemented in service layer
        pass

    @classmethod
    def get_leaderboard(cls, achievement_type: Optional[str] = None, limit: int = 10) -> list[dict]:
        """Get achievement leaderboard."""
        # This would be implemented in service layer
        pass
