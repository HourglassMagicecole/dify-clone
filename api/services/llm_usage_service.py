"""
LLM Usage Service
Records LLM usage to llm_usage_logs table for persistent API usage tracking.
"""

import logging
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.orm import Session

from models.education import LlmUsageLog, SessionResourceTag
from models.model import App, Message

logger = logging.getLogger(__name__)


def _get_session_id_for_app(session: Session, app_id: str) -> str | None:
    """Get session_id from SessionResourceTag for the given app."""
    stmt = (
        select(SessionResourceTag.session_id)
        .where(
            SessionResourceTag.resource_id == app_id,
            SessionResourceTag.resource_type == "app",
        )
        .limit(1)
    )
    result = session.execute(stmt).scalar_one_or_none()
    return result


def record_llm_usage(
    *,
    session: Session,
    message: Message,
    app: App,
) -> LlmUsageLog | None:
    """
    Record LLM usage to llm_usage_logs table.

    This creates a persistent record of LLM token usage that survives
    message/conversation/app deletion.

    Args:
        session: SQLAlchemy session
        message: Message object with token usage info
        app: App object

    Returns:
        Created LlmUsageLog object, or None if no tokens to record
    """
    # Skip if no tokens used
    if message.message_tokens == 0 and message.answer_tokens == 0:
        logger.debug("Skipping LLM usage record - no tokens used for message %s", message.id)
        return None

    try:
        # Get session_id from SessionResourceTag (if app is tagged to a session)
        session_id = _get_session_id_for_app(session, str(app.id))

        usage_log = LlmUsageLog(
            tenant_id=app.tenant_id,
            session_id=session_id,
            account_id=message.from_account_id,
            app_id=app.id,
            app_name=app.name,
            conversation_id=message.conversation_id,
            message_id=message.id,
            model_provider=message.model_provider,
            model_id=message.model_id,
            input_tokens=message.message_tokens,
            output_tokens=message.answer_tokens,
            total_tokens=message.message_tokens + message.answer_tokens,
            total_price=message.total_price or Decimal(0),
            currency=message.currency or "USD",
        )

        session.add(usage_log)

        logger.info(
            "Recorded LLM usage: app=%s, message=%s, tokens=%d (in=%d, out=%d), price=%s",
            app.id,
            message.id,
            usage_log.total_tokens,
            usage_log.input_tokens,
            usage_log.output_tokens,
            usage_log.total_price,
        )

        return usage_log

    except Exception as e:
        logger.error("Failed to record LLM usage for message %s: %s", message.id, e, exc_info=True)
        # Don't raise - usage recording failure shouldn't break the main flow
        return None
