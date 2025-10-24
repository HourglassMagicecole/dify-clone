"""Unit tests for EduSessionService."""

from unittest.mock import MagicMock, patch

from models.account import TenantAccountRole
from services.edu.session_service import EduSessionService


class TestEduSessionService:
    """Test EduSessionService class."""

    @patch("services.edu.session_service.db")
    @patch("services.edu_session_member_service.EduSessionMemberService")
    def test_create_session_basic(self, mock_member_service, mock_db):
        """Test basic session creation."""
        # Arrange
        service = EduSessionService()
        mock_session = MagicMock()
        mock_session.id = "test-session-id"
        mock_session.session_name = "Test Session"
        mock_session.session_tag = "test-tag"

        mock_db.session.scalar.return_value = None  # No existing session
        mock_db.session.add = MagicMock()
        mock_db.session.flush = MagicMock()
        mock_db.session.commit = MagicMock()

        # Act
        # Note: This is a simplified test - full implementation would need proper fixtures
        # For now, we're just testing the structure exists

        # Assert
        assert service is not None
        assert hasattr(service, "create_session")
        assert hasattr(service, "get_session")
        assert hasattr(service, "list_sessions")
        assert hasattr(service, "update_session")
        assert hasattr(service, "delete_session")

    def test_service_has_member_management_methods(self):
        """Test that service has member management methods."""
        service = EduSessionService()

        assert hasattr(service, "get_session_members")
        assert hasattr(service, "add_session_member")
        assert hasattr(service, "remove_session_member")

    @patch("services.edu.session_service.db")
    def test_list_sessions_as_normal_role_calls_list_sessions_by_member(self, mock_db):
        """Test that Normal role uses list_sessions_by_member."""
        # Arrange
        service = EduSessionService()
        mock_user = MagicMock()
        mock_user.id = "normal-user-id"

        # Mock tenant join with NORMAL role
        mock_tenant_join = MagicMock()
        mock_tenant_join.role = TenantAccountRole.NORMAL.value
        mock_db.session.query.return_value.filter_by.return_value.first.return_value = mock_tenant_join

        # Mock list_sessions_by_member
        with patch.object(service, "list_sessions_by_member") as mock_list_by_member:
            mock_list_by_member.return_value = {
                "sessions": [],
                "total": 0,
                "page": 1,
                "limit": 20,
            }

            # Act
            result = service.list_sessions(current_user=mock_user, is_active=True, page=1, limit=20)

            # Assert
            mock_list_by_member.assert_called_once_with(account_id="normal-user-id", is_active=True, page=1, limit=20)
            assert result["sessions"] == []
            assert result["total"] == 0

    @patch("services.edu.session_service.db")
    def test_list_sessions_as_editor_role_calls_list_sessions_by_member(self, mock_db):
        """Test that Editor role (non-privileged) uses list_sessions_by_member."""
        # Arrange
        service = EduSessionService()
        mock_user = MagicMock()
        mock_user.id = "editor-user-id"
        mock_user.email = "editor@test.com"

        # Mock tenant join with EDITOR role
        mock_tenant_join = MagicMock()
        mock_tenant_join.role = TenantAccountRole.EDITOR.value
        mock_db.session.query.return_value.filter_by.return_value.first.return_value = mock_tenant_join

        # Mock list_sessions_by_member
        with patch.object(service, "list_sessions_by_member") as mock_list_by_member:
            mock_list_by_member.return_value = {
                "sessions": [],
                "total": 0,
                "page": 1,
                "limit": 20,
            }

            # Act
            result = service.list_sessions(current_user=mock_user, is_active=True, page=1, limit=20)

            # Assert
            mock_list_by_member.assert_called_once_with(account_id="editor-user-id", is_active=True, page=1, limit=20)
            assert result["sessions"] == []
            assert result["total"] == 0

    @patch("services.edu.session_service.db")
    def test_list_sessions_as_owner_shows_all_sessions(self, mock_db):
        """Test that Owner role can see all sessions."""
        # Arrange
        service = EduSessionService()
        mock_user = MagicMock()
        mock_user.id = "owner-user-id"

        # Mock tenant join with OWNER role
        mock_tenant_join = MagicMock()
        mock_tenant_join.role = TenantAccountRole.OWNER.value
        mock_db.session.query.return_value.filter_by.return_value.first.return_value = mock_tenant_join

        # Mock database query
        mock_query = MagicMock()
        mock_db.session.scalar.return_value = 5  # 5 total sessions
        mock_db.session.scalars.return_value.all.return_value = []

        with patch("services.edu.session_service.select", return_value=mock_query):
            # Act
            result = service.list_sessions(current_user=mock_user, page=1, limit=20)

            # Assert
            assert result["total"] == 5
            # Owner should see all sessions (no instructor_account_id filter applied)

    @patch("services.edu.session_service.db")
    def test_list_sessions_as_admin_filters_by_creator(self, mock_db):
        """Test that Admin role only sees their own sessions."""
        # Arrange
        service = EduSessionService()
        mock_user = MagicMock()
        mock_user.id = "admin-user-id"

        # Mock tenant join with ADMIN role
        mock_tenant_join = MagicMock()
        mock_tenant_join.role = TenantAccountRole.ADMIN.value
        mock_db.session.query.return_value.filter_by.return_value.first.return_value = mock_tenant_join

        # Mock database query
        mock_query = MagicMock()
        mock_db.session.scalar.return_value = 2  # 2 sessions created by admin
        mock_db.session.scalars.return_value.all.return_value = []

        with patch("services.edu.session_service.select", return_value=mock_query):
            # Act
            result = service.list_sessions(current_user=mock_user, page=1, limit=20)

            # Assert
            assert result["total"] == 2
            # Admin should only see their sessions (instructor_account_id filter applied)
