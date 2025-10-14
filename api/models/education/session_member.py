from datetime import datetime
from enum import StrEnum

import sqlalchemy as sa
from sqlalchemy import DateTime, ForeignKey, Index, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from models.base import Base
from models.types import StringUUID


class MemberStatus(StrEnum):
    """Member status enum."""

    ACTIVE = "active"
    REMOVED = "removed"
    INACTIVE = "inactive"


class EducationSessionMember(Base):
    """Education session member model."""

    __tablename__ = "edu_session_members"
    __table_args__ = (
        sa.PrimaryKeyConstraint("id", name="edu_session_members_pkey"),
        UniqueConstraint("session_id", "account_id", name="uq_edu_session_members_session_account"),
        Index("idx_edu_session_members_account_id", "account_id"),
        Index("idx_edu_session_members_status", "status"),
    )

    # Columns
    id: Mapped[str] = mapped_column(StringUUID, server_default=sa.text("uuid_generate_v4()"))
    session_id: Mapped[str] = mapped_column(
        StringUUID, ForeignKey("education_sessions.id", ondelete="CASCADE"), nullable=False
    )
    account_id: Mapped[str] = mapped_column(StringUUID, ForeignKey("accounts.id", ondelete="CASCADE"), nullable=False)
    joined_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, server_default=sa.text("CURRENT_TIMESTAMP(0)")
    )
    status: Mapped[str] = mapped_column(String(20), nullable=False, server_default="active")
    created_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, server_default=sa.text("CURRENT_TIMESTAMP(0)")
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        nullable=False,
        server_default=sa.text("CURRENT_TIMESTAMP(0)"),
        onupdate=sa.text("CURRENT_TIMESTAMP(0)"),
    )

    # Relationships
    session = relationship("EducationSession", back_populates="members", lazy="joined")
    account = relationship("Account", foreign_keys=[account_id], lazy="joined")

    def __repr__(self) -> str:
        return (
            f"<EducationSessionMember session_id={self.session_id} account_id={self.account_id} status={self.status}>"
        )
