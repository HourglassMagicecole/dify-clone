"""
Education template model for educational material templates.
"""

import uuid
from datetime import datetime
from typing import Optional

import sqlalchemy as sa
from sqlalchemy import DateTime, String, Text, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from models.base import Base


class EducationTemplate(Base):
    """
    Education template table for educational material templates.

    This table manages educational material templates with JSONB config field
    for flexible template configuration and content structure.
    """

    __tablename__ = "education_templates"

    # Primary key
    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, comment="Template unique identifier"
    )

    # Template identification
    template_type: Mapped[str] = mapped_column(
        String(50), nullable=False, comment="Template type: agent, workflow, rag, assessment, exercise"
    )

    name: Mapped[str] = mapped_column(String(200), nullable=False, comment="Template name")

    description: Mapped[Optional[str]] = mapped_column(Text, comment="Template description")

    # Template content
    content: Mapped[Optional[str]] = mapped_column(Text, comment="Template content/instructions")

    # Template configuration - JSONB for flexible configuration
    config: Mapped[Optional[dict]] = mapped_column(JSONB, comment="Template configuration in JSON format")

    # Metadata
    category: Mapped[Optional[str]] = mapped_column(String(100), comment="Template category")

    tags: Mapped[Optional[list]] = mapped_column(JSONB, comment="Template tags for search and organization")

    difficulty_level: Mapped[Optional[str]] = mapped_column(
        String(20), comment="Difficulty level: beginner, intermediate, advanced"
    )

    estimated_duration_minutes: Mapped[Optional[int]] = mapped_column(
        sa.Integer, comment="Estimated completion time in minutes"
    )

    # Status and versioning
    status: Mapped[str] = mapped_column(
        String(20), default="draft", nullable=False, comment="Template status: draft, published, archived"
    )

    version: Mapped[str] = mapped_column(String(20), default="1.0", nullable=False, comment="Template version")

    # Usage tracking
    usage_count: Mapped[int] = mapped_column(
        sa.Integer, default=0, nullable=False, comment="Number of times template has been used"
    )

    # Timestamps
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False, comment="Template creation timestamp"
    )

    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
        comment="Last update timestamp",
    )

    published_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), comment="Publication timestamp")

    # Author tracking
    created_by: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), comment="Creator user ID from account system"
    )

    updated_by: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), comment="Last updater user ID")

    # Indexes
    __table_args__ = (
        sa.Index("ix_education_templates_type", "template_type"),
        sa.Index("ix_education_templates_category", "category"),
        sa.Index("ix_education_templates_status", "status"),
        sa.Index("ix_education_templates_difficulty", "difficulty_level"),
        sa.Index("ix_education_templates_name", "name"),
    )

    def __repr__(self) -> str:
        return f"<EducationTemplate(id={self.id}, name='{self.name}', type='{self.template_type}')>"

    def __str__(self) -> str:
        return f"Template: {self.name} ({self.template_type})"

    @property
    def is_published(self) -> bool:
        """Check if template is published."""
        return self.status == "published"

    @property
    def is_draft(self) -> bool:
        """Check if template is in draft status."""
        return self.status == "draft"

    def increment_usage(self) -> None:
        """Increment usage count."""
        self.usage_count += 1

    def publish(self) -> None:
        """Publish the template."""
        self.status = "published"
        self.published_at = datetime.utcnow()

    def archive(self) -> None:
        """Archive the template."""
        self.status = "archived"

    @classmethod
    def get_by_type(cls, template_type: str) -> list["EducationTemplate"]:
        """Get templates by type."""
        # This would be implemented in service layer
        pass
