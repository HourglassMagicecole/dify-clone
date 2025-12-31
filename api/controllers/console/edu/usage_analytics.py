"""
Usage Analytics API
API endpoints for usage analytics and cost reporting.
"""

import logging
from datetime import date, datetime

from flask import Blueprint, jsonify, request
from sqlalchemy import delete

from controllers.console.edu.auth_decorators import jwt_required, owner_required
from extensions.ext_database import db
from models.account import TenantAccountJoin, TenantAccountRole
from models.education import ApiUsageLog
from services.education_management.usage_analytics_service import UsageAnalyticsService

logger = logging.getLogger(__name__)

bp = Blueprint("usage_analytics", __name__, url_prefix="/console/api/edu/usage-analytics")


def _parse_date(date_str: str | None) -> date | None:
    """Parse date string to date object."""
    if not date_str:
        return None
    try:
        return datetime.strptime(date_str, "%Y-%m-%d").date()
    except ValueError:
        return None


def _verify_session_access(session_id: str) -> tuple[bool, str | None, object | None]:
    """
    Verify that the current user has access to the specified education session.

    Access is granted if the user is:
    - The tenant owner (TenantAccountRole.OWNER)
    - The session instructor (session.instructor_account_id == account_id)

    Returns:
        tuple: (has_access, error_message, session_object)
            - has_access: True if access is granted
            - error_message: Error message if access denied, None otherwise
            - session_object: The EducationSession object if found, None otherwise
    """
    from models.education import EducationSession

    account = request.user
    account_id = account.id

    # Verify session exists
    session = db.session.query(EducationSession).filter(EducationSession.id == session_id).first()

    if not session:
        return False, "Session not found", None

    # Check permission: must be session instructor or owner
    tenant_join = db.session.query(TenantAccountJoin).filter_by(account_id=account_id, current=True).first()
    if not tenant_join:
        tenant_join = db.session.query(TenantAccountJoin).filter_by(account_id=account_id).first()

    is_owner = False
    if tenant_join:
        role = TenantAccountRole(tenant_join.role)
        is_owner = role == TenantAccountRole.OWNER
    is_instructor = session.instructor_account_id == account_id

    if not is_owner and not is_instructor:
        return False, "Permission denied", session

    return True, None, session


# ============================================================
# Admin APIs (require admin role)
# ============================================================


@bp.route("/sessions/<session_id>/summary", methods=["GET"])
@jwt_required
def get_session_usage_summary(session_id: str):
    """
    Get usage summary for an education session (Admin only).

    Query params:
        start_date: Start date (YYYY-MM-DD, optional)
        end_date: End date (YYYY-MM-DD, optional)
    """
    # Verify session access (owner or instructor)
    has_access, error_message, _ = _verify_session_access(session_id)
    if not has_access:
        status_code = 404 if error_message == "Session not found" else 403
        return jsonify({"result": "fail", "message": error_message}), status_code

    tenant_id = request.user.current_tenant_id

    start_date = _parse_date(request.args.get("start_date"))
    end_date = _parse_date(request.args.get("end_date"))

    summaries = UsageAnalyticsService.get_session_usage_summary(
        session=db.session,  # type: ignore[arg-type]
        tenant_id=tenant_id,
        edu_session_id=session_id,
        start_date=start_date,
        end_date=end_date,
    )

    return jsonify(
        {
            "result": "success",
            "data": [
                {
                    "usage_type": s.usage_type,
                    "request_count": s.request_count,
                    "total_input_tokens": s.total_input_tokens,
                    "total_output_tokens": s.total_output_tokens,
                    "total_tokens": s.total_tokens,
                    "total_price": str(s.total_price),
                    "currency": s.currency,
                }
                for s in summaries
            ],
        }
    )


@bp.route("/sessions/<session_id>/daily-trend", methods=["GET"])
@jwt_required
def get_session_daily_trend(session_id: str):
    """
    Get daily usage trend for an education session (Admin only).

    Query params:
        start_date: Start date (YYYY-MM-DD, required)
        end_date: End date (YYYY-MM-DD, required)
        usage_type: Filter by usage type (optional)
    """
    # Verify session access (owner or instructor)
    has_access, error_message, _ = _verify_session_access(session_id)
    if not has_access:
        status_code = 404 if error_message == "Session not found" else 403
        return jsonify({"result": "fail", "message": error_message}), status_code

    tenant_id = request.user.current_tenant_id

    start_date = _parse_date(request.args.get("start_date"))
    end_date = _parse_date(request.args.get("end_date"))
    usage_type = request.args.get("usage_type")

    if not start_date or not end_date:
        return jsonify({"result": "fail", "message": "start_date and end_date are required"}), 400

    daily_data = UsageAnalyticsService.get_daily_usage_trend(
        session=db.session,  # type: ignore[arg-type]
        tenant_id=tenant_id,
        edu_session_id=session_id,
        start_date=start_date,
        end_date=end_date,
        usage_type=usage_type,
    )

    return jsonify(
        {
            "result": "success",
            "data": [
                {
                    "date": d.date.isoformat(),
                    "usage_type": d.usage_type,
                    "request_count": d.request_count,
                    "total_tokens": d.total_tokens,
                    "total_price": str(d.total_price),
                }
                for d in daily_data
            ],
        }
    )


@bp.route("/sessions/<session_id>/users", methods=["GET"])
@jwt_required
def get_session_user_breakdown(session_id: str):
    """
    Get per-user usage breakdown for an education session (Admin only).

    Query params:
        start_date: Start date (YYYY-MM-DD, optional)
        end_date: End date (YYYY-MM-DD, optional)
        usage_type: Filter by usage type (optional)
    """
    # Verify session access (owner or instructor)
    has_access, error_message, _ = _verify_session_access(session_id)
    if not has_access:
        status_code = 404 if error_message == "Session not found" else 403
        return jsonify({"result": "fail", "message": error_message}), status_code

    tenant_id = request.user.current_tenant_id

    start_date = _parse_date(request.args.get("start_date"))
    end_date = _parse_date(request.args.get("end_date"))
    usage_type = request.args.get("usage_type")

    user_data = UsageAnalyticsService.get_user_usage_breakdown(
        session=db.session,  # type: ignore[arg-type]
        tenant_id=tenant_id,
        edu_session_id=session_id,
        start_date=start_date,
        end_date=end_date,
        usage_type=usage_type,
    )

    return jsonify(
        {
            "result": "success",
            "data": [
                {
                    "account_id": u.account_id,
                    "account_name": u.account_name,
                    "usage_type": u.usage_type,
                    "request_count": u.request_count,
                    "total_tokens": u.total_tokens,
                    "total_price": str(u.total_price),
                }
                for u in user_data
            ],
        }
    )


@bp.route("/sessions/<session_id>/models", methods=["GET"])
@jwt_required
def get_session_model_breakdown(session_id: str):
    """
    Get per-model usage breakdown for an education session (Admin only).

    Query params:
        start_date: Start date (YYYY-MM-DD, optional)
        end_date: End date (YYYY-MM-DD, optional)
    """
    # Verify session access (owner or instructor)
    has_access, error_message, _ = _verify_session_access(session_id)
    if not has_access:
        status_code = 404 if error_message == "Session not found" else 403
        return jsonify({"result": "fail", "message": error_message}), status_code

    tenant_id = request.user.current_tenant_id

    start_date = _parse_date(request.args.get("start_date"))
    end_date = _parse_date(request.args.get("end_date"))

    model_data = UsageAnalyticsService.get_model_usage_breakdown(
        session=db.session,  # type: ignore[arg-type]
        tenant_id=tenant_id,
        edu_session_id=session_id,
        start_date=start_date,
        end_date=end_date,
    )

    return jsonify(
        {
            "result": "success",
            "data": [
                {
                    "model_provider": m.model_provider,
                    "model_id": m.model_id,
                    "usage_type": m.usage_type,
                    "request_count": m.request_count,
                    "total_tokens": m.total_tokens,
                    "total_price": str(m.total_price),
                }
                for m in model_data
            ],
        }
    )


# ============================================================
# User Self-Service APIs (own usage only)
# ============================================================


@bp.route("/my-usage/summary", methods=["GET"])
@jwt_required
def get_my_usage_summary():
    """
    Get current user's own usage summary.

    Query params:
        session_id: Education session ID (optional)
        start_date: Start date (YYYY-MM-DD, optional)
        end_date: End date (YYYY-MM-DD, optional)
    """
    tenant_id = request.user.current_tenant_id
    account_id = request.user.id

    session_id = request.args.get("session_id")
    start_date = _parse_date(request.args.get("start_date"))
    end_date = _parse_date(request.args.get("end_date"))

    summaries = UsageAnalyticsService.get_user_own_usage(
        session=db.session,  # type: ignore[arg-type]
        tenant_id=tenant_id,
        account_id=account_id,
        edu_session_id=session_id,
        start_date=start_date,
        end_date=end_date,
    )

    return jsonify(
        {
            "result": "success",
            "data": [
                {
                    "usage_type": s.usage_type,
                    "request_count": s.request_count,
                    "total_input_tokens": s.total_input_tokens,
                    "total_output_tokens": s.total_output_tokens,
                    "total_tokens": s.total_tokens,
                    "total_price": str(s.total_price),
                    "currency": s.currency,
                }
                for s in summaries
            ],
        }
    )


@bp.route("/my-usage/daily", methods=["GET"])
@jwt_required
def get_my_daily_usage():
    """
    Get current user's daily usage for the last N days.

    Query params:
        session_id: Education session ID (optional)
        days: Number of days to look back (default: 30)
    """
    tenant_id = request.user.current_tenant_id
    account_id = request.user.id

    session_id = request.args.get("session_id")
    days = int(request.args.get("days", 30))

    daily_data = UsageAnalyticsService.get_user_daily_usage(
        session=db.session,  # type: ignore[arg-type]
        tenant_id=tenant_id,
        account_id=account_id,
        edu_session_id=session_id,
        days=days,
    )

    return jsonify(
        {
            "result": "success",
            "data": [
                {
                    "date": d.date.isoformat(),
                    "usage_type": d.usage_type,
                    "request_count": d.request_count,
                    "total_tokens": d.total_tokens,
                    "total_price": str(d.total_price),
                }
                for d in daily_data
            ],
        }
    )


@bp.route("/messages/<message_id>/cost", methods=["GET"])
@jwt_required
def get_message_usage_cost(message_id: str):
    """
    Get total usage cost for a specific message.

    This endpoint aggregates all ApiUsageLog entries for a given message_id
    and returns the total cost. Used for displaying execution cost in Agent results.

    Returns:
        total_price: Total cost in USD
        currency: Currency code (USD)
        usage_count: Number of API calls
    """
    from decimal import Decimal

    from sqlalchemy import func

    # Get tenant_id from TenantAccountJoin (jwt_required doesn't set current_tenant_id)
    account = request.user
    tenant_join = db.session.query(TenantAccountJoin).filter_by(account_id=account.id, current=True).first()
    if not tenant_join:
        tenant_join = db.session.query(TenantAccountJoin).filter_by(account_id=account.id).first()
    tenant_id = tenant_join.tenant_id if tenant_join else None

    logger.info("get_message_usage_cost called: message_id=%s, tenant_id=%s", message_id, tenant_id)

    try:
        # Aggregate usage for this message
        result = (
            db.session.query(
                func.sum(ApiUsageLog.total_price).label("total_price"),
                func.count(ApiUsageLog.id).label("usage_count"),
            )
            .filter(
                ApiUsageLog.tenant_id == tenant_id,
                ApiUsageLog.message_id == message_id,
            )
            .first()
        )

        total_price = result.total_price if result and result.total_price else Decimal(0)
        usage_count = result.usage_count if result else 0

        logger.info("get_message_usage_cost result: total_price=%s, usage_count=%s", total_price, usage_count)

        return jsonify(
            {
                "result": "success",
                "data": {
                    "total_price": str(total_price),
                    "currency": "USD",
                    "usage_count": usage_count,
                },
            }
        )

    except Exception as e:
        logger.exception("Failed to get message usage cost for message_id=%s", message_id)
        return jsonify({"result": "fail", "message": str(e)}), 500


@bp.route("/sessions/<session_id>/users/<account_id>/logs", methods=["GET"])
@jwt_required
def get_user_usage_logs(session_id: str, account_id: str):
    """
    Get detailed usage logs for a specific user in an education session (Admin only).

    Query params:
        start_date: Start date (YYYY-MM-DD, optional)
        end_date: End date (YYYY-MM-DD, optional)
        usage_type: Filter by usage type (optional)
        limit: Maximum number of records (default: 1000)
        offset: Number of records to skip (default: 0)
    """
    # Verify session access (owner or instructor)
    has_access, error_message, _ = _verify_session_access(session_id)
    if not has_access:
        status_code = 404 if error_message == "Session not found" else 403
        return jsonify({"result": "fail", "message": error_message}), status_code

    start_date = _parse_date(request.args.get("start_date"))
    end_date = _parse_date(request.args.get("end_date"))
    usage_type = request.args.get("usage_type")
    limit = int(request.args.get("limit", 1000))
    offset = int(request.args.get("offset", 0))

    logs, total = UsageAnalyticsService.get_user_usage_logs(
        session=db.session,  # type: ignore[arg-type]
        edu_session_id=session_id,
        account_id=account_id,
        start_date=start_date,
        end_date=end_date,
        usage_type=usage_type,
        limit=limit,
        offset=offset,
    )

    return jsonify(
        {
            "result": "success",
            "data": {
                "items": [
                    {
                        "id": log.id,
                        "created_at": log.created_at.isoformat() + "Z",  # UTC timezone marker
                        "model_provider": log.model_provider,
                        "model_id": log.model_id,
                        "usage_type": log.usage_type,
                        "app_name": log.app_name,
                        "input_tokens": log.input_tokens,
                        "output_tokens": log.output_tokens,
                        "total_tokens": log.total_tokens,
                        "total_price": str(log.total_price),
                        "currency": log.currency,
                        "invoke_source": log.invoke_source,
                    }
                    for log in logs
                ],
                "total": total,
                "limit": limit,
                "offset": offset,
            },
        }
    )


# ============================================================
# Owner-Only Maintenance APIs
# ============================================================


@bp.route("/cleanup", methods=["POST"])
@jwt_required
@owner_required
def cleanup_old_usage_logs():
    """
    Manually trigger cleanup of old usage logs (Owner only).

    Deletes logs where retention_until < today.
    This is the same logic as the scheduled Celery cleanup task.

    Returns:
        deleted_count: Number of logs deleted
    """
    today = date.today()

    try:
        stmt = delete(ApiUsageLog).where(
            ApiUsageLog.retention_until.isnot(None),
            ApiUsageLog.retention_until < today,
        )

        result = db.session.execute(stmt)
        deleted_count = result.rowcount
        db.session.commit()

        logger.info("Manual cleanup completed: deleted %d old usage logs", deleted_count)

        return jsonify(
            {
                "result": "success",
                "data": {
                    "deleted_count": deleted_count,
                },
            }
        )

    except Exception as e:
        db.session.rollback()
        logger.exception("Failed to cleanup old usage logs")
        return jsonify({"result": "fail", "message": str(e)}), 500


@bp.route("/sessions/<session_id>/logs", methods=["DELETE"])
@jwt_required
def delete_session_usage_logs(session_id: str):
    """
    Delete all usage logs for a specific education session.

    Only the session instructor (Admin) or Owner can delete logs.
    This allows administrators to clean up logs after reviewing usage data.

    Returns:
        deleted_count: Number of logs deleted
    """
    from models.education import EducationSession

    account = request.user
    account_id = account.id

    # Verify session exists
    session = db.session.query(EducationSession).filter(EducationSession.id == session_id).first()

    if not session:
        return jsonify({"result": "fail", "message": "Session not found"}), 404

    # Check permission: must be session instructor or owner
    # Get role from TenantAccountJoin (same as owner_required)
    tenant_join = db.session.query(TenantAccountJoin).filter_by(account_id=account_id, current=True).first()
    if not tenant_join:
        tenant_join = db.session.query(TenantAccountJoin).filter_by(account_id=account_id).first()

    is_owner = False
    if tenant_join:
        role = TenantAccountRole(tenant_join.role)
        is_owner = role == TenantAccountRole.OWNER
    is_instructor = session.instructor_account_id == account_id

    if not is_owner and not is_instructor:
        return jsonify({"result": "fail", "message": "Permission denied"}), 403

    # Check if session is active
    if session.is_currently_active:
        return jsonify(
            {"result": "fail", "message": "Active session logs cannot be deleted. Deactivate it first."}
        ), 400

    try:
        stmt = delete(ApiUsageLog).where(
            ApiUsageLog.session_id == session_id,
        )

        result = db.session.execute(stmt)
        deleted_count = result.rowcount
        db.session.commit()

        logger.info(
            "Deleted %d usage logs for session %s by user %s",
            deleted_count,
            session_id,
            account_id,
        )

        return jsonify(
            {
                "result": "success",
                "data": {
                    "deleted_count": deleted_count,
                },
            }
        )

    except Exception as e:
        db.session.rollback()
        logger.exception("Failed to delete session usage logs")
        return jsonify({"result": "fail", "message": str(e)}), 500


# ============================================================
# System-wide APIs (Owner only)
# ============================================================


@bp.route("/system/summary", methods=["GET"])
@jwt_required
@owner_required
def get_system_usage_summary():
    """
    Get system-wide usage summary (Owner only).

    Query params:
        start_date: Start date (YYYY-MM-DD, optional)
        end_date: End date (YYYY-MM-DD, optional)
    """
    tenant_id = request.tenant_id

    start_date = _parse_date(request.args.get("start_date"))
    end_date = _parse_date(request.args.get("end_date"))

    summaries = UsageAnalyticsService.get_session_usage_summary(
        session=db.session,  # type: ignore[arg-type]
        tenant_id=tenant_id,
        edu_session_id=None,  # None for system-wide
        start_date=start_date,
        end_date=end_date,
    )

    return jsonify(
        {
            "result": "success",
            "data": [
                {
                    "usage_type": s.usage_type,
                    "request_count": s.request_count,
                    "total_input_tokens": s.total_input_tokens,
                    "total_output_tokens": s.total_output_tokens,
                    "total_tokens": s.total_tokens,
                    "total_price": str(s.total_price),
                    "currency": s.currency,
                }
                for s in summaries
            ],
        }
    )


@bp.route("/system/daily-trend", methods=["GET"])
@jwt_required
@owner_required
def get_system_daily_trend():
    """
    Get system-wide daily usage trend (Owner only).

    Query params:
        start_date: Start date (YYYY-MM-DD, optional)
        end_date: End date (YYYY-MM-DD, optional)
        usage_type: Filter by usage type (optional)
    """
    tenant_id = request.tenant_id

    start_date = _parse_date(request.args.get("start_date"))
    end_date = _parse_date(request.args.get("end_date"))
    usage_type = request.args.get("usage_type")

    trend = UsageAnalyticsService.get_daily_usage_trend(
        session=db.session,  # type: ignore[arg-type]
        tenant_id=tenant_id,
        edu_session_id=None,  # None for system-wide
        start_date=start_date,
        end_date=end_date,
        usage_type=usage_type,
    )

    return jsonify(
        {
            "result": "success",
            "data": [
                {
                    "date": d.date.isoformat(),
                    "usage_type": d.usage_type,
                    "request_count": d.request_count,
                    "total_tokens": d.total_tokens,
                    "total_price": str(d.total_price),
                }
                for d in trend
            ],
        }
    )


@bp.route("/system/user-breakdown", methods=["GET"])
@jwt_required
@owner_required
def get_system_user_breakdown():
    """
    Get system-wide per-user usage breakdown (Owner only).

    Query params:
        start_date: Start date (YYYY-MM-DD, optional)
        end_date: End date (YYYY-MM-DD, optional)
        usage_type: Filter by usage type (optional)
    """
    tenant_id = request.tenant_id

    start_date = _parse_date(request.args.get("start_date"))
    end_date = _parse_date(request.args.get("end_date"))
    usage_type = request.args.get("usage_type")

    breakdown = UsageAnalyticsService.get_user_usage_breakdown(
        session=db.session,  # type: ignore[arg-type]
        tenant_id=tenant_id,
        edu_session_id=None,  # None for system-wide
        start_date=start_date,
        end_date=end_date,
        usage_type=usage_type,
    )

    return jsonify(
        {
            "result": "success",
            "data": [
                {
                    "account_id": u.account_id,
                    "account_name": u.account_name,
                    "usage_type": u.usage_type,
                    "request_count": u.request_count,
                    "total_tokens": u.total_tokens,
                    "total_price": str(u.total_price),
                    "session_id": u.session_id,
                    "session_name": u.session_name,
                }
                for u in breakdown
            ],
        }
    )
