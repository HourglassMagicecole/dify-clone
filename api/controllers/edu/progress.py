"""
Progress tracking API endpoints for educational platform.
"""

from flask import request
from flask_restx import Resource, fields

from controllers.edu import api, edu_ns
from services.progress_service import ProgressService

api.add_namespace(edu_ns)

# Define models for Swagger documentation
progress_model = edu_ns.model(
    "Progress",
    {
        "id": fields.String(required=True, description="Progress record ID"),
        "user_id": fields.String(required=True, description="User ID"),
        "session_id": fields.String(required=True, description="Session ID"),
        "activity_type": fields.String(required=True, description="Activity type"),
        "activity_id": fields.String(required=True, description="Activity ID"),
        "completion_percentage": fields.Float(description="Completion percentage (0-100)"),
        "completion_status": fields.String(description="Completion status"),
        "progress_data": fields.Raw(description="Additional progress data"),
        "created_at": fields.DateTime(description="Creation timestamp"),
        "updated_at": fields.DateTime(description="Last update timestamp"),
        "completed_at": fields.DateTime(description="Completion timestamp"),
    },
)

progress_create_model = edu_ns.model(
    "ProgressCreate",
    {
        "user_id": fields.String(required=True, description="User ID"),
        "session_id": fields.String(required=True, description="Session ID"),
        "activity_type": fields.String(required=True, description="Activity type (workflow, agent, rag, etc.)"),
        "activity_id": fields.String(required=True, description="Unique activity ID"),
        "completion_status": fields.String(
            description="Status (in_progress, completed, failed)", default="in_progress"
        ),
        "progress_data": fields.Raw(description="Additional progress data as JSON"),
    },
)

progress_update_model = edu_ns.model(
    "ProgressUpdate",
    {
        "completion_percentage": fields.Float(description="Completion percentage (0-100)"),
        "completion_status": fields.String(description="Completion status"),
        "progress_data": fields.Raw(description="Updated progress data"),
    },
)

user_progress_summary_model = edu_ns.model(
    "UserProgressSummary",
    {
        "user_id": fields.String(required=True, description="User ID"),
        "name": fields.String(required=True, description="User name"),
        "email": fields.String(required=True, description="User email"),
        "total_activities": fields.Integer(description="Total activities attempted"),
        "completed_activities": fields.Integer(description="Completed activities"),
        "average_completion": fields.Float(description="Average completion percentage"),
        "completion_rate": fields.Float(description="Overall completion rate"),
    },
)

activity_progress_model = edu_ns.model(
    "ActivityProgress",
    {
        "user_id": fields.String(required=True, description="User ID"),
        "name": fields.String(required=True, description="User name"),
        "email": fields.String(required=True, description="User email"),
        "completion_percentage": fields.Float(description="Completion percentage"),
        "completion_status": fields.String(description="Completion status"),
        "started_at": fields.DateTime(description="Start timestamp"),
        "completed_at": fields.DateTime(description="Completion timestamp"),
        "progress_data": fields.Raw(description="Progress data"),
    },
)

progress_analytics_model = edu_ns.model(
    "ProgressAnalytics",
    {
        "session_id": fields.String(required=True, description="Session ID"),
        "total_users": fields.Integer(description="Total enrolled users"),
        "total_activities": fields.Integer(description="Total activities"),
        "completed_activities": fields.Integer(description="Completed activities"),
        "completion_rate": fields.Float(description="Overall completion rate"),
        "activity_breakdown": fields.Raw(description="Activity type breakdown"),
        "daily_progress": fields.List(fields.Raw, description="Daily progress statistics"),
    },
)

bulk_update_model = edu_ns.model(
    "BulkUpdate",
    {
        "updates": fields.List(
            fields.Nested(progress_update_model), required=True, description="List of progress updates"
        )
    },
)


@edu_ns.route("/progress")
class ProgressAPI(Resource):
    @edu_ns.doc("create_progress", description="Record learning progress")
    @edu_ns.expect(progress_create_model)
    @edu_ns.marshal_with(progress_model)
    def post(self):
        """Record learning progress for a user"""
        try:
            data = request.get_json()

            # Validate required fields
            required_fields = ["user_id", "session_id", "activity_type", "activity_id"]
            for field in required_fields:
                if not data.get(field):
                    return {"error": f"Field {field} is required"}, 400

            progress = ProgressService.record_progress(
                user_id=data["user_id"],
                session_id=data["session_id"],
                activity_type=data["activity_type"],
                activity_id=data["activity_id"],
                progress_data=data.get("progress_data"),
                completion_status=data.get("completion_status", "in_progress"),
            )

            return {
                "id": progress.id,
                "user_id": progress.user_id,
                "session_id": progress.session_id,
                "activity_type": progress.activity_type,
                "activity_id": progress.activity_id,
                "completion_percentage": progress.completion_percentage,
                "completion_status": progress.completion_status,
                "progress_data": progress.progress_data,
                "created_at": progress.created_at.isoformat() if progress.created_at else None,
                "updated_at": progress.updated_at.isoformat() if progress.updated_at else None,
                "completed_at": progress.completed_at.isoformat() if progress.completed_at else None,
            }, 201

        except ValueError as e:
            return {"error": str(e)}, 400
        except Exception as e:
            return {"error": str(e)}, 500

    @edu_ns.doc("bulk_update_progress", description="Bulk update progress records")
    @edu_ns.expect(bulk_update_model)
    def patch(self):
        """Bulk update multiple progress records"""
        try:
            data = request.get_json()
            updates = data.get("updates", [])

            if not updates:
                return {"error": "No updates provided"}, 400

            result = ProgressService.bulk_update_progress(updates)

            return result

        except Exception as e:
            return {"error": str(e)}, 500


@edu_ns.route("/progress/<string:progress_id>")
class ProgressByIdAPI(Resource):
    @edu_ns.doc("update_progress", description="Update progress record")
    @edu_ns.expect(progress_update_model)
    @edu_ns.marshal_with(progress_model)
    def put(self, progress_id):
        """Update a specific progress record"""
        try:
            data = request.get_json()

            progress = ProgressService.update_progress(
                progress_id=progress_id,
                completion_percentage=data.get("completion_percentage"),
                completion_status=data.get("completion_status"),
                progress_data=data.get("progress_data"),
            )

            if not progress:
                return {"error": "Progress record not found"}, 404

            return {
                "id": progress.id,
                "user_id": progress.user_id,
                "session_id": progress.session_id,
                "activity_type": progress.activity_type,
                "activity_id": progress.activity_id,
                "completion_percentage": progress.completion_percentage,
                "completion_status": progress.completion_status,
                "progress_data": progress.progress_data,
                "created_at": progress.created_at.isoformat() if progress.created_at else None,
                "updated_at": progress.updated_at.isoformat() if progress.updated_at else None,
                "completed_at": progress.completed_at.isoformat() if progress.completed_at else None,
            }

        except Exception as e:
            return {"error": str(e)}, 500

    @edu_ns.doc("delete_progress", description="Delete progress record")
    def delete(self, progress_id):
        """Delete a progress record"""
        try:
            success = ProgressService.delete_progress(progress_id)
            if success:
                return {"message": "Progress record deleted successfully"}
            else:
                return {"error": "Progress record not found"}, 404

        except Exception as e:
            return {"error": str(e)}, 500


@edu_ns.route("/users/<string:user_id>/progress")
class UserProgressAPI(Resource):
    @edu_ns.doc("get_user_progress", description="Get user's progress records")
    @edu_ns.marshal_list_with(progress_model)
    def get(self, user_id):
        """Get all progress records for a specific user"""
        try:
            session_id = request.args.get("session_id")
            activity_type = request.args.get("activity_type")

            progress_records = ProgressService.get_user_progress(
                user_id=user_id, session_id=session_id, activity_type=activity_type
            )

            result = []
            for progress in progress_records:
                result.append(
                    {
                        "id": progress.id,
                        "user_id": progress.user_id,
                        "session_id": progress.session_id,
                        "activity_type": progress.activity_type,
                        "activity_id": progress.activity_id,
                        "completion_percentage": progress.completion_percentage,
                        "completion_status": progress.completion_status,
                        "progress_data": progress.progress_data,
                        "created_at": progress.created_at.isoformat() if progress.created_at else None,
                        "updated_at": progress.updated_at.isoformat() if progress.updated_at else None,
                        "completed_at": progress.completed_at.isoformat() if progress.completed_at else None,
                    }
                )

            return result

        except Exception as e:
            return {"error": str(e)}, 500


@edu_ns.route("/sessions/<string:session_id>/progress")
class SessionProgressAPI(Resource):
    @edu_ns.doc("get_session_progress", description="Get progress summary for all users in session")
    @edu_ns.marshal_list_with(user_progress_summary_model)
    def get(self, session_id):
        """Get progress summary for all users in a session"""
        try:
            progress_summary = ProgressService.get_session_progress(session_id)
            return progress_summary

        except Exception as e:
            return {"error": str(e)}, 500


@edu_ns.route("/sessions/<string:session_id>/activities/<string:activity_type>/<string:activity_id>/progress")
class ActivityProgressAPI(Resource):
    @edu_ns.doc("get_activity_progress", description="Get progress for specific activity across all users")
    @edu_ns.marshal_list_with(activity_progress_model)
    def get(self, session_id, activity_type, activity_id):
        """Get progress for a specific activity across all users in session"""
        try:
            activity_progress = ProgressService.get_activity_progress(
                session_id=session_id, activity_type=activity_type, activity_id=activity_id
            )

            return activity_progress

        except Exception as e:
            return {"error": str(e)}, 500


@edu_ns.route("/sessions/<string:session_id>/progress/analytics")
class ProgressAnalyticsAPI(Resource):
    @edu_ns.doc("get_progress_analytics", description="Get progress analytics for session")
    @edu_ns.marshal_with(progress_analytics_model)
    def get(self, session_id):
        """Get analytics and statistics for session progress"""
        try:
            analytics = ProgressService.get_progress_analytics(session_id)
            return analytics

        except Exception as e:
            return {"error": str(e)}, 500
