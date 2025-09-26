"""
Progress tracking service for educational platform.
"""

from datetime import UTC, datetime
from typing import Optional

from sqlalchemy import case, func
from sqlalchemy.exc import IntegrityError

from extensions.ext_database import db
from models.education import EducationEnrollment, LearningProgress
from models.model import Account


class ProgressService:
    """Service for managing learning progress tracking."""

    @staticmethod
    def record_progress(
        user_id: str,
        session_id: str,
        module_type: str,
        module_id: str,
        progress_data: Optional[dict] = None,
        status: str = "in_progress",
    ) -> LearningProgress:
        """
        Record learning progress for a user.

        Args:
            user_id: User ID
            session_id: Session ID
            module_type: Type of module (workflow, agent, rag, etc.)
            module_id: Unique ID for the specific module
            progress_data: Additional progress data as JSON
            status: Status (in_progress, completed, failed)

        Returns:
            LearningProgress: Created progress record

        Raises:
            ValueError: If validation fails
        """
        try:
            # Verify user is enrolled in session
            enrollment = db.session.query(EducationEnrollment).filter_by(user_id=user_id, session_id=session_id).first()

            if not enrollment:
                raise ValueError("User is not enrolled in this session")

            # Check if progress record already exists
            existing = (
                db.session.query(LearningProgress)
                .filter_by(user_id=user_id, session_id=session_id, module_type=module_type, module_id=module_id)
                .first()
            )

            if existing:
                # Update existing progress
                existing.progress_data = progress_data
                existing.status = status
                existing.updated_at = datetime.now(UTC)

                if status == "completed" and not existing.completed_at:
                    existing.completed_at = datetime.now(UTC)
                    existing.progress_percentage = 100.0

                db.session.commit()
                return existing
            else:
                # Create new progress record
                progress_percentage = 100.0 if status == "completed" else 0.0
                completed_at = datetime.now(UTC) if status == "completed" else None

                progress = LearningProgress(
                    user_id=user_id,
                    session_id=session_id,
                    module_type=module_type,
                    module_id=module_id,
                    progress_data=progress_data,
                    status=status,
                    progress_percentage=progress_percentage,
                    completed_at=completed_at,
                )

                db.session.add(progress)
                db.session.commit()

                return progress

        except IntegrityError as e:
            db.session.rollback()
            raise ValueError(f"Progress recording failed: {str(e)}")
        except Exception as e:
            db.session.rollback()
            raise e

    @staticmethod
    def update_progress(
        progress_id: str,
        progress_percentage: Optional[float] = None,
        status: Optional[str] = None,
        progress_data: Optional[dict] = None,
    ) -> Optional[LearningProgress]:
        """
        Update existing progress record.

        Args:
            progress_id: Progress record ID
            progress_percentage: New progress percentage (0-100)
            status: New status
            progress_data: Updated progress data

        Returns:
            Optional[LearningProgress]: Updated progress record if found
        """
        try:
            progress = db.session.query(LearningProgress).filter_by(id=progress_id).first()
            if not progress:
                return None

            if progress_percentage is not None:
                progress.progress_percentage = max(0, min(100, progress_percentage))

            if status is not None:
                progress.status = status
                if status == "completed":
                    progress.progress_percentage = 100.0
                    if not progress.completed_at:
                        progress.completed_at = datetime.now(UTC)

            if progress_data is not None:
                progress.progress_data = progress_data

            progress.updated_at = datetime.now(UTC)
            db.session.commit()

            return progress

        except Exception as e:
            db.session.rollback()
            raise e

    @staticmethod
    def get_user_progress(
        user_id: str, session_id: Optional[str] = None, module_type: Optional[str] = None
    ) -> list[LearningProgress]:
        """
        Get progress records for a user.

        Args:
            user_id: User ID
            session_id: Filter by session ID (optional)
            module_type: Filter by module type (optional)

        Returns:
            List[LearningProgress]: List of progress records
        """
        try:
            query = db.session.query(LearningProgress).filter_by(user_id=user_id)

            if session_id:
                query = query.filter_by(session_id=session_id)

            if module_type:
                query = query.filter_by(module_type=module_type)

            return query.order_by(LearningProgress.created_at.desc()).all()

        except Exception as e:
            raise e

    @staticmethod
    def get_session_progress(session_id: str) -> list[dict]:
        """
        Get progress summary for all users in a session.

        Args:
            session_id: Session ID

        Returns:
            List[Dict]: List of user progress summaries
        """
        try:
            # Get all enrolled users and their progress
            results = (
                db.session.query(
                    Account.id,
                    Account.name,
                    Account.email,
                    func.count(LearningProgress.id).label("total_activities"),
                    func.sum(case((LearningProgress.status == "completed", 1), else_=0)).label(
                        "completed_activities"
                    ),
                    func.avg(LearningProgress.progress_percentage).label("avg_completion"),
                )
                .join(EducationEnrollment, Account.id == EducationEnrollment.user_id)
                .outerjoin(
                    LearningProgress,
                    db.and_(Account.id == LearningProgress.user_id, LearningProgress.session_id == session_id),
                )
                .filter(EducationEnrollment.session_id == session_id)
                .group_by(Account.id, Account.name, Account.email)
                .all()
            )

            progress_summary = []
            for result in results:
                progress_summary.append(
                    {
                        "user_id": result.id,
                        "name": result.name,
                        "email": result.email,
                        "total_activities": result.total_activities or 0,
                        "completed_activities": result.completed_activities or 0,
                        "average_completion": float(result.avg_completion or 0),
                        "completion_rate": (
                            (result.completed_activities or 0) / max(result.total_activities or 1, 1) * 100
                        ),
                    }
                )

            return progress_summary

        except Exception as e:
            raise e

    @staticmethod
    def get_activity_progress(session_id: str, module_type: str, module_id: str) -> list[dict]:
        """
        Get progress for a specific activity across all users.

        Args:
            session_id: Session ID
            module_type: Module type
            module_id: Module ID

        Returns:
            List[Dict]: List of user progress for the activity
        """
        try:
            results = (
                db.session.query(LearningProgress, Account.name, Account.email)
                .join(Account, LearningProgress.user_id == Account.id)
                .filter(
                    LearningProgress.session_id == session_id,
                    LearningProgress.module_type == module_type,
                    LearningProgress.module_id == module_id,
                )
                .all()
            )

            activity_progress = []
            for progress, name, email in results:
                activity_progress.append(
                    {
                        "user_id": progress.user_id,
                        "name": name,
                        "email": email,
                        "progress_percentage": progress.progress_percentage,
                        "status": progress.status,
                        "started_at": progress.created_at,
                        "completed_at": progress.completed_at,
                        "progress_data": progress.progress_data,
                    }
                )

            return activity_progress

        except Exception as e:
            raise e

    @staticmethod
    def get_progress_analytics(session_id: str) -> dict:
        """
        Get analytics and statistics for session progress.

        Args:
            session_id: Session ID

        Returns:
            Dict: Progress analytics data
        """
        try:
            # Get overall statistics
            total_users = db.session.query(EducationEnrollment).filter_by(session_id=session_id).count()

            total_activities = db.session.query(LearningProgress).filter_by(session_id=session_id).count()

            completed_activities = (
                db.session.query(LearningProgress)
                .filter_by(session_id=session_id, completion_status="completed")
                .count()
            )

            # Get activity type breakdown
            activity_types = (
                db.session.query(
                    LearningProgress.module_type,
                    func.count(LearningProgress.id).label("count"),
                    func.avg(LearningProgress.progress_percentage).label("avg_completion"),
                )
                .filter_by(session_id=session_id)
                .group_by(LearningProgress.module_type)
                .all()
            )

            activity_breakdown = {}
            for module_type, count, avg_completion in activity_types:
                activity_breakdown[module_type] = {
                    "total_attempts": count,
                    "average_completion": float(avg_completion or 0),
                }

            # Get daily progress (last 7 days)
            from datetime import timedelta

            end_date = datetime.now(UTC)
            start_date = end_date - timedelta(days=7)

            daily_progress = (
                db.session.query(
                    func.date(LearningProgress.created_at).label("date"),
                    func.count(LearningProgress.id).label("activities_started"),
                    func.sum(case((LearningProgress.status == "completed", 1), else_=0)).label(
                        "activities_completed"
                    ),
                )
                .filter(LearningProgress.session_id == session_id, LearningProgress.created_at >= start_date)
                .group_by(func.date(LearningProgress.created_at))
                .order_by(func.date(LearningProgress.created_at))
                .all()
            )

            daily_stats = []
            for date, started, completed in daily_progress:
                daily_stats.append(
                    {
                        "date": date.isoformat() if date else None,
                        "activities_started": started or 0,
                        "activities_completed": completed or 0,
                    }
                )

            return {
                "session_id": session_id,
                "total_users": total_users,
                "total_activities": total_activities,
                "completed_activities": completed_activities,
                "completion_rate": (completed_activities / max(total_activities, 1)) * 100,
                "activity_breakdown": activity_breakdown,
                "daily_progress": daily_stats,
            }

        except Exception as e:
            raise e

    @staticmethod
    def delete_progress(progress_id: str) -> bool:
        """
        Delete a progress record.

        Args:
            progress_id: Progress record ID

        Returns:
            bool: Success status
        """
        try:
            progress = db.session.query(LearningProgress).filter_by(id=progress_id).first()
            if not progress:
                return False

            db.session.delete(progress)
            db.session.commit()

            return True

        except Exception as e:
            db.session.rollback()
            raise e

    @staticmethod
    def bulk_update_progress(updates: list[dict]) -> dict:
        """
        Bulk update multiple progress records.

        Args:
            updates: List of progress update dictionaries

        Returns:
            Dict: Summary of updates
        """
        try:
            updated_count = 0
            errors = []

            for update in updates:
                try:
                    progress_id = update.get("progress_id")
                    if not progress_id:
                        errors.append("Missing progress_id in update")
                        continue

                    progress = ProgressService.update_progress(
                        progress_id=progress_id,
                        progress_percentage=update.get("progress_percentage"),
                        status=update.get("status"),
                        progress_data=update.get("progress_data"),
                    )

                    if progress:
                        updated_count += 1
                    else:
                        errors.append(f"Progress record {progress_id} not found")

                except Exception as e:
                    errors.append(f"Error updating {progress_id}: {str(e)}")

            return {"updated_count": updated_count, "total_requested": len(updates), "errors": errors}

        except Exception as e:
            raise e
