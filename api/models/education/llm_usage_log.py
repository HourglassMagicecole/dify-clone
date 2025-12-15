"""LLM Usage Log model for tracking API usage independently of message deletion."""

from datetime import datetime
from decimal import Decimal

import sqlalchemy as sa
from sqlalchemy import DateTime, Index, Numeric, String, func
from sqlalchemy.orm import Mapped, mapped_column

from models.base import Base
from models.types import StringUUID


class LlmUsageLog(Base):
    """
    LLM Usage Log model for recording API usage that persists after message/conversation deletion.

    This model stores LLM token usage and cost information independently of the messages table,
    ensuring that API usage statistics remain accurate even when conversations are deleted.

    Attributes:
        id: Unique identifier (UUID)
        tenant_id: Tenant ID for multi-tenancy
        session_id: Education session ID (nullable, no FK constraint)
        account_id: User account ID who made the request (nullable, no FK constraint)
        app_id: App ID that generated the usage (no FK constraint)
        app_name: App name at the time of usage (for display after app deletion)
        conversation_id: Conversation ID (nullable, no FK constraint)
        message_id: Message ID (nullable, no FK constraint)
        model_provider: Model provider name (e.g., "openai", "anthropic")
        model_id: Model ID (e.g., "gpt-4", "claude-3-opus")
        input_tokens: Number of input/prompt tokens
        output_tokens: Number of output/completion tokens
        total_tokens: Total tokens (input + output)
        total_price: Total cost in the specified currency
        currency: Currency code (e.g., "USD")
        created_at: Timestamp when the usage occurred
    """

    __tablename__ = "llm_usage_logs"
    __table_args__ = (
        sa.PrimaryKeyConstraint("id", name="llm_usage_log_pkey"),
        Index("idx_llm_usage_tenant_created", "tenant_id", "created_at"),
        Index("idx_llm_usage_session_created", "session_id", "created_at"),
        Index("idx_llm_usage_app_created", "app_id", "created_at"),
        Index("idx_llm_usage_account_created", "account_id", "created_at"),
    )

    id: Mapped[str] = mapped_column(StringUUID, server_default=sa.text("uuid_generate_v4()"))
    tenant_id: Mapped[str] = mapped_column(StringUUID, nullable=False)

    # Education session info (no FK constraint - survives deletion)
    session_id: Mapped[str | None] = mapped_column(StringUUID, nullable=True)
    account_id: Mapped[str | None] = mapped_column(StringUUID, nullable=True)

    # App info (no FK constraint - survives deletion)
    app_id: Mapped[str] = mapped_column(StringUUID, nullable=False)
    app_name: Mapped[str | None] = mapped_column(String(255), nullable=True)

    # Conversation/Message info (no FK constraint - survives deletion)
    conversation_id: Mapped[str | None] = mapped_column(StringUUID, nullable=True)
    message_id: Mapped[str | None] = mapped_column(StringUUID, nullable=True)

    # Model info
    model_provider: Mapped[str | None] = mapped_column(String(255), nullable=True)
    model_id: Mapped[str | None] = mapped_column(String(255), nullable=True)

    # Token usage
    input_tokens: Mapped[int] = mapped_column(sa.Integer, nullable=False, server_default=sa.text("0"))
    output_tokens: Mapped[int] = mapped_column(sa.Integer, nullable=False, server_default=sa.text("0"))
    total_tokens: Mapped[int] = mapped_column(sa.Integer, nullable=False, server_default=sa.text("0"))

    # Cost info
    total_price: Mapped[Decimal] = mapped_column(Numeric(10, 7), nullable=False, server_default=sa.text("0"))
    currency: Mapped[str] = mapped_column(String(10), nullable=False, server_default=sa.text("'USD'"))

    # Timestamp
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, server_default=func.now())

    def __repr__(self) -> str:
        """Return string representation of the LLM usage log."""
        return (
            f"<LlmUsageLog(id={self.id}, app_id={self.app_id}, tokens={self.total_tokens}, price={self.total_price})>"
        )
