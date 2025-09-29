"""
Unit tests for ProgressService.
"""

from datetime import datetime
from unittest.mock import MagicMock, patch

import pytest

from services.progress_service import ProgressService


class TestProgressService:
    """Test cases for ProgressService."""

    @patch("services.progress_service.db")
    def test_record_progress_new_record(self, mock_db):
        """Test recording progress for new activity."""
        # Mock enrollment check
        mock_enrollment = MagicMock()
        mock_db.session.query.return_value.filter_by.return_value.first.side_effect = [
            mock_enrollment,  # Enrollment exists
            None,  # No existing progress
        ]

        mock_progress = MagicMock()
        mock_progress.id = "progress123"

        mock_db.session.add = MagicMock()
        mock_db.session.commit = MagicMock()

        with patch("services.progress_service.LearningProgress", return_value=mock_progress):
            result = ProgressService.record_progress(
                user_id="user123",
                session_id="session123",
                module_type="workflow",
                module_id="workflow123",
                status="in_progress",
            )

            assert result == mock_progress
            mock_db.session.add.assert_called_once_with(mock_progress)
            mock_db.session.commit.assert_called_once()

    @patch("services.progress_service.db")
    def test_record_progress_update_existing(self, mock_db):
        """Test updating existing progress record."""
        mock_enrollment = MagicMock()
        mock_existing = MagicMock()
        mock_existing.progress_data = None
        mock_existing.status = "in_progress"

        mock_db.session.query.return_value.filter_by.return_value.first.side_effect = [
            mock_enrollment,  # Enrollment exists
            mock_existing,  # Existing progress record
        ]

        mock_db.session.commit = MagicMock()

        result = ProgressService.record_progress(
            user_id="user123",
            session_id="session123",
            module_type="workflow",
            module_id="workflow123",
            progress_data={"step": 2},
            status="completed",
        )

        assert result == mock_existing
        assert mock_existing.progress_data == {"step": 2}
        assert mock_existing.status == "completed"
        mock_db.session.commit.assert_called_once()

    @patch("services.progress_service.db")
    def test_record_progress_not_enrolled(self, mock_db):
        """Test recording progress for user not enrolled in session."""
        mock_db.session.query.return_value.filter_by.return_value.first.return_value = None

        with pytest.raises(ValueError, match="User is not enrolled in this session"):
            ProgressService.record_progress(
                user_id="user123", session_id="session123", module_type="workflow", module_id="workflow123"
            )

    @patch("services.progress_service.db")
    def test_update_progress_success(self, mock_db):
        """Test successful progress update."""
        mock_progress = MagicMock()
        mock_progress.progress_percentage = 50.0
        mock_progress.status = "in_progress"
        mock_progress.completed_at = None

        mock_db.session.query.return_value.filter_by.return_value.first.return_value = mock_progress
        mock_db.session.commit = MagicMock()

        result = ProgressService.update_progress(
            progress_id="progress123", progress_percentage=100.0, status="completed"
        )

        assert result == mock_progress
        assert mock_progress.progress_percentage == 100.0
        assert mock_progress.status == "completed"
        assert mock_progress.completed_at is not None

    @patch("services.progress_service.db")
    def test_update_progress_not_found(self, mock_db):
        """Test updating non-existent progress record."""
        mock_db.session.query.return_value.filter_by.return_value.first.return_value = None

        result = ProgressService.update_progress("nonexistent", progress_percentage=50.0)

        assert result is None

    @patch("services.progress_service.db")
    def test_get_user_progress(self, mock_db):
        """Test getting user progress records."""
        mock_progress1 = MagicMock()
        mock_progress1.id = "progress1"
        mock_progress2 = MagicMock()
        mock_progress2.id = "progress2"

        mock_query = MagicMock()
        mock_query.order_by.return_value.all.return_value = [mock_progress1, mock_progress2]
        mock_db.session.query.return_value.filter_by.return_value = mock_query

        result = ProgressService.get_user_progress("user123")

        assert len(result) == 2
        assert result[0] == mock_progress1
        assert result[1] == mock_progress2

    @patch("services.progress_service.db")
    def test_get_user_progress_with_filters(self, mock_db):
        """Test getting user progress with session and activity type filters."""
        mock_query = MagicMock()
        mock_db.session.query.return_value.filter_by.side_effect = [
            mock_query,  # User filter
            mock_query,  # Session filter
            mock_query,  # Activity type filter
        ]

        ProgressService.get_user_progress(user_id="user123", session_id="session123", module_type="workflow")

        # Verify filter_by was called for user, session, and activity type
        assert mock_db.session.query.return_value.filter_by.call_count == 3

    @patch("services.progress_service.db")
    def test_get_session_progress(self, mock_db):
        """Test getting session progress summary."""
        # Mock the complex query result
        mock_result = MagicMock()
        mock_result.id = "user123"
        mock_result.name = "Test User"
        mock_result.email = "test@example.com"
        mock_result.total_activities = 5
        mock_result.completed_activities = 3
        mock_result.avg_completion = 75.0

        (mock_db.session.query.return_value
         .join.return_value
         .outerjoin.return_value
         .filter.return_value
         .group_by.return_value
         .all.return_value) = [mock_result]

        result = ProgressService.get_session_progress("session123")

        assert len(result) == 1
        assert result[0]["user_id"] == "user123"
        assert result[0]["name"] == "Test User"
        assert result[0]["total_activities"] == 5
        assert result[0]["completed_activities"] == 3
        assert result[0]["average_completion"] == 75.0

    @patch("services.progress_service.db")
    def test_get_activity_progress(self, mock_db):
        """Test getting activity progress across users."""
        mock_progress = MagicMock()
        mock_progress.user_id = "user123"
        mock_progress.progress_percentage = 100.0
        mock_progress.status = "completed"
        mock_progress.created_at = datetime.now()

        mock_db.session.query.return_value.join.return_value.filter.return_value.all.return_value = [
            (mock_progress, "Test User", "test@example.com")
        ]

        result = ProgressService.get_activity_progress(
            session_id="session123", module_type="workflow", module_id="workflow123"
        )

        assert len(result) == 1
        assert result[0]["user_id"] == "user123"
        assert result[0]["name"] == "Test User"
        assert result[0]["progress_percentage"] == 100.0

    @patch("services.progress_service.db")
    def test_get_progress_analytics(self, mock_db):
        """Test getting progress analytics."""
        # Mock different queries for statistics
        query_mock = MagicMock()
        mock_db.session.query.side_effect = [
            query_mock,  # Total users
            query_mock,  # Total activities
            query_mock,  # Completed activities
            query_mock,  # Activity types
            query_mock,  # Daily progress
        ]

        # Mock query results
        query_mock.filter_by.return_value.count.side_effect = [10, 50, 30]  # users, activities, completed
        query_mock.filter_by.return_value.group_by.return_value.all.return_value = [
            ("workflow", 20, 80.0),
            ("agent", 30, 70.0),
        ]
        query_mock.filter.return_value.group_by.return_value.order_by.return_value.all.return_value = [
            (datetime.now().date(), 5, 3)
        ]

        result = ProgressService.get_progress_analytics("session123")

        assert result["session_id"] == "session123"
        assert result["total_users"] == 10
        assert result["total_activities"] == 50
        assert result["completed_activities"] == 30
        assert result["completion_rate"] == 60.0
        assert "activity_breakdown" in result
        assert "daily_progress" in result

    @patch("services.progress_service.db")
    def test_delete_progress_success(self, mock_db):
        """Test successful progress deletion."""
        mock_progress = MagicMock()
        mock_db.session.query.return_value.filter_by.return_value.first.return_value = mock_progress
        mock_db.session.delete = MagicMock()
        mock_db.session.commit = MagicMock()

        result = ProgressService.delete_progress("progress123")

        assert result is True
        mock_db.session.delete.assert_called_once_with(mock_progress)
        mock_db.session.commit.assert_called_once()

    @patch("services.progress_service.db")
    def test_delete_progress_not_found(self, mock_db):
        """Test deleting non-existent progress record."""
        mock_db.session.query.return_value.filter_by.return_value.first.return_value = None

        result = ProgressService.delete_progress("nonexistent")

        assert result is False

    @patch("services.progress_service.ProgressService.update_progress")
    def test_bulk_update_progress(self, mock_update):
        """Test bulk updating progress records."""
        mock_update.side_effect = [
            MagicMock(),  # Successful update
            None,  # Progress not found
            MagicMock(),  # Another successful update
        ]

        updates = [
            {"progress_id": "progress1", "progress_percentage": 50.0},
            {"progress_id": "progress2", "status": "completed"},
            {"progress_id": "progress3", "progress_percentage": 75.0},
        ]

        result = ProgressService.bulk_update_progress(updates)

        assert result["updated_count"] == 2
        assert result["total_requested"] == 3
        assert len(result["errors"]) == 1
        assert "progress2" in result["errors"][0]

    def test_bulk_update_progress_missing_id(self):
        """Test bulk update with missing progress_id."""
        updates = [
            {"progress_percentage": 50.0},  # Missing progress_id
            {"progress_id": "progress1", "progress_percentage": 75.0},
        ]

        result = ProgressService.bulk_update_progress(updates)

        assert result["updated_count"] == 0
        assert result["total_requested"] == 2
        assert len(result["errors"]) == 2  # Missing ID + progress not found
