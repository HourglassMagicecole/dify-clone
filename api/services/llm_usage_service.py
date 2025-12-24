"""
LLM Usage Service
Records LLM usage to api_usage_logs table for persistent API usage tracking.

This module delegates to ApiUsageTrackingService for actual recording.
"""

import logging

from sqlalchemy.orm import Session

from models.education import ApiUsageLog
from models.model import App, Message
from services.api_usage_tracking_service import ApiUsageTrackingService

logger = logging.getLogger(__name__)


def record_llm_usage(
    *,
    session: Session,
    message: Message,
    app: App,
) -> ApiUsageLog | None:
    """
    Record LLM usage to api_usage_logs table.

    This creates a persistent record of LLM token usage that survives
    message/conversation/app deletion.

    Args:
        session: SQLAlchemy session
        message: Message object with token usage info
        app: App object

    Returns:
        Created ApiUsageLog object, or None if no tokens to record
    """
    # Skip if no tokens used
    if message.message_tokens == 0 and message.answer_tokens == 0:
        logger.debug("Skipping LLM usage record - no tokens used for message %s", message.id)
        return None

    # Get session_id from SessionResourceTag (if app is tagged to a session)
    session_id = ApiUsageTrackingService.get_session_id_for_app(session, str(app.id))

    return ApiUsageTrackingService.record_usage(
        session=session,
        tenant_id=app.tenant_id,
        usage_type="llm",
        app_id=str(app.id),
        app_name=app.name,
        account_id=message.from_account_id,
        session_id=session_id,
        conversation_id=message.conversation_id,
        message_id=message.id,
        model_provider=message.model_provider,
        model_id=message.model_id,
        input_tokens=message.message_tokens,
        output_tokens=message.answer_tokens,
        total_price=message.total_price,
        currency=message.currency or "USD",
    )
