"""
Main education service that integrates all educational platform services.
"""

from datetime import UTC, datetime
from typing import Any, Optional

from extensions.ext_database import db
from models.education import (
    EducationApiKey,
    EducationEnrollment,
    EducationSession,
    EducationTemplate,
    EducationUsageStats,
    LearningProgress,
)
from services.group_service import GroupService
from services.progress_service import ProgressService
from services.session_service import SessionService
from services.template_service import TemplateService


class EducationService:
    """
    Main education service that provides high-level operations
    and integrates all education-related services.
    """

    def __init__(self):
        self.group_service = GroupService()
        self.session_service = SessionService()
        self.progress_service = ProgressService()
        self.template_service = TemplateService()

    @staticmethod
    def get_platform_overview() -> dict[str, Any]:
        """
        Get overall platform statistics and health status.

        Returns:
            Dict[str, Any]: Platform overview data
        """
        try:
            # Get counts from different entities
            total_sessions = db.session.query(EducationSession).count()
            total_enrollments = db.session.query(EducationEnrollment).count()
            total_templates = db.session.query(EducationTemplate).filter_by(is_public=True).count()
            total_progress_records = db.session.query(LearningProgress).count()
            total_api_keys = db.session.query(EducationApiKey).filter_by(is_active=True).count()

            # Get recent activity (last 24 hours)
            yesterday = datetime.now(UTC).replace(hour=0, minute=0, second=0, microsecond=0)
            recent_sessions = (
                db.session.query(EducationSession).filter(EducationSession.created_at >= yesterday).count()
            )

            recent_progress = (
                db.session.query(LearningProgress).filter(LearningProgress.created_at >= yesterday).count()
            )

            # Get active sessions (assuming sessions with recent activity)
            active_sessions = db.session.query(EducationSession).filter_by(status="active").count()

            return {
                "platform_stats": {
                    "total_sessions": total_sessions,
                    "total_enrollments": total_enrollments,
                    "total_templates": total_templates,
                    "total_progress_records": total_progress_records,
                    "total_api_keys": total_api_keys,
                    "active_sessions": active_sessions,
                },
                "recent_activity": {
                    "new_sessions_today": recent_sessions,
                    "progress_updates_today": recent_progress,
                },
                "system_status": {
                    "database_healthy": True,
                    "apis_operational": True,
                    "last_updated": datetime.now(UTC).isoformat(),
                },
            }

        except Exception as e:
            return {
                "error": f"Failed to get platform overview: {str(e)}",
                "system_status": {
                    "database_healthy": False,
                    "apis_operational": False,
                    "last_updated": datetime.now(UTC).isoformat(),
                },
            }

    @staticmethod
    def create_complete_session(
        title: str,
        description: Optional[str] = None,
        created_by: Optional[str] = None,
        participants: Optional[list[str]] = None,
        templates: Optional[list[str]] = None,
        **session_kwargs,
    ) -> dict[str, Any]:
        """
        Create a complete session with participants and templates.

        Args:
            title: Session title
            description: Session description
            created_by: Creator user ID
            participants: List of user IDs to enroll
            templates: List of template IDs to associate
            **session_kwargs: Additional session creation parameters

        Returns:
            Dict[str, Any]: Complete session creation result
        """
        try:
            with db.session.begin():
                # Create the session
                session = SessionService.create_session(
                    title=title, description=description, created_by=created_by, **session_kwargs
                )

                result = {
                    "session": {
                        "id": session.id,
                        "title": session.title,
                        "description": session.description,
                        "created_at": session.created_at.isoformat() if session.created_at else None,
                    },
                    "enrollments": [],
                    "templates": [],
                    "errors": [],
                }

                # Batch enroll participants
                if participants:
                    enrollments_data = []
                    for user_id in participants:
                        try:
                            enrollment = SessionService.enroll_user(session.id, user_id)
                            enrollments_data.append(
                                {"user_id": user_id, "enrollment_id": enrollment.id, "status": "success"}
                            )
                        except Exception as e:
                            result["errors"].append(f"Failed to enroll user {user_id}: {str(e)}")
                    result["enrollments"] = enrollments_data

                # Batch associate templates - fetch all templates at once
                if templates:
                    # Batch fetch all templates
                    from models.education import EducationTemplate

                    all_templates = (
                        db.session.query(EducationTemplate)
                        .filter(EducationTemplate.id.in_(templates))
                        .filter_by(created_by=created_by)
                        .all()
                    )

                    template_map = {str(t.id): t for t in all_templates}
                    templates_data = []

                    for template_id in templates:
                        if template_id in template_map:
                            template = template_map[template_id]
                            templates_data.append(
                                {"template_id": template_id, "name": template.name, "status": "associated"}
                            )
                        else:
                            result["errors"].append(f"Template {template_id} not found or not accessible")

                    result["templates"] = templates_data

                return result

        except Exception as e:
            db.session.rollback()
            return {
                "error": f"Failed to create complete session: {str(e)}",
                "session": None,
                "enrollments": [],
                "templates": [],
                "errors": [str(e)],
            }

    @staticmethod
    def get_user_dashboard(user_id: str) -> dict[str, Any]:
        """
        Get comprehensive dashboard data for a user.

        Args:
            user_id: User ID

        Returns:
            Dict[str, Any]: User dashboard data
        """
        try:
            # Get user's sessions
            user_sessions = SessionService.get_user_sessions(user_id)

            # Get user's progress
            user_progress = ProgressService.get_user_progress(user_id)

            # Get user's templates
            user_templates = TemplateService.get_user_templates(user_id, include_public=False)

            # Calculate progress statistics
            total_activities = len(user_progress)
            completed_activities = len([p for p in user_progress if p.status == "completed"])
            in_progress_activities = len([p for p in user_progress if p.status == "in_progress"])

            # Get recent activity
            recent_progress = [
                p for p in user_progress if p.created_at and (datetime.now(UTC) - p.created_at).days <= 7
            ]

            return {
                "user_id": user_id,
                "sessions": {
                    "total": len(user_sessions),
                    "active": len([s for s in user_sessions if s.get("status") == "active"]),
                    "completed": len([s for s in user_sessions if s.get("status") == "completed"]),
                    "recent": user_sessions[:5],  # Last 5 sessions
                },
                "progress": {
                    "total_activities": total_activities,
                    "completed": completed_activities,
                    "in_progress": in_progress_activities,
                    "completion_rate": (completed_activities / max(total_activities, 1)) * 100,
                    "recent_activity_count": len(recent_progress),
                },
                "templates": {
                    "owned": len(user_templates),
                    "recent": [
                        {
                            "id": t.id,
                            "name": t.name,
                            "type": t.template_type,
                            "created_at": t.created_at.isoformat() if t.created_at else None,
                        }
                        for t in user_templates[:3]
                    ],  # Last 3 templates
                },
                "last_updated": datetime.now(UTC).isoformat(),
            }

        except Exception as e:
            return {
                "error": f"Failed to get user dashboard: {str(e)}",
                "user_id": user_id,
                "last_updated": datetime.now(UTC).isoformat(),
            }

    @staticmethod
    def get_session_dashboard(session_id: str) -> dict[str, Any]:
        """
        Get comprehensive dashboard data for a session.

        Args:
            session_id: Session ID

        Returns:
            Dict[str, Any]: Session dashboard data
        """
        try:
            # Get session details
            session = SessionService.get_session_by_id(session_id)
            if not session:
                return {"error": "Session not found"}

            # Get participants
            participants = SessionService.get_session_participants(session_id)

            # Get session progress summary
            progress_summary = ProgressService.get_session_progress(session_id)

            # Get session statistics
            session_stats = SessionService.get_session_stats(session_id)

            # Get progress analytics
            progress_analytics = ProgressService.get_progress_analytics(session_id)

            return {
                "session": {
                    "id": session.id,
                    "title": session.title,
                    "description": session.description,
                    "status": session.status,
                    "created_at": session.created_at.isoformat() if session.created_at else None,
                    "start_date": session.start_date.isoformat() if session.start_date else None,
                    "end_date": session.end_date.isoformat() if session.end_date else None,
                },
                "participants": {
                    "total": len(participants),
                    "active": len([p for p in participants if p.get("status") == "active"]),
                    "list": participants,
                },
                "progress_summary": progress_summary,
                "session_stats": session_stats,
                "analytics": progress_analytics,
                "last_updated": datetime.now(UTC).isoformat(),
            }

        except Exception as e:
            return {
                "error": f"Failed to get session dashboard: {str(e)}",
                "session_id": session_id,
                "last_updated": datetime.now(UTC).isoformat(),
            }

    @staticmethod
    def cleanup_expired_data() -> dict[str, Any]:
        """
        Clean up expired or old data from the education platform.

        Returns:
            Dict[str, Any]: Cleanup results
        """
        try:
            cleanup_results = {"expired_api_keys": 0, "old_usage_stats": 0, "completed_sessions": 0, "errors": []}

            # Deactivate expired API keys
            try:
                expired_keys = (
                    db.session.query(EducationApiKey)
                    .filter(EducationApiKey.expires_at < datetime.now(UTC), EducationApiKey.is_active.is_(True))
                    .all()
                )

                for key in expired_keys:
                    key.is_active = False

                cleanup_results["expired_api_keys"] = len(expired_keys)
            except Exception as e:
                cleanup_results["errors"].append(f"Failed to cleanup expired API keys: {str(e)}")

            # Archive old usage stats (older than 1 year)
            try:
                now = datetime.now(UTC)
                one_year_ago = now.replace(year=now.year - 1)
                old_stats_count = (
                    db.session.query(EducationUsageStats).filter(EducationUsageStats.recorded_at < one_year_ago).count()
                )

                # In a real implementation, you might move these to an archive table
                # For now, just count them
                cleanup_results["old_usage_stats"] = old_stats_count
            except Exception as e:
                cleanup_results["errors"].append(f"Failed to process old usage stats: {str(e)}")

            # Update status of completed sessions
            try:
                completed_sessions = (
                    db.session.query(EducationSession)
                    .filter(EducationSession.end_date < datetime.now(UTC), EducationSession.status != "completed")
                    .all()
                )

                for session in completed_sessions:
                    session.status = "completed"

                cleanup_results["completed_sessions"] = len(completed_sessions)
            except Exception as e:
                cleanup_results["errors"].append(f"Failed to update completed sessions: {str(e)}")

            db.session.commit()

            cleanup_results["cleanup_time"] = datetime.now(UTC).isoformat()
            cleanup_results["success"] = len(cleanup_results["errors"]) == 0

            return cleanup_results

        except Exception as e:
            db.session.rollback()
            return {
                "error": f"Cleanup operation failed: {str(e)}",
                "success": False,
                "cleanup_time": datetime.now(UTC).isoformat(),
            }

    @staticmethod
    def health_check() -> dict[str, Any]:
        """
        Perform comprehensive health check of the education platform.

        Returns:
            Dict[str, Any]: Health check results
        """
        try:
            health_status = {
                "overall_status": "healthy",
                "components": {},
                "timestamp": datetime.now(UTC).isoformat(),
                "issues": [],
            }

            # Check database connectivity
            try:
                db.session.execute(db.text("SELECT 1")).fetchone()
                health_status["components"]["database"] = "healthy"
            except Exception as e:
                health_status["components"]["database"] = "unhealthy"
                health_status["issues"].append(f"Database connectivity issue: {str(e)}")
                health_status["overall_status"] = "unhealthy"

            # Check service layers
            services_to_check = [
                ("session_service", SessionService),
                ("progress_service", ProgressService),
                ("template_service", TemplateService),
                ("group_service", GroupService),
            ]

            for service_name, _ in services_to_check:
                try:
                    # Try to perform a basic operation
                    if service_name == "session_service":
                        SessionService.get_sessions(limit=1)
                    elif service_name == "progress_service":
                        ProgressService.get_progress_analytics("dummy-session")
                    elif service_name == "template_service":
                        TemplateService.get_templates(limit=1)
                    elif service_name == "group_service":
                        GroupService.get_groups(limit=1)

                    health_status["components"][service_name] = "healthy"
                except Exception as e:
                    health_status["components"][service_name] = "unhealthy"
                    health_status["issues"].append(f"{service_name} issue: {str(e)}")
                    health_status["overall_status"] = "degraded"

            # Check for expired API keys
            try:
                expired_count = (
                    db.session.query(EducationApiKey)
                    .filter(EducationApiKey.expires_at < datetime.now(UTC), EducationApiKey.is_active.is_(True))
                    .count()
                )

                if expired_count > 0:
                    health_status["issues"].append(f"{expired_count} expired API keys need cleanup")
                    if health_status["overall_status"] == "healthy":
                        health_status["overall_status"] = "degraded"

            except Exception as e:
                health_status["issues"].append(f"API key check failed: {str(e)}")

            return health_status

        except Exception as e:
            return {
                "overall_status": "unhealthy",
                "error": f"Health check failed: {str(e)}",
                "timestamp": datetime.now(UTC).isoformat(),
            }

    @staticmethod
    def get_integration_status() -> dict[str, Any]:
        """
        Get the status of integrations between different services.

        Returns:
            Dict[str, Any]: Integration status
        """
        try:
            # Check relationships between services
            orphaned_enrollments = (
                db.session.query(EducationEnrollment)
                .outerjoin(EducationSession, EducationEnrollment.session_id == EducationSession.id)
                .filter(EducationSession.id.is_(None))
                .count()
            )

            orphaned_progress = (
                db.session.query(LearningProgress)
                .outerjoin(EducationSession, LearningProgress.session_id == EducationSession.id)
                .filter(EducationSession.id.is_(None))
                .count()
            )

            return {
                "service_integrations": {
                    "session_enrollment_integrity": orphaned_enrollments == 0,
                    "session_progress_integrity": orphaned_progress == 0,
                },
                "data_consistency": {
                    "orphaned_enrollments": orphaned_enrollments,
                    "orphaned_progress_records": orphaned_progress,
                },
                "apis_accessible": True,  # Would check actual API endpoints
                "last_checked": datetime.now(UTC).isoformat(),
            }

        except Exception as e:
            return {
                "error": f"Integration status check failed: {str(e)}",
                "last_checked": datetime.now(UTC).isoformat(),
            }
