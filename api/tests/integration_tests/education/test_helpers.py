import time
import uuid
from typing import Any

import requests
from requests.exceptions import ConnectionError, RequestException, Timeout


class DifyAPITestClient:
    """Test client for Dify API integration testing."""

    def __init__(self, base_url: str, api_key: str, timeout: float = 30.0):
        self.base_url = base_url.rstrip("/")
        self.api_key = api_key
        self.timeout = timeout
        self.session = requests.Session()
        self.session.headers.update({"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"})

    def _make_request(
        self,
        method: str,
        endpoint: str,
        data: dict | None = None,
        params: dict | None = None,
        files: dict | None = None,
    ) -> dict[str, Any]:
        """Make HTTP request to Dify API."""
        url = f"{self.base_url}{endpoint}"

        try:
            if files:
                # Remove Content-Type for file uploads
                headers = self.session.headers.copy()
                headers.pop("Content-Type", None)
                response = self.session.request(
                    method, url, json=data, params=params, files=files, timeout=self.timeout, headers=headers
                )
            else:
                response = self.session.request(method, url, json=data, params=params, timeout=self.timeout)

            response.raise_for_status()
            return response.json()

        except Timeout as e:
            raise e
        except ConnectionError:
            raise ConnectionError(f"Failed to connect to {url}")
        except RequestException as e:
            raise Exception(f"API request failed: {str(e)}")

    def create_agent(self, name: str = None, description: str = "", mode: str = "agent-chat", **kwargs) -> dict[str, Any]:
        """Create a new agent."""
        data = {"name": name, "description": description, "mode": mode, "icon_type": "emoji", "icon": "🤖"}
        # Merge additional kwargs into data
        data.update(kwargs)
        # Remove None values
        data = {k: v for k, v in data.items() if v is not None}
        return self._make_request("POST", "/console/api/apps", data=data)

    def get_agent(self, app_id: str) -> dict[str, Any]:
        """Get agent by ID."""
        return self._make_request("GET", f"/console/api/apps/{app_id}")

    def update_agent(self, app_id: str, **kwargs) -> dict[str, Any]:
        """Update agent."""
        return self._make_request("PUT", f"/console/api/apps/{app_id}", data=kwargs)

    def delete_agent(self, app_id: str) -> dict[str, Any]:
        """Delete agent."""
        return self._make_request("DELETE", f"/console/api/apps/{app_id}")

    def list_agents(self, page: int = 1, limit: int = 20) -> dict[str, Any]:
        """List all agents."""
        params = {"page": page, "limit": limit}
        return self._make_request("GET", "/console/api/apps", params=params)

    def run_workflow(self, app_id: str, inputs: dict[str, Any], user: str = "test-user") -> dict[str, Any]:
        """Run workflow."""
        data = {"inputs": inputs, "response_mode": "blocking", "user": user}
        return self._make_request("POST", "/v1/workflows/run", data=data)

    def create_dataset(self, name: str = None, description: str = "", **kwargs) -> dict[str, Any]:
        """Create RAG dataset."""
        data = {"name": name, "description": description}
        # Merge additional kwargs into data
        data.update(kwargs)
        # Remove None values
        data = {k: v for k, v in data.items() if v is not None}
        return self._make_request("POST", "/console/api/datasets", data=data)

    def upload_file(self, file_path: str, filename: str) -> dict[str, Any]:
        """Upload file."""
        with open(file_path, "rb") as f:
            files = {"file": (filename, f, "text/plain")}
            return self._make_request("POST", "/files/upload", files=files)


class EducationAPITestHelper:
    """Helper class for education API testing."""

    @staticmethod
    def create_test_user_data(
        name: str = "Test User", email: str | None = None, role: str = "student"
    ) -> dict[str, Any]:
        """Create test user data."""
        if not email:
            email = f"test-{uuid.uuid4().hex[:8]}@example.com"

        return {"name": name, "email": email, "role": role, "password": "test-password-123"}

    @staticmethod
    def create_test_group_data(
        name: str = "Test Group", description: str = "Test group for integration testing"
    ) -> dict[str, Any]:
        """Create test group data."""
        return {"name": name, "description": description, "max_members": 50}

    @staticmethod
    def create_test_session_data(
        name: str = "Test Session", group_id: str = "test-group-id", template_id: str = "test-template-id"
    ) -> dict[str, Any]:
        """Create test session data."""
        return {
            "name": name,
            "group_id": group_id,
            "template_id": template_id,
            "max_participants": 25,
            "duration_minutes": 120,
        }

    @staticmethod
    def create_test_template_data(name: str = "Test Template", type: str = "agent") -> dict[str, Any]:
        """Create test template data."""
        return {
            "name": name,
            "type": type,
            "description": "Test template for integration testing",
            "config": {"agent": {"name": "Test Agent", "instructions": "You are a helpful test assistant."}},
        }


class PerformanceTestHelper:
    """Helper for performance testing."""

    @staticmethod
    def measure_response_time(func, *args, **kwargs) -> tuple[Any, float]:
        """Measure function execution time."""
        start_time = time.time()
        result = func(*args, **kwargs)
        end_time = time.time()
        return result, end_time - start_time

    @staticmethod
    def assert_response_time(response_time: float, max_time: float, percentile: str = "p90"):
        """Assert response time meets performance requirements."""
        assert response_time <= max_time, (
            f"Response time {response_time:.2f}s exceeds {percentile} threshold of {max_time}s"
        )

    @staticmethod
    def create_concurrent_users_scenario(user_count: int, scenario_func, ramp_up_time: float = 10.0) -> list[float]:
        """Simulate concurrent users and return response times."""
        import concurrent.futures

        response_times = []

        def user_scenario():
            start_time = time.time()
            try:
                scenario_func()
                return time.time() - start_time
            except Exception as e:
                print(f"User scenario failed: {e}")
                return -1

        with concurrent.futures.ThreadPoolExecutor(max_workers=user_count) as executor:
            # Submit all tasks
            futures = []
            for i in range(user_count):
                # Stagger user starts over ramp-up time
                if i > 0:
                    time.sleep(ramp_up_time / user_count)
                future = executor.submit(user_scenario)
                futures.append(future)

            # Collect results
            for future in concurrent.futures.as_completed(futures):
                response_time = future.result()
                if response_time > 0:
                    response_times.append(response_time)

        return response_times


def assert_api_response_structure(
    response: dict[str, Any], required_fields: list[str], optional_fields: list[str] = None
):
    """Assert API response has expected structure."""
    optional_fields = optional_fields or []

    # Check required fields
    for field in required_fields:
        assert field in response, f"Required field '{field}' missing from response"

    # Verify data types for common fields
    if "id" in response:
        assert isinstance(response["id"], str), "ID should be string"

    if "created_at" in response:
        assert isinstance(response["created_at"], str | int), "created_at should be string or timestamp"

    if "updated_at" in response:
        assert isinstance(response["updated_at"], str | int), "updated_at should be string or timestamp"


def create_test_file(content: str = "Test file content", filename: str = "test.txt") -> str:
    """Create temporary test file."""
    import tempfile

    with tempfile.NamedTemporaryFile(mode="w", delete=False, suffix=filename) as f:
        f.write(content)
        return f.name


def cleanup_test_file(file_path: str):
    """Clean up temporary test file."""
    import os

    if os.path.exists(file_path):
        os.unlink(file_path)
