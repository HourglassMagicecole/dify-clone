"""
Unit tests for EducationService integration.
"""

from datetime import UTC, datetime, timedelta
from unittest.mock import MagicMock, patch

from services.education_service import EducationService


class TestEducationService:
    """Test cases for EducationService integration."""

    @patch("services.education_service.datetime")
    @patch("services.education_service.db")
    def test_get_platform_overview_success(self, mock_db, mock_datetime):
        """Test successful platform overview retrieval."""
        # Mock datetime
        mock_now = MagicMock()
        mock_now.isoformat.return_value = "2025-09-26T00:00:00"
        mock_datetime.utcnow.return_value = mock_now
        mock_now.replace.return_value = mock_now

        # Set up query chain mock
        query_mock = MagicMock()
        filter_mock = MagicMock()
        filter_by_mock = MagicMock()

        # Configure chaining
        mock_db.session.query.return_value = query_mock
        query_mock.filter_by.return_value = filter_by_mock
        query_mock.filter.return_value = filter_mock

        # Set count values for each query type
        query_mock.count.return_value = 100  # total_sessions
        filter_by_mock.count.side_effect = [50, 25, 10]  # total_templates, total_api_keys, active_sessions
        filter_mock.count.side_effect = [15, 20]  # recent_sessions, recent_progress

        # Configure query to return different mock objects for different model types
        call_count = 0

        def query_side_effect(model):
            nonlocal call_count
            call_count += 1
            if call_count == 1:  # EducationSession
                query_mock.count.return_value = 100
            elif call_count == 2:  # EducationEnrollment
                query_mock.count.return_value = 500
            elif call_count == 3:  # EducationTemplate
                query_mock.count.return_value = 50  # This will be overridden by filter_by
            elif call_count == 4:  # LearningProgress
                query_mock.count.return_value = 200
            elif call_count == 5:  # EducationApiKey
                query_mock.count.return_value = 25  # This will be overridden by filter_by
            elif call_count == 6:  # EducationSession (recent)
                query_mock.count.return_value = 15  # This will be overridden by filter
            elif call_count == 7:  # LearningProgress (recent)
                query_mock.count.return_value = 20  # This will be overridden by filter
            elif call_count == 8:  # EducationSession (active)
                query_mock.count.return_value = 10  # This will be overridden by filter_by
            return query_mock

        mock_db.session.query.side_effect = query_side_effect

        result = EducationService.get_platform_overview()

        assert "platform_stats" in result
        assert result["platform_stats"]["total_sessions"] == 100
        assert result["platform_stats"]["total_enrollments"] == 500
        assert result["system_status"]["database_healthy"] is True

    @patch("services.education_service.db")
    def test_get_platform_overview_database_error(self, mock_db):
        """Test platform overview when database is unavailable."""
        mock_db.session.query.side_effect = Exception("Database connection failed")

        result = EducationService.get_platform_overview()

        assert "error" in result
        assert result["system_status"]["database_healthy"] is False

    @patch("services.education_service.SessionService")
    @patch("services.education_service.db")
    def test_create_complete_session_success(self, mock_db, mock_session_service):
        """Test successful complete session creation."""
        # Mock session creation
        mock_session = MagicMock()
        mock_session.id = "session123"
        mock_session.title = "Test Session"
        mock_session.description = "Test Description"
        mock_session.created_at = datetime.now(UTC)

        mock_session_service.create_session.return_value = mock_session

        # Mock enrollment
        mock_enrollment = MagicMock()
        mock_enrollment.id = "enrollment123"
        mock_session_service.enroll_user.return_value = mock_enrollment

        # Mock template
        with patch("services.education_service.TemplateService") as mock_template_service:
            mock_template = MagicMock()
            mock_template.name = "Test Template"
            mock_template_service.get_template_by_id.return_value = mock_template

            # Mock database transaction
            mock_db.session.begin.return_value.__enter__ = MagicMock()
            mock_db.session.begin.return_value.__exit__ = MagicMock()

            result = EducationService.create_complete_session(
                title="Test Session",
                description="Test Description",
                created_by="user123",
                participants=["user456"],
                templates=["template789"],
            )

            assert result["session"]["id"] == "session123"
            assert len(result["enrollments"]) == 1
            assert result["enrollments"][0]["status"] == "success"
            assert len(result["templates"]) == 1
            assert result["templates"][0]["status"] == "associated"

    @patch("services.education_service.SessionService")
    @patch("services.education_service.ProgressService")
    @patch("services.education_service.TemplateService")
    def test_get_user_dashboard(self, mock_template_service, mock_progress_service, mock_session_service):
        """Test user dashboard data retrieval."""
        # Mock user sessions
        mock_session_service.get_user_sessions.return_value = [
            {"session_id": "session1", "status": "active"},
            {"session_id": "session2", "status": "completed"},
        ]

        # Mock user progress
        mock_progress1 = MagicMock()
        mock_progress1.status = "completed"
        mock_progress1.created_at = datetime.now(UTC)

        mock_progress2 = MagicMock()
        mock_progress2.status = "in_progress"
        mock_progress2.created_at = datetime.now(UTC) - timedelta(days=2)

        mock_progress_service.get_user_progress.return_value = [mock_progress1, mock_progress2]

        # Mock user templates
        mock_template = MagicMock()
        mock_template.id = "template123"
        mock_template.name = "Test Template"
        mock_template.template_type = "workflow"
        mock_template.created_at = datetime.now(UTC)

        mock_template_service.get_user_templates.return_value = [mock_template]

        result = EducationService.get_user_dashboard("user123")

        assert result["user_id"] == "user123"
        assert result["sessions"]["total"] == 2
        assert result["sessions"]["active"] == 1
        assert result["sessions"]["completed"] == 1
        assert result["progress"]["total_activities"] == 2
        assert result["progress"]["completed"] == 1
        assert result["progress"]["completion_rate"] == 50.0
        assert result["templates"]["owned"] == 1

    @patch("services.education_service.SessionService")
    @patch("services.education_service.ProgressService")
    def test_get_session_dashboard(self, mock_progress_service, mock_session_service):
        """Test session dashboard data retrieval."""
        # Mock session details
        mock_session = MagicMock()
        mock_session.id = "session123"
        mock_session.title = "Test Session"
        mock_session.status = "active"
        mock_session.created_at = datetime.now(UTC)
        mock_session.start_date = None
        mock_session.end_date = None

        mock_session_service.get_session_by_id.return_value = mock_session

        # Mock participants
        mock_session_service.get_session_participants.return_value = [
            {"user_id": "user1", "status": "active"},
            {"user_id": "user2", "status": "active"},
        ]

        # Mock progress summary
        mock_progress_service.get_session_progress.return_value = [
            {"user_id": "user1", "completion_rate": 75.0},
        ]

        # Mock session stats
        mock_session_service.get_session_stats.return_value = {
            "total_enrolled": 2,
            "active_participants": 2,
        }

        # Mock analytics
        mock_progress_service.get_progress_analytics.return_value = {
            "total_activities": 10,
            "completed_activities": 5,
        }

        result = EducationService.get_session_dashboard("session123")

        assert result["session"]["id"] == "session123"
        assert result["participants"]["total"] == 2
        assert result["participants"]["active"] == 2
        assert "progress_summary" in result
        assert "session_stats" in result
        assert "analytics" in result

    @patch("services.education_service.datetime")
    @patch("services.education_service.db")
    def test_cleanup_expired_data(self, mock_db, mock_datetime):
        """Test cleanup of expired data."""
        # Mock datetime
        mock_now = MagicMock()
        mock_now.isoformat.return_value = "2025-09-26T00:00:00"
        mock_datetime.now.return_value = mock_now

        # Mock expired API keys
        mock_expired_key = MagicMock()
        mock_expired_key.is_active = True

        # Mock completed sessions
        mock_session = MagicMock()
        mock_session.status = "active"

        # Create separate mocks for each query type
        key_query_mock = MagicMock()
        key_query_mock.filter.return_value.all.return_value = [mock_expired_key]

        stats_query_mock = MagicMock()
        stats_query_mock.filter.return_value.count.return_value = 5  # Old usage stats

        session_query_mock = MagicMock()
        session_query_mock.filter.return_value.all.return_value = [mock_session]

        # Track query calls and return appropriate mocks
        query_call_count = [0]

        def query_side_effect(model):
            query_call_count[0] += 1
            # Return mocks based on call order - matching the actual function flow
            if query_call_count[0] == 1:  # First call - EducationApiKey
                return key_query_mock
            elif query_call_count[0] == 2:  # Second call - EducationUsageStats
                return stats_query_mock
            elif query_call_count[0] == 3:  # Third call - EducationSession
                return session_query_mock
            elif query_call_count[0] == 4:  # Fourth call - API keys for counting expired
                return key_query_mock
            return MagicMock()

        mock_db.session.query.side_effect = query_side_effect
        mock_db.session.commit = MagicMock()

        result = EducationService.cleanup_expired_data()

        assert result["expired_api_keys"] == 1
        assert result["old_usage_stats"] == 5
        assert result["completed_sessions"] == 1
        assert result["success"] is True
        assert mock_expired_key.is_active is False
        assert mock_session.status == "completed"

    @patch("services.education_service.db")
    def test_health_check_healthy(self, mock_db):
        """Test health check when all systems are healthy."""
        # Mock successful database query
        mock_db.session.execute.return_value.fetchone.return_value = (1,)
        mock_db.text.return_value = "SELECT 1"

        # Mock service operations
        with (
            patch("services.education_service.SessionService") as mock_session_service,
            patch("services.education_service.ProgressService") as mock_progress_service,
            patch("services.education_service.TemplateService") as mock_template_service,
            patch("services.education_service.GroupService") as mock_group_service,
        ):
            mock_session_service.get_sessions.return_value = []
            mock_progress_service.get_progress_analytics.return_value = {}
            mock_template_service.get_templates.return_value = []
            mock_group_service.get_groups.return_value = []

            # Mock API key query
            query_mock = MagicMock()
            mock_db.session.query.return_value = query_mock
            query_mock.filter.return_value.count.return_value = 0  # No expired keys

            result = EducationService.health_check()

            assert result["overall_status"] == "healthy"
            assert result["components"]["database"] == "healthy"
            assert result["components"]["session_service"] == "healthy"
            assert len(result["issues"]) == 0

    @patch("services.education_service.GroupService")
    @patch("services.education_service.TemplateService")
    @patch("services.education_service.ProgressService")
    @patch("services.education_service.SessionService")
    @patch("services.education_service.datetime")
    @patch("services.education_service.db")
    def test_health_check_unhealthy_database(
        self,
        mock_db,
        mock_datetime,
        mock_session_service,
        mock_progress_service,
        mock_template_service,
        mock_group_service,
    ):
        """Test health check when database is unhealthy."""
        # Mock datetime
        mock_now = MagicMock()
        mock_now.isoformat.return_value = "2025-09-26T00:00:00"
        mock_datetime.now.return_value = mock_now

        # Make database check fail
        mock_db.session.execute.side_effect = Exception("Connection failed")
        mock_db.text.return_value = "SELECT 1"

        # Mock services to not fail (they should work but DB is down)
        mock_session_service.get_sessions.return_value = []
        mock_progress_service.get_progress_analytics.return_value = {}
        mock_template_service.get_templates.return_value = []
        mock_group_service.get_groups.return_value = []

        result = EducationService.health_check()

        assert result["overall_status"] == "unhealthy"
        assert result["components"]["database"] == "unhealthy"
        assert any("Database connectivity issue" in issue for issue in result["issues"])

    @patch("services.education_service.db")
    def test_get_integration_status_success(self, mock_db):
        """Test successful integration status check."""
        # Mock queries for orphaned records
        query_mock = MagicMock()
        mock_db.session.query.return_value = query_mock
        query_mock.outerjoin.return_value = query_mock
        query_mock.filter.return_value = query_mock
        query_mock.count.return_value = 0  # No orphaned records

        result = EducationService.get_integration_status()

        assert result["service_integrations"]["session_enrollment_integrity"] is True
        assert result["service_integrations"]["session_progress_integrity"] is True
        assert result["data_consistency"]["orphaned_enrollments"] == 0
        assert result["data_consistency"]["orphaned_progress_records"] == 0

    @patch("services.education_service.db")
    def test_get_integration_status_with_issues(self, mock_db):
        """Test integration status check with data integrity issues."""
        # Mock queries for orphaned records
        query_mock = MagicMock()
        mock_db.session.query.return_value = query_mock
        query_mock.outerjoin.return_value = query_mock
        query_mock.filter.return_value = query_mock
        query_mock.count.side_effect = [5, 3]  # Orphaned records found

        result = EducationService.get_integration_status()

        assert result["service_integrations"]["session_enrollment_integrity"] is False
        assert result["service_integrations"]["session_progress_integrity"] is False
        assert result["data_consistency"]["orphaned_enrollments"] == 5
        assert result["data_consistency"]["orphaned_progress_records"] == 3

    def test_education_service_initialization(self):
        """Test EducationService initialization."""
        service = EducationService()

        assert hasattr(service, "group_service")
        assert hasattr(service, "session_service")
        assert hasattr(service, "progress_service")
        assert hasattr(service, "template_service")

    @patch("services.education_service.SessionService")
    def test_create_complete_session_with_enrollment_failure(self, mock_session_service):
        """Test complete session creation with enrollment failures."""
        # Mock session creation success
        mock_session = MagicMock()
        mock_session.id = "session123"
        mock_session.title = "Test Session"
        mock_session.created_at = datetime.now(UTC)

        mock_session_service.create_session.return_value = mock_session

        # Mock enrollment failure
        mock_session_service.enroll_user.side_effect = Exception("User not found")

        # Mock database transaction
        with patch("services.education_service.db") as mock_db:
            mock_db.session.begin.return_value.__enter__ = MagicMock()
            mock_db.session.begin.return_value.__exit__ = MagicMock()

            result = EducationService.create_complete_session(
                title="Test Session", created_by="user123", participants=["invalid_user"]
            )

            assert result["session"]["id"] == "session123"
            assert len(result["enrollments"]) == 0
            assert len(result["errors"]) == 1
            assert "Failed to enroll user" in result["errors"][0]
