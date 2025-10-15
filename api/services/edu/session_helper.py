"""Helper functions for education session management."""

import logging
from typing import Optional

from sqlalchemy import select

from extensions.ext_database import db
from models.education.session import EducationSession
from models.education.session_member import EducationSessionMember

logger = logging.getLogger(__name__)


def get_user_active_session(account_id: str) -> Optional[EducationSession]:
    """
    Get user's active education session.

    Finds the first active session where the user is a member.
    Used for automatically tagging resources to user's default session.

    Args:
        account_id: User account ID

    Returns:
        EducationSession if found, None otherwise
    """
    try:
        # Find active session where user is a member
        stmt = (
            select(EducationSession)
            .join(EducationSessionMember, EducationSession.id == EducationSessionMember.session_id)
            .where(
                EducationSessionMember.account_id == account_id,
                EducationSessionMember.status == "active",
                EducationSession.is_active == True,
            )
            .order_by(EducationSession.created_at.desc())
            .limit(1)
        )

        session = db.session.scalar(stmt)
        if session:
            logger.debug("Found active session for user %s: %s", account_id, session.id)
        else:
            logger.debug("No active session found for user %s", account_id)

        return session

    except Exception as e:
        logger.error("Error finding active session for user %s: %s", account_id, e, exc_info=True)
        return None
