"""Tests for EduRoleService (AC7 - Backend Unit Tests)."""

import uuid
from unittest.mock import MagicMock, patch

import pytest

from services.edu_role_service import EduRoleService


class TestEduRoleService:
    """Test EduRoleService methods."""

    def test_get_user_role_returns_admin(self):
        """Admin 역할이 할당된 사용자는 'admin' 반환."""
        # Arrange
        session_id = str(uuid.uuid4())
        account_id = str(uuid.uuid4())

        mock_role = MagicMock()
        mock_role.role = "admin"

        mock_db_session = MagicMock()
        mock_query = mock_db_session.query.return_value
        mock_filter = mock_query.filter.return_value
        mock_filter.first.return_value = mock_role

        # Act
        result = EduRoleService.get_user_role(session_id=session_id, account_id=account_id, db_session=mock_db_session)

        # Assert
        assert result == "admin"
        mock_db_session.query.assert_called_once()

    def test_get_user_role_returns_normal_default(self):
        """역할이 할당되지 않은 사용자는 'normal' 기본값 반환."""
        # Arrange
        session_id = str(uuid.uuid4())
        account_id = str(uuid.uuid4())

        mock_db_session = MagicMock()
        mock_query = mock_db_session.query.return_value
        mock_filter = mock_query.filter.return_value
        mock_filter.first.return_value = None  # No role assigned

        # Act
        result = EduRoleService.get_user_role(session_id=session_id, account_id=account_id, db_session=mock_db_session)

        # Assert
        assert result == "normal"

    def test_assign_admin_role_success_with_admin_permission(self):
        """Admin 사용자의 admin 할당 → 성공 (AC9 - SEC-002 완화)."""
        # Arrange
        session_id = str(uuid.uuid4())
        target_account_id = str(uuid.uuid4())
        admin_account_id = str(uuid.uuid4())

        mock_role = MagicMock()
        mock_role.id = str(uuid.uuid4())
        mock_role.role = "admin"

        mock_db_session = MagicMock()

        with (
            patch("services.edu_role_service.EduRoleService.get_user_role") as mock_get_role,
            patch("services.edu_role_service.EduUserRole") as MockEduUserRole,
        ):
            # Admin 권한 확인
            mock_get_role.return_value = "admin"
            MockEduUserRole.return_value = mock_role

            # Act
            result = EduRoleService.assign_admin_role(
                session_id=session_id,
                account_id=target_account_id,
                assigned_by=admin_account_id,
                db_session=mock_db_session,
            )

            # Assert
            assert result is not None
            assert result.role == "admin"
            mock_get_role.assert_called_once_with(
                session_id=session_id, account_id=admin_account_id, db_session=mock_db_session
            )
            mock_db_session.add.assert_called_once()
            mock_db_session.commit.assert_called_once()

    def test_assign_admin_role_permission_denied(self):
        """권한 없는 사용자의 admin 할당 시도 → PermissionError (AC9 - SEC-002 완화)."""
        # Arrange
        session_id = str(uuid.uuid4())
        target_account_id = str(uuid.uuid4())
        normal_account_id = str(uuid.uuid4())

        mock_db_session = MagicMock()

        with patch("services.edu_role_service.EduRoleService.get_user_role") as mock_get_role:
            # Normal 사용자 권한 확인
            mock_get_role.return_value = "normal"

            # Act & Assert
            with pytest.raises(PermissionError) as exc_info:
                EduRoleService.assign_admin_role(
                    session_id=session_id,
                    account_id=target_account_id,
                    assigned_by=normal_account_id,
                    db_session=mock_db_session,
                )

            # 에러 메시지 검증
            assert "does not have permission" in str(exc_info.value)
            assert "normal" in str(exc_info.value)
            mock_db_session.add.assert_not_called()
            mock_db_session.commit.assert_not_called()

    def test_assign_admin_role_missing_parameters(self):
        """필수 파라미터 누락 시 ValueError 발생."""
        # Arrange
        mock_db_session = MagicMock()

        # Act & Assert
        with pytest.raises(ValueError) as exc_info:
            EduRoleService.assign_admin_role(
                session_id="",  # Empty session_id
                account_id="test-id",
                assigned_by="admin-id",
                db_session=mock_db_session,
            )

        assert "required" in str(exc_info.value)

    def test_assign_creator_admin_role_success(self):
        """세션 생성자에게 admin 역할 자동 할당 성공."""
        # Arrange
        session_id = str(uuid.uuid4())
        creator_account_id = str(uuid.uuid4())

        mock_role = MagicMock()
        mock_role.id = str(uuid.uuid4())
        mock_role.role = "admin"
        mock_role.assigned_by = None

        mock_db_session = MagicMock()

        with patch("services.edu_role_service.EduUserRole") as MockEduUserRole:
            MockEduUserRole.return_value = mock_role

            # Act
            result = EduRoleService.assign_creator_admin_role(
                session_id=session_id, account_id=creator_account_id, db_session=mock_db_session
            )

            # Assert
            assert result is not None
            assert result.role == "admin"
            assert result.assigned_by is None  # 시스템 자동 할당
            mock_db_session.add.assert_called_once()
            mock_db_session.commit.assert_called_once()

    def test_assign_creator_admin_role_missing_parameters(self):
        """세션 생성자 역할 할당 시 필수 파라미터 누락 → ValueError."""
        # Arrange
        mock_db_session = MagicMock()

        # Act & Assert
        with pytest.raises(ValueError) as exc_info:
            EduRoleService.assign_creator_admin_role(
                session_id="",  # Empty session_id
                account_id="test-id",
                db_session=mock_db_session,
            )

        assert "required" in str(exc_info.value)

    def test_assign_normal_role_success(self):
        """참가자에게 normal 역할 할당 성공."""
        # Arrange
        session_id = str(uuid.uuid4())
        account_id = str(uuid.uuid4())
        assigned_by = str(uuid.uuid4())

        mock_role = MagicMock()
        mock_role.id = str(uuid.uuid4())
        mock_role.role = "normal"
        mock_role.assigned_by = assigned_by

        mock_db_session = MagicMock()

        with patch("services.edu_role_service.EduUserRole") as MockEduUserRole:
            MockEduUserRole.return_value = mock_role

            # Act
            result = EduRoleService.assign_normal_role(
                session_id=session_id, account_id=account_id, assigned_by=assigned_by, db_session=mock_db_session
            )

            # Assert
            assert result is not None
            assert result.role == "normal"
            assert result.assigned_by == assigned_by
            mock_db_session.add.assert_called_once()
            mock_db_session.commit.assert_called_once()

    def test_assign_normal_role_missing_parameters(self):
        """Normal 역할 할당 시 필수 파라미터 누락 → ValueError."""
        # Arrange
        mock_db_session = MagicMock()

        # Act & Assert
        with pytest.raises(ValueError) as exc_info:
            EduRoleService.assign_normal_role(
                session_id="",  # Empty session_id
                account_id="test-id",
                assigned_by="admin-id",
                db_session=mock_db_session,
            )

        assert "required" in str(exc_info.value)
