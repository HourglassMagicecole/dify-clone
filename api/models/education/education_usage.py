"""
Education usage models for usage limit and statistics management.
"""

import uuid
from datetime import datetime
from typing import Optional

import sqlalchemy as sa
from sqlalchemy import DateTime, ForeignKey, Numeric, String, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from models.base import Base


class EducationUsageLimit(Base):
    """
    Education usage limits table for usage limit settings.

    This table manages usage limits with daily/monthly limits
    for controlling resource consumption in educational environment.
    """

    __tablename__ = "education_usage_limits"

    # Primary key
    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, comment="Usage limit record unique identifier"
    )

    # Scope identification
    limit_type: Mapped[str] = mapped_column(
        String(50), nullable=False, comment="Limit type: user, session, group, global"
    )

    resource_type: Mapped[str] = mapped_column(
        String(50), nullable=False, comment="Resource type: api_calls, tokens, requests, storage"
    )

    # Target identification
    target_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), comment="Target ID (user_id, session_id, group_id, etc.)"
    )

    target_name: Mapped[Optional[str]] = mapped_column(String(200), comment="Human-readable target name")

    # Limit settings
    daily_limit: Mapped[Optional[int]] = mapped_column(sa.BigInteger, comment="Daily usage limit")

    monthly_limit: Mapped[Optional[int]] = mapped_column(sa.BigInteger, comment="Monthly usage limit")

    # Soft limits and warnings
    soft_daily_limit: Mapped[Optional[int]] = mapped_column(sa.BigInteger, comment="Daily soft limit for warnings")

    soft_monthly_limit: Mapped[Optional[int]] = mapped_column(sa.BigInteger, comment="Monthly soft limit for warnings")

    # Cost limits (if applicable)
    daily_cost_limit: Mapped[Optional[float]] = mapped_column(Numeric(10, 4), comment="Daily cost limit in dollars")

    monthly_cost_limit: Mapped[Optional[float]] = mapped_column(Numeric(10, 4), comment="Monthly cost limit in dollars")

    # Configuration
    config: Mapped[Optional[dict]] = mapped_column(JSONB, comment="Additional limit configuration")

    # Status
    status: Mapped[str] = mapped_column(
        String(20), default="active", nullable=False, comment="Limit status: active, inactive, suspended"
    )

    # Timestamps
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False, comment="Limit creation timestamp"
    )

    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
        comment="Last update timestamp",
    )

    effective_from: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), comment="When limit becomes effective"
    )

    effective_until: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), comment="When limit expires")

    # Created by reference
    created_by: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), comment="Creator user ID from account system"
    )

    # Indexes
    __table_args__ = (
        sa.Index("ix_education_usage_limits_type_resource", "limit_type", "resource_type"),
        sa.Index("ix_education_usage_limits_target", "target_id"),
        sa.Index("ix_education_usage_limits_status", "status"),
    )

    def __repr__(self) -> str:
        return f"<EducationUsageLimit(id={self.id}, type='{self.limit_type}', resource='{self.resource_type}')>"

    def __str__(self) -> str:
        return (
            f"Limit: {self.limit_type}/{self.resource_type} - Daily: {self.daily_limit}, Monthly: {self.monthly_limit}"
        )

    @property
    def is_active(self) -> bool:
        """Check if usage limit is active."""
        if self.status != "active":
            return False
        now = datetime.utcnow()
        if self.effective_from and self.effective_from > now:
            return False
        if self.effective_until and self.effective_until < now:
            return False
        return True


class EducationUsageStats(Base):
    """
    Education usage statistics table for usage statistics collection.

    This table collects usage statistics with cost estimation
    for monitoring and reporting resource consumption.
    """

    __tablename__ = "education_usage_stats"

    # Primary key
    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, comment="Usage stats record unique identifier"
    )

    # Reference to usage limit
    usage_limit_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("education_usage_limits.id", ondelete="SET NULL"),
        comment="Related usage limit ID",
    )

    # Scope identification
    stat_type: Mapped[str] = mapped_column(
        String(50), nullable=False, comment="Stat type: user, session, group, global"
    )

    resource_type: Mapped[str] = mapped_column(
        String(50), nullable=False, comment="Resource type: api_calls, tokens, requests, storage"
    )

    # Target identification
    target_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), comment="Target ID (user_id, session_id, group_id, etc.)"
    )

    # Time period
    period_type: Mapped[str] = mapped_column(String(20), nullable=False, comment="Period type: hourly, daily, monthly")

    period_start: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, comment="Period start timestamp"
    )

    period_end: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, comment="Period end timestamp"
    )

    # Usage statistics
    usage_count: Mapped[int] = mapped_column(
        sa.BigInteger, default=0, nullable=False, comment="Usage count for the period"
    )

    # Cost estimation
    estimated_cost: Mapped[Optional[float]] = mapped_column(Numeric(10, 4), comment="Estimated cost in dollars")

    actual_cost: Mapped[Optional[float]] = mapped_column(Numeric(10, 4), comment="Actual cost if available")

    # Additional metrics
    metrics: Mapped[Optional[dict]] = mapped_column(JSONB, comment="Additional metrics in JSON format")

    # Timestamps
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False, comment="Stats creation timestamp"
    )

    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
        comment="Last update timestamp",
    )

    # Relationships
    usage_limit: Mapped[Optional[EducationUsageLimit]] = relationship("EducationUsageLimit")

    # Constraints and indexes
    __table_args__ = (
        UniqueConstraint(
            "stat_type",
            "resource_type",
            "target_id",
            "period_type",
            "period_start",
            name="uq_education_usage_stats_period",
        ),
        sa.Index("ix_education_usage_stats_type_resource", "stat_type", "resource_type"),
        sa.Index("ix_education_usage_stats_target", "target_id"),
        sa.Index("ix_education_usage_stats_period", "period_start", "period_end"),
        sa.Index("ix_education_usage_stats_limit", "usage_limit_id"),
    )

    def __repr__(self) -> str:
        return f"<EducationUsageStats(id={self.id}, type='{self.stat_type}', resource='{self.resource_type}')>"

    def __str__(self) -> str:
        return (
            f"Stats: {self.stat_type}/{self.resource_type} - {self.usage_count} uses, ${self.estimated_cost or 0:.4f}"
        )

    def update_usage(self, count: int, cost: Optional[float] = None) -> None:
        """Update usage count and cost."""
        self.usage_count += count
        if cost:
            if self.estimated_cost:
                self.estimated_cost += cost
            else:
                self.estimated_cost = cost
