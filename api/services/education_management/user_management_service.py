"""User management service for education system."""

import base64
import secrets
import uuid
from datetime import UTC, datetime
from typing import Any

from sqlalchemy import func

from extensions.ext_database import db
from libs.password import hash_password
from models.account import Account, TenantAccountJoin, TenantAccountRole
from models.education.user_role import EduUserRole


class UserManagementService:
    """
    사용자 관리 서비스.

    교육 시스템에서 사용자 계정을 생성, 조회, 수정, 삭제하는 서비스입니다.
    """

    @staticmethod
    def _normalize_role(role: str | None) -> str:
        """
        역할을 정규화합니다.

        프론트엔드에서는 'student'를 사용하지만, 데이터베이스에서는 'normal'을 사용합니다.
        호환성을 위해 'student' -> 'normal'로 매핑합니다.

        Args:
            role: 역할 ('admin', 'student', 'normal', None)

        Returns:
            정규화된 역할 ('admin' 또는 'normal')
        """
        if role == "student":
            return "normal"
        if role == "admin":
            return "admin"
        return "normal"  # 기본값

    @staticmethod
    def _denormalize_role(role: str | None) -> str | None:
        """
        역할을 비정규화합니다.

        데이터베이스의 'normal', 'editor'를 프론트엔드의 'student'로 변환합니다.

        Args:
            role: 역할 ('owner', 'admin', 'editor', 'normal', None)

        Returns:
            비정규화된 역할 ('owner', 'admin', 'student', None)
        """
        if role in {"normal", "editor"}:
            return "student"
        return role

    @staticmethod
    def _can_admin_manage_user(admin_account_id: str, target_user_id: str) -> bool:
        """
        Admin이 특정 사용자를 관리할 권한이 있는지 확인.

        Admin은 다음 경우에 사용자를 관리할 수 있음:
        1. 직접 생성한 사용자 (created_by = admin_id)
        2. 자신이 생성한 세션의 멤버

        Args:
            admin_account_id: Admin 계정 ID
            target_user_id: 대상 사용자 ID

        Returns:
            bool: 권한이 있으면 True, 없으면 False
        """
        # 1. created_by 확인
        user = db.session.get(Account, target_user_id)
        if user and user.created_by == admin_account_id:
            return True

        # 2. 세션 멤버십 확인
        from models.education.session import EducationSession
        from models.education.session_member import EducationSessionMember

        # Admin이 생성한 세션의 멤버인지 확인
        is_member = (
            db.session.query(EducationSessionMember)
            .join(EducationSession, EducationSessionMember.session_id == EducationSession.id)
            .filter(
                EducationSession.instructor_account_id == admin_account_id,
                EducationSessionMember.account_id == target_user_id,
                EducationSessionMember.status == "active",
            )
            .first()
        )

        return is_member is not None

    def list_users(self, current_user: Account, page: int = 1, limit: int = 20) -> dict[str, Any]:
        """
        사용자 목록 조회 (권한 기반 필터링).

        Args:
            current_user: 현재 사용자 (Account 객체)
            page: 페이지 번호 (1부터 시작)
            limit: 페이지당 사용자 수

        Returns:
            사용자 목록 및 페이지네이션 정보

        Permission Logic:
            - Owner: 모든 사용자 조회
            - Admin: 다음 사용자 조회 가능
              1. created_by = current_user.id (직접 생성한 사용자)
              2. 자신이 생성한 세션의 멤버
        """
        offset = (page - 1) * limit

        # 사용자 목록 조회 (권한 필터링 추가)
        users_query = db.session.query(Account)

        # Permission filtering
        tenant_join = db.session.query(TenantAccountJoin).filter_by(account_id=current_user.id, current=True).first()

        if not tenant_join:
            tenant_join = db.session.query(TenantAccountJoin).filter_by(account_id=current_user.id).first()

        role = None
        if tenant_join:
            role = TenantAccountRole(tenant_join.role)
            # Admin은 다음 사용자들 조회 가능:
            # 1. 자신이 생성한 사용자 (created_by)
            # 2. 자신이 생성한 세션의 멤버
            if role == TenantAccountRole.ADMIN:
                from models.education.session import EducationSession
                from models.education.session_member import EducationSessionMember

                # Admin이 생성한 세션 ID 목록
                admin_session_ids_subquery = (
                    db.session.query(EducationSession.id)
                    .filter(EducationSession.instructor_account_id == current_user.id)
                    .subquery()
                )

                # 세션 멤버 account_id 목록
                session_member_ids_subquery = (
                    db.session.query(EducationSessionMember.account_id)
                    .filter(
                        EducationSessionMember.session_id.in_(admin_session_ids_subquery),  # type: ignore[arg-type]
                        EducationSessionMember.status == "active",
                    )
                    .subquery()
                )

                # created_by = current_user.id OR id IN (session members)
                users_query = users_query.filter(
                    db.or_(
                        Account.created_by == current_user.id,
                        Account.id.in_(session_member_ids_subquery),  # type: ignore[arg-type]
                    )
                )
            # Owner는 모든 사용자 조회 (필터 없음)

        # 페이지네이션 적용
        users_query = users_query.offset(offset).limit(limit)
        users = users_query.all()

        # 전체 사용자 수 (권한 필터링 적용)
        total_query = db.session.query(func.count(Account.id))
        if tenant_join and role == TenantAccountRole.ADMIN:
            from models.education.session import EducationSession
            from models.education.session_member import EducationSessionMember

            admin_session_ids_subquery = (
                db.session.query(EducationSession.id)
                .filter(EducationSession.instructor_account_id == current_user.id)
                .subquery()
            )
            session_member_ids_subquery = (
                db.session.query(EducationSessionMember.account_id)
                .filter(
                    EducationSessionMember.session_id.in_(admin_session_ids_subquery),  # type: ignore[arg-type]
                    EducationSessionMember.status == "active",
                )
                .subquery()
            )
            total_query = total_query.filter(
                db.or_(
                    Account.created_by == current_user.id,
                    Account.id.in_(session_member_ids_subquery),  # type: ignore[arg-type]
                )
            )
        total = total_query.scalar() or 0

        # 사용자 데이터 변환
        user_list = []
        for user in users:
            user_dict: dict[str, Any] = {
                "id": user.id,
                "email": user.email,
                "name": user.name,
                "status": user.status,
                "created_by": user.created_by,
                "created_at": user.created_at.isoformat() if user.created_at else None,
                "last_login_at": user.last_login_at.isoformat() if user.last_login_at else None,
            }

            # 생성자 정보 추가 (created_by가 있을 경우)
            if user.created_by:
                creator = db.session.get(Account, user.created_by)
                if creator:
                    user_dict["created_by_name"] = creator.name
                    user_dict["created_by_email"] = creator.email
                else:
                    user_dict["created_by_name"] = None
                    user_dict["created_by_email"] = None
            else:
                user_dict["created_by_name"] = None
                user_dict["created_by_email"] = None

            # 시스템 역할 정보 추가 (TenantAccountJoin에서 조회)
            tenant_join_user = db.session.query(TenantAccountJoin).filter_by(account_id=user.id).first()
            if tenant_join_user:
                user_dict["role"] = self._denormalize_role(tenant_join_user.role)

            user_list.append(user_dict)

        return {"users": user_list, "total": total, "page": page, "limit": limit}

    def create_user(
        self,
        email: str,
        name: str,
        password: str,
        role: str | None = "student",
        session_id: str | None = None,
        creator_account: Account | None = None,
    ) -> dict[str, Any]:
        """
        새 사용자 생성.

        Args:
            email: 이메일 주소
            name: 사용자 이름
            password: 비밀번호 (평문, 암호화하여 저장)
            role: 역할 ('admin' 또는 'student', 기본값: 'student')
            session_id: 세션 ID (선택적, 지정하면 자동으로 세션 멤버로 추가)
            creator_account: 사용자를 생성하는 관리자 계정 (Tenant 멤버십 생성에 사용)

        Returns:
            생성된 사용자 정보

        Raises:
            ValueError: 이메일이 이미 존재하거나 creator_account가 없거나 owner 역할로 생성하려는 경우
        """
        # Owner 역할 생성 방지
        if role and role.lower() == "owner":
            raise ValueError("Cannot create user with 'owner' role. Owner role is reserved for tenant creators.")

        # 이메일 중복 확인
        existing_user = db.session.query(Account).filter_by(email=email).first()
        if existing_user:
            raise ValueError(f"Email already exists: {email}")

        # creator_account 확인
        if not creator_account:
            raise ValueError("creator_account is required to create user")

        # creator의 tenant_id 및 역할 가져오기
        # JWT 인증에서는 current_tenant_id가 설정되지 않을 수 있으므로 TenantAccountJoin에서 조회
        creator_tenant_id = creator_account.current_tenant_id
        creator_join = None
        if not creator_tenant_id:
            # TenantAccountJoin에서 조회
            creator_join = db.session.query(TenantAccountJoin).filter_by(account_id=creator_account.id).first()
            if not creator_join:
                raise ValueError("Creator account is not a member of any tenant")
            creator_tenant_id = creator_join.tenant_id
        else:
            # creator_join이 없으면 조회
            creator_join = db.session.query(TenantAccountJoin).filter_by(account_id=creator_account.id).first()

        # Admin 권한 검증: Admin은 student만 생성 가능
        if creator_join and role and role.lower() == "admin":
            creator_role = TenantAccountRole(creator_join.role)
            if creator_role == TenantAccountRole.ADMIN:
                raise ValueError("Admin users can only create 'student' role users. Only owner can create admin users.")

        # 역할 정규화
        normalized_role = self._normalize_role(role)

        # 비밀번호 해싱 (Dify 방식: PBKDF2-HMAC-SHA256 + base64)
        salt = secrets.token_bytes(16)
        base64_salt = base64.b64encode(salt).decode()
        password_hashed = hash_password(password, salt)
        base64_password_hashed = base64.b64encode(password_hashed).decode()

        # Account 생성
        account = Account(
            id=str(uuid.uuid4()),
            email=email,
            name=name,
            password=base64_password_hashed,
            password_salt=base64_salt,
            interface_language="ko-KR",  # 기본 언어 설정 (Agent 생성 시 default_language로 사용됨)
            timezone="Asia/Seoul",  # 기본 시간대 설정 (워크플로우 시간 표시에 사용됨)
            status="active",
            created_by=creator_account.id,  # 생성자 ID 저장
            created_at=datetime.now(UTC),
        )
        db.session.add(account)
        db.session.flush()  # ID 생성

        # TenantAccountJoin 생성 (로그인을 위해 필수)
        # 로그인 시 TenantService.get_join_tenants()에서 이 레코드를 조회하여 tenant를 찾음
        # NOTE: admin은 admin 역할, 학생은 editor 역할로 생성하여 Agent를 생성할 수 있도록 함
        system_role = "admin" if normalized_role == "admin" else "editor"
        tenant_join = TenantAccountJoin(
            id=str(uuid.uuid4()),
            tenant_id=creator_tenant_id,
            account_id=account.id,
            role=system_role,  # admin이면 admin, 학생이면 editor (Agent 생성 권한)
            created_at=datetime.now(UTC),
        )
        db.session.add(tenant_join)

        # 세션 ID가 제공된 경우 자동으로 세션 멤버로 추가
        if session_id:
            from models.education.session import EducationSession
            from models.education.session_member import EducationSessionMember

            # 세션 존재 확인
            session = db.session.query(EducationSession).filter_by(id=session_id).first()
            if not session:
                db.session.rollback()
                raise ValueError(f"Session not found: {session_id}")

            # 세션 멤버 추가
            session_member = EducationSessionMember(
                id=str(uuid.uuid4()),
                session_id=session_id,
                account_id=account.id,
                joined_at=datetime.now(UTC),
                status="active",
                created_at=datetime.now(UTC),
            )
            db.session.add(session_member)

        db.session.commit()

        return {
            "id": account.id,
            "email": account.email,
            "name": account.name,
            "status": account.status,
            "role": self._denormalize_role(normalized_role),
            "created_at": account.created_at.isoformat(),
        }

    def get_user(self, user_id: str) -> dict[str, Any] | None:
        """
        특정 사용자 조회.

        Args:
            user_id: 사용자 ID

        Returns:
            사용자 정보 또는 None
        """
        user = db.session.query(Account).filter_by(id=user_id).first()
        if not user:
            return None

        # 시스템 역할 정보 추가 (TenantAccountJoin에서 조회)
        tenant_join = db.session.query(TenantAccountJoin).filter_by(account_id=user.id).first()
        role = self._denormalize_role(tenant_join.role) if tenant_join else None

        return {
            "id": user.id,
            "email": user.email,
            "name": user.name,
            "status": user.status,
            "role": role,
            "created_at": user.created_at.isoformat() if user.created_at else None,
            "last_login_at": user.last_login_at.isoformat() if user.last_login_at else None,
        }

    def update_user(
        self, user_id: str, updates: dict[str, Any], updater_account: Account | None = None
    ) -> dict[str, Any]:
        """
        사용자 정보 수정 (권한 검증 포함).

        Args:
            user_id: 사용자 ID
            updates: 수정할 필드 딕셔너리 (name, status, role, password)
            updater_account: 수정을 수행하는 관리자 계정 (권한 검증)

        Returns:
            수정된 사용자 정보

        Raises:
            ValueError: 사용자를 찾을 수 없거나 권한이 없는 경우

        Permission Logic:
            - Owner: 모든 사용자 수정 가능
            - Admin: 다음 사용자만 수정 가능
              1. created_by = updater_account.id (직접 생성한 사용자)
              2. 자신이 생성한 세션의 멤버
        """
        user = db.session.query(Account).filter_by(id=user_id).first()
        if not user:
            raise ValueError(f"User not found: {user_id}")

        # 권한 검증 (Owner/Admin 권한 구분)
        if updater_account:
            tenant_join = (
                db.session.query(TenantAccountJoin).filter_by(account_id=updater_account.id, current=True).first()
            )

            if not tenant_join:
                tenant_join = db.session.query(TenantAccountJoin).filter_by(account_id=updater_account.id).first()

            if tenant_join:
                role = TenantAccountRole(tenant_join.role)
                # Admin은 자신이 생성한 사용자 또는 자신의 세션 멤버만 수정 가능
                if role == TenantAccountRole.ADMIN:
                    if not self._can_admin_manage_user(updater_account.id, user_id):
                        raise ValueError(
                            "Permission denied: You can only update users you created or members of your sessions"
                        )
                # Owner는 모든 사용자 수정 가능 (권한 체크 스킵)

        # 수정자 권한 확인
        if updater_account:
            updater_join = db.session.query(TenantAccountJoin).filter_by(account_id=updater_account.id).first()
            updater_role = updater_join.role if updater_join else None

            # 자기 자신의 role/status 변경 방지
            if user_id == updater_account.id:
                if "role" in updates:
                    raise ValueError("Cannot change your own role")
                if "status" in updates:
                    raise ValueError("Cannot change your own status")

            # Owner만 role 변경 가능 (Admin은 status 변경 가능)
            if "role" in updates and updater_role != "owner":
                raise ValueError("Only owner can change user role")

        # Owner 보호: 역할과 상태 변경 금지 (Owner 본인만 이름/비밀번호 변경 가능)
        tenant_join = db.session.query(TenantAccountJoin).filter_by(account_id=user.id).first()
        if tenant_join and tenant_join.role == "owner":
            if "role" in updates:
                raise ValueError("Cannot change owner role")
            if "status" in updates:
                raise ValueError("Cannot change owner status")

        # Account 필드 수정
        if "name" in updates:
            user.name = updates["name"]
        if "status" in updates:
            user.status = updates["status"]

        # 비밀번호 수정
        if "password" in updates:
            password = updates["password"]
            # 비밀번호 해싱 (Dify 방식: PBKDF2-HMAC-SHA256 + base64)
            salt = secrets.token_bytes(16)
            base64_salt = base64.b64encode(salt).decode()
            password_hashed = hash_password(password, salt)
            base64_password_hashed = base64.b64encode(password_hashed).decode()
            user.password = base64_password_hashed
            user.password_salt = base64_salt

        # 시스템 역할 수정 (TenantAccountJoin.role)
        if "role" in updates:
            normalized_role = self._normalize_role(updates["role"])
            # TenantAccountJoin에서 사용자의 역할 조회 및 수정
            if tenant_join:
                tenant_join.role = normalized_role
            else:
                raise ValueError(f"User {user_id} is not a member of any tenant")

        db.session.commit()

        return self.get_user(user_id)  # type: ignore[return-value]

    def delete_user(self, user_id: str, delete_resources: bool = True, deleter_account: Account | None = None) -> None:
        """
        사용자 삭제 (권한 검증 포함).

        Args:
            user_id: 사용자 ID
            delete_resources: 관련 리소스(App, Dataset, Conversation) 삭제 여부
            deleter_account: 삭제를 수행하는 관리자 계정 (자기 자신 삭제 방지)

        Raises:
            ValueError: 사용자를 찾을 수 없거나 권한이 없는 경우

        Permission Logic:
            - Owner: 모든 사용자 삭제 가능
            - Admin: 다음 사용자만 삭제 가능
              1. created_by = deleter_account.id (직접 생성한 사용자)
              2. 자신이 생성한 세션의 멤버
        """
        user = db.session.query(Account).filter_by(id=user_id).first()
        if not user:
            raise ValueError(f"User not found: {user_id}")

        # 권한 검증 (Owner/Admin 권한 구분)
        if deleter_account:
            tenant_join = (
                db.session.query(TenantAccountJoin).filter_by(account_id=deleter_account.id, current=True).first()
            )

            if not tenant_join:
                tenant_join = db.session.query(TenantAccountJoin).filter_by(account_id=deleter_account.id).first()

            if tenant_join:
                role = TenantAccountRole(tenant_join.role)
                # Admin은 자신이 생성한 사용자 또는 자신의 세션 멤버만 삭제 가능
                if role == TenantAccountRole.ADMIN:
                    if not self._can_admin_manage_user(deleter_account.id, user_id):
                        raise ValueError(
                            "Permission denied: You can only delete users you created or members of your sessions"
                        )
                # Owner는 모든 사용자 삭제 가능 (권한 체크 스킵)

        # 자기 자신 삭제 방지
        if deleter_account and user_id == deleter_account.id:
            raise ValueError("Cannot delete your own account")

        # Owner 보호: 삭제 금지
        tenant_join = db.session.query(TenantAccountJoin).filter_by(account_id=user.id).first()
        if tenant_join and tenant_join.role == "owner":
            raise ValueError("Cannot delete owner account")

        if delete_resources:
            # 사용자가 생성한 리소스 삭제
            from models.dataset import Dataset
            from models.model import App, Conversation

            # App 삭제 (사용자가 생성한 애플리케이션)
            db.session.query(App).filter_by(created_by=user_id).delete(synchronize_session=False)

            # Dataset 삭제 (사용자가 생성한 데이터셋)
            db.session.query(Dataset).filter_by(created_by=user_id).delete(synchronize_session=False)

            # Conversation 삭제 (사용자가 참여한 대화)
            db.session.query(Conversation).filter_by(from_account_id=user_id).delete(synchronize_session=False)

        # EduUserRole 삭제
        db.session.query(EduUserRole).filter_by(account_id=user.id).delete(synchronize_session=False)

        # Account 삭제
        db.session.delete(user)
        db.session.commit()

    def assign_role(self, account_id: str, session_id: str, role: str) -> dict[str, Any]:
        """
        사용자에게 역할 할당.

        Args:
            account_id: 사용자 ID
            session_id: 교육 세션 ID
            role: 역할 ('admin' 또는 'student')

        Returns:
            역할 할당 결과

        Raises:
            ValueError: 사용자 또는 세션을 찾을 수 없는 경우
        """
        # 사용자 존재 확인
        user = db.session.query(Account).filter_by(id=account_id).first()
        if not user:
            raise ValueError(f"User not found: {account_id}")

        # 세션 존재 확인
        from models.education.session import EducationSession

        session = db.session.query(EducationSession).filter_by(id=session_id).first()
        if not session:
            raise ValueError(f"Session not found: {session_id}")

        # 역할 정규화
        normalized_role = self._normalize_role(role)

        # 기존 역할 확인
        existing_role = db.session.query(EduUserRole).filter_by(account_id=account_id, session_id=session_id).first()

        if existing_role:
            # 역할 업데이트
            existing_role.role = normalized_role
            existing_role.updated_at = datetime.now(UTC)
        else:
            # 새 역할 생성
            new_role = EduUserRole(
                id=str(uuid.uuid4()),
                account_id=account_id,
                session_id=session_id,
                role=normalized_role,
                assigned_at=datetime.now(UTC),
                created_at=datetime.now(UTC),
            )
            db.session.add(new_role)

        db.session.commit()

        return {
            "account_id": account_id,
            "session_id": session_id,
            "role": self._denormalize_role(normalized_role),
            "message": "Role assigned successfully",
        }
