"""AdminPriceConfig model for manual API pricing configuration by owners."""

from datetime import datetime
from decimal import Decimal

import sqlalchemy as sa
from sqlalchemy import DateTime, Index, Numeric, String, func
from sqlalchemy.orm import Mapped, mapped_column

from models.base import Base
from models.types import StringUUID


class AdminPriceConfig(Base):
    """
    Admin Price Config model for storing manually configured API prices.

    This model allows system owners to set custom prices for API usage
    that override Dify's default pricing. Price lookup priority:
    1. Tenant-specific price (tenant_id = specific tenant)
    2. Default price (tenant_id = NULL)
    3. Dify PriceConfig (from model schemas)
    4. None (usage only, no cost)

    When tenant_id is NULL, the config serves as a default price that applies
    to all tenants unless they have their own tenant-specific config.

    Attributes:
        id: Unique identifier (UUID)
        tenant_id: Tenant ID (NULL for default prices)
        provider: Model provider name (e.g., "openai", "anthropic")
        model_id: Model ID (e.g., "gpt-4", "text-embedding-3-small")
        usage_type: Type of API (llm, embedding, rerank, tts, stt, image_gen, tool)
        input_modality: Input modality for multimodal pricing (optional)
        output_modality: Output modality for multimodal pricing (optional)
        quality: Image quality for image_gen pricing (optional)
        resolution: Image resolution for image_gen pricing (optional)
        tool_name: Tool name for tool pricing (optional)
        price_unit: Unit for pricing (token, character, image, minute, call, hour)
        unit_scale: Scale for the unit (e.g., 1000000 for per-million tokens)
        input_price: Price per unit for input
        output_price: Price per unit for output
        currency: Currency code (default: USD)
        is_active: Whether this config is active
        created_at: Creation timestamp
        updated_at: Last update timestamp
    """

    __tablename__ = "admin_price_configs"
    __table_args__ = (
        sa.PrimaryKeyConstraint("id", name="admin_price_config_pkey"),
        sa.UniqueConstraint(
            "tenant_id",
            "provider",
            "model_id",
            "usage_type",
            "input_modality",
            "output_modality",
            "quality",
            "resolution",
            "tool_name",
            name="uq_admin_price_config",
        ),
        Index("idx_price_config_lookup", "tenant_id", "provider", "model_id"),
        Index("idx_price_config_type", "tenant_id", "usage_type"),
        Index("idx_price_config_active", "is_active"),
    )

    id: Mapped[str] = mapped_column(StringUUID, server_default=sa.text("uuid_generate_v4()"))
    tenant_id: Mapped[str | None] = mapped_column(StringUUID, nullable=True)  # NULL = default price

    # Identification fields
    provider: Mapped[str] = mapped_column(String(50), nullable=False)
    model_id: Mapped[str] = mapped_column(String(100), nullable=False)
    usage_type: Mapped[str] = mapped_column(
        String(20), nullable=False
    )  # llm, embedding, rerank, tts, stt, image_gen, tool

    # Multimodal/Image/Tool discrimination (nullable for simple cases)
    input_modality: Mapped[str | None] = mapped_column(String(20), nullable=True)
    output_modality: Mapped[str | None] = mapped_column(String(20), nullable=True)
    quality: Mapped[str | None] = mapped_column(String(20), nullable=True)
    resolution: Mapped[str | None] = mapped_column(String(20), nullable=True)
    tool_name: Mapped[str | None] = mapped_column(String(100), nullable=True)

    # Pricing information
    price_unit: Mapped[str] = mapped_column(String(20), nullable=False)  # token, character, image, minute, call, hour
    unit_scale: Mapped[int] = mapped_column(
        sa.Integer, nullable=False, server_default=sa.text("1")
    )  # e.g., 1000000 for per-million
    input_price: Mapped[Decimal | None] = mapped_column(Numeric(10, 7), nullable=True)
    output_price: Mapped[Decimal | None] = mapped_column(Numeric(10, 7), nullable=True)
    currency: Mapped[str] = mapped_column(String(10), nullable=False, server_default=sa.text("'USD'"))

    # Status
    is_active: Mapped[bool] = mapped_column(sa.Boolean, nullable=False, server_default=sa.text("true"))

    # Timestamps
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, server_default=func.now(), onupdate=func.now()
    )

    def __repr__(self) -> str:
        """Return string representation of the price config."""
        return f"<AdminPriceConfig(provider={self.provider}, model={self.model_id}, type={self.usage_type})>"
