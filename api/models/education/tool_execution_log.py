"""Tool Execution Log model for tracking tool usage."""

from datetime import datetime
from typing import Any

import sqlalchemy as sa
from sqlalchemy import DateTime, Index, Integer, String, Text, func
from sqlalchemy.dialects.postgresql import JSON
from sqlalchemy.orm import Mapped, mapped_column

from models.base import Base
from models.types import StringUUID


class ToolExecutionLog(Base):
    """
    Tool execution log model for tracking educational tool usage.

    This model records every tool invocation including:
    - Tool identification (provider, name)
    - Execution context (tenant, user, session, app)
    - Input parameters
    - Execution result (success/error)
    - Performance metrics (execution time)

    Use cases:
    - Administrator monitoring dashboard
    - Usage statistics and analytics
    - Debugging and error tracking
    - Performance monitoring
    """

    __tablename__ = "tool_execution_logs"
    __table_args__ = (
        sa.PrimaryKeyConstraint("id", name="tool_execution_log_pkey"),
        Index("idx_tool_execution_tenant", "tenant_id"),
        Index("idx_tool_execution_account", "account_id"),
        Index("idx_tool_execution_session", "session_id"),
        Index("idx_tool_execution_app", "app_id"),
        Index("idx_tool_execution_provider", "tool_provider"),
        Index("idx_tool_execution_name", "tool_name"),
        Index("idx_tool_execution_status", "status"),
        Index("idx_tool_execution_executed_at", "executed_at"),
    )

    # Primary key
    id: Mapped[str] = mapped_column(StringUUID, server_default=sa.text("uuid_generate_v4()"))

    # Tenant and user context
    tenant_id: Mapped[str] = mapped_column(String(255), nullable=False)
    account_id: Mapped[str] = mapped_column(String(255), nullable=False)

    # Session context (optional - for education sessions)
    session_id: Mapped[str | None] = mapped_column(String(255), nullable=True)

    # App context (optional - if tool was invoked from an app)
    app_id: Mapped[str | None] = mapped_column(String(255), nullable=True)
    conversation_id: Mapped[str | None] = mapped_column(String(255), nullable=True)
    message_id: Mapped[str | None] = mapped_column(String(255), nullable=True)

    # Tool identification
    tool_provider: Mapped[str] = mapped_column(String(100), nullable=False)
    tool_name: Mapped[str] = mapped_column(String(100), nullable=False)
    tool_parameters: Mapped[dict[str, Any] | None] = mapped_column(JSON, nullable=True)

    # Execution result
    status: Mapped[str] = mapped_column(String(20), nullable=False)  # "success" or "error"
    result_summary: Mapped[str | None] = mapped_column(Text, nullable=True)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Performance metrics
    execution_time_ms: Mapped[int | None] = mapped_column(Integer, nullable=True)

    # Timestamps
    executed_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, server_default=func.now())
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, server_default=func.now())

    def __repr__(self) -> str:
        """String representation."""
        return f"<ToolExecutionLog {self.tool_provider}/{self.tool_name} [{self.status}]>"

    def to_dict(self) -> dict:
        """
        Convert to dictionary.

        Returns:
            dict: Dictionary representation of the log
        """
        return {
            "id": self.id,
            "tenant_id": self.tenant_id,
            "account_id": self.account_id,
            "session_id": self.session_id,
            "app_id": self.app_id,
            "conversation_id": self.conversation_id,
            "message_id": self.message_id,
            "tool_provider": self.tool_provider,
            "tool_name": self.tool_name,
            "tool_parameters": self.tool_parameters,
            "status": self.status,
            "result_summary": self.result_summary,
            "error_message": self.error_message,
            "execution_time_ms": self.execution_time_ms,
            "executed_at": self.executed_at.isoformat() if self.executed_at else None,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }
