"""Session resource tag model for tracking student-created resources."""

from datetime import datetime

import sqlalchemy as sa
from sqlalchemy import DateTime, ForeignKey, Index, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from models.base import Base
from models.types import StringUUID


class SessionResourceTag(Base):
    """
    Session resource tag model for linking resources to education sessions.

    This model tracks which resources (apps, datasets, conversations) belong
    to which education session and which student created them.

    Attributes:
        id: Unique identifier (UUID)
        session_id: Reference to education session
        resource_type: Type of resource (e.g., "app", "dataset", "conversation")
        resource_id: ID of the resource
        account_id: Reference to student account who created the resource
        tagged_at: When the resource was tagged
        created_at: Creation timestamp
    """

    __tablename__ = "session_resource_tags"
    __table_args__ = (
        sa.PrimaryKeyConstraint("id", name="session_resource_tag_pkey"),
        Index("idx_session_resource_account", "session_id", "resource_type", "account_id"),
        Index("idx_resource_lookup", "resource_type", "resource_id"),
        Index("idx_account_resource_tagged", "account_id", "resource_type", "tagged_at"),
    )

    id: Mapped[str] = mapped_column(StringUUID, server_default=sa.text("uuid_generate_v4()"))
    session_id: Mapped[str] = mapped_column(
        StringUUID, ForeignKey("education_sessions.id", ondelete="CASCADE"), nullable=False
    )
    resource_type: Mapped[str] = mapped_column(String(50), nullable=False)
    resource_id: Mapped[str] = mapped_column(StringUUID, nullable=False)
    account_id: Mapped[str] = mapped_column(StringUUID, ForeignKey("accounts.id", ondelete="CASCADE"), nullable=False)
    tagged_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, server_default=func.now())
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, server_default=func.now())

    # Relationships
    session: Mapped["EducationSession"] = relationship("EducationSession", foreign_keys=[session_id])  # type: ignore[name-defined]
    account: Mapped["Account"] = relationship("Account", foreign_keys=[account_id])  # type: ignore[name-defined]

    def __repr__(self) -> str:
        """Return string representation of the session resource tag."""
        return (
            f"<SessionResourceTag(id={self.id}, session_id={self.session_id}, "
            f"resource_type={self.resource_type}, resource_id={self.resource_id})>"
        )
