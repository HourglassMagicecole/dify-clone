"""Education user role model."""

from datetime import datetime

import sqlalchemy as sa
from sqlalchemy import DateTime, ForeignKey, Index, String, func
from sqlalchemy.orm import Mapped, mapped_column

from models.base import Base
from models.types import StringUUID


class EduUserRole(Base):
    """
    Education user role model for session-based RBAC.

    This model provides independent role management for educational sessions,
    completely separate from Dify's tenant-based RBAC system.

    Attributes:
        id: Unique identifier (UUID)
        session_id: Reference to education session
        account_id: Reference to user account
        role: User role in the session ('admin' or 'normal')
        assigned_by: Reference to the account who assigned this role (optional)
        assigned_at: Timestamp when the role was assigned
        created_at: Creation timestamp
        updated_at: Last update timestamp
    """

    __tablename__ = "edu_user_roles"
    __table_args__ = (
        sa.PrimaryKeyConstraint("id", name="edu_user_roles_pkey"),
        sa.UniqueConstraint("session_id", "account_id", name="unique_session_account_role"),
        Index("edu_user_roles_session_id_idx", "session_id"),
        Index("edu_user_roles_account_id_idx", "account_id"),
        Index("edu_user_roles_role_idx", "role"),
    )

    id: Mapped[str] = mapped_column(StringUUID, server_default=sa.text("uuid_generate_v4()"))
    session_id: Mapped[str] = mapped_column(
        StringUUID, ForeignKey("education_sessions.id", ondelete="CASCADE"), nullable=False
    )
    account_id: Mapped[str] = mapped_column(StringUUID, ForeignKey("accounts.id", ondelete="CASCADE"), nullable=False)
    role: Mapped[str] = mapped_column(String(16), server_default=sa.text("'normal'"), nullable=False)
    assigned_by: Mapped[str | None] = mapped_column(
        StringUUID, ForeignKey("accounts.id", ondelete="SET NULL"), nullable=True
    )
    assigned_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, server_default=func.now())
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, server_default=func.now(), onupdate=func.now()
    )

    def __repr__(self) -> str:
        """Return string representation of the education user role."""
        return (
            f"<EduUserRole(id={self.id}, session_id={self.session_id}, account_id={self.account_id}, role={self.role})>"
        )
