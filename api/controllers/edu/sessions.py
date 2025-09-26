"""
Session management API endpoints for educational platform.
"""

from flask import request
from flask_restx import Resource, fields

from controllers.edu import api, edu_ns
from services.session_service import SessionService

api.add_namespace(edu_ns)

# Define models for Swagger documentation
session_model = edu_ns.model(
    "Session",
    {
        "id": fields.String(required=True, description="Session ID"),
        "title": fields.String(required=True, description="Session title"),
        "description": fields.String(description="Session description"),
        "created_by": fields.String(description="Creator user ID"),
        "start_date": fields.DateTime(description="Session start date"),
        "end_date": fields.DateTime(description="Session end date"),
        "max_participants": fields.Integer(description="Maximum participants"),
        "status": fields.String(description="Session status"),
        "created_at": fields.DateTime(description="Creation timestamp"),
    },
)

session_create_model = edu_ns.model(
    "SessionCreate",
    {
        "title": fields.String(required=True, description="Session title"),
        "description": fields.String(description="Session description"),
        "start_date": fields.DateTime(description="Session start date (ISO format)"),
        "end_date": fields.DateTime(description="Session end date (ISO format)"),
        "max_participants": fields.Integer(description="Maximum participants"),
    },
)

session_participant_model = edu_ns.model(
    "SessionParticipant",
    {
        "user_id": fields.String(required=True, description="User ID"),
        "name": fields.String(required=True, description="User name"),
        "email": fields.String(required=True, description="User email"),
        "role": fields.String(required=True, description="Role in session"),
        "enrolled_at": fields.DateTime(description="Enrollment timestamp"),
        "status": fields.String(description="Enrollment status"),
    },
)

session_enrollment_model = edu_ns.model(
    "SessionEnrollment",
    {
        "user_id": fields.String(required=True, description="User ID to enroll"),
        "role": fields.String(description="Role in session (default: participant)"),
    },
)

session_stats_model = edu_ns.model(
    "SessionStats",
    {
        "session_id": fields.String(required=True, description="Session ID"),
        "total_enrolled": fields.Integer(description="Total enrolled participants"),
        "active_participants": fields.Integer(description="Active participants"),
        "max_participants": fields.Integer(description="Maximum participants"),
        "available_spots": fields.Integer(description="Available spots"),
    },
)


@edu_ns.route("/sessions")
class SessionsAPI(Resource):
    @edu_ns.doc("list_sessions", description="Get list of sessions")
    @edu_ns.marshal_list_with(session_model)
    def get(self):
        """Get list of sessions with pagination and filtering"""
        try:
            page = request.args.get("page", 1, type=int)
            per_page = min(request.args.get("per_page", 20, type=int), 100)
            status = request.args.get("status")

            offset = (page - 1) * per_page
            sessions = SessionService.get_sessions(limit=per_page, offset=offset, status=status)

            session_list = []
            for session in sessions:
                session_list.append(
                    {
                        "id": session.id,
                        "title": session.title,
                        "description": session.description,
                        "created_by": session.created_by,
                        "start_date": session.start_date.isoformat() if session.start_date else None,
                        "end_date": session.end_date.isoformat() if session.end_date else None,
                        "max_participants": session.max_participants,
                        "status": session.status,
                        "created_at": session.created_at.isoformat() if session.created_at else None,
                    }
                )

            return session_list

        except Exception as e:
            return {"error": str(e)}, 500

    @edu_ns.doc("create_session", description="Create a new session")
    @edu_ns.expect(session_create_model)
    @edu_ns.marshal_with(session_model)
    def post(self):
        """Create a new session"""
        try:
            data = request.get_json()

            if not data.get("title"):
                return {"error": "Session title is required"}, 400

            # Parse datetime fields
            start_date = None
            end_date = None
            if data.get("start_date"):
                from datetime import datetime

                try:
                    start_date = datetime.fromisoformat(data["start_date"])
                except ValueError:
                    return {"error": "Invalid start_date format. Use ISO format."}, 400

            if data.get("end_date"):
                from datetime import datetime

                try:
                    end_date = datetime.fromisoformat(data["end_date"])
                except ValueError:
                    return {"error": "Invalid end_date format. Use ISO format."}, 400

            # Get creator from headers (mock authentication)
            created_by = request.headers.get("X-User-ID")

            session = SessionService.create_session(
                title=data["title"],
                description=data.get("description"),
                created_by=created_by,
                start_date=start_date,
                end_date=end_date,
                max_participants=data.get("max_participants"),
            )

            return {
                "id": session.id,
                "title": session.title,
                "description": session.description,
                "created_by": session.created_by,
                "start_date": session.start_date.isoformat() if session.start_date else None,
                "end_date": session.end_date.isoformat() if session.end_date else None,
                "max_participants": session.max_participants,
                "status": session.status,
                "created_at": session.created_at.isoformat() if session.created_at else None,
            }, 201

        except ValueError as e:
            return {"error": str(e)}, 400
        except Exception as e:
            return {"error": str(e)}, 500


@edu_ns.route("/sessions/<string:session_id>")
class SessionAPI(Resource):
    @edu_ns.doc("get_session", description="Get session by ID")
    @edu_ns.marshal_with(session_model)
    def get(self, session_id):
        """Get session by ID"""
        try:
            session = SessionService.get_session_by_id(session_id)
            if not session:
                return {"error": "Session not found"}, 404

            return {
                "id": session.id,
                "title": session.title,
                "description": session.description,
                "created_by": session.created_by,
                "start_date": session.start_date.isoformat() if session.start_date else None,
                "end_date": session.end_date.isoformat() if session.end_date else None,
                "max_participants": session.max_participants,
                "status": session.status,
                "created_at": session.created_at.isoformat() if session.created_at else None,
            }

        except Exception as e:
            return {"error": str(e)}, 500

    @edu_ns.doc("update_session", description="Update session information")
    @edu_ns.expect(session_create_model)
    @edu_ns.marshal_with(session_model)
    def put(self, session_id):
        """Update session information"""
        try:
            data = request.get_json()

            # Parse datetime fields if provided
            if data.get("start_date"):
                from datetime import datetime

                try:
                    data["start_date"] = datetime.fromisoformat(data["start_date"])
                except ValueError:
                    return {"error": "Invalid start_date format. Use ISO format."}, 400

            if data.get("end_date"):
                from datetime import datetime

                try:
                    data["end_date"] = datetime.fromisoformat(data["end_date"])
                except ValueError:
                    return {"error": "Invalid end_date format. Use ISO format."}, 400

            session = SessionService.update_session(session_id, **data)
            if not session:
                return {"error": "Session not found"}, 404

            return {
                "id": session.id,
                "title": session.title,
                "description": session.description,
                "created_by": session.created_by,
                "start_date": session.start_date.isoformat() if session.start_date else None,
                "end_date": session.end_date.isoformat() if session.end_date else None,
                "max_participants": session.max_participants,
                "status": session.status,
                "created_at": session.created_at.isoformat() if session.created_at else None,
            }

        except Exception as e:
            return {"error": str(e)}, 500

    @edu_ns.doc("delete_session", description="Delete session")
    def delete(self, session_id):
        """Delete session"""
        try:
            success = SessionService.delete_session(session_id)
            if not success:
                return {"error": "Session not found"}, 404

            return {"message": "Session deleted successfully"}

        except Exception as e:
            return {"error": str(e)}, 500


@edu_ns.route("/sessions/<string:session_id>/participants")
class SessionParticipantsAPI(Resource):
    @edu_ns.doc("get_session_participants", description="Get session participants")
    @edu_ns.marshal_list_with(session_participant_model)
    def get(self, session_id):
        """Get all participants of a session"""
        try:
            participants = SessionService.get_session_participants(session_id)
            return participants

        except Exception as e:
            return {"error": str(e)}, 500

    @edu_ns.doc("enroll_in_session", description="Enroll user in session")
    @edu_ns.expect(session_enrollment_model)
    def post(self, session_id):
        """Enroll a user in the session"""
        try:
            data = request.get_json()

            if not data.get("user_id"):
                return {"error": "User ID is required"}, 400

            role = data.get("role", "participant")

            enrollment = SessionService.enroll_user(session_id, data["user_id"], role)

            return {
                "message": "User enrolled successfully",
                "enrollment_id": enrollment.id,
                "session_id": session_id,
                "user_id": data["user_id"],
                "role": role,
            }, 201

        except ValueError as e:
            return {"error": str(e)}, 400
        except Exception as e:
            return {"error": str(e)}, 500


@edu_ns.route("/sessions/<string:session_id>/participants/<string:user_id>")
class SessionParticipantAPI(Resource):
    @edu_ns.doc("unenroll_from_session", description="Remove participant from session")
    def delete(self, session_id, user_id):
        """Remove a participant from the session"""
        try:
            success = SessionService.unenroll_user(session_id, user_id)
            if success:
                return {"message": "User unenrolled successfully"}
            else:
                return {"error": "User not enrolled in this session"}, 404

        except Exception as e:
            return {"error": str(e)}, 500


@edu_ns.route("/sessions/<string:session_id>/stats")
class SessionStatsAPI(Resource):
    @edu_ns.doc("get_session_stats", description="Get session statistics")
    @edu_ns.marshal_with(session_stats_model)
    def get(self, session_id):
        """Get session statistics"""
        try:
            stats = SessionService.get_session_stats(session_id)
            return stats

        except ValueError as e:
            return {"error": str(e)}, 404
        except Exception as e:
            return {"error": str(e)}, 500


@edu_ns.route("/users/<string:user_id>/sessions")
class UserSessionsAPI(Resource):
    @edu_ns.doc("get_user_sessions", description="Get user's enrolled sessions")
    def get(self, user_id):
        """Get all sessions for a specific user"""
        try:
            status = request.args.get("status")
            sessions = SessionService.get_user_sessions(user_id, status)
            return sessions

        except Exception as e:
            return {"error": str(e)}, 500
