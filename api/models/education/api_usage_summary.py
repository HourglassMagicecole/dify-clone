"""ApiUsageSummary model for daily/monthly aggregated API usage statistics."""

from datetime import date, datetime
from decimal import Decimal

import sqlalchemy as sa
from sqlalchemy import DateTime, Index, Numeric, String, func
from sqlalchemy.orm import Mapped, mapped_column

from models.base import Base
from models.types import StringUUID


class ApiUsageSummary(Base):
    """
    API Usage Summary model for storing aggregated usage statistics.

    This model stores pre-aggregated usage data for efficient dashboard queries.
    Data is aggregated daily by Celery Beat tasks and persists permanently
    even after original logs are deleted.

    Aggregation dimensions:
    - summary_date: The date being summarized
    - summary_type: daily or monthly
    - tenant_id: For multi-tenancy
    - session_id: Education session (nullable for tenant-wide summary)
    - account_id: User account (nullable for session/tenant-wide summary)
    - usage_type: API type (llm, embedding, rerank, etc.)
    - model_provider: Provider name (nullable for type-wide summary)
    - model_id: Model ID (nullable for provider-wide summary)

    Attributes:
        id: Unique identifier (UUID)
        tenant_id: Tenant ID for multi-tenancy
        summary_date: The date being summarized
        summary_type: Type of summary (daily, monthly)
        account_id: User account ID (nullable for aggregated summary)
        session_id: Education session ID (nullable for aggregated summary)
        usage_type: API type being summarized
        model_provider: Provider name (nullable)
        model_id: Model ID (nullable)
        request_count: Number of API requests
        total_input_tokens: Sum of input tokens
        total_output_tokens: Sum of output tokens
        total_tokens: Sum of all tokens
        total_input_units: Sum of non-token input units
        total_output_units: Sum of non-token output units
        total_price: Sum of costs
        currency: Currency code
        created_at: Creation timestamp
        updated_at: Last update timestamp
    """

    __tablename__ = "api_usage_summaries"
    __table_args__ = (
        sa.PrimaryKeyConstraint("id", name="api_usage_summary_pkey"),
        Index("idx_summary_tenant_type_date", "tenant_id", "summary_type", "summary_date"),
        Index("idx_summary_account_date", "tenant_id", "account_id", "summary_date"),
        Index("idx_summary_session_date", "tenant_id", "session_id", "summary_date"),
    )

    id: Mapped[str] = mapped_column(StringUUID, server_default=sa.text("uuid_generate_v4()"))
    tenant_id: Mapped[str] = mapped_column(StringUUID, nullable=False)

    # Summary period
    summary_date: Mapped[date] = mapped_column(sa.Date, nullable=False)
    summary_type: Mapped[str] = mapped_column(String(10), nullable=False)  # daily, monthly

    # Aggregation dimensions (nullable for higher-level aggregations)
    account_id: Mapped[str | None] = mapped_column(StringUUID, nullable=True)
    session_id: Mapped[str | None] = mapped_column(StringUUID, nullable=True)
    usage_type: Mapped[str] = mapped_column(String(20), nullable=False)  # llm, embedding, rerank, etc.
    model_provider: Mapped[str | None] = mapped_column(String(255), nullable=True)
    model_id: Mapped[str | None] = mapped_column(String(255), nullable=True)

    # Aggregated values
    request_count: Mapped[int] = mapped_column(sa.Integer, nullable=False, server_default=sa.text("0"))
    total_input_tokens: Mapped[int] = mapped_column(sa.BigInteger, nullable=False, server_default=sa.text("0"))
    total_output_tokens: Mapped[int] = mapped_column(sa.BigInteger, nullable=False, server_default=sa.text("0"))
    total_tokens: Mapped[int] = mapped_column(sa.BigInteger, nullable=False, server_default=sa.text("0"))
    total_input_units: Mapped[Decimal] = mapped_column(Numeric(15, 4), nullable=False, server_default=sa.text("0"))
    total_output_units: Mapped[Decimal] = mapped_column(Numeric(15, 4), nullable=False, server_default=sa.text("0"))
    total_price: Mapped[Decimal] = mapped_column(Numeric(12, 7), nullable=False, server_default=sa.text("0"))
    currency: Mapped[str] = mapped_column(String(10), nullable=False, server_default=sa.text("'USD'"))

    # Timestamps
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, server_default=func.now(), onupdate=func.now()
    )

    def __repr__(self) -> str:
        """Return string representation of the usage summary."""
        return (
            f"<ApiUsageSummary(date={self.summary_date}, type={self.summary_type}, "
            f"usage_type={self.usage_type}, tokens={self.total_tokens})>"
        )
