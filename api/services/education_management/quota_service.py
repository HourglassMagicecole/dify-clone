"""
Quota Service
Manages session and user usage quotas (CRUD operations).
"""

import logging
from dataclasses import dataclass
from datetime import UTC, datetime
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.orm import Session, scoped_session

from models.account import Account
from models.education import SessionDefaultUserQuota, SessionQuota, UserUsageQuota

# Type alias for db session (supports both Session and scoped_session)
DBSession = Session | scoped_session[Session]

logger = logging.getLogger(__name__)


@dataclass
class SessionQuotaData:
    """Data class for session quota."""

    id: str
    session_id: str
    model_provider: str
    quota_limit: Decimal
    period: str
    current_usage: Decimal
    usage_percentage: float
    warning_threshold: int
    is_warning: bool
    is_exceeded: bool
    is_blocked: bool
    is_active: bool
    last_reset_at: datetime


@dataclass
class UserQuotaData:
    """Data class for user quota."""

    id: str
    session_id: str
    account_id: str
    account_name: str
    model_provider: str
    quota_limit: Decimal
    period: str
    current_usage: Decimal
    usage_percentage: float
    warning_threshold: int
    is_warning: bool
    is_exceeded: bool
    is_blocked: bool
    is_active: bool
    override_until: datetime | None
    last_reset_at: datetime


class QuotaService:
    """Service for managing session and user quotas."""

    # === Session Quota Methods ===

    @staticmethod
    def get_session_quotas(
        db_session: DBSession,
        session_id: str,
    ) -> list[SessionQuotaData]:
        """
        Get all quotas for a session.

        Args:
            db_session: Database session
            session_id: Education session ID

        Returns:
            List of session quota data
        """
        stmt = select(SessionQuota).where(
            SessionQuota.session_id == session_id,
            SessionQuota.is_active == True,
        )
        quotas = db_session.execute(stmt).scalars().all()
        return [
            SessionQuotaData(
                id=q.id,
                session_id=q.session_id,
                model_provider=q.model_provider,
                quota_limit=q.quota_limit,
                period=q.period,
                current_usage=q.current_usage,
                usage_percentage=q.usage_percentage,
                warning_threshold=q.warning_threshold,
                is_warning=q.is_warning,
                is_exceeded=q.is_exceeded,
                is_blocked=q.is_blocked,
                is_active=q.is_active,
                last_reset_at=q.last_reset_at,
            )
            for q in quotas
        ]

    @staticmethod
    def get_session_quota_by_provider(
        db_session: DBSession,
        session_id: str,
        model_provider: str,
    ) -> SessionQuotaData | None:
        """
        Get a specific session quota by provider.

        Args:
            db_session: Database session
            session_id: Education session ID
            model_provider: Provider name or "all"

        Returns:
            Session quota data or None
        """
        stmt = select(SessionQuota).where(
            SessionQuota.session_id == session_id,
            SessionQuota.model_provider == model_provider,
        )
        quota = db_session.execute(stmt).scalar_one_or_none()
        if not quota:
            return None

        return SessionQuotaData(
            id=quota.id,
            session_id=quota.session_id,
            model_provider=quota.model_provider,
            quota_limit=quota.quota_limit,
            period=quota.period,
            current_usage=quota.current_usage,
            usage_percentage=quota.usage_percentage,
            warning_threshold=quota.warning_threshold,
            is_warning=quota.is_warning,
            is_exceeded=quota.is_exceeded,
            is_blocked=quota.is_blocked,
            is_active=quota.is_active,
            last_reset_at=quota.last_reset_at,
        )

    @staticmethod
    def set_session_quota(
        db_session: DBSession,
        tenant_id: str,
        session_id: str,
        model_provider: str,
        quota_limit: Decimal,
        period: str,
        warning_threshold: int = 70,
    ) -> SessionQuotaData:
        """
        Create or update a session quota.

        Args:
            db_session: Database session
            tenant_id: Tenant ID
            session_id: Education session ID
            model_provider: Provider name or "all"
            quota_limit: Quota limit in USD
            period: Reset period (daily, session, monthly)
            warning_threshold: Warning threshold percentage

        Returns:
            Created or updated session quota data
        """
        # Check existing
        existing = db_session.execute(
            select(SessionQuota).where(
                SessionQuota.session_id == session_id,
                SessionQuota.model_provider == model_provider,
            )
        ).scalar_one_or_none()

        if existing:
            existing.quota_limit = quota_limit
            existing.period = period
            existing.warning_threshold = warning_threshold
            existing.is_active = True
            existing.updated_at = datetime.now(UTC)
            # Auto-unblock if new limit is higher than current usage
            if existing.is_blocked and existing.current_usage < quota_limit:
                existing.is_blocked = False
                logger.info("Auto-unblocked session quota: session=%s, new_limit=%s", session_id, quota_limit)
            quota = existing
            logger.info("Updated session quota: session=%s, provider=%s", session_id, model_provider)
        else:
            quota = SessionQuota(
                tenant_id=tenant_id,
                session_id=session_id,
                model_provider=model_provider,
                quota_limit=quota_limit,
                period=period,
                warning_threshold=warning_threshold,
            )
            db_session.add(quota)
            logger.info("Created session quota: session=%s, provider=%s", session_id, model_provider)

        db_session.commit()
        db_session.refresh(quota)

        return SessionQuotaData(
            id=quota.id,
            session_id=quota.session_id,
            model_provider=quota.model_provider,
            quota_limit=quota.quota_limit,
            period=quota.period,
            current_usage=quota.current_usage,
            usage_percentage=quota.usage_percentage,
            warning_threshold=quota.warning_threshold,
            is_warning=quota.is_warning,
            is_exceeded=quota.is_exceeded,
            is_blocked=quota.is_blocked,
            is_active=quota.is_active,
            last_reset_at=quota.last_reset_at,
        )

    @staticmethod
    def delete_session_quota(
        db_session: DBSession,
        session_id: str,
        model_provider: str,
    ) -> bool:
        """
        Delete a session quota.

        Args:
            db_session: Database session
            session_id: Education session ID
            model_provider: Provider name or "all"

        Returns:
            True if deleted, False if not found
        """
        quota = db_session.execute(
            select(SessionQuota).where(
                SessionQuota.session_id == session_id,
                SessionQuota.model_provider == model_provider,
            )
        ).scalar_one_or_none()

        if not quota:
            return False

        db_session.delete(quota)
        db_session.commit()
        logger.info("Deleted session quota: session=%s, provider=%s", session_id, model_provider)
        return True

    @staticmethod
    def unblock_session_quota(
        db_session: DBSession,
        session_id: str,
        model_provider: str,
    ) -> bool:
        """
        Unblock a session quota.

        Args:
            db_session: Database session
            session_id: Education session ID
            model_provider: Provider name or "all"

        Returns:
            True if unblocked, False if not found
        """
        quota = db_session.execute(
            select(SessionQuota).where(
                SessionQuota.session_id == session_id,
                SessionQuota.model_provider == model_provider,
            )
        ).scalar_one_or_none()

        if not quota:
            return False

        quota.is_blocked = False
        quota.updated_at = datetime.now(UTC)
        db_session.commit()
        logger.info("Unblocked session quota: session=%s, provider=%s", session_id, model_provider)
        return True

    # === User Quota Methods ===

    @staticmethod
    def get_user_quotas(
        db_session: DBSession,
        session_id: str,
        account_id: str | None = None,
    ) -> list[UserQuotaData]:
        """
        Get user quotas for a session (optionally filtered by account).

        Args:
            db_session: Database session
            session_id: Education session ID
            account_id: Optional account ID filter

        Returns:
            List of user quota data
        """
        stmt = (
            select(UserUsageQuota, Account.name.label("account_name"))
            .outerjoin(Account, UserUsageQuota.account_id == Account.id)
            .where(
                UserUsageQuota.session_id == session_id,
                UserUsageQuota.is_active == True,
            )
        )

        if account_id:
            stmt = stmt.where(UserUsageQuota.account_id == account_id)

        results = db_session.execute(stmt).all()

        return [
            UserQuotaData(
                id=row.UserUsageQuota.id,
                session_id=row.UserUsageQuota.session_id,
                account_id=row.UserUsageQuota.account_id,
                account_name=row.account_name or f"User {row.UserUsageQuota.account_id[:8]}",
                model_provider=row.UserUsageQuota.model_provider,
                quota_limit=row.UserUsageQuota.quota_limit,
                period=row.UserUsageQuota.period,
                current_usage=row.UserUsageQuota.current_usage,
                usage_percentage=row.UserUsageQuota.usage_percentage,
                warning_threshold=row.UserUsageQuota.warning_threshold,
                is_warning=row.UserUsageQuota.is_warning,
                is_exceeded=row.UserUsageQuota.is_exceeded,
                is_blocked=row.UserUsageQuota.is_blocked,
                is_active=row.UserUsageQuota.is_active,
                override_until=row.UserUsageQuota.override_until,
                last_reset_at=row.UserUsageQuota.last_reset_at,
            )
            for row in results
        ]

    @staticmethod
    def get_user_quota_by_id(
        db_session: DBSession,
        quota_id: str,
    ) -> UserQuotaData | None:
        """
        Get a specific user quota by ID.

        Args:
            db_session: Database session
            quota_id: Quota ID

        Returns:
            User quota data or None
        """
        stmt = (
            select(UserUsageQuota, Account.name.label("account_name"))
            .outerjoin(Account, UserUsageQuota.account_id == Account.id)
            .where(UserUsageQuota.id == quota_id)
        )
        result = db_session.execute(stmt).first()

        if not result:
            return None

        return UserQuotaData(
            id=result.UserUsageQuota.id,
            session_id=result.UserUsageQuota.session_id,
            account_id=result.UserUsageQuota.account_id,
            account_name=result.account_name or f"User {result.UserUsageQuota.account_id[:8]}",
            model_provider=result.UserUsageQuota.model_provider,
            quota_limit=result.UserUsageQuota.quota_limit,
            period=result.UserUsageQuota.period,
            current_usage=result.UserUsageQuota.current_usage,
            usage_percentage=result.UserUsageQuota.usage_percentage,
            warning_threshold=result.UserUsageQuota.warning_threshold,
            is_warning=result.UserUsageQuota.is_warning,
            is_exceeded=result.UserUsageQuota.is_exceeded,
            is_blocked=result.UserUsageQuota.is_blocked,
            is_active=result.UserUsageQuota.is_active,
            override_until=result.UserUsageQuota.override_until,
            last_reset_at=result.UserUsageQuota.last_reset_at,
        )

    @staticmethod
    def set_user_quota(
        db_session: DBSession,
        tenant_id: str,
        session_id: str,
        account_id: str,
        model_provider: str,
        quota_limit: Decimal,
        period: str,
        created_by: str,
        warning_threshold: int = 70,
    ) -> UserQuotaData:
        """
        Create or update a user quota.

        Args:
            db_session: Database session
            tenant_id: Tenant ID
            session_id: Education session ID
            account_id: User account ID
            model_provider: Provider name or "all"
            quota_limit: Quota limit in USD
            period: Reset period (daily, session, monthly)
            created_by: Account ID of creator
            warning_threshold: Warning threshold percentage

        Returns:
            Created or updated user quota data

        Raises:
            ValueError: If user quota exceeds session quota for the same provider
        """
        # Check if user quota exceeds session quota
        session_quota = db_session.execute(
            select(SessionQuota).where(
                SessionQuota.session_id == session_id,
                SessionQuota.model_provider == model_provider,
                SessionQuota.is_active == True,
            )
        ).scalar_one_or_none()

        if session_quota and quota_limit > session_quota.quota_limit:
            raise ValueError(
                f"User quota (${quota_limit}) cannot exceed session quota (${session_quota.quota_limit}) "
                f"for provider '{model_provider}'"
            )

        existing = db_session.execute(
            select(UserUsageQuota).where(
                UserUsageQuota.session_id == session_id,
                UserUsageQuota.account_id == account_id,
                UserUsageQuota.model_provider == model_provider,
            )
        ).scalar_one_or_none()

        if existing:
            existing.quota_limit = quota_limit
            existing.period = period
            existing.warning_threshold = warning_threshold
            existing.is_active = True
            existing.updated_at = datetime.now(UTC)
            # Auto-unblock if new limit is higher than current usage
            if existing.is_blocked and existing.current_usage < quota_limit:
                existing.is_blocked = False
                logger.info("Auto-unblocked user quota: account=%s, new_limit=%s", account_id, quota_limit)
            quota = existing
            logger.info("Updated user quota: account=%s, provider=%s", account_id, model_provider)
        else:
            quota = UserUsageQuota(
                tenant_id=tenant_id,
                session_id=session_id,
                account_id=account_id,
                model_provider=model_provider,
                quota_limit=quota_limit,
                period=period,
                warning_threshold=warning_threshold,
                created_by=created_by,
            )
            db_session.add(quota)
            logger.info("Created user quota: account=%s, provider=%s", account_id, model_provider)

        db_session.commit()
        db_session.refresh(quota)

        account = db_session.get(Account, account_id)

        return UserQuotaData(
            id=quota.id,
            session_id=quota.session_id,
            account_id=quota.account_id,
            account_name=account.name if account else f"User {account_id[:8]}",
            model_provider=quota.model_provider,
            quota_limit=quota.quota_limit,
            period=quota.period,
            current_usage=quota.current_usage,
            usage_percentage=quota.usage_percentage,
            warning_threshold=quota.warning_threshold,
            is_warning=quota.is_warning,
            is_exceeded=quota.is_exceeded,
            is_blocked=quota.is_blocked,
            is_active=quota.is_active,
            override_until=quota.override_until,
            last_reset_at=quota.last_reset_at,
        )

    @staticmethod
    def unblock_user(db_session: DBSession, quota_id: str) -> bool:
        """
        Unblock a user quota.

        Args:
            db_session: Database session
            quota_id: Quota ID

        Returns:
            True if successful, False if not found
        """
        quota = db_session.get(UserUsageQuota, quota_id)
        if not quota:
            return False

        quota.is_blocked = False
        quota.updated_at = datetime.now(UTC)
        db_session.commit()
        logger.info("Unblocked user quota: %s", quota_id)
        return True

    @staticmethod
    def delete_user_quota(
        db_session: DBSession,
        quota_id: str,
    ) -> bool:
        """
        Delete a user quota.

        Args:
            db_session: Database session
            quota_id: Quota ID

        Returns:
            True if deleted, False if not found
        """
        quota = db_session.get(UserUsageQuota, quota_id)
        if not quota:
            return False

        db_session.delete(quota)
        db_session.commit()
        logger.info("Deleted user quota: %s", quota_id)
        return True

    @staticmethod
    def set_default_user_quota(
        db_session: DBSession,
        tenant_id: str,
        session_id: str,
        model_provider: str,
        quota_limit: Decimal,
        period: str,
        created_by: str,
        warning_threshold: int = 70,
    ) -> list[UserQuotaData]:
        """
        Set default quota for ALL members in a session (bulk apply).

        This applies the same quota limit to every member in the session,
        ensuring fair resource distribution.

        Args:
            db_session: Database session
            tenant_id: Tenant ID
            session_id: Education session ID
            model_provider: Provider name or "all"
            quota_limit: Quota limit in USD (same for all users)
            period: Reset period (daily, session, monthly)
            created_by: Account ID of creator
            warning_threshold: Warning threshold percentage

        Returns:
            List of created/updated user quota data

        Raises:
            ValueError: If user quota exceeds session quota for the same provider
        """
        # Check if user quota exceeds session quota
        session_quota = db_session.execute(
            select(SessionQuota).where(
                SessionQuota.session_id == session_id,
                SessionQuota.model_provider == model_provider,
                SessionQuota.is_active == True,
            )
        ).scalar_one_or_none()

        if session_quota and quota_limit > session_quota.quota_limit:
            raise ValueError(
                f"User quota (${quota_limit}) cannot exceed session quota (${session_quota.quota_limit}) "
                f"for provider '{model_provider}'"
            )

        from models.education import EducationSessionMember, MemberStatus

        # Get all members in the session
        members_stmt = select(EducationSessionMember).where(
            EducationSessionMember.session_id == session_id,
            EducationSessionMember.status == MemberStatus.ACTIVE,
        )
        members = db_session.execute(members_stmt).scalars().all()

        if not members:
            logger.warning("No active members in session %s", session_id)
            return []

        results: list[UserQuotaData] = []

        for member in members:
            # Check existing quota for this user+provider
            existing = db_session.execute(
                select(UserUsageQuota).where(
                    UserUsageQuota.session_id == session_id,
                    UserUsageQuota.account_id == member.account_id,
                    UserUsageQuota.model_provider == model_provider,
                )
            ).scalar_one_or_none()

            if existing:
                existing.quota_limit = quota_limit
                existing.period = period
                existing.warning_threshold = warning_threshold
                existing.is_active = True
                existing.updated_at = datetime.now(UTC)
                # Re-evaluate blocked status: unblock if usage is now within new limit
                if existing.current_usage <= quota_limit:
                    existing.is_blocked = False
                quota = existing
            else:
                quota = UserUsageQuota(
                    tenant_id=tenant_id,
                    session_id=session_id,
                    account_id=member.account_id,
                    model_provider=model_provider,
                    quota_limit=quota_limit,
                    period=period,
                    warning_threshold=warning_threshold,
                    created_by=created_by,
                )
                db_session.add(quota)

            db_session.flush()  # Get ID without committing

            # Get account name
            account = db_session.get(Account, member.account_id)

            results.append(
                UserQuotaData(
                    id=quota.id,
                    session_id=quota.session_id,
                    account_id=quota.account_id,
                    account_name=account.name if account else f"User {member.account_id[:8]}",
                    model_provider=quota.model_provider,
                    quota_limit=quota.quota_limit,
                    period=quota.period,
                    current_usage=quota.current_usage,
                    usage_percentage=quota.usage_percentage,
                    warning_threshold=quota.warning_threshold,
                    is_warning=quota.is_warning,
                    is_exceeded=quota.is_exceeded,
                    is_blocked=quota.is_blocked,
                    is_active=quota.is_active,
                    override_until=quota.override_until,
                    last_reset_at=quota.last_reset_at,
                )
            )

        db_session.commit()
        logger.info(
            "Set default user quota for %d members: session=%s, provider=%s, limit=%s",
            len(results),
            session_id,
            model_provider,
            quota_limit,
        )

        return results

    # === Default User Quota Config Methods ===

    @staticmethod
    def get_default_quota_configs(
        db_session: DBSession,
        session_id: str,
    ) -> list[dict]:
        """
        Get all default user quota configurations for a session.

        Args:
            db_session: Database session
            session_id: Education session ID

        Returns:
            List of default quota config dictionaries
        """
        stmt = select(SessionDefaultUserQuota).where(
            SessionDefaultUserQuota.session_id == session_id,
        )
        configs = db_session.execute(stmt).scalars().all()

        return [
            {
                "id": c.id,
                "session_id": c.session_id,
                "model_provider": c.model_provider,
                "quota_limit": str(c.quota_limit),
                "warning_threshold": c.warning_threshold,
                "created_at": c.created_at.isoformat() if c.created_at else None,
                "updated_at": c.updated_at.isoformat() if c.updated_at else None,
            }
            for c in configs
        ]

    @staticmethod
    def set_default_quota_config(
        db_session: DBSession,
        tenant_id: str,
        session_id: str,
        model_provider: str,
        quota_limit: Decimal,
        warning_threshold: int = 70,
        apply_to_existing: bool = True,
        created_by: str | None = None,
    ) -> dict:
        """
        Save default user quota configuration for a session.

        This configuration will be automatically applied to new members.
        Optionally applies to existing members immediately.

        Args:
            db_session: Database session
            tenant_id: Tenant ID
            session_id: Education session ID
            model_provider: Provider name
            quota_limit: Default quota limit in USD
            warning_threshold: Warning threshold percentage
            apply_to_existing: If True, apply to all existing members
            created_by: Account ID of creator (required if apply_to_existing)

        Returns:
            Dictionary with config and applied count

        Raises:
            ValueError: If user quota exceeds session quota for the same provider
        """
        # Check if user quota exceeds session quota
        session_quota = db_session.execute(
            select(SessionQuota).where(
                SessionQuota.session_id == session_id,
                SessionQuota.model_provider == model_provider,
                SessionQuota.is_active == True,
            )
        ).scalar_one_or_none()

        if session_quota and quota_limit > session_quota.quota_limit:
            raise ValueError(
                f"User quota (${quota_limit}) cannot exceed session quota (${session_quota.quota_limit}) "
                f"for provider '{model_provider}'"
            )

        # Check existing config
        existing = db_session.execute(
            select(SessionDefaultUserQuota).where(
                SessionDefaultUserQuota.session_id == session_id,
                SessionDefaultUserQuota.model_provider == model_provider,
            )
        ).scalar_one_or_none()

        if existing:
            existing.quota_limit = quota_limit
            existing.warning_threshold = warning_threshold
            existing.updated_at = datetime.now(UTC)
            config = existing
            logger.info("Updated default quota config: session=%s, provider=%s", session_id, model_provider)
        else:
            config = SessionDefaultUserQuota(
                tenant_id=tenant_id,
                session_id=session_id,
                model_provider=model_provider,
                quota_limit=quota_limit,
                warning_threshold=warning_threshold,
            )
            db_session.add(config)
            logger.info("Created default quota config: session=%s, provider=%s", session_id, model_provider)

        db_session.flush()

        applied_count = 0
        if apply_to_existing and created_by:
            # Apply to all existing members
            results = QuotaService.set_default_user_quota(
                db_session=db_session,
                tenant_id=tenant_id,
                session_id=session_id,
                model_provider=model_provider,
                quota_limit=quota_limit,
                period="session",
                created_by=created_by,
                warning_threshold=warning_threshold,
            )
            applied_count = len(results)

        db_session.commit()
        db_session.refresh(config)

        return {
            "id": config.id,
            "session_id": config.session_id,
            "model_provider": config.model_provider,
            "quota_limit": str(config.quota_limit),
            "warning_threshold": config.warning_threshold,
            "applied_count": applied_count,
        }

    @staticmethod
    def delete_default_quota_config(
        db_session: DBSession,
        session_id: str,
        model_provider: str,
    ) -> bool:
        """
        Delete a default user quota configuration.

        Args:
            db_session: Database session
            session_id: Education session ID
            model_provider: Provider name

        Returns:
            True if deleted, False if not found
        """
        config = db_session.execute(
            select(SessionDefaultUserQuota).where(
                SessionDefaultUserQuota.session_id == session_id,
                SessionDefaultUserQuota.model_provider == model_provider,
            )
        ).scalar_one_or_none()

        if not config:
            return False

        db_session.delete(config)
        db_session.commit()
        logger.info("Deleted default quota config: session=%s, provider=%s", session_id, model_provider)
        return True

    @staticmethod
    def delete_user_quotas_by_provider(
        db_session: DBSession,
        session_id: str,
        model_provider: str,
    ) -> dict:
        """
        Delete all user quotas for a specific provider in a session.

        Also deletes the default quota config for that provider.

        Args:
            db_session: Database session
            session_id: Education session ID
            model_provider: Provider name

        Returns:
            Dictionary with deleted counts
        """
        from sqlalchemy import delete

        # Delete all user quotas for this provider
        result = db_session.execute(
            delete(UserUsageQuota).where(
                UserUsageQuota.session_id == session_id,
                UserUsageQuota.model_provider == model_provider,
            )
        )
        deleted_user_quotas = result.rowcount

        # Delete the default config for this provider
        config_result = db_session.execute(
            delete(SessionDefaultUserQuota).where(
                SessionDefaultUserQuota.session_id == session_id,
                SessionDefaultUserQuota.model_provider == model_provider,
            )
        )
        deleted_default_config = config_result.rowcount > 0

        db_session.commit()

        logger.info(
            "Deleted user quotas by provider: session=%s, provider=%s, user_quotas=%d, default_config=%s",
            session_id,
            model_provider,
            deleted_user_quotas,
            deleted_default_config,
        )

        return {
            "deleted_user_quotas": deleted_user_quotas,
            "deleted_default_config": deleted_default_config,
        }

    @staticmethod
    def apply_default_quotas_to_member(
        db_session: DBSession,
        tenant_id: str,
        session_id: str,
        account_id: str,
        created_by: str,
    ) -> list[UserQuotaData]:
        """
        Apply all default quota configurations to a new member.

        Called when a member is added to a session.

        Args:
            db_session: Database session
            tenant_id: Tenant ID
            session_id: Education session ID
            account_id: New member's account ID
            created_by: Account ID of creator

        Returns:
            List of created user quota data
        """
        # Get all default configs for this session
        configs = (
            db_session.execute(
                select(SessionDefaultUserQuota).where(
                    SessionDefaultUserQuota.session_id == session_id,
                )
            )
            .scalars()
            .all()
        )

        if not configs:
            logger.debug("No default quota configs for session %s", session_id)
            return []

        results: list[UserQuotaData] = []

        for config in configs:
            # Check if quota already exists for this user+provider
            existing = db_session.execute(
                select(UserUsageQuota).where(
                    UserUsageQuota.session_id == session_id,
                    UserUsageQuota.account_id == account_id,
                    UserUsageQuota.model_provider == config.model_provider,
                )
            ).scalar_one_or_none()

            if existing:
                logger.debug(
                    "Quota already exists for account=%s, provider=%s",
                    account_id,
                    config.model_provider,
                )
                continue

            # Create new quota
            quota = UserUsageQuota(
                tenant_id=tenant_id,
                session_id=session_id,
                account_id=account_id,
                model_provider=config.model_provider,
                quota_limit=config.quota_limit,
                period="session",
                warning_threshold=config.warning_threshold,
                created_by=created_by,
            )
            db_session.add(quota)
            db_session.flush()

            account = db_session.get(Account, account_id)

            results.append(
                UserQuotaData(
                    id=quota.id,
                    session_id=quota.session_id,
                    account_id=quota.account_id,
                    account_name=account.name if account else f"User {account_id[:8]}",
                    model_provider=quota.model_provider,
                    quota_limit=quota.quota_limit,
                    period=quota.period,
                    current_usage=quota.current_usage,
                    usage_percentage=quota.usage_percentage,
                    warning_threshold=quota.warning_threshold,
                    is_warning=quota.is_warning,
                    is_exceeded=quota.is_exceeded,
                    is_blocked=quota.is_blocked,
                    is_active=quota.is_active,
                    override_until=quota.override_until,
                    last_reset_at=quota.last_reset_at,
                )
            )

        if results:
            db_session.commit()
            logger.info(
                "Applied %d default quotas to new member: session=%s, account=%s",
                len(results),
                session_id,
                account_id,
            )

        return results
