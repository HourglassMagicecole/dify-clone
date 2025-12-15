"""Helper functions for education session management."""

import logging
from datetime import datetime
from typing import Optional

import sqlalchemy as sa
from sqlalchemy import select

from extensions.ext_database import db
from models.education.session import EducationSession
from models.education.session_member import EducationSessionMember

logger = logging.getLogger(__name__)


def build_session_active_condition() -> sa.ColumnElement[bool]:
    """
    Build SQLAlchemy condition for checking if a session is currently active.

    Active status is determined by:
    1. force_status = True -> always active
    2. force_status = False -> always inactive
    3. force_status = None (auto) -> based on date range:
       - start_date <= now AND (end_date IS NULL OR end_date >= now)

    Returns:
        SQLAlchemy boolean expression
    """
    now = datetime.now()

    # Date-based activation: start_date <= now AND (end_date IS NULL OR end_date >= now)
    date_based_active = sa.and_(
        EducationSession.start_date <= now,
        sa.or_(
            EducationSession.end_date.is_(None),
            EducationSession.end_date >= now,
        ),
    )

    # Combined condition:
    # force_status = True -> active
    # force_status = False -> inactive
    # force_status = None -> date_based_active
    return sa.case(
        (EducationSession.force_status.is_(True), True),
        (EducationSession.force_status.is_(False), False),
        else_=date_based_active,
    )


def is_session_currently_active(session: EducationSession) -> bool:
    """
    Check if a session is currently active (Python-side evaluation).

    Args:
        session: EducationSession instance

    Returns:
        True if session is currently active, False otherwise
    """
    if session.force_status is True:
        return True
    if session.force_status is False:
        return False

    # Auto mode: check date range
    now = datetime.now()
    if session.start_date > now:
        return False
    if session.end_date is not None and session.end_date < now:
        return False
    return True


def get_user_active_session(account_id: str) -> Optional[EducationSession]:
    """
    Get user's active education session.

    Finds the first active session where the user is a member.
    Session is considered active based on force_status and date range.
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
                build_session_active_condition(),
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
