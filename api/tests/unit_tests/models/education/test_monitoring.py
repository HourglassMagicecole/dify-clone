"""Unit tests for SessionMonitoring model."""

from datetime import datetime

from models.education.monitoring import SessionMonitoring


def test_session_monitoring_repr():
    """Test __repr__ method of SessionMonitoring."""
    # Arrange
    monitoring = SessionMonitoring(
        id="monitoring-id-123",
        session_id="session-456",
        metric_type="api_call",
        metric_value=100,
    )

    # Act
    repr_str = repr(monitoring)

    # Assert
    assert "SessionMonitoring" in repr_str
    assert "monitoring-id-123" in repr_str
    assert "session-456" in repr_str
    assert "api_call" in repr_str
    assert "100" in repr_str


def test_session_monitoring_attributes():
    """Test SessionMonitoring model attributes."""
    # Arrange
    monitoring_id = "mon-001"
    session_id = "session-002"
    account_id = "account-003"
    metric_type = "token_usage"
    metric_value = 5000
    metric_metadata = {"model": "gpt-4", "prompt_tokens": 3000, "completion_tokens": 2000}
    recorded_at = datetime(2025, 10, 12, 10, 30)

    # Act
    monitoring = SessionMonitoring(
        id=monitoring_id,
        session_id=session_id,
        account_id=account_id,
        metric_type=metric_type,
        metric_value=metric_value,
        metric_metadata=metric_metadata,
        recorded_at=recorded_at,
    )

    # Assert
    assert monitoring.id == monitoring_id
    assert monitoring.session_id == session_id
    assert monitoring.account_id == account_id
    assert monitoring.metric_type == metric_type
    assert monitoring.metric_value == metric_value
    assert monitoring.metric_metadata == metric_metadata
    assert monitoring.recorded_at == recorded_at


def test_session_monitoring_tablename():
    """Test SessionMonitoring table name."""
    # Assert
    assert SessionMonitoring.__tablename__ == "session_monitoring"


def test_session_monitoring_nullable_account_id():
    """Test SessionMonitoring with nullable account_id."""
    # Arrange & Act
    monitoring = SessionMonitoring(
        id="mon-system",
        session_id="session-1",
        account_id=None,  # Nullable - system-level metric
        metric_type="error",
        metric_value=1,
        metric_metadata={"error_type": "timeout", "endpoint": "/api/chat"},
        recorded_at=datetime.now(),
    )

    # Assert
    assert monitoring.account_id is None
    assert monitoring.metric_type == "error"


def test_session_monitoring_nullable_metadata():
    """Test SessionMonitoring with nullable metric_metadata."""
    # Arrange & Act
    monitoring = SessionMonitoring(
        id="mon-simple",
        session_id="session-1",
        account_id="account-1",
        metric_type="login",
        metric_value=1,
        metric_metadata=None,  # Nullable
        recorded_at=datetime.now(),
    )

    # Assert
    assert monitoring.metric_metadata is None


def test_session_monitoring_different_metric_types():
    """Test SessionMonitoring with different metric types."""
    # Arrange & Act
    api_call_metric = SessionMonitoring(
        id="mon-1",
        session_id="session-1",
        account_id="account-1",
        metric_type="api_call",
        metric_value=1,
        metric_metadata={"endpoint": "/api/chat"},
        recorded_at=datetime.now(),
    )

    token_usage_metric = SessionMonitoring(
        id="mon-2",
        session_id="session-1",
        account_id="account-1",
        metric_type="token_usage",
        metric_value=1500,
        metric_metadata={"model": "gpt-3.5-turbo"},
        recorded_at=datetime.now(),
    )

    error_metric = SessionMonitoring(
        id="mon-3",
        session_id="session-1",
        account_id="account-1",
        metric_type="error",
        metric_value=1,
        metric_metadata={"error_code": 500, "message": "Internal server error"},
        recorded_at=datetime.now(),
    )

    login_metric = SessionMonitoring(
        id="mon-4",
        session_id="session-1",
        account_id="account-1",
        metric_type="login",
        metric_value=1,
        metric_metadata={"ip_address": "192.168.1.1"},
        recorded_at=datetime.now(),
    )

    # Assert
    assert api_call_metric.metric_type == "api_call"
    assert token_usage_metric.metric_type == "token_usage"
    assert error_metric.metric_type == "error"
    assert login_metric.metric_type == "login"


def test_session_monitoring_json_metadata():
    """Test SessionMonitoring with complex JSON metadata."""
    # Arrange
    complex_metadata = {
        "model": "gpt-4",
        "tokens": {"prompt": 1000, "completion": 500, "total": 1500},
        "cost": 0.045,
        "latency_ms": 3500,
        "success": True,
        "tags": ["education", "tutorial"],
    }

    # Act
    monitoring = SessionMonitoring(
        id="mon-complex",
        session_id="session-1",
        account_id="account-1",
        metric_type="api_call",
        metric_value=1,
        metric_metadata=complex_metadata,
        recorded_at=datetime.now(),
    )

    # Assert
    assert monitoring.metric_metadata == complex_metadata
    assert monitoring.metric_metadata["model"] == "gpt-4"
    assert monitoring.metric_metadata["tokens"]["total"] == 1500
    assert monitoring.metric_metadata["tags"] == ["education", "tutorial"]
