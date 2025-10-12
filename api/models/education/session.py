"""Education session model."""

from datetime import datetime

import sqlalchemy as sa
from sqlalchemy import Boolean, DateTime, ForeignKey, Index, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from models.base import Base
from models.types import StringUUID


class EducationSession(Base):
    """
    Education session model for managing educational courses.

    Attributes:
        id: Unique identifier (UUID)
        session_name: Name of the education session
        session_tag: Unique tag for resource filtering
        tenant_id: Reference to tenant
        instructor_account_id: Reference to instructor account
        start_date: Session start date
        end_date: Session end date (optional)
        max_students: Maximum number of students (default: 50)
        is_active: Whether the session is active
        description: Session description (optional)
        created_at: Creation timestamp
        updated_at: Last update timestamp
    """

    __tablename__ = "education_sessions"
    __table_args__ = (
        sa.PrimaryKeyConstraint("id", name="education_session_pkey"),
        Index("idx_session_tag_unique", "session_tag", unique=True),
    )

    id: Mapped[str] = mapped_column(StringUUID, server_default=sa.text("uuid_generate_v4()"))
    session_name: Mapped[str] = mapped_column(String(255), nullable=False)
    session_tag: Mapped[str] = mapped_column(String(100), nullable=False)
    tenant_id: Mapped[str] = mapped_column(StringUUID, ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False)
    instructor_account_id: Mapped[str] = mapped_column(
        StringUUID, ForeignKey("accounts.id", ondelete="CASCADE"), nullable=False
    )
    start_date: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    end_date: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    max_students: Mapped[int] = mapped_column(Integer, default=50, nullable=False, server_default=sa.text("50"))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False, server_default=sa.text("true"))
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, server_default=func.now(), onupdate=func.now()
    )

    # Relationships
    tenant: Mapped["Tenant"] = relationship("Tenant", foreign_keys=[tenant_id])  # type: ignore[name-defined]
    instructor: Mapped["Account"] = relationship("Account", foreign_keys=[instructor_account_id])  # type: ignore[name-defined]

    def __repr__(self) -> str:
        """Return string representation of the education session."""
        return f"<EducationSession(id={self.id}, session_name={self.session_name}, session_tag={self.session_tag})>"
