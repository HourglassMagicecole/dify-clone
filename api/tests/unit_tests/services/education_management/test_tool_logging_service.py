"""Tests for ToolLoggingService (Story 2.1B - Task 12.4)."""

from datetime import datetime, timedelta
from unittest.mock import MagicMock, patch

from services.education_management.tool_logging_service import ToolLoggingService


class TestToolLoggingService:
    """Test Tool Logging Service operations."""

    @patch("services.education_management.tool_logging_service.db")
    def test_log_tool_execution_success(self, mock_db):
        """Test logging successful tool execution."""
        # Arrange
        mock_log = MagicMock()
        mock_log.id = "log-123"
        mock_log.tool_name = "calculator"
        mock_log.status = "success"

        with patch("services.education_management.tool_logging_service.ToolExecutionLog", return_value=mock_log):
            # Act
            log = ToolLoggingService.log_tool_execution(
                tenant_id="test-tenant-id",
                account_id="test-account-id",
                tool_provider="edu_tools",
                tool_name="calculator",
                tool_parameters={"expression": "2 + 2"},
                status="success",
                result_summary="Result: 4",
                execution_time_ms=150,
            )

            # Assert
            assert log.id is not None
            assert log.tool_name == "calculator"
            assert log.status == "success"
            mock_db.session.add.assert_called_once()
            mock_db.session.commit.assert_called_once()

    @patch("services.education_management.tool_logging_service.db")
    def test_log_tool_execution_error(self, mock_db):
        """Test logging failed tool execution."""
        # Arrange
        mock_log = MagicMock()
        mock_log.id = "log-456"
        mock_log.tool_name = "calculator"
        mock_log.status = "error"
        mock_log.error_message = "Invalid expression"

        with patch("services.education_management.tool_logging_service.ToolExecutionLog", return_value=mock_log):
            # Act
            log = ToolLoggingService.log_tool_execution(
                tenant_id="test-tenant-id",
                account_id="test-account-id",
                tool_provider="edu_tools",
                tool_name="calculator",
                tool_parameters={"expression": "invalid"},
                status="error",
                error_message="Invalid expression",
                execution_time_ms=50,
            )

            # Assert
            assert log.status == "error"
            assert log.error_message == "Invalid expression"
            mock_db.session.add.assert_called_once()
            mock_db.session.commit.assert_called_once()

    @patch("services.education_management.tool_logging_service.db")
    def test_get_tool_usage_stats(self, mock_db):
        """Test getting tool usage statistics."""
        # Arrange
        mock_logs = []
        for i in range(5):
            mock_log = MagicMock()
            mock_log.tool_provider = "edu_tools"
            mock_log.tool_name = "calculator"
            mock_log.account_id = "test-account-id"
            mock_log.status = "success"
            mock_logs.append(mock_log)

        # Add 2 error logs
        for i in range(2):
            mock_log = MagicMock()
            mock_log.tool_provider = "edu_tools"
            mock_log.tool_name = "json_parser"
            mock_log.account_id = "test-account-id-2"
            mock_log.status = "error"
            mock_logs.append(mock_log)

        mock_query = MagicMock()
        mock_query.filter.return_value.all.return_value = mock_logs
        mock_query.filter.return_value.filter.return_value.all.return_value = mock_logs
        mock_db.session.query.return_value = mock_query

        # Act
        stats = ToolLoggingService.get_tool_usage_stats(tenant_id="test-tenant-id")

        # Assert
        assert stats["total_executions"] == 7
        assert stats["success_count"] == 5
        assert stats["error_count"] == 2
        assert "edu_tools/calculator" in stats["by_tool"]
        assert stats["by_tool"]["edu_tools/calculator"]["count"] == 5
        assert stats["by_tool"]["edu_tools/calculator"]["errors"] == 0
        assert "edu_tools/json_parser" in stats["by_tool"]
        assert stats["by_tool"]["edu_tools/json_parser"]["count"] == 2
        assert stats["by_tool"]["edu_tools/json_parser"]["errors"] == 2
        assert "test-account-id" in stats["by_user"]
        assert "test-account-id-2" in stats["by_user"]

    @patch("services.education_management.tool_logging_service.db")
    def test_get_tool_usage_stats_with_session_filter(self, mock_db):
        """Test getting tool usage statistics filtered by session."""
        # Arrange
        mock_log = MagicMock()
        mock_log.tool_provider = "edu_tools"
        mock_log.tool_name = "calculator"
        mock_log.account_id = "test-account-id"
        mock_log.status = "success"

        mock_query = MagicMock()
        mock_query.filter.return_value.filter.return_value.all.return_value = [mock_log]
        mock_db.session.query.return_value = mock_query

        # Act
        stats = ToolLoggingService.get_tool_usage_stats(tenant_id="test-tenant-id", session_id="test-session-id")

        # Assert
        assert stats["total_executions"] == 1
        assert stats["success_count"] == 1
        assert stats["error_count"] == 0

    @patch("services.education_management.tool_logging_service.db")
    def test_get_tool_usage_stats_with_date_range(self, mock_db):
        """Test getting tool usage statistics with date range."""
        # Arrange
        start_date = datetime.now() - timedelta(days=7)
        end_date = datetime.now()

        mock_log = MagicMock()
        mock_log.tool_provider = "edu_tools"
        mock_log.tool_name = "calculator"
        mock_log.account_id = "test-account-id"
        mock_log.status = "success"

        mock_query = MagicMock()
        mock_query.filter.return_value.filter.return_value.filter.return_value.all.return_value = [mock_log]
        mock_db.session.query.return_value = mock_query

        # Act
        stats = ToolLoggingService.get_tool_usage_stats(
            tenant_id="test-tenant-id", start_date=start_date, end_date=end_date
        )

        # Assert
        assert stats["total_executions"] == 1
        assert stats["success_count"] == 1

    @patch("services.education_management.tool_logging_service.db")
    def test_get_recent_logs(self, mock_db):
        """Test getting recent tool execution logs."""
        # Arrange
        mock_logs = []
        for i in range(5):
            mock_log = MagicMock()
            mock_log.id = f"log-{i}"
            mock_log.tool_name = "calculator"
            mock_log.executed_at = datetime.now() - timedelta(minutes=i)
            mock_logs.append(mock_log)

        mock_query = MagicMock()
        mock_query.filter.return_value.order_by.return_value.limit.return_value.all.return_value = mock_logs
        mock_db.session.query.return_value = mock_query

        # Act
        logs = ToolLoggingService.get_recent_logs(tenant_id="test-tenant-id", limit=5)

        # Assert
        assert len(logs) == 5
        mock_query.filter.return_value.order_by.return_value.limit.assert_called_with(5)

    @patch("services.education_management.tool_logging_service.db")
    def test_get_recent_logs_with_session_filter(self, mock_db):
        """Test getting recent logs filtered by session."""
        # Arrange
        mock_log = MagicMock()
        mock_log.id = "log-123"
        mock_log.session_id = "test-session-id"

        mock_query = MagicMock()
        mock_query.filter.return_value.order_by.return_value.limit.return_value.filter.return_value.all.return_value = [
            mock_log
        ]
        mock_db.session.query.return_value = mock_query

        # Act
        logs = ToolLoggingService.get_recent_logs(tenant_id="test-tenant-id", session_id="test-session-id", limit=100)

        # Assert
        assert len(logs) == 1
        assert logs[0].session_id == "test-session-id"
