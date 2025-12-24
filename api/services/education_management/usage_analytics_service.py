"""
Usage Analytics Service
Provides analytics and reporting for API usage and costs.
"""

import logging
from dataclasses import dataclass
from datetime import date, datetime, timedelta
from decimal import Decimal

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from models.account import Account
from models.education import ApiUsageLog

logger = logging.getLogger(__name__)


@dataclass
class UsageSummaryData:
    """Data class for usage summary."""

    usage_type: str
    request_count: int
    total_input_tokens: int
    total_output_tokens: int
    total_tokens: int
    total_price: Decimal
    currency: str


@dataclass
class DailyUsageData:
    """Data class for daily usage."""

    date: date
    usage_type: str
    request_count: int
    total_tokens: int
    total_price: Decimal


@dataclass
class UserUsageData:
    """Data class for user usage."""

    account_id: str
    account_name: str
    usage_type: str
    request_count: int
    total_tokens: int
    total_price: Decimal


@dataclass
class ModelUsageData:
    """Data class for model usage."""

    model_provider: str
    model_id: str
    usage_type: str
    request_count: int
    total_tokens: int
    total_price: Decimal


@dataclass
class UserUsageLogData:
    """Data class for individual user usage log entry."""

    id: str
    created_at: datetime
    model_provider: str | None
    model_id: str | None
    usage_type: str
    app_name: str | None
    input_tokens: int
    output_tokens: int
    total_tokens: int
    total_price: Decimal
    currency: str
    invoke_source: str | None


class UsageAnalyticsService:
    """
    Service for analyzing API usage and costs.

    Provides methods for:
    - Session-level usage summary
    - Daily usage trends
    - Per-user usage breakdown
    - Per-model usage breakdown
    - User's own usage query
    """

    @staticmethod
    def get_session_usage_summary(
        session: Session,
        tenant_id: str,
        edu_session_id: str,
        start_date: date | None = None,
        end_date: date | None = None,
    ) -> list[UsageSummaryData]:
        """
        Get usage summary for an education session.

        Args:
            session: SQLAlchemy session
            tenant_id: Tenant ID
            edu_session_id: Education session ID
            start_date: Start date filter (optional)
            end_date: End date filter (optional)

        Returns:
            List of usage summaries by type
        """
        # Note: tenant_id filter removed to match dashboard_service behavior
        stmt = (
            select(
                ApiUsageLog.usage_type,
                func.count(ApiUsageLog.id).label("request_count"),
                func.sum(ApiUsageLog.input_tokens).label("total_input_tokens"),
                func.sum(ApiUsageLog.output_tokens).label("total_output_tokens"),
                func.sum(ApiUsageLog.total_tokens).label("total_tokens"),
                func.sum(ApiUsageLog.total_price).label("total_price"),
                ApiUsageLog.currency,
            )
            .where(ApiUsageLog.session_id == edu_session_id)
            .group_by(ApiUsageLog.usage_type, ApiUsageLog.currency)
        )

        if start_date:
            stmt = stmt.where(ApiUsageLog.created_at >= datetime.combine(start_date, datetime.min.time()))
        if end_date:
            stmt = stmt.where(ApiUsageLog.created_at <= datetime.combine(end_date, datetime.max.time()))

        results = session.execute(stmt).all()

        return [
            UsageSummaryData(
                usage_type=row.usage_type,
                request_count=row.request_count,
                total_input_tokens=row.total_input_tokens or 0,
                total_output_tokens=row.total_output_tokens or 0,
                total_tokens=row.total_tokens or 0,
                total_price=row.total_price or Decimal(0),
                currency=row.currency,
            )
            for row in results
        ]

    @staticmethod
    def get_daily_usage_trend(
        session: Session,
        tenant_id: str,
        edu_session_id: str,
        start_date: date,
        end_date: date,
        usage_type: str | None = None,
    ) -> list[DailyUsageData]:
        """
        Get daily usage trend for an education session.

        Args:
            session: SQLAlchemy session
            tenant_id: Tenant ID
            edu_session_id: Education session ID
            start_date: Start date
            end_date: End date
            usage_type: Filter by usage type (optional)

        Returns:
            List of daily usage data
        """
        # Note: tenant_id filter removed to match dashboard_service behavior
        stmt = (
            select(
                func.date(ApiUsageLog.created_at).label("date"),
                ApiUsageLog.usage_type,
                func.count(ApiUsageLog.id).label("request_count"),
                func.sum(ApiUsageLog.total_tokens).label("total_tokens"),
                func.sum(ApiUsageLog.total_price).label("total_price"),
            )
            .where(
                ApiUsageLog.session_id == edu_session_id,
                ApiUsageLog.created_at >= datetime.combine(start_date, datetime.min.time()),
                ApiUsageLog.created_at <= datetime.combine(end_date, datetime.max.time()),
            )
            .group_by(func.date(ApiUsageLog.created_at), ApiUsageLog.usage_type)
            .order_by(func.date(ApiUsageLog.created_at))
        )

        if usage_type:
            stmt = stmt.where(ApiUsageLog.usage_type == usage_type)

        results = session.execute(stmt).all()

        return [
            DailyUsageData(
                date=row.date,
                usage_type=row.usage_type,
                request_count=row.request_count,
                total_tokens=row.total_tokens or 0,
                total_price=row.total_price or Decimal(0),
            )
            for row in results
        ]

    @staticmethod
    def get_user_usage_breakdown(
        session: Session,
        tenant_id: str,
        edu_session_id: str,
        start_date: date | None = None,
        end_date: date | None = None,
        usage_type: str | None = None,
    ) -> list[UserUsageData]:
        """
        Get per-user usage breakdown for an education session.

        Args:
            session: SQLAlchemy session
            tenant_id: Tenant ID
            edu_session_id: Education session ID
            start_date: Start date filter (optional)
            end_date: End date filter (optional)
            usage_type: Filter by usage type (optional)

        Returns:
            List of user usage data
        """
        # Note: tenant_id filter removed to match dashboard_service behavior
        # Join with Account table to get user names
        # Include records with null account_id as "미분류"
        stmt = (
            select(
                ApiUsageLog.account_id,
                Account.name.label("account_name"),
                ApiUsageLog.usage_type,
                func.count(ApiUsageLog.id).label("request_count"),
                func.sum(ApiUsageLog.total_tokens).label("total_tokens"),
                func.sum(ApiUsageLog.total_price).label("total_price"),
            )
            .outerjoin(Account, ApiUsageLog.account_id == Account.id)
            .where(ApiUsageLog.session_id == edu_session_id)
            .group_by(ApiUsageLog.account_id, Account.name, ApiUsageLog.usage_type)
            .order_by(func.sum(ApiUsageLog.total_price).desc())
        )

        if start_date:
            stmt = stmt.where(ApiUsageLog.created_at >= datetime.combine(start_date, datetime.min.time()))
        if end_date:
            stmt = stmt.where(ApiUsageLog.created_at <= datetime.combine(end_date, datetime.max.time()))
        if usage_type:
            stmt = stmt.where(ApiUsageLog.usage_type == usage_type)

        results = session.execute(stmt).all()

        return [
            UserUsageData(
                account_id=row.account_id or "unknown",
                account_name=row.account_name or ("미분류" if not row.account_id else f"User {row.account_id[:8]}"),
                usage_type=row.usage_type,
                request_count=row.request_count,
                total_tokens=row.total_tokens or 0,
                total_price=row.total_price or Decimal(0),
            )
            for row in results
        ]

    @staticmethod
    def get_model_usage_breakdown(
        session: Session,
        tenant_id: str,
        edu_session_id: str,
        start_date: date | None = None,
        end_date: date | None = None,
    ) -> list[ModelUsageData]:
        """
        Get per-model usage breakdown for an education session.

        Args:
            session: SQLAlchemy session
            tenant_id: Tenant ID
            edu_session_id: Education session ID
            start_date: Start date filter (optional)
            end_date: End date filter (optional)

        Returns:
            List of model usage data
        """
        # Note: tenant_id filter removed to match dashboard_service behavior
        stmt = (
            select(
                ApiUsageLog.model_provider,
                ApiUsageLog.model_id,
                ApiUsageLog.usage_type,
                func.count(ApiUsageLog.id).label("request_count"),
                func.sum(ApiUsageLog.total_tokens).label("total_tokens"),
                func.sum(ApiUsageLog.total_price).label("total_price"),
            )
            .where(
                ApiUsageLog.session_id == edu_session_id,
                ApiUsageLog.model_provider.isnot(None),
            )
            .group_by(ApiUsageLog.model_provider, ApiUsageLog.model_id, ApiUsageLog.usage_type)
            .order_by(func.sum(ApiUsageLog.total_price).desc())
        )

        if start_date:
            stmt = stmt.where(ApiUsageLog.created_at >= datetime.combine(start_date, datetime.min.time()))
        if end_date:
            stmt = stmt.where(ApiUsageLog.created_at <= datetime.combine(end_date, datetime.max.time()))

        results = session.execute(stmt).all()

        return [
            ModelUsageData(
                model_provider=row.model_provider or "",
                model_id=row.model_id or "",
                usage_type=row.usage_type,
                request_count=row.request_count,
                total_tokens=row.total_tokens or 0,
                total_price=row.total_price or Decimal(0),
            )
            for row in results
        ]

    @staticmethod
    def get_user_own_usage(
        session: Session,
        tenant_id: str,
        account_id: str,
        edu_session_id: str | None = None,
        start_date: date | None = None,
        end_date: date | None = None,
    ) -> list[UsageSummaryData]:
        """
        Get a user's own usage summary.

        Args:
            session: SQLAlchemy session
            tenant_id: Tenant ID
            account_id: User's account ID
            edu_session_id: Education session ID (optional)
            start_date: Start date filter (optional)
            end_date: End date filter (optional)

        Returns:
            List of usage summaries by type
        """
        stmt = (
            select(
                ApiUsageLog.usage_type,
                func.count(ApiUsageLog.id).label("request_count"),
                func.sum(ApiUsageLog.input_tokens).label("total_input_tokens"),
                func.sum(ApiUsageLog.output_tokens).label("total_output_tokens"),
                func.sum(ApiUsageLog.total_tokens).label("total_tokens"),
                func.sum(ApiUsageLog.total_price).label("total_price"),
                ApiUsageLog.currency,
            )
            .where(
                ApiUsageLog.tenant_id == tenant_id,
                ApiUsageLog.account_id == account_id,
            )
            .group_by(ApiUsageLog.usage_type, ApiUsageLog.currency)
        )

        if edu_session_id:
            stmt = stmt.where(ApiUsageLog.session_id == edu_session_id)
        if start_date:
            stmt = stmt.where(ApiUsageLog.created_at >= datetime.combine(start_date, datetime.min.time()))
        if end_date:
            stmt = stmt.where(ApiUsageLog.created_at <= datetime.combine(end_date, datetime.max.time()))

        results = session.execute(stmt).all()

        return [
            UsageSummaryData(
                usage_type=row.usage_type,
                request_count=row.request_count,
                total_input_tokens=row.total_input_tokens or 0,
                total_output_tokens=row.total_output_tokens or 0,
                total_tokens=row.total_tokens or 0,
                total_price=row.total_price or Decimal(0),
                currency=row.currency,
            )
            for row in results
        ]

    @staticmethod
    def get_user_daily_usage(
        session: Session,
        tenant_id: str,
        account_id: str,
        edu_session_id: str | None = None,
        days: int = 30,
    ) -> list[DailyUsageData]:
        """
        Get a user's daily usage for the last N days.

        Args:
            session: SQLAlchemy session
            tenant_id: Tenant ID
            account_id: User's account ID
            edu_session_id: Education session ID (optional)
            days: Number of days to look back (default: 30)

        Returns:
            List of daily usage data
        """
        end_date = date.today()
        start_date = end_date - timedelta(days=days)

        stmt = (
            select(
                func.date(ApiUsageLog.created_at).label("date"),
                ApiUsageLog.usage_type,
                func.count(ApiUsageLog.id).label("request_count"),
                func.sum(ApiUsageLog.total_tokens).label("total_tokens"),
                func.sum(ApiUsageLog.total_price).label("total_price"),
            )
            .where(
                ApiUsageLog.tenant_id == tenant_id,
                ApiUsageLog.account_id == account_id,
                ApiUsageLog.created_at >= datetime.combine(start_date, datetime.min.time()),
            )
            .group_by(func.date(ApiUsageLog.created_at), ApiUsageLog.usage_type)
            .order_by(func.date(ApiUsageLog.created_at))
        )

        if edu_session_id:
            stmt = stmt.where(ApiUsageLog.session_id == edu_session_id)

        results = session.execute(stmt).all()

        return [
            DailyUsageData(
                date=row.date,
                usage_type=row.usage_type,
                request_count=row.request_count,
                total_tokens=row.total_tokens or 0,
                total_price=row.total_price or Decimal(0),
            )
            for row in results
        ]

    @staticmethod
    def get_user_usage_logs(
        session: Session,
        edu_session_id: str,
        account_id: str,
        start_date: date | None = None,
        end_date: date | None = None,
        usage_type: str | None = None,
        limit: int = 1000,
        offset: int = 0,
    ) -> tuple[list[UserUsageLogData], int]:
        """
        Get detailed usage logs for a specific user in an education session.

        Args:
            session: SQLAlchemy session
            edu_session_id: Education session ID
            account_id: User's account ID
            start_date: Start date filter (optional)
            end_date: End date filter (optional)
            usage_type: Filter by usage type (optional)
            limit: Maximum number of records to return
            offset: Number of records to skip

        Returns:
            Tuple of (list of usage logs, total count)
        """
        # Base query
        base_conditions = [
            ApiUsageLog.session_id == edu_session_id,
            ApiUsageLog.account_id == account_id,
        ]

        if start_date:
            base_conditions.append(ApiUsageLog.created_at >= datetime.combine(start_date, datetime.min.time()))
        if end_date:
            base_conditions.append(ApiUsageLog.created_at <= datetime.combine(end_date, datetime.max.time()))
        if usage_type:
            base_conditions.append(ApiUsageLog.usage_type == usage_type)

        # Count query
        count_stmt = select(func.count(ApiUsageLog.id)).where(*base_conditions)
        total = session.execute(count_stmt).scalar() or 0

        # Data query
        stmt = (
            select(ApiUsageLog)
            .where(*base_conditions)
            .order_by(ApiUsageLog.created_at.desc())
            .limit(limit)
            .offset(offset)
        )

        results = session.execute(stmt).scalars().all()

        return (
            [
                UserUsageLogData(
                    id=log.id,
                    created_at=log.created_at,
                    model_provider=log.model_provider,
                    model_id=log.model_id,
                    usage_type=log.usage_type,
                    app_name=log.app_name,
                    input_tokens=log.input_tokens,
                    output_tokens=log.output_tokens,
                    total_tokens=log.total_tokens,
                    total_price=log.total_price,
                    currency=log.currency,
                    invoke_source=log.invoke_source,
                )
                for log in results
            ],
            total,
        )
