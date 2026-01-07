"""
Quota Enforcement Service
Handles quota checking, blocking, and usage increment.
"""

import logging
from dataclasses import dataclass
from datetime import UTC, datetime
from decimal import Decimal

from sqlalchemy import select, update
from sqlalchemy.orm import Session, scoped_session

from models.account import Account
from models.education import SessionQuota, UserUsageQuota

# Type alias for db session (supports both Session and scoped_session)
DBSession = Session | scoped_session[Session]

logger = logging.getLogger(__name__)


@dataclass
class QuotaCheckResult:
    """Result of a quota check."""

    allowed: bool
    blocked_by: str | None  # "session" | "user" | None
    model_provider: str
    session_usage: Decimal
    session_limit: Decimal
    user_usage: Decimal
    user_limit: Decimal
    is_warning: bool
    message: str | None
    reset_at: datetime | None


class QuotaEnforcementService:
    """Service for enforcing usage quotas."""

    @staticmethod
    def check_quota(
        db_session: DBSession,
        tenant_id: str,
        session_id: str,
        account_id: str,
        model_provider: str,
    ) -> QuotaCheckResult:
        """
        Check if a user can make an API call based on quotas.

        Checks both session-wide and user-specific quotas.
        Performance target: < 5ms (IV1)

        Args:
            db_session: Database session
            tenant_id: Tenant ID
            session_id: Education session ID
            account_id: User account ID
            model_provider: Provider name (e.g., "openai", "anthropic")

        Returns:
            QuotaCheckResult indicating whether the request is allowed
        """
        # Default values
        session_usage = Decimal(0)
        session_limit = Decimal(0)
        user_usage = Decimal(0)
        user_limit = Decimal(0)
        is_warning = False
        reset_at = None

        # Get session quota (check specific provider first, then "all")
        session_quota = (
            db_session.execute(
                select(SessionQuota)
                .where(
                    SessionQuota.session_id == session_id,
                    SessionQuota.model_provider.in_([model_provider, "all"]),
                    SessionQuota.is_active == True,
                )
                .order_by(SessionQuota.model_provider.desc())  # specific provider first
            )
            .scalars()
            .first()
        )

        # Get user quota
        user_quota = (
            db_session.execute(
                select(UserUsageQuota)
                .where(
                    UserUsageQuota.session_id == session_id,
                    UserUsageQuota.account_id == account_id,
                    UserUsageQuota.model_provider.in_([model_provider, "all"]),
                    UserUsageQuota.is_active == True,
                )
                .order_by(UserUsageQuota.model_provider.desc())
            )
            .scalars()
            .first()
        )

        # Check session quota first (blocks everyone)
        if session_quota:
            session_usage = session_quota.current_usage
            session_limit = session_quota.quota_limit
            reset_at = session_quota.last_reset_at

            if session_quota.is_exceeded:
                # Auto-block when exceeded
                if not session_quota.is_blocked:
                    session_quota.is_blocked = True
                    session_quota.updated_at = datetime.now(UTC)
                    db_session.commit()
                    logger.warning("Session quota exceeded and blocked: session=%s", session_id)

                return QuotaCheckResult(
                    allowed=False,
                    blocked_by="session",
                    model_provider=model_provider,
                    session_usage=session_usage,
                    session_limit=session_limit,
                    user_usage=user_usage,
                    user_limit=user_limit,
                    is_warning=True,
                    message="세션 전체 사용량 한도에 도달했습니다.",
                    reset_at=reset_at,
                )
            elif session_quota.is_blocked:
                # Auto-unblock when no longer exceeded (e.g., limit was increased)
                session_quota.is_blocked = False
                session_quota.updated_at = datetime.now(UTC)
                db_session.commit()
                logger.info("Session quota auto-unblocked: session=%s", session_id)

            if session_quota.is_warning:
                is_warning = True

        # Check user quota
        if user_quota:
            user_usage = user_quota.current_usage
            user_limit = user_quota.quota_limit
            if reset_at is None:
                reset_at = user_quota.last_reset_at

            # Check override first
            if user_quota.is_override_active:
                logger.debug("User quota override active: account=%s", account_id)
            elif user_quota.is_exceeded:
                # Auto-block when exceeded
                if not user_quota.is_blocked:
                    user_quota.is_blocked = True
                    user_quota.updated_at = datetime.now(UTC)
                    db_session.commit()
                    logger.warning("User quota exceeded and blocked: account=%s", account_id)

                return QuotaCheckResult(
                    allowed=False,
                    blocked_by="user",
                    model_provider=model_provider,
                    session_usage=session_usage,
                    session_limit=session_limit,
                    user_usage=user_usage,
                    user_limit=user_limit,
                    is_warning=True,
                    message="사용량 한도에 도달했습니다. 관리자에게 문의하세요.",
                    reset_at=reset_at,
                )
            elif user_quota.is_blocked:
                # Auto-unblock when no longer exceeded (e.g., limit was increased)
                user_quota.is_blocked = False
                user_quota.updated_at = datetime.now(UTC)
                db_session.commit()
                logger.info("User quota auto-unblocked: account=%s", account_id)

            if user_quota.is_warning:
                is_warning = True

        return QuotaCheckResult(
            allowed=True,
            blocked_by=None,
            model_provider=model_provider,
            session_usage=session_usage,
            session_limit=session_limit,
            user_usage=user_usage,
            user_limit=user_limit,
            is_warning=is_warning,
            message="사용량이 경고 수준입니다." if is_warning else None,
            reset_at=reset_at,
        )

    @staticmethod
    def increment_usage(
        db_session: DBSession,
        session_id: str,
        account_id: str,
        model_provider: str,
        amount: Decimal,
    ) -> None:
        """
        Increment usage for both session and user quotas.

        Args:
            db_session: Database session
            session_id: Education session ID
            account_id: User account ID
            model_provider: Provider name
            amount: Amount to increment (in USD)
        """
        # Update session quotas (both specific provider and "all")
        db_session.execute(
            update(SessionQuota)
            .where(
                SessionQuota.session_id == session_id,
                SessionQuota.model_provider.in_([model_provider, "all"]),
                SessionQuota.is_active == True,
            )
            .values(
                current_usage=SessionQuota.current_usage + amount,
                updated_at=datetime.now(UTC),
            )
        )

        # Update user quotas
        db_session.execute(
            update(UserUsageQuota)
            .where(
                UserUsageQuota.session_id == session_id,
                UserUsageQuota.account_id == account_id,
                UserUsageQuota.model_provider.in_([model_provider, "all"]),
                UserUsageQuota.is_active == True,
            )
            .values(
                current_usage=UserUsageQuota.current_usage + amount,
                updated_at=datetime.now(UTC),
            )
        )

        db_session.commit()
        logger.debug(
            "Incremented usage: session=%s, account=%s, provider=%s, amount=$%s",
            session_id,
            account_id,
            model_provider,
            amount,
        )

    @staticmethod
    def get_warnings_for_session(
        db_session: DBSession,
        session_id: str,
    ) -> dict:
        """
        Get warning summary for a session dashboard banner.

        Args:
            db_session: Database session
            session_id: Education session ID

        Returns:
            Dictionary with warning summary
        """
        # Get session quota warnings
        session_quotas = (
            db_session.execute(
                select(SessionQuota).where(
                    SessionQuota.session_id == session_id,
                    SessionQuota.is_active == True,
                )
            )
            .scalars()
            .all()
        )

        session_warnings = [q for q in session_quotas if q.is_warning and not q.is_blocked]
        session_blocked = [q for q in session_quotas if q.is_blocked]

        # Get user quota warnings
        user_results = db_session.execute(
            select(UserUsageQuota, Account.name.label("account_name"))
            .outerjoin(Account, UserUsageQuota.account_id == Account.id)
            .where(
                UserUsageQuota.session_id == session_id,
                UserUsageQuota.is_active == True,
            )
        ).all()

        user_warnings: list[dict] = []
        user_blocked: list[dict] = []

        for row in user_results:
            user_info = {
                "account_id": row.UserUsageQuota.account_id,
                "account_name": row.account_name or f"User {row.UserUsageQuota.account_id[:8]}",
                "provider": row.UserUsageQuota.model_provider,
                "usage_percentage": row.UserUsageQuota.usage_percentage,
            }
            if row.UserUsageQuota.is_blocked:
                user_blocked.append(user_info)
            elif row.UserUsageQuota.is_warning:
                user_warnings.append(user_info)

        return {
            "session_warning_count": len(session_warnings),
            "session_blocked": len(session_blocked) > 0,
            "session_blocked_providers": [q.model_provider for q in session_blocked],
            "user_warning_count": len(user_warnings),
            "user_blocked_count": len(user_blocked),
            "user_warnings": user_warnings[:5],  # Top 5
            "user_blocked": user_blocked,
        }

    @staticmethod
    def get_all_warnings(
        db_session: DBSession,
        tenant_id: str,
    ) -> list[dict]:
        """
        Get all quota warnings across all sessions (for Owner dashboard).

        Args:
            db_session: Database session
            tenant_id: Tenant ID

        Returns:
            List of warning entries
        """
        from models.education import EducationSession

        warnings: list[dict] = []

        # Get session quota warnings/blocks
        session_quotas = db_session.execute(
            select(SessionQuota, EducationSession.session_name)
            .join(EducationSession, SessionQuota.session_id == EducationSession.id)
            .where(
                SessionQuota.tenant_id == tenant_id,
                SessionQuota.is_active == True,
            )
        ).all()

        for row in session_quotas:
            quota = row.SessionQuota
            if quota.is_blocked or quota.is_warning:
                warnings.append(
                    {
                        "type": "session",
                        "session_id": quota.session_id,
                        "session_name": row.session_name,
                        "account_id": None,
                        "account_name": None,
                        "model_provider": quota.model_provider,
                        "current_usage": str(quota.current_usage),
                        "quota_limit": str(quota.quota_limit),
                        "usage_percentage": quota.usage_percentage,
                        "is_blocked": quota.is_blocked,
                        "is_warning": quota.is_warning,
                    }
                )

        # Get user quota warnings/blocks
        user_quotas = db_session.execute(
            select(UserUsageQuota, Account.name.label("account_name"), EducationSession.session_name)
            .join(EducationSession, UserUsageQuota.session_id == EducationSession.id)
            .outerjoin(Account, UserUsageQuota.account_id == Account.id)
            .where(
                UserUsageQuota.tenant_id == tenant_id,
                UserUsageQuota.is_active == True,
            )
        ).all()

        for row in user_quotas:
            quota = row.UserUsageQuota
            if quota.is_blocked or quota.is_warning:
                warnings.append(
                    {
                        "type": "user",
                        "session_id": quota.session_id,
                        "session_name": row.session_name,
                        "account_id": quota.account_id,
                        "account_name": row.account_name or f"User {quota.account_id[:8]}",
                        "model_provider": quota.model_provider,
                        "current_usage": str(quota.current_usage),
                        "quota_limit": str(quota.quota_limit),
                        "usage_percentage": quota.usage_percentage,
                        "is_blocked": quota.is_blocked,
                        "is_warning": quota.is_warning,
                    }
                )

        # Sort by blocked first, then by usage percentage
        warnings.sort(key=lambda x: (-x["is_blocked"], -x["usage_percentage"]))

        return warnings
