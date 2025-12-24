"""
Central API Usage Tracking Service.

This service provides unified tracking for all API types:
- LLM (text generation)
- Embedding (text embedding)
- Rerank (document reranking)
- TTS (text-to-speech)
- STT (speech-to-text)
- Image Generation (DALL-E, etc.)
- Tool (function calls)
"""

import logging
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.orm import Session

from core.model_runtime.entities.model_entities import ModelType, PriceType
from models.education import AdminPriceConfig, ApiUsageLog, SessionResourceTag

logger = logging.getLogger(__name__)

# Mapping from usage_type to ModelType
USAGE_TYPE_TO_MODEL_TYPE: dict[str, ModelType] = {
    "llm": ModelType.LLM,
    "embedding": ModelType.TEXT_EMBEDDING,
    "rerank": ModelType.RERANK,
    "tts": ModelType.TTS,
    "stt": ModelType.SPEECH2TEXT,
    "image_gen": ModelType.TEXT_EMBEDDING,  # Image generation uses different approach
}


class ApiUsageTrackingService:
    """
    Central service for tracking all API usage.

    This service handles:
    - Recording usage for all API types
    - Price lookup with priority: AdminPriceConfig > Dify PriceConfig > None
    - Cost calculation based on usage and pricing
    """

    @staticmethod
    def record_usage(
        *,
        session: Session,
        tenant_id: str,
        usage_type: str,
        app_id: str | None = None,
        app_name: str | None = None,
        account_id: str | None = None,
        session_id: str | None = None,
        conversation_id: str | None = None,
        message_id: str | None = None,
        model_provider: str | None = None,
        model_id: str | None = None,
        input_tokens: int = 0,
        output_tokens: int = 0,
        input_unit_count: Decimal | None = None,
        output_unit_count: Decimal | None = None,
        input_modality: str = "text",
        output_modality: str = "text",
        tool_name: str | None = None,
        quality: str | None = None,
        resolution: str | None = None,
        total_price: Decimal | None = None,
        currency: str = "USD",
        invoke_source: str | None = None,
    ) -> ApiUsageLog | None:
        """
        Record API usage to api_usage_logs table.

        This creates a persistent record of API usage that survives
        message/conversation/app deletion.

        Args:
            session: SQLAlchemy session
            tenant_id: Tenant ID for multi-tenancy
            usage_type: API type (llm, embedding, rerank, tts, stt, image_gen, tool)
            app_id: App ID that generated the usage
            app_name: App name (for display after app deletion)
            account_id: User account ID
            session_id: Education session ID
            conversation_id: Conversation ID
            message_id: Message ID
            model_provider: Model provider name
            model_id: Model ID
            input_tokens: Number of input tokens
            output_tokens: Number of output tokens
            input_unit_count: Non-token input units (images, minutes)
            output_unit_count: Non-token output units
            input_modality: Input modality (text, image, audio, video)
            output_modality: Output modality (text, image, audio)
            tool_name: Tool name for tool/image_gen usage
            quality: Image quality for image_gen
            resolution: Image resolution for image_gen
            total_price: Pre-calculated total price (if available)
            currency: Currency code
            invoke_source: Source of invocation (agent, tool_test, hit_testing, indexing)

        Returns:
            Created ApiUsageLog object, or None on failure
        """
        # Use a separate session to avoid polluting the caller's transaction
        # This ensures usage logging failures don't affect the main operation
        from sqlalchemy.orm import Session as SASession

        from extensions.ext_database import db

        try:
            # Auto-lookup session_id from app_id if not provided
            if session_id is None and app_id:
                session_id = ApiUsageTrackingService.get_session_id_for_app(session, app_id)

            # Calculate price if not provided
            if total_price is None and model_provider and model_id:
                total_price = ApiUsageTrackingService._calculate_total_price(
                    session=session,
                    tenant_id=tenant_id,
                    provider=model_provider,
                    model_id=model_id,
                    usage_type=usage_type,
                    input_tokens=input_tokens,
                    output_tokens=output_tokens,
                    input_unit_count=input_unit_count,
                    output_unit_count=output_unit_count,
                    input_modality=input_modality,
                    output_modality=output_modality,
                    quality=quality,
                    resolution=resolution,
                    tool_name=tool_name,
                )

            usage_log = ApiUsageLog(
                tenant_id=tenant_id,
                usage_type=usage_type,
                session_id=session_id,
                account_id=account_id,
                app_id=app_id,
                app_name=app_name,
                conversation_id=conversation_id,
                message_id=message_id,
                model_provider=model_provider,
                model_id=model_id,
                input_tokens=input_tokens,
                output_tokens=output_tokens,
                total_tokens=input_tokens + output_tokens,
                input_unit_count=input_unit_count,
                output_unit_count=output_unit_count,
                input_modality=input_modality,
                output_modality=output_modality,
                tool_name=tool_name,
                quality=quality,
                resolution=resolution,
                total_price=total_price or Decimal(0),
                currency=currency,
                invoke_source=invoke_source,
            )

            # Use independent session to commit immediately without affecting caller's transaction
            with SASession(db.engine) as new_session:
                new_session.add(usage_log)
                new_session.commit()
                # Refresh to get the generated id
                new_session.refresh(usage_log)

            logger.info(
                "Recorded %s usage: app=%s, tokens=%d, price=%s",
                usage_type,
                app_id,
                input_tokens + output_tokens,
                total_price,
            )

            return usage_log

        except Exception:
            logger.exception("Failed to record %s usage for app %s", usage_type, app_id)
            return None

    @staticmethod
    def record_embedding_usage(
        *,
        session: Session,
        tenant_id: str,
        model_provider: str,
        model_id: str,
        input_tokens: int,
        app_id: str | None = None,
        app_name: str | None = None,
        account_id: str | None = None,
        session_id: str | None = None,
        invoke_source: str | None = None,
    ) -> ApiUsageLog | None:
        """
        Record embedding API usage.

        Args:
            session: SQLAlchemy session
            tenant_id: Tenant ID
            model_provider: Provider name
            model_id: Model ID
            input_tokens: Number of tokens embedded
            app_id: App ID (optional)
            app_name: App name (optional)
            account_id: Account ID (optional)
            session_id: Session ID (optional)
            invoke_source: Source of invocation (optional)

        Returns:
            Created ApiUsageLog or None
        """
        # app_id is optional - indexing happens without app context
        return ApiUsageTrackingService.record_usage(
            session=session,
            tenant_id=tenant_id,
            usage_type="embedding",
            app_id=app_id,  # None for indexing (no app context)
            app_name=app_name,
            account_id=account_id,
            session_id=session_id,
            model_provider=model_provider,
            model_id=model_id,
            input_tokens=input_tokens,
            output_tokens=0,
            invoke_source=invoke_source,
        )

    @staticmethod
    def record_rerank_usage(
        *,
        session: Session,
        tenant_id: str,
        model_provider: str,
        model_id: str,
        doc_count: int,
        app_id: str | None = None,
        app_name: str | None = None,
        account_id: str | None = None,
        session_id: str | None = None,
        invoke_source: str | None = None,
    ) -> ApiUsageLog | None:
        """
        Record rerank API usage.

        Args:
            session: SQLAlchemy session
            tenant_id: Tenant ID
            model_provider: Provider name
            model_id: Model ID
            doc_count: Number of documents reranked
            app_id: App ID (optional)
            app_name: App name (optional)
            account_id: Account ID (optional)
            session_id: Session ID (optional)
            invoke_source: Source of invocation (optional)

        Returns:
            Created ApiUsageLog or None
        """
        # Allow recording without app_id for hit_testing and other test scenarios
        if not app_id and not invoke_source:
            logger.debug("Skipping rerank usage record - no app_id or invoke_source")
            return None

        return ApiUsageTrackingService.record_usage(
            session=session,
            tenant_id=tenant_id,
            usage_type="rerank",
            app_id=app_id,
            app_name=app_name,
            account_id=account_id,
            session_id=session_id,
            model_provider=model_provider,
            model_id=model_id,
            input_unit_count=Decimal(doc_count),
            invoke_source=invoke_source,
        )

    @staticmethod
    def record_tts_usage(
        *,
        session: Session,
        tenant_id: str,
        model_provider: str,
        model_id: str,
        char_count: int,
        audio_minutes: Decimal | None = None,
        app_id: str | None = None,
        app_name: str | None = None,
        account_id: str | None = None,
        session_id: str | None = None,
        conversation_id: str | None = None,
        message_id: str | None = None,
        invoke_source: str | None = None,
    ) -> ApiUsageLog | None:
        """
        Record TTS (text-to-speech) API usage.

        Args:
            session: SQLAlchemy session
            tenant_id: Tenant ID
            model_provider: Provider name
            model_id: Model ID
            char_count: Number of characters converted
            audio_minutes: Output audio duration in minutes (for models like gpt-4o-mini-tts)
            app_id: App ID (optional)
            app_name: App name (optional)
            account_id: Account ID (optional)
            session_id: Session ID (optional)
            conversation_id: Conversation ID (optional)
            message_id: Message ID (optional)
            invoke_source: Source of invocation (optional)

        Returns:
            Created ApiUsageLog or None
        """
        # Allow recording without app_id for tool_test scenarios
        if not app_id and not invoke_source:
            logger.debug("Skipping TTS usage record - no app_id or invoke_source")
            return None

        return ApiUsageTrackingService.record_usage(
            session=session,
            tenant_id=tenant_id,
            usage_type="tts",
            app_id=app_id,
            app_name=app_name,
            account_id=account_id,
            session_id=session_id,
            conversation_id=conversation_id,
            message_id=message_id,
            model_provider=model_provider,
            model_id=model_id,
            input_modality="text",
            output_modality="audio",
            input_unit_count=Decimal(char_count),
            output_unit_count=audio_minutes,
            invoke_source=invoke_source,
        )

    @staticmethod
    def record_stt_usage(
        *,
        session: Session,
        tenant_id: str,
        model_provider: str,
        model_id: str,
        estimated_minutes: Decimal,
        app_id: str | None = None,
        app_name: str | None = None,
        account_id: str | None = None,
        session_id: str | None = None,
        conversation_id: str | None = None,
        message_id: str | None = None,
        invoke_source: str | None = None,
    ) -> ApiUsageLog | None:
        """
        Record STT (speech-to-text) API usage.

        Args:
            session: SQLAlchemy session
            tenant_id: Tenant ID
            model_provider: Provider name
            model_id: Model ID
            estimated_minutes: Estimated audio duration in minutes
            app_id: App ID (optional)
            app_name: App name (optional)
            account_id: Account ID (optional)
            session_id: Session ID (optional)
            conversation_id: Conversation ID (optional)
            message_id: Message ID (optional)
            invoke_source: Source of invocation (optional)

        Returns:
            Created ApiUsageLog or None
        """
        # Allow recording without app_id for tool_test scenarios
        if not app_id and not invoke_source:
            logger.debug("Skipping STT usage record - no app_id or invoke_source")
            return None

        return ApiUsageTrackingService.record_usage(
            session=session,
            tenant_id=tenant_id,
            usage_type="stt",
            app_id=app_id,
            app_name=app_name,
            account_id=account_id,
            session_id=session_id,
            conversation_id=conversation_id,
            message_id=message_id,
            model_provider=model_provider,
            model_id=model_id,
            input_modality="audio",
            output_modality="text",
            input_unit_count=estimated_minutes,
            invoke_source=invoke_source,
        )

    @staticmethod
    def record_image_gen_usage(
        *,
        session: Session,
        tenant_id: str,
        model_provider: str,
        model_id: str,
        image_count: int,
        quality: str | None = None,
        resolution: str | None = None,
        tool_name: str | None = None,
        app_id: str | None = None,
        app_name: str | None = None,
        account_id: str | None = None,
        session_id: str | None = None,
        conversation_id: str | None = None,
        message_id: str | None = None,
        invoke_source: str | None = None,
    ) -> ApiUsageLog | None:
        """
        Record image generation API usage.

        Args:
            session: SQLAlchemy session
            tenant_id: Tenant ID
            model_provider: Provider name (e.g., "openai")
            model_id: Model ID (e.g., "dall-e-3")
            image_count: Number of images generated
            quality: Image quality (e.g., "standard", "hd")
            resolution: Image resolution (e.g., "1024x1024")
            tool_name: Tool name (e.g., "dalle3")
            app_id: App ID (optional)
            app_name: App name (optional)
            account_id: Account ID (optional)
            session_id: Session ID (optional)
            conversation_id: Conversation ID (optional)
            message_id: Message ID (optional)
            invoke_source: Source of invocation (optional)

        Returns:
            Created ApiUsageLog or None
        """
        # Allow recording without app_id for tool_test scenarios
        if not app_id and not invoke_source:
            logger.debug("Skipping image_gen usage record - no app_id or invoke_source")
            return None

        return ApiUsageTrackingService.record_usage(
            session=session,
            tenant_id=tenant_id,
            usage_type="image_gen",
            app_id=app_id,
            app_name=app_name,
            account_id=account_id,
            session_id=session_id,
            conversation_id=conversation_id,
            message_id=message_id,
            model_provider=model_provider,
            model_id=model_id,
            input_modality="text",
            output_modality="image",
            tool_name=tool_name,
            quality=quality,
            resolution=resolution,
            output_unit_count=Decimal(image_count),
            invoke_source=invoke_source,
        )

    @staticmethod
    def record_tool_usage(
        *,
        session: Session,
        tenant_id: str,
        tool_name: str,
        app_id: str | None = None,
        app_name: str | None = None,
        account_id: str | None = None,
        session_id: str | None = None,
        conversation_id: str | None = None,
        message_id: str | None = None,
        invoke_source: str | None = None,
    ) -> ApiUsageLog | None:
        """
        Record tool invocation usage.

        Args:
            session: SQLAlchemy session
            tenant_id: Tenant ID
            tool_name: Name of the tool invoked
            app_id: App ID (optional)
            app_name: App name (optional)
            account_id: Account ID (optional)
            session_id: Session ID (optional)
            conversation_id: Conversation ID (optional)
            message_id: Message ID (optional)
            invoke_source: Source of invocation (optional)

        Returns:
            Created ApiUsageLog or None
        """
        # Allow recording without app_id for tool_test scenarios
        if not app_id and not invoke_source:
            logger.debug("Skipping tool usage record - no app_id or invoke_source")
            return None

        return ApiUsageTrackingService.record_usage(
            session=session,
            tenant_id=tenant_id,
            usage_type="tool",
            app_id=app_id,
            app_name=app_name,
            account_id=account_id,
            session_id=session_id,
            conversation_id=conversation_id,
            message_id=message_id,
            tool_name=tool_name,
            input_unit_count=Decimal(1),  # 1 call
            invoke_source=invoke_source,
        )

    @staticmethod
    def get_session_id_for_app(session: Session, app_id: str) -> str | None:
        """
        Get session_id from SessionResourceTag for the given app.

        Args:
            session: SQLAlchemy session
            app_id: App ID to look up

        Returns:
            session_id if found, None otherwise
        """
        stmt = (
            select(SessionResourceTag.session_id)
            .where(
                SessionResourceTag.resource_id == app_id,
                SessionResourceTag.resource_type == "app",
            )
            .limit(1)
        )
        return session.execute(stmt).scalar_one_or_none()

    @staticmethod
    def _calculate_total_price(
        *,
        session: Session,
        tenant_id: str,
        provider: str,
        model_id: str,
        usage_type: str,
        input_tokens: int = 0,
        output_tokens: int = 0,
        input_unit_count: Decimal | None = None,
        output_unit_count: Decimal | None = None,
        input_modality: str | None = None,
        output_modality: str | None = None,
        quality: str | None = None,
        resolution: str | None = None,
        tool_name: str | None = None,
    ) -> Decimal | None:
        """
        Calculate total price based on usage and pricing configuration.

        Price lookup priority:
        1. AdminPriceConfig (manual override)
        2. Dify PriceConfig (from model schema)
        3. None (no pricing available)

        Args:
            session: SQLAlchemy session
            tenant_id: Tenant ID
            provider: Model provider
            model_id: Model ID
            usage_type: API type
            input_tokens: Input token count
            output_tokens: Output token count
            input_unit_count: Non-token input units
            output_unit_count: Non-token output units
            input_modality: Input modality
            output_modality: Output modality
            quality: Image quality
            resolution: Image resolution
            tool_name: Tool name

        Returns:
            Calculated total price or None
        """
        # Try AdminPriceConfig first
        admin_config = ApiUsageTrackingService._get_admin_price_config(
            session=session,
            tenant_id=tenant_id,
            provider=provider,
            model_id=model_id,
            usage_type=usage_type,
            input_modality=input_modality,
            output_modality=output_modality,
            quality=quality,
            resolution=resolution,
            tool_name=tool_name,
        )

        if admin_config:
            return ApiUsageTrackingService._calculate_price_from_config(
                input_price=admin_config.input_price,
                output_price=admin_config.output_price,
                unit_scale=admin_config.unit_scale,
                input_tokens=input_tokens,
                output_tokens=output_tokens,
                input_unit_count=input_unit_count,
                output_unit_count=output_unit_count,
            )

        # Try Dify PriceConfig as fallback
        dify_price = ApiUsageTrackingService._get_dify_price(
            tenant_id=tenant_id,
            provider=provider,
            model_id=model_id,
            usage_type=usage_type,
            input_tokens=input_tokens,
            output_tokens=output_tokens,
        )
        if dify_price is not None:
            return dify_price

        return None

    @staticmethod
    def _get_admin_price_config(
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
        Get AdminPriceConfig from database.

        Lookup priority:
        1. Tenant-specific price (tenant_id = given tenant)
        2. Default price (tenant_id = NULL)

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
        # Extract simple provider name from full provider path
        # e.g., "langgenius/openai/openai" -> "openai"
        simple_provider = provider.split("/")[-1] if "/" in provider else provider

        def build_query(target_tenant_id: str | None):
            """Build query for given tenant_id (None for default prices)."""
            if target_tenant_id is None:
                stmt = select(AdminPriceConfig).where(
                    AdminPriceConfig.tenant_id.is_(None),
                    AdminPriceConfig.provider == simple_provider,
                    AdminPriceConfig.model_id == model_id,
                    AdminPriceConfig.usage_type == usage_type,
                    AdminPriceConfig.is_active.is_(True),
                )
            else:
                stmt = select(AdminPriceConfig).where(
                    AdminPriceConfig.tenant_id == target_tenant_id,
                    AdminPriceConfig.provider == simple_provider,
                    AdminPriceConfig.model_id == model_id,
                    AdminPriceConfig.usage_type == usage_type,
                    AdminPriceConfig.is_active.is_(True),
                )

            # Add optional filters
            if input_modality:
                stmt = stmt.where(AdminPriceConfig.input_modality == input_modality)
            if output_modality:
                stmt = stmt.where(AdminPriceConfig.output_modality == output_modality)
            if quality:
                stmt = stmt.where(AdminPriceConfig.quality == quality)
            if resolution:
                stmt = stmt.where(AdminPriceConfig.resolution == resolution)
            # For image_gen, tool_name doesn't affect pricing (based on quality/resolution)
            if tool_name and usage_type != "image_gen":
                stmt = stmt.where(AdminPriceConfig.tool_name == tool_name)

            return stmt

        # Use a fresh session to avoid transaction isolation issues
        from sqlalchemy.orm import Session as SASession

        from extensions.ext_database import db

        try:
            with SASession(db.engine) as fresh_session:
                # 1. Try tenant-specific price first
                result = fresh_session.execute(build_query(tenant_id)).scalar_one_or_none()
                if result:
                    logger.info("Found tenant-specific price config: %s", result.id)
                    return result

                # 2. Fall back to default price (tenant_id = NULL)
                default_result = fresh_session.execute(build_query(None)).scalar_one_or_none()
                if default_result:
                    logger.info(
                        "Found default price config: %s, output_price=%s",
                        default_result.id,
                        default_result.output_price,
                    )
                else:
                    logger.info(
                        "No price config found for %s/%s type=%s quality=%s res=%s in=%s out=%s",
                        provider,
                        model_id,
                        usage_type,
                        quality,
                        resolution,
                        input_modality,
                        output_modality,
                    )
                return default_result
        except Exception:
            logger.exception("Failed to get admin price config")
            return None

    @staticmethod
    def _calculate_price_from_config(
        input_price: Decimal | None,
        output_price: Decimal | None,
        unit_scale: int,
        input_tokens: int = 0,
        output_tokens: int = 0,
        input_unit_count: Decimal | None = None,
        output_unit_count: Decimal | None = None,
    ) -> Decimal:
        """
        Calculate total price from pricing configuration.

        For token-based pricing: price * tokens / unit_scale
        For unit-based pricing: price * units / unit_scale

        Args:
            input_price: Price per input unit
            output_price: Price per output unit
            unit_scale: Scale factor (e.g., 1000000 for per-million)
            input_tokens: Input token count
            output_tokens: Output token count
            input_unit_count: Non-token input units
            output_unit_count: Non-token output units

        Returns:
            Calculated total price
        """
        total = Decimal(0)
        scale = Decimal(unit_scale) if unit_scale > 0 else Decimal(1)

        if input_price:
            # Use unit count if available, otherwise use tokens
            input_amount = input_unit_count if input_unit_count is not None else Decimal(input_tokens)
            total += input_price * input_amount / scale

        if output_price:
            output_amount = output_unit_count if output_unit_count is not None else Decimal(output_tokens)
            total += output_price * output_amount / scale

        return total

    @staticmethod
    def _get_dify_price(
        *,
        tenant_id: str,
        provider: str,
        model_id: str,
        usage_type: str,
        input_tokens: int = 0,
        output_tokens: int = 0,
    ) -> Decimal | None:
        """
        Get price from Dify's model schema.

        Uses ModelManager to get model instance and calculate price
        based on the model's pricing configuration.

        Args:
            tenant_id: Tenant ID
            provider: Model provider (e.g., "langgenius/openai/openai")
            model_id: Model ID (e.g., "text-embedding-3-small")
            usage_type: API type (e.g., "embedding", "llm")
            input_tokens: Input token count
            output_tokens: Output token count

        Returns:
            Calculated price or None if not available
        """
        try:
            # Get ModelType from usage_type
            model_type = USAGE_TYPE_TO_MODEL_TYPE.get(usage_type)
            if not model_type:
                logger.debug("No ModelType mapping for usage_type: %s", usage_type)
                return None

            # Import here to avoid circular imports
            from core.model_manager import ModelManager

            model_manager = ModelManager()

            # Extract simple provider name from full provider path
            # e.g., "langgenius/openai/openai" -> "openai"
            simple_provider = provider.split("/")[-1] if "/" in provider else provider

            try:
                model_instance = model_manager.get_model_instance(
                    tenant_id=tenant_id,
                    provider=simple_provider,
                    model_type=model_type,
                    model=model_id,
                )
            except Exception as e:
                logger.debug("Failed to get model instance for %s/%s: %s", simple_provider, model_id, e)
                return None

            # Calculate input price using model_type_instance
            total_price = Decimal(0)
            model_type_instance = model_instance.model_type_instance

            if input_tokens > 0:
                input_price_info = model_type_instance.get_price(
                    model=model_id,
                    credentials=model_instance.credentials,
                    price_type=PriceType.INPUT,
                    tokens=input_tokens,
                )
                total_price += input_price_info.total_amount

            if output_tokens > 0:
                output_price_info = model_type_instance.get_price(
                    model=model_id,
                    credentials=model_instance.credentials,
                    price_type=PriceType.OUTPUT,
                    tokens=output_tokens,
                )
                total_price += output_price_info.total_amount

            logger.debug(
                "Dify price for %s/%s: input=%d, output=%d, total=%s",
                simple_provider,
                model_id,
                input_tokens,
                output_tokens,
                total_price,
            )

            return total_price

        except Exception:
            logger.exception("Failed to get Dify price for %s/%s", provider, model_id)
            return None
