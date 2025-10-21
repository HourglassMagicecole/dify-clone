"""
User Management Service Unit Tests
사용자 관리 서비스 단위 테스트
"""

from datetime import UTC, datetime
from unittest.mock import Mock, patch

import pytest

from models.account import Account, TenantAccountJoin
from models.education.user_role import EduUserRole
from services.education_management.user_management_service import UserManagementService


class TestUserManagementService:
    """UserManagementService 단위 테스트"""

    @pytest.fixture
    def service(self):
        """서비스 인스턴스 생성"""
        return UserManagementService()

    @pytest.fixture
    def mock_db_session(self, mocker):
        """DB 세션 Mock"""
        return mocker.patch("services.education_management.user_management_service.db.session")


class TestCreateUser:
    """사용자 생성 테스트"""

    @pytest.fixture
    def service(self):
        """서비스 인스턴스 생성"""
        return UserManagementService()

    @pytest.fixture
    def mock_db_session(self, mocker):
        """DB 세션 Mock"""
        return mocker.patch("services.education_management.user_management_service.db.session")

    def test_create_user_success(self, service, mock_db_session):
        """사용자 생성 성공 테스트"""
        # Arrange
        email = "test@example.com"
        name = "Test User"
        password = "password123"
        role = "student"

        # Mock creator account
        mock_creator = Mock(spec=Account)
        mock_creator.current_tenant_id = "tenant-123"

        # Mock: 이메일 중복 확인 (중복 없음)
        mock_db_session.query.return_value.filter_by.return_value.first.return_value = None

        # Act
        result = service.create_user(email, name, password, role, creator_account=mock_creator)

        # Assert
        assert result["email"] == email
        assert result["name"] == name
        assert result["status"] == "active"
        assert result["role"] == "student"  # normalized_role이 'normal'이지만, denormalize해서 'student' 반환
        assert "id" in result
        assert "created_at" in result
        # add should be called twice: once for Account, once for TenantAccountJoin
        assert mock_db_session.add.call_count == 2
        mock_db_session.commit.assert_called_once()

    def test_create_user_duplicate_email(self, service, mock_db_session):
        """중복 이메일로 사용자 생성 실패 테스트"""
        # Arrange
        email = "existing@example.com"
        mock_existing_user = Mock(spec=Account)
        mock_db_session.query.return_value.filter_by.return_value.first.return_value = mock_existing_user

        # Mock creator account
        mock_creator = Mock(spec=Account)
        mock_creator.current_tenant_id = "tenant-123"

        # Act & Assert
        with pytest.raises(ValueError, match="Email already exists"):
            service.create_user(email, "Name", "password", "student", creator_account=mock_creator)

        # Verify no add or commit was called
        mock_db_session.add.assert_not_called()
        mock_db_session.commit.assert_not_called()

    def test_create_user_admin_role(self, service, mock_db_session):
        """관리자 역할로 사용자 생성 테스트"""
        # Arrange
        email = "admin@example.com"
        name = "Admin User"
        password = "adminpass123"
        role = "admin"

        # Mock creator account
        mock_creator = Mock(spec=Account)
        mock_creator.current_tenant_id = "tenant-123"

        # Mock: 이메일 중복 확인 (중복 없음)
        mock_db_session.query.return_value.filter_by.return_value.first.return_value = None

        # Act
        result = service.create_user(email, name, password, role, creator_account=mock_creator)

        # Assert
        assert result["email"] == email
        assert result["name"] == name
        assert result["role"] == "admin"
        # add should be called twice: once for Account, once for TenantAccountJoin
        assert mock_db_session.add.call_count == 2
        mock_db_session.commit.assert_called_once()


class TestListUsers:
    """사용자 목록 조회 테스트"""

    @pytest.fixture
    def service(self):
        """서비스 인스턴스 생성"""
        return UserManagementService()

    @pytest.fixture
    def mock_db_session(self, mocker):
        """DB 세션 Mock"""
        return mocker.patch("services.education_management.user_management_service.db.session")

    def test_list_users_success(self, service, mock_db_session):
        """사용자 목록 조회 성공 테스트"""
        # Arrange
        mock_user1 = Mock(spec=Account)
        mock_user1.id = "user-1"
        mock_user1.email = "user1@test.com"
        mock_user1.name = "User 1"
        mock_user1.status = "active"
        mock_user1.created_at = datetime.now(UTC)
        mock_user1.last_login_at = None

        mock_user2 = Mock(spec=Account)
        mock_user2.id = "user-2"
        mock_user2.email = "user2@test.com"
        mock_user2.name = "User 2"
        mock_user2.status = "active"
        mock_user2.created_at = datetime.now(UTC)
        mock_user2.last_login_at = None

        # Mock query chain
        mock_query = Mock()
        mock_query.offset.return_value.limit.return_value.all.return_value = [mock_user1, mock_user2]
        mock_db_session.query.return_value = mock_query

        # Mock total count
        mock_db_session.query.return_value.scalar.return_value = 2

        # Mock role query (no roles)
        mock_db_session.query.return_value.filter_by.return_value.first.return_value = None

        # Act
        result = service.list_users(page=1, limit=20)

        # Assert
        assert len(result["users"]) == 2
        assert result["total"] == 2
        assert result["page"] == 1
        assert result["limit"] == 20

    def test_list_users_with_pagination(self, service, mock_db_session):
        """페이지네이션 테스트"""
        # Arrange
        mock_user = Mock(spec=Account)
        mock_user.id = "user-1"
        mock_user.email = "user1@test.com"
        mock_user.name = "User 1"
        mock_user.status = "active"
        mock_user.created_at = datetime.now(UTC)
        mock_user.last_login_at = None

        # Mock query chain
        mock_query = Mock()
        mock_query.offset.return_value.limit.return_value.all.return_value = [mock_user]
        mock_db_session.query.return_value = mock_query

        # Mock total count
        mock_db_session.query.return_value.scalar.return_value = 100

        # Mock role query
        mock_db_session.query.return_value.filter_by.return_value.first.return_value = None

        # Act
        result = service.list_users(page=2, limit=10)

        # Assert
        assert result["page"] == 2
        assert result["limit"] == 10
        assert result["total"] == 100
        # Verify offset was called with correct value (page 2 with limit 10 = offset 10)
        mock_query.offset.assert_called_once_with(10)
        mock_query.offset.return_value.limit.assert_called_once_with(10)


class TestGetUser:
    """특정 사용자 조회 테스트"""

    @pytest.fixture
    def service(self):
        """서비스 인스턴스 생성"""
        return UserManagementService()

    @pytest.fixture
    def mock_db_session(self, mocker):
        """DB 세션 Mock"""
        return mocker.patch("services.education_management.user_management_service.db.session")

    def test_get_user_success(self, service, mock_db_session):
        """사용자 조회 성공 테스트"""
        # Arrange
        user_id = "user-123"
        mock_user = Mock(spec=Account)
        mock_user.id = user_id
        mock_user.email = "user@test.com"
        mock_user.name = "Test User"
        mock_user.status = "active"
        mock_user.created_at = datetime.now(UTC)
        mock_user.last_login_at = None

        # Mock TenantAccountJoin (시스템 역할)
        mock_tenant_join = Mock(spec=TenantAccountJoin)
        mock_tenant_join.role = "normal"

        # Mock query
        def mock_query_side_effect(model):
            if model == Account:
                return Mock(filter_by=Mock(return_value=Mock(first=Mock(return_value=mock_user))))
            elif model == TenantAccountJoin:
                return Mock(filter_by=Mock(return_value=Mock(first=Mock(return_value=mock_tenant_join))))
            return Mock()

        mock_db_session.query.side_effect = mock_query_side_effect

        # Act
        result = service.get_user(user_id)

        # Assert
        assert result is not None
        assert result["id"] == user_id
        assert result["email"] == "user@test.com"
        assert result["name"] == "Test User"
        assert result["role"] == "student"  # 'normal' -> 'student' denormalized

    def test_get_user_not_found(self, service, mock_db_session):
        """사용자 없음 테스트"""
        # Arrange
        user_id = "nonexistent"
        mock_db_session.query.return_value.filter_by.return_value.first.return_value = None

        # Act
        result = service.get_user(user_id)

        # Assert
        assert result is None


class TestUpdateUser:
    """사용자 수정 테스트"""

    @pytest.fixture
    def service(self):
        """서비스 인스턴스 생성"""
        return UserManagementService()

    @pytest.fixture
    def mock_db_session(self, mocker):
        """DB 세션 Mock"""
        return mocker.patch("services.education_management.user_management_service.db.session")

    def test_update_user_name(self, service, mock_db_session):
        """사용자 이름 수정 테스트"""
        # Arrange
        user_id = "user-123"
        mock_user = Mock(spec=Account)
        mock_user.id = user_id
        mock_user.email = "user@test.com"
        mock_user.name = "Old Name"
        mock_user.status = "active"
        mock_user.created_at = datetime.now(UTC)
        mock_user.last_login_at = None

        # Mock TenantAccountJoin (non-owner)
        mock_tenant_join = Mock(spec=TenantAccountJoin)
        mock_tenant_join.role = "normal"

        # Mock query for update
        def mock_query_side_effect(model):
            if model == Account:
                return Mock(filter_by=Mock(return_value=Mock(first=Mock(return_value=mock_user))))
            elif model == TenantAccountJoin:
                return Mock(filter_by=Mock(return_value=Mock(first=Mock(return_value=mock_tenant_join))))
            return Mock()

        mock_db_session.query.side_effect = mock_query_side_effect

        # Mock get_user call at the end
        with patch.object(service, "get_user", return_value={"id": user_id, "name": "New Name"}):
            # Act
            result = service.update_user(user_id, {"name": "New Name"})

            # Assert
            assert mock_user.name == "New Name"
            mock_db_session.commit.assert_called_once()

    def test_update_user_status(self, service, mock_db_session):
        """사용자 상태 수정 테스트"""
        # Arrange
        user_id = "user-123"
        mock_user = Mock(spec=Account)
        mock_user.id = user_id
        mock_user.status = "active"
        mock_user.created_at = datetime.now(UTC)
        mock_user.last_login_at = None

        # Mock TenantAccountJoin (non-owner)
        mock_tenant_join = Mock(spec=TenantAccountJoin)
        mock_tenant_join.role = "normal"

        # Mock query
        def mock_query_side_effect(model):
            if model == Account:
                return Mock(filter_by=Mock(return_value=Mock(first=Mock(return_value=mock_user))))
            elif model == TenantAccountJoin:
                return Mock(filter_by=Mock(return_value=Mock(first=Mock(return_value=mock_tenant_join))))
            return Mock()

        mock_db_session.query.side_effect = mock_query_side_effect

        # Mock get_user call
        with patch.object(service, "get_user", return_value={"id": user_id, "status": "banned"}):
            # Act
            result = service.update_user(user_id, {"status": "banned"})

            # Assert
            assert mock_user.status == "banned"
            mock_db_session.commit.assert_called_once()

    def test_update_user_not_found(self, service, mock_db_session):
        """존재하지 않는 사용자 수정 실패 테스트"""
        # Arrange
        user_id = "nonexistent"
        mock_db_session.query.return_value.filter_by.return_value.first.return_value = None

        # Act & Assert
        with pytest.raises(ValueError, match="User not found"):
            service.update_user(user_id, {"name": "New Name"})

        mock_db_session.commit.assert_not_called()


class TestDeleteUser:
    """사용자 삭제 테스트"""

    @pytest.fixture
    def service(self):
        """서비스 인스턴스 생성"""
        return UserManagementService()

    @pytest.fixture
    def mock_db_session(self, mocker):
        """DB 세션 Mock"""
        return mocker.patch("services.education_management.user_management_service.db.session")

    def test_delete_user_without_resources(self, service, mock_db_session):
        """리소스 삭제 없이 사용자 삭제 테스트"""
        # Arrange
        user_id = "user-123"
        mock_user = Mock(spec=Account)
        mock_user.id = user_id

        # Mock TenantAccountJoin (non-owner)
        mock_tenant_join = Mock(spec=TenantAccountJoin)
        mock_tenant_join.role = "normal"

        # Mock query
        def mock_query_side_effect(model):
            if model == Account:
                return Mock(filter_by=Mock(return_value=Mock(first=Mock(return_value=mock_user))))
            elif model == TenantAccountJoin:
                return Mock(
                    filter_by=Mock(
                        return_value=Mock(first=Mock(return_value=mock_tenant_join), delete=Mock(return_value=None))
                    )
                )
            else:
                return Mock(filter_by=Mock(return_value=Mock(delete=Mock(return_value=None))))

        mock_db_session.query.side_effect = mock_query_side_effect

        # Act
        service.delete_user(user_id, delete_resources=False)

        # Assert
        mock_db_session.delete.assert_called_once_with(mock_user)
        mock_db_session.commit.assert_called_once()

    def test_delete_user_with_resources(self, service, mock_db_session):
        """리소스와 함께 사용자 삭제 테스트"""
        # Arrange
        user_id = "user-123"
        mock_user = Mock(spec=Account)
        mock_user.id = user_id

        # Mock TenantAccountJoin (non-owner)
        mock_tenant_join = Mock(spec=TenantAccountJoin)
        mock_tenant_join.role = "normal"

        # Mock query
        def mock_query_side_effect(model):
            if model == Account:
                return Mock(filter_by=Mock(return_value=Mock(first=Mock(return_value=mock_user))))
            elif model == TenantAccountJoin:
                return Mock(
                    filter_by=Mock(
                        return_value=Mock(first=Mock(return_value=mock_tenant_join), delete=Mock(return_value=None))
                    )
                )
            else:
                return Mock(filter_by=Mock(return_value=Mock(delete=Mock(return_value=None))))

        mock_db_session.query.side_effect = mock_query_side_effect

        # Act
        service.delete_user(user_id, delete_resources=True)

        # Assert
        mock_db_session.delete.assert_called_once_with(mock_user)
        mock_db_session.commit.assert_called_once()

    def test_delete_user_not_found(self, service, mock_db_session):
        """존재하지 않는 사용자 삭제 실패 테스트"""
        # Arrange
        user_id = "nonexistent"
        mock_db_session.query.return_value.filter_by.return_value.first.return_value = None

        # Act & Assert
        with pytest.raises(ValueError, match="User not found"):
            service.delete_user(user_id)

        mock_db_session.delete.assert_not_called()
        mock_db_session.commit.assert_not_called()


class TestAssignRole:
    """역할 할당 테스트"""

    @pytest.fixture
    def service(self):
        """서비스 인스턴스 생성"""
        return UserManagementService()

    @pytest.fixture
    def mock_db_session(self, mocker):
        """DB 세션 Mock"""
        return mocker.patch("services.education_management.user_management_service.db.session")

    @patch("models.education.session.EducationSession")
    def test_assign_role_new(self, mock_education_session, service, mock_db_session):
        """새로운 역할 할당 테스트"""
        # Arrange
        account_id = "user-123"
        session_id = "session-456"
        role = "admin"

        mock_user = Mock(spec=Account)
        mock_user.id = account_id

        mock_session = Mock()
        mock_session.id = session_id

        # Mock queries
        def mock_query_side_effect(model):
            if model == Account:
                return Mock(filter_by=Mock(return_value=Mock(first=Mock(return_value=mock_user))))
            elif model == mock_education_session:
                return Mock(filter_by=Mock(return_value=Mock(first=Mock(return_value=mock_session))))
            elif model == EduUserRole:
                # No existing role
                return Mock(filter_by=Mock(return_value=Mock(first=Mock(return_value=None))))
            return Mock()

        mock_db_session.query.side_effect = mock_query_side_effect

        # Act
        result = service.assign_role(account_id, session_id, role)

        # Assert
        assert result["account_id"] == account_id
        assert result["session_id"] == session_id
        assert result["role"] == "admin"
        assert result["message"] == "Role assigned successfully"
        mock_db_session.add.assert_called_once()
        mock_db_session.commit.assert_called_once()

    @patch("models.education.session.EducationSession")
    def test_assign_role_update_existing(self, mock_education_session, service, mock_db_session):
        """기존 역할 업데이트 테스트"""
        # Arrange
        account_id = "user-123"
        session_id = "session-456"
        role = "admin"

        mock_user = Mock(spec=Account)
        mock_user.id = account_id

        mock_existing_role = Mock(spec=EduUserRole)
        mock_existing_role.role = "normal"

        mock_session = Mock()
        mock_session.id = session_id

        # Mock queries
        def mock_query_side_effect(model):
            if model == Account:
                return Mock(filter_by=Mock(return_value=Mock(first=Mock(return_value=mock_user))))
            elif model == mock_education_session:
                return Mock(filter_by=Mock(return_value=Mock(first=Mock(return_value=mock_session))))
            elif model == EduUserRole:
                # Existing role found
                return Mock(filter_by=Mock(return_value=Mock(first=Mock(return_value=mock_existing_role))))
            return Mock()

        mock_db_session.query.side_effect = mock_query_side_effect

        # Act
        result = service.assign_role(account_id, session_id, role)

        # Assert
        assert mock_existing_role.role == "admin"  # normalized
        assert result["role"] == "admin"  # denormalized
        mock_db_session.add.assert_not_called()  # No new role added
        mock_db_session.commit.assert_called_once()

    def test_assign_role_user_not_found(self, service, mock_db_session):
        """사용자 없음 - 역할 할당 실패 테스트"""
        # Arrange
        account_id = "nonexistent"
        session_id = "session-456"
        role = "admin"

        # Mock query - user not found
        mock_db_session.query.return_value.filter_by.return_value.first.return_value = None

        # Act & Assert
        with pytest.raises(ValueError, match="User not found"):
            service.assign_role(account_id, session_id, role)

        mock_db_session.add.assert_not_called()
        mock_db_session.commit.assert_not_called()

    @patch("models.education.session.EducationSession")
    def test_assign_role_session_not_found(self, mock_education_session, service, mock_db_session):
        """세션 없음 - 역할 할당 실패 테스트"""
        # Arrange
        account_id = "user-123"
        session_id = "nonexistent"
        role = "admin"

        mock_user = Mock(spec=Account)
        mock_user.id = account_id

        # Mock queries
        def mock_query_side_effect(model):
            if model == Account:
                return Mock(filter_by=Mock(return_value=Mock(first=Mock(return_value=mock_user))))
            elif model == mock_education_session:
                # Session not found
                return Mock(filter_by=Mock(return_value=Mock(first=Mock(return_value=None))))
            return Mock()

        mock_db_session.query.side_effect = mock_query_side_effect

        # Act & Assert
        with pytest.raises(ValueError, match="Session not found"):
            service.assign_role(account_id, session_id, role)

        mock_db_session.add.assert_not_called()
        mock_db_session.commit.assert_not_called()


class TestRoleNormalization:
    """역할 정규화/비정규화 테스트"""

    def test_normalize_role_student(self):
        """'student' -> 'normal' 정규화 테스트"""
        assert UserManagementService._normalize_role("student") == "normal"

    def test_normalize_role_admin(self):
        """'admin' -> 'admin' 정규화 테스트"""
        assert UserManagementService._normalize_role("admin") == "admin"

    def test_normalize_role_none(self):
        """None -> 'normal' 정규화 테스트"""
        assert UserManagementService._normalize_role(None) == "normal"

    def test_denormalize_role_normal(self):
        """'normal' -> 'student' 비정규화 테스트"""
        assert UserManagementService._denormalize_role("normal") == "student"

    def test_denormalize_role_admin(self):
        """'admin' -> 'admin' 비정규화 테스트"""
        assert UserManagementService._denormalize_role("admin") == "admin"

    def test_denormalize_role_none(self):
        """None -> None 비정규화 테스트"""
        assert UserManagementService._denormalize_role(None) is None
