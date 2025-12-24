"""
Usage Analytics API
API endpoints for usage analytics and cost reporting.
"""

from datetime import date, datetime

from flask import Blueprint, jsonify, request

from controllers.console.edu.auth_decorators import jwt_required
from extensions.ext_database import db
from services.education_management.usage_analytics_service import UsageAnalyticsService

bp = Blueprint("usage_analytics", __name__, url_prefix="/console/api/edu/usage-analytics")


def _parse_date(date_str: str | None) -> date | None:
    """Parse date string to date object."""
    if not date_str:
        return None
    try:
        return datetime.strptime(date_str, "%Y-%m-%d").date()
    except ValueError:
        return None


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
