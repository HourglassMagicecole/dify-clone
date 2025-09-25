"""
Resource tag model for resource tagging system (multi-tenant alternative).
"""

import uuid
from datetime import datetime
from typing import Optional

import sqlalchemy as sa
from sqlalchemy import DateTime, String, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from models.base import Base


class ResourceTag(Base):
    """
    Resource tagging table for multi-tenant support.

    This table provides resource tagging functionality with tag search indexing.
    Serves as an alternative to complex multi-tenant architecture.
    """

    __tablename__ = "resource_tags"

    # Primary key
    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, comment="Tag unique identifier"
    )

    # Resource identification
    resource_type: Mapped[str] = mapped_column(String(50), nullable=False, comment="Type of resource being tagged")

    resource_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), nullable=False, comment="ID of the tagged resource"
    )

    # Tag information
    tag_name: Mapped[str] = mapped_column(String(100), nullable=False, comment="Tag name")

    tag_value: Mapped[Optional[str]] = mapped_column(String(200), comment="Optional tag value")

    # Metadata
    category: Mapped[Optional[str]] = mapped_column(String(50), comment="Tag category for organization")

    description: Mapped[Optional[str]] = mapped_column(String(500), comment="Tag description")

    # Timestamps
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False, comment="Tag creation timestamp"
    )

    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
        comment="Last update timestamp",
    )

    # Created by reference
    created_by: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), comment="Creator user ID from account system"
    )

    # Indexes for efficient searching
    __table_args__ = (
        sa.Index("ix_resource_tags_resource_type_id", "resource_type", "resource_id"),
        sa.Index("ix_resource_tags_tag_name", "tag_name"),
        sa.Index("ix_resource_tags_category", "category"),
        sa.Index("ix_resource_tags_composite", "resource_type", "tag_name", "tag_value"),
    )

    def __repr__(self) -> str:
        return f"<ResourceTag(id={self.id}, resource_type='{self.resource_type}', tag='{self.tag_name}')>"

    def __str__(self) -> str:
        if self.tag_value:
            return f"Tag: {self.tag_name}={self.tag_value} ({self.resource_type})"
        return f"Tag: {self.tag_name} ({self.resource_type})"

    @property
    def full_tag(self) -> str:
        """Get full tag representation."""
        if self.tag_value:
            return f"{self.tag_name}={self.tag_value}"
        return self.tag_name

    @classmethod
    def get_resource_tags(cls, resource_type: str, resource_id: uuid.UUID) -> list["ResourceTag"]:
        """Get all tags for a specific resource."""
        # This would be implemented in service layer
        pass

    @classmethod
    def find_resources_by_tag(cls, tag_name: str, tag_value: Optional[str] = None) -> list[tuple]:
        """Find resources by tag name and optional value."""
        # This would be implemented in service layer
        pass
