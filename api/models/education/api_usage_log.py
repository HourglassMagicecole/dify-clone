"""API Usage Log model for tracking all API usage independently of message deletion."""

from datetime import date, datetime
from decimal import Decimal

import sqlalchemy as sa
from sqlalchemy import DateTime, Index, Numeric, String, func
from sqlalchemy.orm import Mapped, mapped_column

from models.base import Base
from models.types import StringUUID


class ApiUsageLog(Base):
    """
    API Usage Log model for recording all API usage that persists after message/conversation deletion.

    This model stores API usage and cost information for all API types:
    - llm: LLM text generation
    - embedding: Text embedding
    - rerank: Document reranking
    - tts: Text-to-speech
    - stt: Speech-to-text
    - image_gen: Image generation (DALL-E, etc.)
    - tool: Tool/function calls

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
        usage_type: Type of API (llm, embedding, rerank, tts, stt, image_gen, tool)
        input_modality: Input modality (text, image, audio, video)
        output_modality: Output modality (text, image, audio)
        tool_name: Tool name for tool/image_gen usage
        quality: Image quality for image generation
        resolution: Image resolution for image generation
        invoke_source: Source of invocation (agent, tool_test, hit_testing, indexing)
        input_tokens: Number of input/prompt tokens
        output_tokens: Number of output/completion tokens
        total_tokens: Total tokens (input + output)
        input_unit_count: Non-token input units (images, minutes, calls)
        output_unit_count: Non-token output units (images, minutes)
        total_price: Total cost in the specified currency
        currency: Currency code (e.g., "USD")
        retention_until: Date until which this log should be retained
        created_at: Timestamp when the usage occurred
    """

    __tablename__ = "api_usage_logs"
    __table_args__ = (
        sa.PrimaryKeyConstraint("id", name="api_usage_log_pkey"),
        Index("idx_api_usage_tenant_created", "tenant_id", "created_at"),
        Index("idx_api_usage_session_created", "session_id", "created_at"),
        Index("idx_api_usage_app_created", "app_id", "created_at"),
        Index("idx_api_usage_account_created", "account_id", "created_at"),
        Index("idx_api_usage_type_created", "tenant_id", "usage_type", "created_at"),
        Index("idx_api_usage_provider_created", "tenant_id", "model_provider", "created_at"),
        Index("idx_api_usage_account_type_created", "tenant_id", "account_id", "usage_type", "created_at"),
        Index("idx_api_usage_retention", "retention_until"),
    )

    id: Mapped[str] = mapped_column(StringUUID, server_default=sa.text("uuid_generate_v4()"))
    tenant_id: Mapped[str] = mapped_column(StringUUID, nullable=False)

    # Education session info (no FK constraint - survives deletion)
    session_id: Mapped[str | None] = mapped_column(StringUUID, nullable=True)
    account_id: Mapped[str | None] = mapped_column(StringUUID, nullable=True)

    # App info (no FK constraint - survives deletion)
    # app_id is nullable for indexing/background tasks that have no app context
    app_id: Mapped[str | None] = mapped_column(StringUUID, nullable=True)
    app_name: Mapped[str | None] = mapped_column(String(255), nullable=True)

    # Conversation/Message info (no FK constraint - survives deletion)
    conversation_id: Mapped[str | None] = mapped_column(StringUUID, nullable=True)
    message_id: Mapped[str | None] = mapped_column(StringUUID, nullable=True)

    # Model info
    model_provider: Mapped[str | None] = mapped_column(String(255), nullable=True)
    model_id: Mapped[str | None] = mapped_column(String(255), nullable=True)

    # API type and modality
    usage_type: Mapped[str] = mapped_column(
        String(20), nullable=False, server_default=sa.text("'llm'")
    )  # llm, embedding, rerank, tts, stt, image_gen, tool
    input_modality: Mapped[str] = mapped_column(
        String(20), nullable=False, server_default=sa.text("'text'")
    )  # text, image, audio, video
    output_modality: Mapped[str] = mapped_column(
        String(20), nullable=False, server_default=sa.text("'text'")
    )  # text, image, audio

    # Tool/Image Gen specific fields
    tool_name: Mapped[str | None] = mapped_column(String(100), nullable=True)
    quality: Mapped[str | None] = mapped_column(String(20), nullable=True)
    resolution: Mapped[str | None] = mapped_column(String(20), nullable=True)

    # Invocation source (agent, tool_test, hit_testing, indexing, etc.)
    invoke_source: Mapped[str | None] = mapped_column(String(50), nullable=True)

    # Token usage
    input_tokens: Mapped[int] = mapped_column(sa.Integer, nullable=False, server_default=sa.text("0"))
    output_tokens: Mapped[int] = mapped_column(sa.Integer, nullable=False, server_default=sa.text("0"))
    total_tokens: Mapped[int] = mapped_column(sa.Integer, nullable=False, server_default=sa.text("0"))

    # Non-token unit counts (for images, audio minutes, tool calls)
    input_unit_count: Mapped[Decimal | None] = mapped_column(Numeric(15, 4), nullable=True)
    output_unit_count: Mapped[Decimal | None] = mapped_column(Numeric(15, 4), nullable=True)

    # Cost info
    total_price: Mapped[Decimal] = mapped_column(Numeric(10, 7), nullable=False, server_default=sa.text("0"))
    currency: Mapped[str] = mapped_column(String(10), nullable=False, server_default=sa.text("'USD'"))

    # Retention policy (set when session ends/deletes)
    retention_until: Mapped[date | None] = mapped_column(sa.Date, nullable=True)

    # Timestamp
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, server_default=func.now())

    def __repr__(self) -> str:
        """Return string representation of the API usage log."""
        return (
            f"<ApiUsageLog(id={self.id}, type={self.usage_type}, "
            f"app_id={self.app_id}, tokens={self.total_tokens}, price={self.total_price})>"
        )
