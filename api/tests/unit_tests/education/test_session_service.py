"""
Unit tests for SessionService.
"""

from datetime import datetime, timedelta
from unittest.mock import MagicMock, patch

import pytest

from services.session_service import SessionService


class TestSessionService:
    """Test cases for SessionService."""

    @patch("services.session_service.db")
    def test_create_session_success(self, mock_db):
        """Test successful session creation."""
        mock_session = MagicMock()
        mock_session.id = "session123"
        mock_session.title = "Test Session"

        mock_db.session.add = MagicMock()
        mock_db.session.commit = MagicMock()

        with patch("services.session_service.EducationSession", return_value=mock_session):
            result = SessionService.create_session(
                title="Test Session", description="Test Description", created_by="user123"
            )

            assert result == mock_session
            mock_db.session.add.assert_called_once_with(mock_session)
            mock_db.session.commit.assert_called_once()

    @patch("services.session_service.db")
    def test_create_session_with_dates(self, mock_db):
        """Test session creation with start/end dates."""
        mock_session = MagicMock()
        start_date = datetime.now()
        end_date = datetime.now() + timedelta(hours=2)

        mock_db.session.add = MagicMock()
        mock_db.session.commit = MagicMock()

        with patch("services.session_service.EducationSession", return_value=mock_session):
            result = SessionService.create_session(
                title="Test Session", start_date=start_date, end_date=end_date, max_participants=50
            )

            assert result == mock_session

    @patch("services.session_service.db")
    def test_get_sessions(self, mock_db):
        """Test getting sessions with pagination."""
        mock_session1 = MagicMock()
        mock_session1.id = "session1"
        mock_session2 = MagicMock()
        mock_session2.id = "session2"

        mock_query = MagicMock()
        mock_query.order_by.return_value.offset.return_value.limit.return_value.all.return_value = [
            mock_session1,
            mock_session2,
        ]
        mock_db.session.query.return_value = mock_query

        sessions = SessionService.get_sessions(limit=10, offset=0)

        assert len(sessions) == 2
        assert sessions[0] == mock_session1
        assert sessions[1] == mock_session2

    @patch("services.session_service.db")
    def test_get_sessions_with_status_filter(self, mock_db):
        """Test getting sessions with status filter."""
        mock_query = MagicMock()
        mock_db.session.query.return_value = mock_query

        SessionService.get_sessions(status="active")

        mock_query.filter.assert_called_once()

    @patch("services.session_service.db")
    def test_get_session_by_id_found(self, mock_db):
        """Test getting session by ID when found."""
        mock_session = MagicMock()
        mock_session.id = "session123"

        mock_db.session.query.return_value.filter_by.return_value.first.return_value = mock_session

        result = SessionService.get_session_by_id("session123")

        assert result == mock_session

    @patch("services.session_service.db")
    def test_get_session_by_id_not_found(self, mock_db):
        """Test getting session by ID when not found."""
        mock_db.session.query.return_value.filter_by.return_value.first.return_value = None

        result = SessionService.get_session_by_id("nonexistent")

        assert result is None

    @patch("services.session_service.db")
    def test_update_session_success(self, mock_db):
        """Test successful session update."""
        mock_session = MagicMock()
        mock_session.title = "Old Title"

        mock_db.session.query.return_value.filter_by.return_value.first.return_value = mock_session
        mock_db.session.commit = MagicMock()

        result = SessionService.update_session("session123", title="New Title", description="New Desc")

        assert result == mock_session
        assert mock_session.title == "New Title"
        assert mock_session.description == "New Desc"
        mock_db.session.commit.assert_called_once()

    @patch("services.session_service.db")
    def test_update_session_not_found(self, mock_db):
        """Test updating non-existent session."""
        mock_db.session.query.return_value.filter_by.return_value.first.return_value = None

        result = SessionService.update_session("nonexistent", title="New Title")

        assert result is None

    @patch("services.session_service.db")
    def test_delete_session_success(self, mock_db):
        """Test successful session deletion."""
        mock_session = MagicMock()
        mock_db.session.query.return_value.filter_by.return_value.first.return_value = mock_session
        mock_db.session.query.return_value.filter_by.return_value.delete.return_value = 3
        mock_db.session.delete = MagicMock()
        mock_db.session.commit = MagicMock()

        result = SessionService.delete_session("session123")

        assert result is True
        mock_db.session.delete.assert_called_once_with(mock_session)
        mock_db.session.commit.assert_called_once()

    @patch("services.session_service.db")
    def test_delete_session_not_found(self, mock_db):
        """Test deleting non-existent session."""
        mock_db.session.query.return_value.filter_by.return_value.first.return_value = None

        result = SessionService.delete_session("nonexistent")

        assert result is False

    @patch("services.session_service.db")
    def test_enroll_user_success(self, mock_db):
        """Test successful user enrollment."""
        mock_session = MagicMock()
        mock_session.max_participants = 100
        mock_user = MagicMock()
        mock_enrollment = MagicMock()

        # Setup mocks
        query_mock = MagicMock()
        mock_db.session.query.side_effect = [
            query_mock,  # Session query
            query_mock,  # User query
            query_mock,  # Existing enrollment check
            query_mock,  # Current count check
        ]

        query_mock.filter_by.return_value.first.side_effect = [
            mock_session,  # Session exists
            mock_user,  # User exists
            None,  # No existing enrollment
        ]

        query_mock.filter_by.return_value.count.return_value = 5  # Current count < max

        mock_db.session.add = MagicMock()
        mock_db.session.commit = MagicMock()

        with patch("services.session_service.EducationEnrollment", return_value=mock_enrollment):
            result = SessionService.enroll_user("session123", "user123", "participant")

            assert result == mock_enrollment
            mock_db.session.add.assert_called_once_with(mock_enrollment)
            mock_db.session.commit.assert_called_once()

    @patch("services.session_service.db")
    def test_enroll_user_session_not_found(self, mock_db):
        """Test enrolling user in non-existent session."""
        mock_db.session.query.return_value.filter_by.return_value.first.return_value = None

        with pytest.raises(ValueError, match="Session not found"):
            SessionService.enroll_user("nonexistent", "user123")

    @patch("services.session_service.db")
    def test_enroll_user_already_enrolled(self, mock_db):
        """Test enrolling user who is already enrolled."""
        mock_session = MagicMock()
        mock_user = MagicMock()
        mock_existing_enrollment = MagicMock()

        query_mock = MagicMock()
        mock_db.session.query.side_effect = [
            query_mock,  # Session query
            query_mock,  # User query
            query_mock,  # Existing enrollment check
        ]

        query_mock.filter_by.return_value.first.side_effect = [
            mock_session,  # Session exists
            mock_user,  # User exists
            mock_existing_enrollment,  # Already enrolled
        ]

        with pytest.raises(ValueError, match="User already enrolled"):
            SessionService.enroll_user("session123", "user123")

    @patch("services.session_service.db")
    def test_enroll_user_session_full(self, mock_db):
        """Test enrolling user when session is full."""
        mock_session = MagicMock()
        mock_session.max_participants = 10
        mock_user = MagicMock()

        query_mock = MagicMock()
        mock_db.session.query.side_effect = [
            query_mock,  # Session query
            query_mock,  # User query
            query_mock,  # Existing enrollment check
            query_mock,  # Current count check
        ]

        query_mock.filter_by.return_value.first.side_effect = [
            mock_session,  # Session exists
            mock_user,  # User exists
            None,  # No existing enrollment
        ]

        query_mock.filter_by.return_value.count.return_value = 10  # Session is full

        with pytest.raises(ValueError, match="Session is full"):
            SessionService.enroll_user("session123", "user123")

    @patch("services.session_service.db")
    def test_unenroll_user_success(self, mock_db):
        """Test successful user unenrollment."""
        mock_enrollment = MagicMock()
        mock_db.session.query.return_value.filter_by.return_value.first.return_value = mock_enrollment
        mock_db.session.delete = MagicMock()
        mock_db.session.commit = MagicMock()

        result = SessionService.unenroll_user("session123", "user123")

        assert result is True
        mock_db.session.delete.assert_called_once_with(mock_enrollment)
        mock_db.session.commit.assert_called_once()

    @patch("services.session_service.db")
    def test_unenroll_user_not_enrolled(self, mock_db):
        """Test unenrolling user who is not enrolled."""
        mock_db.session.query.return_value.filter_by.return_value.first.return_value = None

        result = SessionService.unenroll_user("session123", "user123")

        assert result is False

    @patch("services.session_service.db")
    def test_get_session_participants(self, mock_db):
        """Test getting session participants."""
        mock_enrollment = MagicMock()
        mock_enrollment.role = "participant"
        mock_enrollment.created_at = datetime.now()
        mock_enrollment.status = "active"

        mock_user = MagicMock()
        mock_user.id = "user123"
        mock_user.name = "Test User"
        mock_user.email = "test@example.com"

        mock_db.session.query.return_value.join.return_value.filter.return_value.all.return_value = [
            (mock_enrollment, mock_user)
        ]

        participants = SessionService.get_session_participants("session123")

        assert len(participants) == 1
        assert participants[0]["user_id"] == "user123"
        assert participants[0]["name"] == "Test User"
        assert participants[0]["email"] == "test@example.com"
        assert participants[0]["role"] == "participant"

    @patch("services.session_service.db")
    def test_get_session_stats(self, mock_db):
        """Test getting session statistics."""
        mock_session = MagicMock()
        mock_session.max_participants = 100

        query_mock = MagicMock()
        mock_db.session.query.side_effect = [
            query_mock,  # Session query
            query_mock,  # Total enrolled count
            query_mock,  # Active participants count
        ]

        query_mock.filter_by.return_value.first.return_value = mock_session
        query_mock.filter_by.return_value.count.side_effect = [30, 25]  # Total and active counts

        stats = SessionService.get_session_stats("session123")

        assert stats["session_id"] == "session123"
        assert stats["total_enrolled"] == 30
        assert stats["active_participants"] == 25
        assert stats["max_participants"] == 100
        assert stats["available_spots"] == 70

    @patch("services.session_service.db")
    def test_get_session_stats_session_not_found(self, mock_db):
        """Test getting stats for non-existent session."""
        mock_db.session.query.return_value.filter_by.return_value.first.return_value = None

        with pytest.raises(ValueError, match="Session not found"):
            SessionService.get_session_stats("nonexistent")
