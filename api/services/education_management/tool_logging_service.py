"""Tool Logging Service for tracking and analyzing tool usage."""

from datetime import datetime
from typing import Any

from extensions.ext_database import db
from models.education.tool_execution_log import ToolExecutionLog


class ToolLoggingService:
    """
    Service for logging and analyzing educational tool executions.

    Provides methods to:
    - Log tool executions (success and errors)
    - Retrieve execution logs
    - Generate usage statistics
    - Aggregate metrics by tool, user, session
    """

    @staticmethod
    def log_tool_execution(
        tenant_id: str,
        account_id: str,
        tool_provider: str,
        tool_name: str,
        tool_parameters: dict[str, Any],
        status: str,
        result_summary: str | None = None,
        error_message: str | None = None,
        execution_time_ms: int | None = None,
        session_id: str | None = None,
        app_id: str | None = None,
        conversation_id: str | None = None,
        message_id: str | None = None,
    ) -> ToolExecutionLog:
        """
        Log a tool execution.

        Args:
            tenant_id: The tenant ID
            account_id: The user/account ID
            tool_provider: Tool provider name (e.g., "edu_tools")
            tool_name: Tool name (e.g., "calculator")
            tool_parameters: Input parameters used
            status: Execution status ("success" or "error")
            result_summary: Summary of the result (optional)
            error_message: Error message if status is "error" (optional)
            execution_time_ms: Execution time in milliseconds (optional)
            session_id: Education session ID (optional)
            app_id: App ID if invoked from an app (optional)
            conversation_id: Conversation ID (optional)
            message_id: Message ID (optional)

        Returns:
            ToolExecutionLog: The created log entry
        """
        log_entry = ToolExecutionLog(
            tenant_id=tenant_id,
            account_id=account_id,
            session_id=session_id,
            app_id=app_id,
            conversation_id=conversation_id,
            message_id=message_id,
            tool_provider=tool_provider,
            tool_name=tool_name,
            tool_parameters=tool_parameters,
            status=status,
            result_summary=result_summary,
            error_message=error_message,
            execution_time_ms=execution_time_ms,
            executed_at=datetime.now(),
        )

        db.session.add(log_entry)
        db.session.commit()

        return log_entry

    @staticmethod
    def get_tool_usage_stats(
        tenant_id: str,
        session_id: str | None = None,
        start_date: datetime | None = None,
        end_date: datetime | None = None,
    ) -> dict[str, Any]:
        """
        Get tool usage statistics.

        Args:
            tenant_id: The tenant ID
            session_id: Optional session ID to filter by
            start_date: Optional start date to filter by
            end_date: Optional end date to filter by

        Returns:
            dict[str, Any]: Usage statistics including:
                - total_executions: Total number of executions
                - success_count: Number of successful executions
                - error_count: Number of failed executions
                - by_tool: Breakdown by tool (count and error count)
                - by_user: Breakdown by user (count and error count)

        Example:
            >>> stats = ToolLoggingService.get_tool_usage_stats(
            ...     tenant_id="tenant-123",
            ...     session_id="session-456"
            ... )
            >>> print(stats)
            {
                "total_executions": 100,
                "success_count": 95,
                "error_count": 5,
                "by_tool": {
                    "edu_tools/calculator": {"count": 50, "errors": 2},
                    "edu_tools/json_parser": {"count": 50, "errors": 3}
                },
                "by_user": {
                    "user-1": {"count": 60, "errors": 3},
                    "user-2": {"count": 40, "errors": 2}
                }
            }
        """
        # Build query
        query = db.session.query(ToolExecutionLog).filter(ToolExecutionLog.tenant_id == tenant_id)

        if session_id:
            query = query.filter(ToolExecutionLog.session_id == session_id)

        if start_date:
            query = query.filter(ToolExecutionLog.executed_at >= start_date)

        if end_date:
            query = query.filter(ToolExecutionLog.executed_at <= end_date)

        logs = query.all()

        # Aggregate statistics
        stats: dict[str, Any] = {
            "total_executions": len(logs),
            "success_count": sum(1 for log in logs if log.status == "success"),
            "error_count": sum(1 for log in logs if log.status == "error"),
            "by_tool": {},
            "by_user": {},
        }

        # Aggregate by tool
        for log in logs:
            tool_key = f"{log.tool_provider}/{log.tool_name}"
            if tool_key not in stats["by_tool"]:
                stats["by_tool"][tool_key] = {"count": 0, "errors": 0}

            stats["by_tool"][tool_key]["count"] += 1
            if log.status == "error":
                stats["by_tool"][tool_key]["errors"] += 1

        # Aggregate by user
        for log in logs:
            if log.account_id not in stats["by_user"]:
                stats["by_user"][log.account_id] = {"count": 0, "errors": 0}

            stats["by_user"][log.account_id]["count"] += 1
            if log.status == "error":
                stats["by_user"][log.account_id]["errors"] += 1

        return stats

    @staticmethod
    def get_recent_logs(
        tenant_id: str,
        session_id: str | None = None,
        limit: int = 100,
    ) -> list[ToolExecutionLog]:
        """
        Get recent tool execution logs.

        Args:
            tenant_id: The tenant ID
            session_id: Optional session ID to filter by
            limit: Maximum number of logs to return (default 100)

        Returns:
            list[ToolExecutionLog]: List of recent logs, sorted by executed_at descending
        """
        query = (
            db.session.query(ToolExecutionLog)
            .filter(ToolExecutionLog.tenant_id == tenant_id)
            .order_by(ToolExecutionLog.executed_at.desc())
            .limit(limit)
        )

        if session_id:
            query = query.filter(ToolExecutionLog.session_id == session_id)

        return query.all()
