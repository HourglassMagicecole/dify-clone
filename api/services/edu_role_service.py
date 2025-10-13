"""Education role service for session-based RBAC management."""

import logging
from datetime import UTC, datetime
from typing import Optional

from sqlalchemy.orm import Session

from models.education import EduUserRole

logger = logging.getLogger(__name__)


class EduRoleService:
    """
    Service for managing education session roles.

    This service provides independent role management for educational sessions,
    completely separate from Dify's tenant-based RBAC system.
    """

    @staticmethod
    def get_user_role(session_id: str, account_id: str, db_session: Session) -> str:
        """
        특정 세션에서 사용자의 역할을 조회합니다.

        Args:
            session_id: 교육 세션 ID
            account_id: 사용자 계정 ID
            db_session: SQLAlchemy 세션

        Returns:
            'admin' 또는 'normal' (기본값: 'normal')
        """
        role_record = (
            db_session.query(EduUserRole)
            .filter(EduUserRole.session_id == session_id, EduUserRole.account_id == account_id)
            .first()
        )

        if role_record:
            return role_record.role

        # 역할이 할당되지 않은 경우 기본값 반환
        return "normal"

    @staticmethod
    def assign_admin_role(session_id: str, account_id: str, assigned_by: str, db_session: Session) -> EduUserRole:
        """
        관리자 역할 할당 (권한 검증 포함).

        CRITICAL (AC9 - SEC-002 완화): 이 메서드는 호출자의 admin 권한을 검증합니다.
        권한이 없는 사용자의 호출을 차단하여 권한 상승 공격을 방지합니다.

        Args:
            session_id: 교육 세션 ID
            account_id: 할당 받을 사용자 계정 ID
            assigned_by: 할당하는 사용자 ID (REQUIRED - 권한 검증용)
            db_session: SQLAlchemy 세션

        Returns:
            생성된 EduUserRole 객체

        Raises:
            PermissionError: 할당자가 admin 권한이 없는 경우
            ValueError: session_id, account_id, assigned_by가 누락된 경우

        Security:
            - SEC-002 완화: 호출자의 권한을 먼저 검증
            - 보안 이벤트 로깅: 권한 검증 실패 및 성공 시 로그 기록
        """
        if not session_id or not account_id or not assigned_by:
            raise ValueError("session_id, account_id, and assigned_by are required")

        # CRITICAL (AC9): 할당자가 admin 권한을 가지고 있는지 검증
        assigner_role = EduRoleService.get_user_role(
            session_id=session_id, account_id=assigned_by, db_session=db_session
        )

        if assigner_role != "admin":
            # 보안 이벤트 로깅 (OPS-002 완화)
            logger.warning(
                "Permission denied: User %s (role: %s) attempted to assign admin role to %s in session %s",
                assigned_by,
                assigner_role,
                account_id,
                session_id,
                extra={
                    "event_type": "security",
                    "user_id": assigned_by,
                    "target_user_id": account_id,
                    "session_id": session_id,
                    "action": "assign_admin_role_denied",
                    "current_role": assigner_role,
                },
            )
            raise PermissionError(
                f"User {assigned_by} does not have permission to assign admin role. Current role: {assigner_role}"
            )

        # 권한 검증 통과 후 역할 할당
        role = EduUserRole(
            session_id=session_id,
            account_id=account_id,
            role="admin",
            assigned_by=assigned_by,
            assigned_at=datetime.now(UTC),
        )

        db_session.add(role)
        db_session.commit()
        db_session.refresh(role)

        # 보안 감사 로깅 (OPS-002 완화)
        logger.info(
            "Admin role assigned to %s in session %s by %s",
            account_id,
            session_id,
            assigned_by,
            extra={
                "event_type": "audit",
                "user_id": account_id,
                "assigned_by": assigned_by,
                "session_id": session_id,
                "action": "assign_admin_role_success",
                "role_id": role.id,
            },
        )

        return role

    @staticmethod
    def assign_creator_admin_role(session_id: str, account_id: str, db_session: Session) -> EduUserRole:
        """
        세션 생성자에게 admin 역할 자동 할당 (시스템 호출 전용).

        이 메서드는 권한 검증을 하지 않으며, 오직 세션 생성 시에만 호출되어야 합니다.
        일반 사용자가 이 메서드를 호출하는 것을 방지하기 위해, 이 메서드는
        세션 생성 로직 내부에서만 호출되어야 합니다.

        Args:
            session_id: 교육 세션 ID
            account_id: 세션 생성자 계정 ID
            db_session: SQLAlchemy 세션

        Returns:
            생성된 EduUserRole 객체

        Raises:
            ValueError: session_id, account_id가 누락된 경우

        Note:
            Story 1.1/1.6에서 세션 생성 API 구현 시 이 메서드를 호출하세요.
        """
        if not session_id or not account_id:
            raise ValueError("session_id and account_id are required")

        role = EduUserRole(
            session_id=session_id,
            account_id=account_id,
            role="admin",
            assigned_by=None,  # 시스템 자동 할당
            assigned_at=datetime.now(UTC),
        )

        db_session.add(role)
        db_session.commit()
        db_session.refresh(role)

        # 시스템 자동 할당 로깅
        logger.info(
            "Creator admin role auto-assigned to %s in session %s",
            account_id,
            session_id,
            extra={
                "event_type": "audit",
                "user_id": account_id,
                "session_id": session_id,
                "action": "assign_creator_admin_role_success",
                "role_id": role.id,
            },
        )

        return role

    @staticmethod
    def assign_normal_role(
        session_id: str, account_id: str, assigned_by: Optional[str], db_session: Session
    ) -> EduUserRole:
        """
        참가자에게 normal 역할 할당.

        Args:
            session_id: 교육 세션 ID
            account_id: 사용자 계정 ID
            assigned_by: 할당한 관리자 ID (optional, bulk creation 시 None 가능)
            db_session: SQLAlchemy 세션

        Returns:
            생성된 EduUserRole 객체

        Raises:
            ValueError: session_id, account_id가 누락된 경우
        """
        if not session_id or not account_id:
            raise ValueError("session_id and account_id are required")

        role = EduUserRole(
            session_id=session_id,
            account_id=account_id,
            role="normal",
            assigned_by=assigned_by,
            assigned_at=datetime.now(UTC),
        )

        db_session.add(role)
        db_session.commit()
        db_session.refresh(role)

        logger.info(
            "Normal role assigned to %s in session %s by %s",
            account_id,
            session_id,
            assigned_by or "system",
            extra={
                "event_type": "audit",
                "user_id": account_id,
                "assigned_by": assigned_by,
                "session_id": session_id,
                "action": "assign_normal_role_success",
                "role_id": role.id,
            },
        )

        return role
