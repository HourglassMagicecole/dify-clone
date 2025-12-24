"""
API Usage Aggregation Task
Celery Beat task for daily aggregation of API usage statistics.
"""

import logging
from datetime import date, datetime, timedelta
from decimal import Decimal

from celery import shared_task
from sqlalchemy import delete, func, select

from extensions.ext_database import db
from models.education import ApiUsageLog, ApiUsageSummary

logger = logging.getLogger(__name__)


@shared_task
def aggregate_daily_usage():
    """
    Aggregate API usage logs into daily summaries.

    This task runs daily and aggregates the previous day's usage data
    into ApiUsageSummary records for efficient dashboard queries.

    Aggregation dimensions:
    - By session, account, usage_type, model_provider, model_id
    """
    yesterday = date.today() - timedelta(days=1)
    start_time = datetime.combine(yesterday, datetime.min.time())
    end_time = datetime.combine(yesterday, datetime.max.time())

    logger.info("Starting daily usage aggregation for %s", yesterday)

    try:
        # Query aggregated data from ApiUsageLog
        stmt = (
            select(
                ApiUsageLog.tenant_id,
                ApiUsageLog.session_id,
                ApiUsageLog.account_id,
                ApiUsageLog.usage_type,
                ApiUsageLog.model_provider,
                ApiUsageLog.model_id,
                func.count(ApiUsageLog.id).label("request_count"),
                func.sum(ApiUsageLog.input_tokens).label("total_input_tokens"),
                func.sum(ApiUsageLog.output_tokens).label("total_output_tokens"),
                func.sum(ApiUsageLog.total_tokens).label("total_tokens"),
                func.sum(ApiUsageLog.input_unit_count).label("total_input_units"),
                func.sum(ApiUsageLog.output_unit_count).label("total_output_units"),
                func.sum(ApiUsageLog.total_price).label("total_price"),
                ApiUsageLog.currency,
            )
            .where(
                ApiUsageLog.created_at >= start_time,
                ApiUsageLog.created_at <= end_time,
            )
            .group_by(
                ApiUsageLog.tenant_id,
                ApiUsageLog.session_id,
                ApiUsageLog.account_id,
                ApiUsageLog.usage_type,
                ApiUsageLog.model_provider,
                ApiUsageLog.model_id,
                ApiUsageLog.currency,
            )
        )

        results = db.session.execute(stmt).all()

        # Create summary records
        summaries_created = 0
        for row in results:
            summary = ApiUsageSummary(
                tenant_id=row.tenant_id,
                summary_date=yesterday,
                summary_type="daily",
                session_id=row.session_id,
                account_id=row.account_id,
                usage_type=row.usage_type,
                model_provider=row.model_provider,
                model_id=row.model_id,
                request_count=row.request_count or 0,
                total_input_tokens=row.total_input_tokens or 0,
                total_output_tokens=row.total_output_tokens or 0,
                total_tokens=row.total_tokens or 0,
                total_input_units=row.total_input_units or Decimal(0),
                total_output_units=row.total_output_units or Decimal(0),
                total_price=row.total_price or Decimal(0),
                currency=row.currency or "USD",
            )
            db.session.add(summary)
            summaries_created += 1

        db.session.commit()

        logger.info(
            "Daily usage aggregation completed: date=%s, summaries_created=%d",
            yesterday,
            summaries_created,
        )

        return {"date": yesterday.isoformat(), "summaries_created": summaries_created}

    except Exception:
        db.session.rollback()
        logger.exception("Failed to aggregate daily usage for %s", yesterday)
        raise


@shared_task
def cleanup_old_usage_logs():
    """
    Delete old API usage logs that have passed their retention date.

    This task runs daily and deletes logs where retention_until < today.
    Only logs with a set retention_until date are deleted.
    """
    today = date.today()

    logger.info("Starting cleanup of old usage logs (retention_until < %s)", today)

    try:
        # Delete logs past retention date
        stmt = delete(ApiUsageLog).where(
            ApiUsageLog.retention_until.isnot(None),
            ApiUsageLog.retention_until < today,
        )

        result = db.session.execute(stmt)
        deleted_count = result.rowcount
        db.session.commit()

        logger.info("Cleanup completed: deleted %d old usage logs", deleted_count)

        return {"deleted_count": deleted_count}

    except Exception:
        db.session.rollback()
        logger.exception("Failed to cleanup old usage logs")
        raise


@shared_task
def aggregate_monthly_usage():
    """
    Aggregate API usage into monthly summaries.

    This task runs on the 1st of each month and aggregates
    the previous month's daily summaries into monthly summaries.
    """
    today = date.today()

    # Only run on the 1st of the month
    if today.day != 1:
        logger.debug("Skipping monthly aggregation - not the 1st of the month")
        return {"skipped": True}

    # Get the previous month
    first_of_this_month = today.replace(day=1)
    last_of_prev_month = first_of_this_month - timedelta(days=1)
    first_of_prev_month = last_of_prev_month.replace(day=1)

    logger.info(
        "Starting monthly usage aggregation for %s to %s",
        first_of_prev_month,
        last_of_prev_month,
    )

    try:
        # Aggregate from daily summaries
        stmt = (
            select(
                ApiUsageSummary.tenant_id,
                ApiUsageSummary.session_id,
                ApiUsageSummary.account_id,
                ApiUsageSummary.usage_type,
                ApiUsageSummary.model_provider,
                ApiUsageSummary.model_id,
                func.sum(ApiUsageSummary.request_count).label("request_count"),
                func.sum(ApiUsageSummary.total_input_tokens).label("total_input_tokens"),
                func.sum(ApiUsageSummary.total_output_tokens).label("total_output_tokens"),
                func.sum(ApiUsageSummary.total_tokens).label("total_tokens"),
                func.sum(ApiUsageSummary.total_input_units).label("total_input_units"),
                func.sum(ApiUsageSummary.total_output_units).label("total_output_units"),
                func.sum(ApiUsageSummary.total_price).label("total_price"),
                ApiUsageSummary.currency,
            )
            .where(
                ApiUsageSummary.summary_type == "daily",
                ApiUsageSummary.summary_date >= first_of_prev_month,
                ApiUsageSummary.summary_date <= last_of_prev_month,
            )
            .group_by(
                ApiUsageSummary.tenant_id,
                ApiUsageSummary.session_id,
                ApiUsageSummary.account_id,
                ApiUsageSummary.usage_type,
                ApiUsageSummary.model_provider,
                ApiUsageSummary.model_id,
                ApiUsageSummary.currency,
            )
        )

        results = db.session.execute(stmt).all()

        # Create monthly summary records
        summaries_created = 0
        for row in results:
            summary = ApiUsageSummary(
                tenant_id=row.tenant_id,
                summary_date=first_of_prev_month,  # Use first day of month as summary date
                summary_type="monthly",
                session_id=row.session_id,
                account_id=row.account_id,
                usage_type=row.usage_type,
                model_provider=row.model_provider,
                model_id=row.model_id,
                request_count=row.request_count or 0,
                total_input_tokens=row.total_input_tokens or 0,
                total_output_tokens=row.total_output_tokens or 0,
                total_tokens=row.total_tokens or 0,
                total_input_units=row.total_input_units or Decimal(0),
                total_output_units=row.total_output_units or Decimal(0),
                total_price=row.total_price or Decimal(0),
                currency=row.currency or "USD",
            )
            db.session.add(summary)
            summaries_created += 1

        db.session.commit()

        logger.info(
            "Monthly usage aggregation completed: month=%s, summaries_created=%d",
            first_of_prev_month.strftime("%Y-%m"),
            summaries_created,
        )

        return {
            "month": first_of_prev_month.strftime("%Y-%m"),
            "summaries_created": summaries_created,
        }

    except Exception:
        db.session.rollback()
        logger.exception("Failed to aggregate monthly usage")
        raise
