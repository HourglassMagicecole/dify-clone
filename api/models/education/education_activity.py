"""
Education activity model for activity log tracking.
"""

import uuid
from datetime import datetime
from typing import Optional

import sqlalchemy as sa
from sqlalchemy import DateTime, String, Text, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from models.base import Base


class EducationActivityLog(Base):
    """
    Education activity log table for activity log tracking.

    This table tracks activities with JSONB details
    for comprehensive activity logging and audit trails.
    """

    __tablename__ = "education_activity_logs"

    # Primary key
    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, comment="Activity log unique identifier"
    )

    # Actor identification
    user_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), comment="User ID from account system (if user-initiated)"
    )

    # Session context
    session_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), comment="Education session ID if applicable"
    )

    # Activity classification
    activity_type: Mapped[str] = mapped_column(
        String(50), nullable=False, comment="Activity type: login, logout, module_start, module_complete, error, admin"
    )

    activity_category: Mapped[str] = mapped_column(
        String(50), default="general", nullable=False, comment="Activity category: learning, admin, system, error"
    )

    # Activity details
    action: Mapped[str] = mapped_column(String(100), nullable=False, comment="Specific action performed")

    description: Mapped[Optional[str]] = mapped_column(Text, comment="Human-readable activity description")

    # Target resource
    resource_type: Mapped[Optional[str]] = mapped_column(String(50), comment="Type of resource affected")

    resource_id: Mapped[Optional[str]] = mapped_column(String(100), comment="ID of the affected resource")

    # Detailed activity data - JSONB for flexible structure
    details: Mapped[Optional[dict]] = mapped_column(JSONB, comment="Detailed activity data in JSON format")

    # Request/Response tracking
    request_data: Mapped[Optional[dict]] = mapped_column(JSONB, comment="Request data (sanitized)")

    response_data: Mapped[Optional[dict]] = mapped_column(JSONB, comment="Response data (sanitized)")

    # Status and result
    status: Mapped[str] = mapped_column(
        String(20), default="success", nullable=False, comment="Activity status: success, error, warning, info"
    )

    error_message: Mapped[Optional[str]] = mapped_column(Text, comment="Error message if status is error")

    # Performance tracking
    duration_ms: Mapped[Optional[int]] = mapped_column(sa.Integer, comment="Activity duration in milliseconds")

    # System context
    ip_address: Mapped[Optional[str]] = mapped_column(
        String(45),  # IPv6 compatible
        comment="IP address of the request",
    )

    user_agent: Mapped[Optional[str]] = mapped_column(String(500), comment="User agent string")

    # Timestamp
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False, comment="Activity timestamp"
    )

    # Additional metadata
    extra_metadata: Mapped[Optional[dict]] = mapped_column(JSONB, comment="Additional metadata")

    # Indexes for efficient querying
    __table_args__ = (
        sa.Index("ix_education_activity_logs_user_id", "user_id"),
        sa.Index("ix_education_activity_logs_session_id", "session_id"),
        sa.Index("ix_education_activity_logs_type", "activity_type"),
        sa.Index("ix_education_activity_logs_category", "activity_category"),
        sa.Index("ix_education_activity_logs_status", "status"),
        sa.Index("ix_education_activity_logs_created_at", "created_at"),
        sa.Index("ix_education_activity_logs_resource", "resource_type", "resource_id"),
    )

    def __repr__(self) -> str:
        return f"<EducationActivityLog(id={self.id}, type='{self.activity_type}', user={self.user_id})>"

    def __str__(self) -> str:
        return f"Activity: {self.activity_type}/{self.action} - {self.status}"

    @property
    def is_error(self) -> bool:
        """Check if activity represents an error."""
        return self.status == "error"

    @property
    def is_success(self) -> bool:
        """Check if activity was successful."""
        return self.status == "success"

    @classmethod
    def log_activity(
        cls,
        activity_type: str,
        action: str,
        user_id: Optional[uuid.UUID] = None,
        session_id: Optional[uuid.UUID] = None,
        details: Optional[dict] = None,
        status: str = "success",
        **kwargs,
    ) -> "EducationActivityLog":
        """
        Create a new activity log entry.

        This would be implemented in service layer with proper session handling.
        """
        pass

    @classmethod
    def get_user_activities(
        cls, user_id: uuid.UUID, activity_types: Optional[list] = None, limit: int = 100
    ) -> list["EducationActivityLog"]:
        """Get activities for a specific user."""
        # This would be implemented in service layer
        pass
