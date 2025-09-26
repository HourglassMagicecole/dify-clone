"""
Session management service for educational platform.
"""

from datetime import datetime
from typing import Optional

from sqlalchemy.exc import IntegrityError

from extensions.ext_database import db
from models.education import EducationEnrollment, EducationSession
from models.model import Account


class SessionService:
    """Service for managing educational sessions."""

    @staticmethod
    def create_session(
        title: str,
        description: Optional[str] = None,
        created_by: Optional[str] = None,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
        max_participants: Optional[int] = None,
    ) -> EducationSession:
        """
        Create a new educational session.

        Args:
            title: Session title
            description: Session description
            created_by: User ID who created the session
            start_date: Session start date
            end_date: Session end date
            max_participants: Maximum number of participants

        Returns:
            EducationSession: Created session

        Raises:
            ValueError: If validation fails
        """
        try:
            session = EducationSession(
                title=title,
                description=description,
                created_by=created_by,
                start_date=start_date,
                end_date=end_date,
                max_participants=max_participants,
            )

            db.session.add(session)
            db.session.commit()

            return session

        except IntegrityError as e:
            db.session.rollback()
            raise ValueError(f"Session creation failed: {str(e)}")
        except Exception as e:
            db.session.rollback()
            raise e

    @staticmethod
    def get_sessions(limit: int = 20, offset: int = 0, status: Optional[str] = None) -> list[EducationSession]:
        """
        Get list of sessions with pagination and filtering.

        Args:
            limit: Number of sessions to return
            offset: Offset for pagination
            status: Filter by status (active, completed, etc.)

        Returns:
            List[EducationSession]: List of sessions
        """
        try:
            query = db.session.query(EducationSession)

            if status:
                query = query.filter(EducationSession.status == status)

            sessions = query.order_by(EducationSession.created_at.desc()).offset(offset).limit(limit).all()

            return sessions

        except Exception as e:
            raise e

    @staticmethod
    def get_session_by_id(session_id: str) -> Optional[EducationSession]:
        """
        Get session by ID.

        Args:
            session_id: Session ID

        Returns:
            Optional[EducationSession]: Session if found
        """
        try:
            return db.session.query(EducationSession).filter_by(id=session_id).first()
        except Exception as e:
            raise e

    @staticmethod
    def update_session(session_id: str, **kwargs) -> Optional[EducationSession]:
        """
        Update session information.

        Args:
            session_id: Session ID
            **kwargs: Fields to update

        Returns:
            Optional[EducationSession]: Updated session if found
        """
        try:
            session = db.session.query(EducationSession).filter_by(id=session_id).first()
            if not session:
                return None

            for key, value in kwargs.items():
                if hasattr(session, key):
                    setattr(session, key, value)

            db.session.commit()
            return session

        except Exception as e:
            db.session.rollback()
            raise e

    @staticmethod
    def delete_session(session_id: str) -> bool:
        """
        Delete a session and all associated enrollments.

        Args:
            session_id: Session ID

        Returns:
            bool: Success status
        """
        try:
            session = db.session.query(EducationSession).filter_by(id=session_id).first()
            if not session:
                return False

            # Delete all enrollments for this session
            db.session.query(EducationEnrollment).filter_by(session_id=session_id).delete()

            # Delete the session
            db.session.delete(session)
            db.session.commit()

            return True

        except Exception as e:
            db.session.rollback()
            raise e

    @staticmethod
    def enroll_user(session_id: str, user_id: str, role: str = "participant") -> EducationEnrollment:
        """
        Enroll a user in a session.

        Args:
            session_id: Session ID
            user_id: User ID to enroll
            role: User role in the session

        Returns:
            EducationEnrollment: Created enrollment

        Raises:
            ValueError: If enrollment fails
        """
        try:
            # Check if session exists
            session = db.session.query(EducationSession).filter_by(id=session_id).first()
            if not session:
                raise ValueError("Session not found")

            # Check if user exists
            user = db.session.query(Account).filter_by(id=user_id).first()
            if not user:
                raise ValueError("User not found")

            # Check if user is already enrolled
            existing = db.session.query(EducationEnrollment).filter_by(session_id=session_id, user_id=user_id).first()
            if existing:
                raise ValueError("User already enrolled in this session")

            # Check max participants
            if session.max_participants:
                current_count = db.session.query(EducationEnrollment).filter_by(session_id=session_id).count()
                if current_count >= session.max_participants:
                    raise ValueError("Session is full")

            enrollment = EducationEnrollment(session_id=session_id, user_id=user_id, role=role)

            db.session.add(enrollment)
            db.session.commit()

            return enrollment

        except IntegrityError as e:
            db.session.rollback()
            raise ValueError(f"Enrollment failed: {str(e)}")
        except Exception as e:
            db.session.rollback()
            raise e

    @staticmethod
    def unenroll_user(session_id: str, user_id: str) -> bool:
        """
        Remove user enrollment from session.

        Args:
            session_id: Session ID
            user_id: User ID to unenroll

        Returns:
            bool: Success status
        """
        try:
            enrollment = db.session.query(EducationEnrollment).filter_by(session_id=session_id, user_id=user_id).first()

            if enrollment:
                db.session.delete(enrollment)
                db.session.commit()
                return True
            return False

        except Exception as e:
            db.session.rollback()
            raise e

    @staticmethod
    def get_session_participants(session_id: str) -> list[dict]:
        """
        Get all participants of a session.

        Args:
            session_id: Session ID

        Returns:
            List[dict]: List of participants with their details
        """
        try:
            enrollments = (
                db.session.query(EducationEnrollment, Account)
                .join(Account, EducationEnrollment.user_id == Account.id)
                .filter(EducationEnrollment.session_id == session_id)
                .all()
            )

            participants = []
            for enrollment, user in enrollments:
                participants.append(
                    {
                        "user_id": user.id,
                        "name": user.name,
                        "email": user.email,
                        "role": enrollment.role,
                        "enrolled_at": enrollment.created_at,
                        "status": enrollment.status,
                    }
                )

            return participants

        except Exception as e:
            raise e

    @staticmethod
    def get_user_sessions(user_id: str, status: Optional[str] = None) -> list[dict]:
        """
        Get all sessions for a specific user.

        Args:
            user_id: User ID
            status: Filter by enrollment status

        Returns:
            List[dict]: List of sessions with enrollment details
        """
        try:
            query = (
                db.session.query(EducationEnrollment, EducationSession)
                .join(EducationSession, EducationEnrollment.session_id == EducationSession.id)
                .filter(EducationEnrollment.user_id == user_id)
            )

            if status:
                query = query.filter(EducationEnrollment.status == status)

            enrollments = query.order_by(EducationSession.created_at.desc()).all()

            sessions = []
            for enrollment, session in enrollments:
                sessions.append(
                    {
                        "session_id": session.id,
                        "title": session.title,
                        "description": session.description,
                        "start_date": session.start_date,
                        "end_date": session.end_date,
                        "status": session.status,
                        "role": enrollment.role,
                        "enrolled_at": enrollment.created_at,
                        "enrollment_status": enrollment.status,
                    }
                )

            return sessions

        except Exception as e:
            raise e

    @staticmethod
    def get_session_stats(session_id: str) -> dict:
        """
        Get statistics for a session.

        Args:
            session_id: Session ID

        Returns:
            dict: Session statistics
        """
        try:
            session = db.session.query(EducationSession).filter_by(id=session_id).first()
            if not session:
                raise ValueError("Session not found")

            total_enrolled = db.session.query(EducationEnrollment).filter_by(session_id=session_id).count()

            active_participants = (
                db.session.query(EducationEnrollment).filter_by(session_id=session_id, status="active").count()
            )

            return {
                "session_id": session_id,
                "total_enrolled": total_enrolled,
                "active_participants": active_participants,
                "max_participants": session.max_participants,
                "available_spots": (session.max_participants - total_enrolled) if session.max_participants else None,
            }

        except Exception as e:
            raise e
