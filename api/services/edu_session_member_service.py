"""Education session member service."""

from datetime import UTC, datetime

from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from sqlalchemy.orm import Session

from models.account import Account, TenantAccountJoin, TenantAccountRole
from models.education import EducationSessionMember, MemberStatus


class EduSessionMemberService:
    """Service for managing education session members."""

    @staticmethod
    def add_member(session_id: str, account_id: str, db_session: Session) -> EducationSessionMember:
        """
        Add a member to a session.

        Args:
            session_id: The session ID
            account_id: The account ID to add
            db_session: Database session

        Returns:
            EducationSessionMember: The created or existing member

        Raises:
            Exception: If database operation fails
        """
        try:
            # Check if member already exists
            existing_member = (
                db_session.query(EducationSessionMember)
                .filter(
                    EducationSessionMember.session_id == session_id,
                    EducationSessionMember.account_id == account_id,
                )
                .first()
            )

            if existing_member:
                # If member was removed, reactivate them
                if existing_member.status == MemberStatus.REMOVED.value:
                    existing_member.status = MemberStatus.ACTIVE.value
                    existing_member.updated_at = datetime.now(UTC)
                    db_session.commit()
                return existing_member

            # Create new member
            new_member = EducationSessionMember(
                session_id=session_id, account_id=account_id, status=MemberStatus.ACTIVE.value
            )

            db_session.add(new_member)
            db_session.commit()

            return new_member

        except IntegrityError as e:
            db_session.rollback()
            # Foreign key violation or unique constraint violation
            raise ValueError(f"Invalid session_id or account_id, or member already exists: {e}") from e
        except SQLAlchemyError as e:
            db_session.rollback()
            raise RuntimeError(f"Database error while adding member: {e}") from e

    @staticmethod
    def remove_member(session_id: str, account_id: str, db_session: Session) -> bool:
        """
        Remove a member from a session (soft delete).

        Args:
            session_id: The session ID
            account_id: The account ID to remove
            db_session: Database session

        Returns:
            bool: True if member was removed, False if member not found

        Raises:
            Exception: If database operation fails
        """
        try:
            member = (
                db_session.query(EducationSessionMember)
                .filter(
                    EducationSessionMember.session_id == session_id,
                    EducationSessionMember.account_id == account_id,
                )
                .first()
            )

            if not member:
                return False

            # Soft delete: update status to removed
            member.status = MemberStatus.REMOVED.value
            member.updated_at = datetime.now(UTC)

            db_session.commit()

            return True

        except SQLAlchemyError as e:
            db_session.rollback()
            raise RuntimeError(f"Database error while removing member: {e}") from e

    @staticmethod
    def get_session_members(
        session_id: str, db_session: Session, status: str | None = None
    ) -> list[EducationSessionMember]:
        """
        Get all members of a session.

        Args:
            session_id: The session ID
            db_session: Database session
            status: Filter by status (default: None for active members, pass None explicitly for all statuses)

        Returns:
            list[EducationSessionMember]: List of members
        """
        # Default to active members if no status specified
        if status is None:
            status = MemberStatus.ACTIVE.value
        query = db_session.query(EducationSessionMember).filter(EducationSessionMember.session_id == session_id)

        # Filter by status
        query = query.filter(EducationSessionMember.status == status)

        return query.order_by(EducationSessionMember.joined_at.asc()).all()

    @staticmethod
    def is_session_member(session_id: str, account_id: str, db_session: Session) -> bool:
        """
        Check if an account is a member of a session.

        Permission Logic:
            - Owner: 모든 세션 접근 가능 (멤버십 체크 스킵)
            - Admin/Normal: 세션 멤버만 접근 가능

        Args:
            session_id: The session ID
            account_id: The account ID to check
            db_session: Database session

        Returns:
            bool: True if member or owner, False otherwise
        """
        # 1. 소유자 체크
        account = db_session.get(Account, account_id)
        if account:
            tenant_join = db_session.query(TenantAccountJoin).filter_by(account_id=account.id, current=True).first()

            if not tenant_join:
                tenant_join = db_session.query(TenantAccountJoin).filter_by(account_id=account.id).first()

            if tenant_join:
                role = TenantAccountRole(tenant_join.role)
                # 소유자는 모든 세션 접근 가능
                if role == TenantAccountRole.OWNER:
                    return True

        # 2. 멤버십 체크 (Admin, Normal User)
        member = (
            db_session.query(EducationSessionMember)
            .filter(
                EducationSessionMember.session_id == session_id,
                EducationSessionMember.account_id == account_id,
                EducationSessionMember.status == MemberStatus.ACTIVE.value,
            )
            .first()
        )

        return member is not None
