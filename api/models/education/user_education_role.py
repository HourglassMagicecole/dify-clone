"""
User education role model for education role/permission management.
"""

import uuid
from datetime import datetime
from typing import Optional

import sqlalchemy as sa
from sqlalchemy import DateTime, String, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from models.base import Base


class UserEducationRole(Base):
    """
    User education role table for education role/permission management.

    This table manages educational roles and permissions separate from
    the main account system for fine-grained access control.
    """

    __tablename__ = "user_education_roles"

    # Primary key
    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, comment="Role assignment unique identifier"
    )

    # User identification
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), nullable=False, comment="User ID from account system"
    )

    # Role definition
    role: Mapped[str] = mapped_column(
        String(50), nullable=False, comment="Education role: student, instructor, admin, moderator, observer"
    )

    # Scope of the role
    scope_type: Mapped[str] = mapped_column(
        String(20), default="global", nullable=False, comment="Role scope: global, session, group"
    )

    scope_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), comment="Scope ID (session_id, group_id, etc.) if applicable"
    )

    # Permission details
    permissions: Mapped[Optional[list]] = mapped_column(JSONB, comment="Specific permissions array")

    restrictions: Mapped[Optional[dict]] = mapped_column(JSONB, comment="Role restrictions in JSON format")

    # Status and lifecycle
    status: Mapped[str] = mapped_column(
        String(20), default="active", nullable=False, comment="Role status: active, inactive, suspended"
    )

    # Validity period
    valid_from: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), comment="Role valid from timestamp")

    valid_until: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), comment="Role valid until timestamp"
    )

    # Timestamps
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False, comment="Role assignment creation timestamp"
    )

    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
        comment="Last update timestamp",
    )

    # Assignment tracking
    assigned_by: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), comment="User ID who assigned this role"
    )

    assignment_reason: Mapped[Optional[str]] = mapped_column(String(500), comment="Reason for role assignment")

    # Constraints and indexes
    __table_args__ = (
        UniqueConstraint("user_id", "role", "scope_type", "scope_id", name="uq_user_education_roles_user_role_scope"),
        sa.Index("ix_user_education_roles_user_id", "user_id"),
        sa.Index("ix_user_education_roles_role", "role"),
        sa.Index("ix_user_education_roles_scope", "scope_type", "scope_id"),
        sa.Index("ix_user_education_roles_status", "status"),
    )

    def __repr__(self) -> str:
        return f"<UserEducationRole(id={self.id}, user={self.user_id}, role='{self.role}')>"

    def __str__(self) -> str:
        scope = f" ({self.scope_type}:{self.scope_id})" if self.scope_id else f" ({self.scope_type})"
        return f"Role: {self.role}{scope}"

    @property
    def is_active(self) -> bool:
        """Check if role is currently active."""
        if self.status != "active":
            return False

        now = datetime.utcnow()
        if self.valid_from and self.valid_from > now:
            return False
        if self.valid_until and self.valid_until < now:
            return False

        return True

    @property
    def is_instructor(self) -> bool:
        """Check if role is instructor."""
        return self.role == "instructor"

    @property
    def is_admin(self) -> bool:
        """Check if role is admin."""
        return self.role == "admin"

    @property
    def is_student(self) -> bool:
        """Check if role is student."""
        return self.role == "student"

    @property
    def is_global(self) -> bool:
        """Check if role has global scope."""
        return self.scope_type == "global"

    def has_permission(self, permission: str) -> bool:
        """Check if role has specific permission."""
        if not self.is_active:
            return False

        if not self.permissions:
            return False

        return permission in self.permissions

    def add_permission(self, permission: str) -> None:
        """Add permission to role."""
        if not self.permissions:
            self.permissions = []

        if permission not in self.permissions:
            self.permissions.append(permission)

    def remove_permission(self, permission: str) -> None:
        """Remove permission from role."""
        if self.permissions and permission in self.permissions:
            self.permissions.remove(permission)

    def suspend(self, reason: Optional[str] = None) -> None:
        """Suspend the role."""
        self.status = "suspended"
        if reason and self.restrictions:
            self.restrictions["suspension_reason"] = reason
        elif reason:
            self.restrictions = {"suspension_reason": reason}

    def activate(self) -> None:
        """Activate the role."""
        self.status = "active"
        if self.restrictions and "suspension_reason" in self.restrictions:
            del self.restrictions["suspension_reason"]

    @classmethod
    def get_user_roles(cls, user_id: uuid.UUID, scope_type: Optional[str] = None) -> list["UserEducationRole"]:
        """Get all roles for a user."""
        # This would be implemented in service layer
        pass
