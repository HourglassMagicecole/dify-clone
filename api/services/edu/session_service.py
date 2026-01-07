"""Education session service for managing sessions."""

from datetime import UTC, date, datetime, timedelta
from typing import Any, Optional

from sqlalchemy import select, update

from configs import dify_config
from extensions.ext_database import db
from models.account import Account, TenantAccountJoin, TenantAccountRole
from models.education import ApiUsageLog
from models.education.session import EducationSession
from models.education.session_member import MemberStatus

# Sentinel value to distinguish "not provided" from "provided as None"
# Exported for use in API layer
UNSET: Any = object()


class EduSessionService:
    """Service for managing education sessions."""

    def create_session(
        self,
        session_name: str,
        session_tag: str,
        start_date: datetime,
        tenant_id: str,
        instructor_account_id: str,
        end_date: Optional[datetime] = None,
        max_students: int = 50,
        description: Optional[str] = None,
    ) -> EducationSession:
        """
        Create a new education session.

        Args:
            session_name: Session name
            session_tag: Unique session tag for resource filtering
            start_date: Session start date
            tenant_id: Tenant ID
            instructor_account_id: Instructor (creator) account ID
            end_date: Session end date (optional)
            max_students: Maximum number of students (default: 50)
            description: Session description (optional)

        Returns:
            Created EducationSession object

        Raises:
            ValueError: If session_tag already exists
            Exception: If database operation fails
        """
        # 1. Check if session_tag already exists
        existing_session = db.session.scalar(
            select(EducationSession).where(EducationSession.session_tag == session_tag)
        )
        if existing_session:
            raise ValueError(f"Session tag '{session_tag}' already exists")

        # 2. Create session object
        session = EducationSession(
            session_name=session_name,
            session_tag=session_tag,
            tenant_id=tenant_id,
            instructor_account_id=instructor_account_id,
            start_date=start_date,
            end_date=end_date,
            max_students=max_students,
            description=description,
        )

        # 3. Save to database
        db.session.add(session)
        db.session.flush()  # Generate ID

        # 4. Add creator as session member (AC 8)
        from services.edu_session_member_service import EduSessionMemberService

        EduSessionMemberService.add_member(session.id, instructor_account_id, db.session)  # type: ignore[arg-type]

        # 5. Commit transaction
        db.session.commit()

        return session

    def get_session(self, session_id: str) -> EducationSession:
        """
        Get a session by ID.

        Args:
            session_id: Session ID

        Returns:
            EducationSession object

        Raises:
            ValueError: If session not found
        """
        session = db.session.get(EducationSession, session_id)
        if not session:
            raise ValueError(f"Session not found: {session_id}")

        return session

    def list_sessions(
        self,
        current_user: Account,
        is_active: Optional[bool] = None,
        instructor_account_id: Optional[str] = None,
        page: int = 1,
        limit: int = 20,
    ) -> dict:
        """
        List education sessions with pagination and permission filtering.

        Args:
            current_user: 현재 사용자 (Account 객체)
            is_active: Filter by active status (None = all)
            instructor_account_id: Filter by instructor account ID (None = all)
            page: Page number (starts from 1)
            limit: Items per page

        Returns:
            {
                "sessions": [EducationSession, ...],
                "total": int,
                "page": int,
                "limit": int
            }

        Permission Logic:
            - Owner: 모든 세션 조회 (필터 없음)
            - Admin: instructor_account_id = current_user.id 자동 필터링
            - Others (Editor, Normal 등): 자신이 멤버로 등록된 세션만 조회
        """
        # Get user's role
        tenant_join = db.session.query(TenantAccountJoin).filter_by(account_id=current_user.id, current=True).first()

        if not tenant_join:
            tenant_join = db.session.query(TenantAccountJoin).filter_by(account_id=current_user.id).first()

        if tenant_join:
            role = TenantAccountRole(tenant_join.role)

            # Owner와 Admin이 아닌 모든 역할(Editor, Normal 등)은 멤버십 기반 필터링
            if role not in [TenantAccountRole.OWNER, TenantAccountRole.ADMIN]:
                return self.list_sessions_by_member(
                    account_id=current_user.id, is_active=is_active, page=page, limit=limit
                )

        # Build query for Owner/Admin
        query = select(EducationSession)

        # Permission filtering: Admin은 자신이 생성한 세션만 조회
        if tenant_join:
            role = TenantAccountRole(tenant_join.role)
            # Admin은 자신이 생성한 세션만
            if role == TenantAccountRole.ADMIN:
                query = query.where(EducationSession.instructor_account_id == current_user.id)
            # Owner는 모든 세션 조회 (필터 없음)

        # Filter by is_active if specified
        # Uses force_status + date-based activation check
        if is_active is not None:
            from services.edu.session_helper import build_session_active_condition

            query = query.where(build_session_active_condition() == is_active)

        # Filter by instructor_account_id if specified
        # (Owner가 특정 관리자의 세션만 보고 싶을 때 사용)
        if instructor_account_id is not None:
            query = query.where(EducationSession.instructor_account_id == instructor_account_id)

        # Order by created_at descending
        query = query.order_by(EducationSession.created_at.desc())

        # Count total
        total = db.session.scalar(select(db.func.count()).select_from(query.subquery()))

        # Apply pagination
        offset = (page - 1) * limit
        query = query.offset(offset).limit(limit)

        # Execute query
        sessions = list(db.session.scalars(query).all())

        return {
            "sessions": sessions,
            "total": total or 0,
            "page": page,
            "limit": limit,
        }

    def list_sessions_by_member(
        self,
        account_id: str,
        is_active: Optional[bool] = None,
        page: int = 1,
        limit: int = 20,
    ) -> dict:
        """
        List sessions where the account is a member.

        Args:
            account_id: Account ID to filter by membership
            is_active: Filter by active status (None = all)
            page: Page number (starts from 1)
            limit: Items per page

        Returns:
            {
                "sessions": [EducationSession, ...],
                "total": int,
                "page": int,
                "limit": int
            }
        """
        from models.education.session_member import EducationSessionMember

        # Build query - join with EducationSessionMember
        query = (
            select(EducationSession)
            .join(EducationSessionMember, EducationSession.id == EducationSessionMember.session_id)
            .where(
                EducationSessionMember.account_id == account_id,
                EducationSessionMember.status == MemberStatus.ACTIVE.value,
            )
        )

        # Filter by is_active if specified
        # Uses force_status + date-based activation check
        if is_active is not None:
            from services.edu.session_helper import build_session_active_condition

            query = query.where(build_session_active_condition() == is_active)

        # Order by created_at descending
        query = query.order_by(EducationSession.created_at.desc())

        # Count total
        total = db.session.scalar(select(db.func.count()).select_from(query.subquery()))

        # Apply pagination
        offset = (page - 1) * limit
        query = query.offset(offset).limit(limit)

        # Execute query
        sessions = list(db.session.scalars(query).all())

        return {
            "sessions": sessions,
            "total": total or 0,
            "page": page,
            "limit": limit,
        }

    def update_session(
        self,
        session_id: str,
        session_name: Optional[str] = None,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
        max_students: Optional[int] = None,
        force_status: Optional[bool] = UNSET,  # Use UNSET to distinguish None from not-provided
        description: Optional[str] = None,
    ) -> EducationSession:
        """
        Update a session.

        Args:
            session_id: Session ID
            session_name: New session name (optional)
            start_date: New start date (optional)
            end_date: New end date (optional)
            max_students: New max students (optional)
            force_status: Override date-based activation (optional)
                - None: auto (date-based)
                - True: force active
                - False: force inactive
                - UNSET: not provided, don't update
            description: New description (optional)

        Returns:
            Updated EducationSession object

        Raises:
            ValueError: If session not found
        """
        session = self.get_session(session_id)

        # Update fields if provided
        if session_name is not None:
            session.session_name = session_name
        if start_date is not None:
            session.start_date = start_date
        if end_date is not None:
            session.end_date = end_date
            # Task 18.6: Set retention_until for all logs in this session
            review_period = dify_config.USAGE_LOG_REVIEW_PERIOD_DAYS
            retention_date = end_date.date() + timedelta(days=review_period)
            db.session.execute(
                update(ApiUsageLog).where(ApiUsageLog.session_id == session_id).values(retention_until=retention_date)
            )
        if max_students is not None:
            session.max_students = max_students
        # Default session must always be active (force_status=True cannot be changed)
        if force_status is not UNSET and not session.is_default:
            session.force_status = force_status
        if description is not None:
            session.description = description

        db.session.commit()

        return session

    def delete_session(self, session_id: str) -> bool:
        """
        Delete a session.

        Args:
            session_id: Session ID

        Returns:
            True if deleted

        Raises:
            ValueError: If session not found or is the default session

        Note:
            Related session members will be deleted automatically (CASCADE).
            Default sessions (is_default=True) cannot be deleted.
            Task 18.7: Before deletion, sets retention_until for logs without it.
        """
        session = self.get_session(session_id)

        if session.is_default:
            raise ValueError("Default session cannot be deleted")

        # Task 18.7: Set retention_until for logs that don't have it yet
        review_period = dify_config.USAGE_LOG_REVIEW_PERIOD_DAYS
        end_date = session.end_date.date() if session.end_date else date.today()
        retention_date = end_date + timedelta(days=review_period)
        db.session.execute(
            update(ApiUsageLog)
            .where(
                ApiUsageLog.session_id == session_id,
                ApiUsageLog.retention_until.is_(None),
            )
            .values(retention_until=retention_date)
        )

        db.session.delete(session)
        db.session.commit()

        return True

    def get_session_members(self, session_id: str) -> list:
        """
        Get all members of a session.

        Args:
            session_id: Session ID

        Returns:
            List of dicts with member info: [
                {
                    "account_id": str,
                    "name": str,
                    "email": str,
                    "status": str,
                    "joined_at": str (ISO 8601)
                },
                ...
            ]
        """
        from services.edu_session_member_service import EduSessionMemberService

        members = EduSessionMemberService.get_session_members(session_id, db.session)  # type: ignore[arg-type]

        # Convert to dict format
        result = []
        for member in members:
            result.append(
                {
                    "account_id": member.account_id,
                    "name": member.account.name,
                    "email": member.account.email,
                    "status": member.status,
                    "joined_at": member.joined_at.replace(tzinfo=UTC).isoformat(),
                }
            )

        return result

    def add_session_member(
        self,
        session_id: str,
        account_id: str,
        tenant_id: str | None = None,
        created_by: str | None = None,
    ) -> bool:
        """
        Add a member to a session.

        Args:
            session_id: Session ID
            account_id: Account ID to add
            tenant_id: Tenant ID (optional, for auto quota apply)
            created_by: Creator account ID (optional, for auto quota apply)

        Returns:
            True if added

        Raises:
            ValueError: If session not found or account not found
        """
        from services.edu_session_member_service import EduSessionMemberService

        # Verify session exists
        self.get_session(session_id)

        # Add member (with optional auto quota apply)
        EduSessionMemberService.add_member(
            session_id,
            account_id,
            db.session,  # type: ignore[arg-type]
            tenant_id=tenant_id,
            created_by=created_by,
        )

        return True

    def remove_session_member(self, session_id: str, account_id: str) -> bool:
        """
        Remove a member from a session.

        Args:
            session_id: Session ID
            account_id: Account ID to remove

        Returns:
            True if removed, False if member not found

        Raises:
            ValueError: If session not found
        """
        from services.edu_session_member_service import EduSessionMemberService

        # Verify session exists
        self.get_session(session_id)

        # Remove member
        return EduSessionMemberService.remove_member(session_id, account_id, db.session)  # type: ignore[arg-type]
