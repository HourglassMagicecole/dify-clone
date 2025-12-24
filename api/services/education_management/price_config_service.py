"""
Admin Price Config Service
Manages manual API pricing configuration by owners.
"""

import logging
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.orm import Session

from models.education import AdminPriceConfig

logger = logging.getLogger(__name__)


class PriceConfigService:
    """
    Service for managing admin price configurations.

    Provides CRUD operations for price configs that allow owners
    to set custom prices for API usage.
    """

    @staticmethod
    def list_price_configs(
        session: Session,
        tenant_id: str,
        usage_type: str | None = None,
        provider: str | None = None,
        is_active: bool | None = None,
        page: int = 1,
        page_size: int = 20,
    ) -> tuple[list[AdminPriceConfig], int]:
        """
        List price configurations with optional filtering.

        Args:
            session: SQLAlchemy session
            tenant_id: Tenant ID
            usage_type: Filter by usage type (optional)
            provider: Filter by provider (optional)
            is_active: Filter by active status (optional)
            page: Page number (1-indexed)
            page_size: Items per page

        Returns:
            Tuple of (list of configs, total count)
        """
        stmt = select(AdminPriceConfig).where(AdminPriceConfig.tenant_id == tenant_id)

        if usage_type:
            stmt = stmt.where(AdminPriceConfig.usage_type == usage_type)
        if provider:
            stmt = stmt.where(AdminPriceConfig.provider == provider)
        if is_active is not None:
            stmt = stmt.where(AdminPriceConfig.is_active == is_active)

        # Count total
        count_stmt = select(AdminPriceConfig.id).where(AdminPriceConfig.tenant_id == tenant_id)
        if usage_type:
            count_stmt = count_stmt.where(AdminPriceConfig.usage_type == usage_type)
        if provider:
            count_stmt = count_stmt.where(AdminPriceConfig.provider == provider)
        if is_active is not None:
            count_stmt = count_stmt.where(AdminPriceConfig.is_active == is_active)

        total = len(session.execute(count_stmt).all())

        # Apply pagination
        stmt = stmt.order_by(AdminPriceConfig.created_at.desc())
        stmt = stmt.offset((page - 1) * page_size).limit(page_size)

        configs = list(session.execute(stmt).scalars().all())
        return configs, total

    @staticmethod
    def get_price_config(
        session: Session,
        tenant_id: str,
        config_id: str,
    ) -> AdminPriceConfig | None:
        """
        Get a specific price configuration.

        Args:
            session: SQLAlchemy session
            tenant_id: Tenant ID
            config_id: Config ID

        Returns:
            AdminPriceConfig or None
        """
        stmt = select(AdminPriceConfig).where(
            AdminPriceConfig.id == config_id,
            AdminPriceConfig.tenant_id == tenant_id,
        )
        return session.execute(stmt).scalar_one_or_none()

    @staticmethod
    def create_price_config(
        session: Session,
        tenant_id: str,
        provider: str,
        model_id: str,
        usage_type: str,
        price_unit: str,
        unit_scale: int = 1,
        input_price: Decimal | None = None,
        output_price: Decimal | None = None,
        currency: str = "USD",
        input_modality: str | None = None,
        output_modality: str | None = None,
        quality: str | None = None,
        resolution: str | None = None,
        tool_name: str | None = None,
    ) -> AdminPriceConfig:
        """
        Create a new price configuration.

        Args:
            session: SQLAlchemy session
            tenant_id: Tenant ID
            provider: Model provider
            model_id: Model ID
            usage_type: API type (llm, embedding, etc.)
            price_unit: Pricing unit (token, character, image, etc.)
            unit_scale: Scale factor (e.g., 1000000 for per-million)
            input_price: Price per input unit
            output_price: Price per output unit
            currency: Currency code
            input_modality: Input modality (optional)
            output_modality: Output modality (optional)
            quality: Image quality (optional)
            resolution: Image resolution (optional)
            tool_name: Tool name (optional)

        Returns:
            Created AdminPriceConfig

        Raises:
            ValueError: If validation fails
        """
        # Validate usage_type
        valid_usage_types = {"llm", "embedding", "rerank", "tts", "stt", "image_gen", "tool"}
        if usage_type not in valid_usage_types:
            raise ValueError(f"Invalid usage_type: {usage_type}")

        # Validate price_unit
        valid_price_units = {"token", "character", "image", "minute", "call", "hour"}
        if price_unit not in valid_price_units:
            raise ValueError(f"Invalid price_unit: {price_unit}")

        config = AdminPriceConfig(
            tenant_id=tenant_id,
            provider=provider,
            model_id=model_id,
            usage_type=usage_type,
            price_unit=price_unit,
            unit_scale=unit_scale,
            input_price=input_price,
            output_price=output_price,
            currency=currency,
            input_modality=input_modality,
            output_modality=output_modality,
            quality=quality,
            resolution=resolution,
            tool_name=tool_name,
            is_active=True,
        )

        session.add(config)
        session.flush()

        logger.info(
            "Created price config: provider=%s, model=%s, type=%s",
            provider,
            model_id,
            usage_type,
        )

        return config

    @staticmethod
    def update_price_config(
        session: Session,
        tenant_id: str,
        config_id: str,
        input_price: Decimal | None = None,
        output_price: Decimal | None = None,
        unit_scale: int | None = None,
        currency: str | None = None,
        is_active: bool | None = None,
    ) -> AdminPriceConfig | None:
        """
        Update an existing price configuration.

        Args:
            session: SQLAlchemy session
            tenant_id: Tenant ID
            config_id: Config ID
            input_price: New input price (optional)
            output_price: New output price (optional)
            unit_scale: New unit scale (optional)
            currency: New currency (optional)
            is_active: New active status (optional)

        Returns:
            Updated AdminPriceConfig or None if not found
        """
        config = PriceConfigService.get_price_config(session, tenant_id, config_id)
        if not config:
            return None

        if input_price is not None:
            config.input_price = input_price
        if output_price is not None:
            config.output_price = output_price
        if unit_scale is not None:
            config.unit_scale = unit_scale
        if currency is not None:
            config.currency = currency
        if is_active is not None:
            config.is_active = is_active

        session.flush()

        logger.info("Updated price config: id=%s", config_id)

        return config

    @staticmethod
    def delete_price_config(
        session: Session,
        tenant_id: str,
        config_id: str,
    ) -> bool:
        """
        Delete a price configuration.

        Args:
            session: SQLAlchemy session
            tenant_id: Tenant ID
            config_id: Config ID

        Returns:
            True if deleted, False if not found
        """
        config = PriceConfigService.get_price_config(session, tenant_id, config_id)
        if not config:
            return False

        session.delete(config)
        session.flush()

        logger.info("Deleted price config: id=%s", config_id)

        return True

    @staticmethod
    def get_price_for_model(
        session: Session,
        tenant_id: str,
        provider: str,
        model_id: str,
        usage_type: str,
        input_modality: str | None = None,
        output_modality: str | None = None,
        quality: str | None = None,
        resolution: str | None = None,
        tool_name: str | None = None,
    ) -> AdminPriceConfig | None:
        """
        Get the active price configuration for a specific model.

        Args:
            session: SQLAlchemy session
            tenant_id: Tenant ID
            provider: Model provider
            model_id: Model ID
            usage_type: API type
            input_modality: Input modality (optional)
            output_modality: Output modality (optional)
            quality: Image quality (optional)
            resolution: Image resolution (optional)
            tool_name: Tool name (optional)

        Returns:
            AdminPriceConfig if found, None otherwise
        """
        stmt = select(AdminPriceConfig).where(
            AdminPriceConfig.tenant_id == tenant_id,
            AdminPriceConfig.provider == provider,
            AdminPriceConfig.model_id == model_id,
            AdminPriceConfig.usage_type == usage_type,
            AdminPriceConfig.is_active.is_(True),
        )

        # Add optional filters only if provided
        if input_modality:
            stmt = stmt.where(AdminPriceConfig.input_modality == input_modality)
        if output_modality:
            stmt = stmt.where(AdminPriceConfig.output_modality == output_modality)
        if quality:
            stmt = stmt.where(AdminPriceConfig.quality == quality)
        if resolution:
            stmt = stmt.where(AdminPriceConfig.resolution == resolution)
        if tool_name:
            stmt = stmt.where(AdminPriceConfig.tool_name == tool_name)

        return session.execute(stmt).scalar_one_or_none()
