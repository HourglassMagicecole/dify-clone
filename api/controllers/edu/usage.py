"""
Usage statistics and monitoring endpoints for educational platform.
"""

from datetime import datetime, timedelta

from flask import request
from flask_restx import Resource, fields
from sqlalchemy import func

from controllers.edu import api, edu_ns
from extensions.ext_database import db
from models.education import EducationUsageLimit, EducationUsageStats

api.add_namespace(edu_ns)

# Define models for Swagger documentation
usage_stats_model = edu_ns.model(
    "UsageStats",
    {
        "id": fields.String(required=True, description="Usage stats ID"),
        "user_id": fields.String(description="User ID"),
        "session_id": fields.String(description="Session ID"),
        "api_key_id": fields.String(description="API key ID used"),
        "usage_type": fields.String(required=True, description="Type of usage"),
        "usage_count": fields.Integer(description="Usage count"),
        "usage_data": fields.Raw(description="Additional usage data"),
        "recorded_at": fields.DateTime(description="Recording timestamp"),
    },
)

usage_record_model = edu_ns.model(
    "UsageRecord",
    {
        "user_id": fields.String(description="User ID"),
        "session_id": fields.String(description="Session ID"),
        "api_key_id": fields.String(description="API key ID used"),
        "usage_type": fields.String(required=True, description="Type of usage (tokens, requests, etc.)"),
        "usage_count": fields.Integer(required=True, description="Usage count"),
        "usage_data": fields.Raw(description="Additional usage data"),
    },
)

usage_summary_model = edu_ns.model(
    "UsageSummary",
    {
        "user_id": fields.String(description="User ID"),
        "session_id": fields.String(description="Session ID"),
        "total_requests": fields.Integer(description="Total API requests"),
        "total_tokens": fields.Integer(description="Total tokens used"),
        "period_start": fields.DateTime(description="Period start"),
        "period_end": fields.DateTime(description="Period end"),
        "usage_breakdown": fields.Raw(description="Usage breakdown by type"),
    },
)

usage_limit_check_model = edu_ns.model(
    "UsageLimitCheck",
    {
        "user_id": fields.String(description="User ID"),
        "session_id": fields.String(description="Session ID"),
        "limit_type": fields.String(required=True, description="Type of limit to check"),
        "current_usage": fields.Integer(description="Current usage count"),
        "limit_value": fields.Integer(description="Limit value"),
        "remaining": fields.Integer(description="Remaining usage"),
        "is_exceeded": fields.Boolean(description="Whether limit is exceeded"),
        "reset_time": fields.DateTime(description="When limit resets"),
    },
)


@edu_ns.route("/usage")
class UsageAPI(Resource):
    @edu_ns.doc("record_usage", description="Record usage statistics")
    @edu_ns.expect(usage_record_model)
    @edu_ns.marshal_with(usage_stats_model)
    def post(self):
        """Record usage statistics"""
        try:
            data = request.get_json()

            # Validate required fields
            required_fields = ["usage_type", "usage_count"]
            for field in required_fields:
                if data.get(field) is None:
                    return {"error": f"Field {field} is required"}, 400

            # Create new usage record
            new_usage = EducationUsageStats(
                user_id=data.get("user_id"),
                session_id=data.get("session_id"),
                api_key_id=data.get("api_key_id"),
                usage_type=data["usage_type"],
                usage_count=data["usage_count"],
                usage_data=data.get("usage_data"),
                recorded_at=datetime.utcnow(),
            )

            db.session.add(new_usage)
            db.session.commit()

            return {
                "id": new_usage.id,
                "user_id": new_usage.user_id,
                "session_id": new_usage.session_id,
                "api_key_id": new_usage.api_key_id,
                "usage_type": new_usage.usage_type,
                "usage_count": new_usage.usage_count,
                "usage_data": new_usage.usage_data,
                "recorded_at": new_usage.recorded_at.isoformat() if new_usage.recorded_at else None,
            }, 201

        except Exception as e:
            db.session.rollback()
            return {"error": str(e)}, 500

    @edu_ns.doc("get_usage_stats", description="Get usage statistics")
    @edu_ns.marshal_list_with(usage_stats_model)
    def get(self):
        """Get usage statistics with filtering"""
        try:
            # Query parameters
            user_id = request.args.get("user_id")
            session_id = request.args.get("session_id")
            api_key_id = request.args.get("api_key_id")
            usage_type = request.args.get("usage_type")
            start_date = request.args.get("start_date")
            end_date = request.args.get("end_date")
            limit = min(request.args.get("limit", 100, type=int), 1000)

            query = db.session.query(EducationUsageStats)

            # Apply filters
            if user_id:
                query = query.filter(EducationUsageStats.user_id == user_id)

            if session_id:
                query = query.filter(EducationUsageStats.session_id == session_id)

            if api_key_id:
                query = query.filter(EducationUsageStats.api_key_id == api_key_id)

            if usage_type:
                query = query.filter(EducationUsageStats.usage_type == usage_type)

            if start_date:
                try:
                    start = datetime.fromisoformat(start_date)
                    query = query.filter(EducationUsageStats.recorded_at >= start)
                except ValueError:
                    return {"error": "Invalid start_date format. Use ISO format."}, 400

            if end_date:
                try:
                    end = datetime.fromisoformat(end_date)
                    query = query.filter(EducationUsageStats.recorded_at <= end)
                except ValueError:
                    return {"error": "Invalid end_date format. Use ISO format."}, 400

            usage_stats = query.order_by(EducationUsageStats.recorded_at.desc()).limit(limit).all()

            result = []
            for stats in usage_stats:
                result.append(
                    {
                        "id": stats.id,
                        "user_id": stats.user_id,
                        "session_id": stats.session_id,
                        "api_key_id": stats.api_key_id,
                        "usage_type": stats.usage_type,
                        "usage_count": stats.usage_count,
                        "usage_data": stats.usage_data,
                        "recorded_at": stats.recorded_at.isoformat() if stats.recorded_at else None,
                    }
                )

            return result

        except Exception as e:
            return {"error": str(e)}, 500


@edu_ns.route("/usage/summary")
class UsageSummaryAPI(Resource):
    @edu_ns.doc("get_usage_summary", description="Get usage summary for a period")
    @edu_ns.marshal_with(usage_summary_model)
    def get(self):
        """Get usage summary for a specific period"""
        try:
            user_id = request.args.get("user_id")
            session_id = request.args.get("session_id")
            period = request.args.get("period", "day")  # day, week, month
            start_date = request.args.get("start_date")
            end_date = request.args.get("end_date")

            # Calculate period dates
            end_dt = datetime.utcnow()
            if end_date:
                try:
                    end_dt = datetime.fromisoformat(end_date)
                except ValueError:
                    return {"error": "Invalid end_date format. Use ISO format."}, 400

            if start_date:
                try:
                    start_dt = datetime.fromisoformat(start_date)
                except ValueError:
                    return {"error": "Invalid start_date format. Use ISO format."}, 400
            else:
                if period == "day":
                    start_dt = end_dt - timedelta(days=1)
                elif period == "week":
                    start_dt = end_dt - timedelta(weeks=1)
                elif period == "month":
                    start_dt = end_dt - timedelta(days=30)
                else:
                    start_dt = end_dt - timedelta(days=1)

            # Build query
            query = db.session.query(EducationUsageStats).filter(
                EducationUsageStats.recorded_at >= start_dt, EducationUsageStats.recorded_at <= end_dt
            )

            if user_id:
                query = query.filter(EducationUsageStats.user_id == user_id)

            if session_id:
                query = query.filter(EducationUsageStats.session_id == session_id)

            usage_records = query.all()

            # Calculate summary
            total_requests = 0
            total_tokens = 0
            usage_breakdown = {}

            for record in usage_records:
                if record.usage_type == "requests":
                    total_requests += record.usage_count
                elif record.usage_type == "tokens":
                    total_tokens += record.usage_count

                if record.usage_type not in usage_breakdown:
                    usage_breakdown[record.usage_type] = 0
                usage_breakdown[record.usage_type] += record.usage_count

            return {
                "user_id": user_id,
                "session_id": session_id,
                "total_requests": total_requests,
                "total_tokens": total_tokens,
                "period_start": start_dt.isoformat(),
                "period_end": end_dt.isoformat(),
                "usage_breakdown": usage_breakdown,
            }

        except Exception as e:
            return {"error": str(e)}, 500


@edu_ns.route("/usage/limits/check")
class UsageLimitCheckAPI(Resource):
    @edu_ns.doc("check_usage_limits", description="Check usage against limits")
    @edu_ns.marshal_with(usage_limit_check_model)
    def get(self):
        """Check current usage against limits"""
        try:
            user_id = request.args.get("user_id")
            session_id = request.args.get("session_id")
            limit_type = request.args.get("limit_type", "requests")

            if not user_id and not session_id:
                return {"error": "Either user_id or session_id is required"}, 400

            # Find applicable limit
            query = db.session.query(EducationUsageLimit).filter(
                EducationUsageLimit.limit_type == limit_type, EducationUsageLimit.is_active.is_(True)
            )

            if user_id:
                query = query.filter(EducationUsageLimit.user_id == user_id)

            if session_id:
                query = query.filter(EducationUsageLimit.session_id == session_id)

            limit = query.first()

            if not limit:
                return {"error": "No applicable limit found"}, 404

            # Calculate current period start based on time_period
            now = datetime.utcnow()
            if limit.time_period == "daily":
                period_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
                reset_time = period_start + timedelta(days=1)
            elif limit.time_period == "weekly":
                days_since_monday = now.weekday()
                period_start = (now - timedelta(days=days_since_monday)).replace(
                    hour=0, minute=0, second=0, microsecond=0
                )
                reset_time = period_start + timedelta(weeks=1)
            elif limit.time_period == "monthly":
                period_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
                next_month = (
                    period_start.replace(month=period_start.month + 1)
                    if period_start.month < 12
                    else period_start.replace(year=period_start.year + 1, month=1)
                )
                reset_time = next_month
            else:
                period_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
                reset_time = period_start + timedelta(days=1)

            # Get current usage
            usage_query = db.session.query(func.sum(EducationUsageStats.usage_count)).filter(
                EducationUsageStats.usage_type == limit_type, EducationUsageStats.recorded_at >= period_start
            )

            if user_id:
                usage_query = usage_query.filter(EducationUsageStats.user_id == user_id)

            if session_id:
                usage_query = usage_query.filter(EducationUsageStats.session_id == session_id)

            current_usage = usage_query.scalar() or 0

            remaining = max(0, limit.limit_value - current_usage)
            is_exceeded = current_usage >= limit.limit_value

            return {
                "user_id": user_id,
                "session_id": session_id,
                "limit_type": limit_type,
                "current_usage": current_usage,
                "limit_value": limit.limit_value,
                "remaining": remaining,
                "is_exceeded": is_exceeded,
                "reset_time": reset_time.isoformat(),
            }

        except Exception as e:
            return {"error": str(e)}, 500


@edu_ns.route("/usage/analytics")
class UsageAnalyticsAPI(Resource):
    @edu_ns.doc("get_usage_analytics", description="Get detailed usage analytics")
    def get(self):
        """Get detailed usage analytics and trends"""
        try:
            user_id = request.args.get("user_id")
            session_id = request.args.get("session_id")
            days = request.args.get("days", 7, type=int)

            end_date = datetime.utcnow()
            start_date = end_date - timedelta(days=days)

            # Base query
            query = db.session.query(EducationUsageStats).filter(EducationUsageStats.recorded_at >= start_date)

            if user_id:
                query = query.filter(EducationUsageStats.user_id == user_id)

            if session_id:
                query = query.filter(EducationUsageStats.session_id == session_id)

            usage_records = query.all()

            # Daily aggregation
            daily_usage = {}
            usage_by_type = {}
            total_usage = 0

            for record in usage_records:
                record_date = record.recorded_at.date().isoformat()

                # Daily totals
                if record_date not in daily_usage:
                    daily_usage[record_date] = 0
                daily_usage[record_date] += record.usage_count

                # Usage by type
                if record.usage_type not in usage_by_type:
                    usage_by_type[record.usage_type] = 0
                usage_by_type[record.usage_type] += record.usage_count

                total_usage += record.usage_count

            # Calculate trends
            daily_values = list(daily_usage.values())
            if len(daily_values) >= 2:
                recent_avg = sum(daily_values[-3:]) / min(3, len(daily_values))
                earlier_avg = sum(daily_values[:-3]) / max(1, len(daily_values) - 3)
                trend_direction = (
                    "increasing" if recent_avg > earlier_avg else "decreasing" if recent_avg < earlier_avg else "stable"
                )
                trend_percentage = ((recent_avg - earlier_avg) / max(earlier_avg, 1)) * 100 if earlier_avg > 0 else 0
            else:
                trend_direction = "stable"
                trend_percentage = 0

            return {
                "period_days": days,
                "total_usage": total_usage,
                "daily_usage": daily_usage,
                "usage_by_type": usage_by_type,
                "trend": {"direction": trend_direction, "percentage": round(trend_percentage, 2)},
                "average_daily": round(total_usage / max(days, 1), 2),
            }

        except Exception as e:
            return {"error": str(e)}, 500
