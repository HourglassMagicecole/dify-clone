from collections.abc import Generator
from unittest.mock import Mock, patch

import pytest
import requests_mock


@pytest.fixture(scope="session")
def education_test_config():
    """Education test configuration."""
    return {
        "dify_api_url": "http://localhost:5001",
        "dify_api_key": "test-api-key",
        "max_retries": 3,
        "retry_delay": 1.0,
        "timeout": 30.0,
    }


@pytest.fixture(scope="function")
def mock_dify_api() -> Generator[requests_mock.Mocker, None, None]:
    """Mock Dify API responses for testing."""
    with requests_mock.Mocker() as m:
        # Mock base API endpoints
        m.get("http://localhost:5001/console/api/setup", json={"data": {"setup": True}})
        m.post(
            "http://localhost:5001/console/api/login",
            json={"data": {"access_token": "test-token", "refresh_token": "refresh-token"}},
        )

        # Mock Agent API endpoints
        m.get(
            "http://localhost:5001/console/api/apps",
            json={"data": [], "has_more": False, "limit": 20, "page": 1, "total": 0},
        )

        def agent_create_callback(request, context):
            """Dynamic agent creation response based on request data."""
            request_json = request.json()
            return {
                "data": {
                    "id": "test-app-id",
                    "name": request_json.get("name", "Test App"),
                    "mode": request_json.get("mode", "agent-chat"),
                    "description": request_json.get("description", ""),
                    "icon": request_json.get("icon", "🤖"),
                    "icon_type": request_json.get("icon_type", "emoji"),
                    "created_at": "2024-01-15T14:30:00Z"
                }
            }

        m.post(
            "http://localhost:5001/console/api/apps",
            json=agent_create_callback
        )

        # Mock Workflow API endpoints
        m.post(
            "http://localhost:5001/v1/workflows/run",
            json={"workflow_run_id": "test-run-id", "task_id": "test-task-id", "data": {"answer": "Test response"}},
        )

        # Mock Dataset API endpoints
        m.get(
            "http://localhost:5001/console/api/datasets",
            json={"data": [], "has_more": False, "limit": 20, "page": 1, "total": 0},
        )
        m.post(
            "http://localhost:5001/console/api/datasets",
            json={"data": {"id": "test-dataset-id", "name": "Test Dataset"}},
        )

        # Mock File API endpoints
        m.post(
            "http://localhost:5001/files/upload",
            json={"data": {"id": "test-file-id", "name": "test.txt", "size": 1024}},
        )

        yield m


@pytest.fixture(scope="function")
def mock_education_user():
    """Mock education user for testing."""
    return {
        "id": "test-user-id",
        "name": "Test User",
        "email": "test@example.com",
        "role": "student",
        "group_id": "test-group-id",
    }


@pytest.fixture(scope="function")
def mock_education_session():
    """Mock education session for testing."""
    return {
        "id": "test-session-id",
        "name": "Test Session",
        "group_id": "test-group-id",
        "template_id": "test-template-id",
        "status": "active",
        "max_participants": 50,
    }


@pytest.fixture(scope="function")
def mock_vector_db():
    """Mock vector database for RAG testing."""
    mock_db = Mock()
    mock_db.query.return_value = {"data": {"results": []}}
    mock_db.add_document.return_value = {"id": "test-vector-id"}
    mock_db.search.return_value = [{"id": "test-doc-id", "score": 0.95, "content": "Test content"}]
    return mock_db


@pytest.fixture(autouse=True)
def mock_redis():
    """Auto-mock Redis for all tests."""
    with patch("redis.Redis") as mock_redis:
        mock_instance = Mock()
        mock_redis.return_value = mock_instance
        mock_instance.get.return_value = None
        mock_instance.set.return_value = True
        mock_instance.delete.return_value = True
        yield mock_instance


@pytest.fixture(autouse=True)
def mock_celery():
    """Auto-mock Celery for all tests."""
    with patch("celery.Celery") as mock_celery:
        mock_instance = Mock()
        mock_celery.return_value = mock_instance
        mock_task = Mock()
        mock_task.delay.return_value = Mock(id="test-task-id")
        mock_instance.send_task.return_value = mock_task
        yield mock_instance
