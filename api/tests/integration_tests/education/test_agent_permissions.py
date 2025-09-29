import pytest

from tests.integration_tests.education.test_helpers import (
    DifyAPITestClient,
    EducationAPITestHelper,
    assert_api_response_structure,
)


@pytest.mark.integration
@pytest.mark.agent
@pytest.mark.auth
class TestAgentPermissions:
    """Test Agent permissions and access control via Dify API integration."""

    def test_student_access_to_assigned_agent(self, mock_dify_api, education_test_config, mock_education_user):
        """Test student can access agents assigned to their group."""
        client = DifyAPITestClient(education_test_config["dify_api_url"], education_test_config["dify_api_key"])

        # Mock student user with group assignment
        student_user = mock_education_user.copy()
        student_user["role"] = "student"
        student_user["group_id"] = "math-class-001"

        app_id = "math-tutor-agent"

        # Mock agent access check
        mock_dify_api.get(
            f"http://localhost:5001/console/api/apps/{app_id}/permissions",
            json={
                "data": {
                    "user_access": True,
                    "permissions": ["read", "chat"],
                    "group_access": {"group_id": "math-class-001", "access_level": "student"},
                }
            },
        )

        # Mock successful agent access
        mock_dify_api.get(
            f"http://localhost:5001/console/api/apps/{app_id}",
            json={
                "data": {
                    "id": app_id,
                    "name": "Math Tutor Agent",
                    "mode": "agent-chat",
                    "accessible_to_groups": ["math-class-001"],
                }
            },
        )

        # Verify student can access the agent
        response = client.get_agent(app_id)
        assert response["data"]["id"] == app_id
        assert "math-class-001" in response["data"]["accessible_to_groups"]

    def test_student_denied_access_to_unassigned_agent(self, mock_dify_api, education_test_config, mock_education_user):
        """Test student cannot access agents not assigned to their group."""
        client = DifyAPITestClient(education_test_config["dify_api_url"], education_test_config["dify_api_key"])

        student_user = mock_education_user.copy()
        student_user["role"] = "student"
        student_user["group_id"] = "math-class-001"

        app_id = "science-lab-agent"  # Different subject agent

        # Mock access denied
        mock_dify_api.get(
            f"http://localhost:5001/console/api/apps/{app_id}",
            status_code=403,
            json={
                "error": {
                    "code": "access_denied",
                    "message": "User does not have permission to access this agent",
                    "details": {
                        "user_group": "math-class-001",
                        "required_groups": ["science-class-001", "science-class-002"],
                    },
                }
            },
        )

        with pytest.raises(Exception) as exc_info:
            client.get_agent(app_id)

        assert "API request failed" in str(exc_info.value)

    def test_teacher_access_to_all_class_agents(self, mock_dify_api, education_test_config, mock_education_user):
        """Test teacher can access all agents for their classes."""
        client = DifyAPITestClient(education_test_config["dify_api_url"], education_test_config["dify_api_key"])

        teacher_user = mock_education_user.copy()
        teacher_user["role"] = "teacher"
        teacher_user["managed_groups"] = ["math-class-001", "math-class-002"]

        # Mock teacher agent listing
        mock_dify_api.get(
            "http://localhost:5001/console/api/apps",
            json={
                "data": [
                    {
                        "id": "math-tutor-1",
                        "name": "Algebra Tutor",
                        "mode": "agent-chat",
                        "accessible_to_groups": ["math-class-001"],
                    },
                    {
                        "id": "math-tutor-2",
                        "name": "Geometry Tutor",
                        "mode": "agent-chat",
                        "accessible_to_groups": ["math-class-002"],
                    },
                ],
                "total": 2,
                "has_more": False,
            },
        )

        response = client.list_agents()

        # Teacher should see all agents from their managed groups
        assert len(response["data"]) == 2
        agent_ids = [agent["id"] for agent in response["data"]]
        assert "math-tutor-1" in agent_ids
        assert "math-tutor-2" in agent_ids

    def test_admin_full_agent_access(self, mock_dify_api, education_test_config, mock_education_user):
        """Test admin has full access to all agents."""
        client = DifyAPITestClient(education_test_config["dify_api_url"], education_test_config["dify_api_key"])

        admin_user = mock_education_user.copy()
        admin_user["role"] = "admin"

        # Mock admin agent listing - includes all agents
        mock_dify_api.get(
            "http://localhost:5001/console/api/apps",
            json={
                "data": [
                    {"id": "math-agent", "name": "Math Tutor", "mode": "agent-chat"},
                    {"id": "science-agent", "name": "Science Lab", "mode": "agent-chat"},
                    {"id": "english-agent", "name": "Writing Assistant", "mode": "agent-chat"},
                ],
                "total": 3,
                "has_more": False,
            },
        )

        # Mock admin can create agents
        mock_dify_api.post(
            "http://localhost:5001/console/api/apps",
            json={"data": {"id": "new-admin-agent", "name": "New Admin Agent", "mode": "agent-chat"}},
        )

        # Verify admin can list all agents
        list_response = client.list_agents()
        assert len(list_response["data"]) == 3

        # Verify admin can create agents
        create_response = client.create_agent("New Admin Agent")
        assert create_response["data"]["name"] == "New Admin Agent"

    def test_group_based_agent_isolation(self, mock_dify_api, education_test_config):
        """Test agents are properly isolated between different groups."""
        client = DifyAPITestClient(education_test_config["dify_api_url"], education_test_config["dify_api_key"])

        # Mock different group contexts
        group_a_agents = [{"id": "group-a-agent-1", "name": "Group A Math", "accessible_to_groups": ["group-a"]}]

        group_b_agents = [{"id": "group-b-agent-1", "name": "Group B Math", "accessible_to_groups": ["group-b"]}]

        # Mock Group A user's view
        mock_dify_api.get(
            "http://localhost:5001/console/api/apps?group_filter=group-a",
            json={"data": group_a_agents, "total": 1, "has_more": False},
        )

        # Mock Group B user's view
        mock_dify_api.get(
            "http://localhost:5001/console/api/apps?group_filter=group-b",
            json={"data": group_b_agents, "total": 1, "has_more": False},
        )

        # Test Group A user sees only Group A agents
        group_a_response = client._make_request("GET", "/console/api/apps?group_filter=group-a")
        assert len(group_a_response["data"]) == 1
        assert group_a_response["data"][0]["id"] == "group-a-agent-1"

        # Test Group B user sees only Group B agents
        group_b_response = client._make_request("GET", "/console/api/apps?group_filter=group-b")
        assert len(group_b_response["data"]) == 1
        assert group_b_response["data"][0]["id"] == "group-b-agent-1"

    def test_session_based_agent_access(self, mock_dify_api, education_test_config, mock_education_session):
        """Test agent access within educational sessions."""
        client = DifyAPITestClient(education_test_config["dify_api_url"], education_test_config["dify_api_key"])

        session_id = mock_education_session["id"]
        app_id = "session-math-agent"

        # Mock session-scoped agent access
        mock_dify_api.get(
            f"http://localhost:5001/console/api/apps/{app_id}/session-access",
            json={
                "data": {
                    "session_id": session_id,
                    "access_granted": True,
                    "access_level": "participant",
                    "session_status": "active",
                    "expires_at": "2024-12-31T23:59:59Z",
                }
            },
        )

        # Mock agent accessible within session
        mock_dify_api.get(
            f"http://localhost:5001/console/api/apps/{app_id}",
            json={
                "data": {
                    "id": app_id,
                    "name": "Session Math Agent",
                    "mode": "agent-chat",
                    "session_context": {"session_id": session_id, "max_participants": 25, "current_participants": 12},
                }
            },
        )

        # Verify session-based access
        session_access = client._make_request("GET", f"/console/api/apps/{app_id}/session-access")
        assert session_access["data"]["access_granted"] is True
        assert session_access["data"]["session_id"] == session_id

        agent_response = client.get_agent(app_id)
        assert agent_response["data"]["session_context"]["session_id"] == session_id

    def test_time_based_agent_access_control(self, mock_dify_api, education_test_config):
        """Test time-based access control for agents."""
        client = DifyAPITestClient(education_test_config["dify_api_url"], education_test_config["dify_api_key"])

        app_id = "time-restricted-agent"

        # Mock time-based access (currently within allowed hours)
        mock_dify_api.get(
            f"http://localhost:5001/console/api/apps/{app_id}/time-access",
            json={
                "data": {
                    "access_allowed": True,
                    "schedule": {
                        "days": ["monday", "tuesday", "wednesday", "thursday", "friday"],
                        "hours": {"start": "08:00", "end": "17:00"},
                        "timezone": "UTC",
                    },
                    "current_time": "2024-01-15T14:30:00Z",
                    "next_availability": None,
                }
            },
        )

        # Mock access during allowed hours
        mock_dify_api.get(
            f"http://localhost:5001/console/api/apps/{app_id}",
            json={
                "data": {
                    "id": app_id,
                    "name": "Time Restricted Agent",
                    "mode": "agent-chat",
                    "access_schedule": {"weekdays": "8AM-5PM", "timezone": "UTC"},
                }
            },
        )

        # Verify access is allowed during scheduled hours
        time_access = client._make_request("GET", f"/console/api/apps/{app_id}/time-access")
        assert time_access["data"]["access_allowed"] is True

        agent_response = client.get_agent(app_id)
        assert "access_schedule" in agent_response["data"]

    def test_rate_limiting_per_user_group(self, mock_dify_api, education_test_config):
        """Test rate limiting is properly applied per user group."""
        client = DifyAPITestClient(education_test_config["dify_api_url"], education_test_config["dify_api_key"])

        app_id = "rate-limited-agent"

        # Mock rate limit status
        mock_dify_api.get(
            f"http://localhost:5001/console/api/apps/{app_id}/rate-limit-status",
            json={
                "data": {
                    "group_id": "math-class-001",
                    "current_usage": {"requests_per_hour": 45, "requests_per_day": 180},
                    "limits": {"requests_per_hour": 100, "requests_per_day": 500},
                    "reset_times": {"hourly_reset": "2024-01-15T15:00:00Z", "daily_reset": "2024-01-16T00:00:00Z"},
                    "status": "within_limits",
                }
            },
        )

        # Mock successful request within limits
        mock_dify_api.post(
            "http://localhost:5001/v1/chat-messages",
            json={"id": "rate-limit-msg", "answer": "Hello! How can I help you today?", "status": "completed"},
        )

        # Check rate limit status
        rate_status = client._make_request("GET", f"/console/api/apps/{app_id}/rate-limit-status")
        assert rate_status["data"]["status"] == "within_limits"
        assert (
            rate_status["data"]["current_usage"]["requests_per_hour"]
            < rate_status["data"]["limits"]["requests_per_hour"]
        )

        # Make request within limits
        chat_response = client._make_request(
            "POST",
            "/v1/chat-messages",
            data={"inputs": {"query": "Hello"}, "response_mode": "blocking", "user": "test-student-001"},
        )
        assert chat_response["status"] == "completed"

    def test_rate_limit_exceeded_handling(self, mock_dify_api, education_test_config):
        """Test handling when rate limits are exceeded."""
        client = DifyAPITestClient(education_test_config["dify_api_url"], education_test_config["dify_api_key"])

        # Mock rate limit exceeded response
        mock_dify_api.post(
            "http://localhost:5001/v1/chat-messages",
            status_code=429,
            json={
                "error": {
                    "type": "rate_limit_exceeded",
                    "code": "too_many_requests",
                    "message": "Rate limit exceeded for group math-class-001",
                    "details": {
                        "retry_after": 1800,  # 30 minutes
                        "limit_type": "hourly",
                        "current_usage": 100,
                        "limit": 100,
                    },
                }
            },
        )

        with pytest.raises(Exception) as exc_info:
            client._make_request(
                "POST",
                "/v1/chat-messages",
                data={
                    "inputs": {"query": "This should be rate limited"},
                    "response_mode": "blocking",
                    "user": "test-student-001",
                },
            )

        assert "API request failed" in str(exc_info.value)

    def test_agent_sharing_permissions(self, mock_dify_api, education_test_config):
        """Test agent sharing permissions between groups."""
        client = DifyAPITestClient(education_test_config["dify_api_url"], education_test_config["dify_api_key"])

        app_id = "shared-math-agent"

        # Mock sharing permissions
        mock_dify_api.put(
            f"http://localhost:5001/console/api/apps/{app_id}/sharing",
            json={
                "data": {
                    "sharing_enabled": True,
                    "shared_with_groups": ["math-class-001", "math-class-002"],
                    "sharing_permissions": {
                        "math-class-001": ["read", "chat"],
                        "math-class-002": ["read", "chat", "share"],
                    },
                    "updated_at": "2024-01-15T14:30:00Z",
                }
            },
        )

        sharing_config = {
            "sharing_enabled": True,
            "shared_with_groups": ["math-class-001", "math-class-002"],
            "permissions": {"math-class-001": ["read", "chat"], "math-class-002": ["read", "chat", "share"]},
        }

        response = client._make_request("PUT", f"/console/api/apps/{app_id}/sharing", data=sharing_config)

        assert response["data"]["sharing_enabled"] is True
        assert len(response["data"]["shared_with_groups"]) == 2
        assert "math-class-001" in response["data"]["shared_with_groups"]
        assert "math-class-002" in response["data"]["shared_with_groups"]

    def test_agent_permission_inheritance(self, mock_dify_api, education_test_config):
        """Test permission inheritance from templates and groups."""
        client = DifyAPITestClient(education_test_config["dify_api_url"], education_test_config["dify_api_key"])

        app_id = "inherited-permissions-agent"

        # Mock permission inheritance
        mock_dify_api.get(
            f"http://localhost:5001/console/api/apps/{app_id}/permissions/inheritance",
            json={
                "data": {
                    "inherited_permissions": {
                        "from_template": {"template_id": "math-tutor-template", "permissions": ["read", "chat"]},
                        "from_group": {
                            "group_id": "math-class-001",
                            "permissions": ["read", "chat", "create_conversation"],
                        },
                        "direct_permissions": ["read", "chat", "create_conversation", "delete_conversation"],
                    },
                    "effective_permissions": ["read", "chat", "create_conversation", "delete_conversation"],
                    "permission_source": "combined",
                }
            },
        )

        permissions_response = client._make_request("GET", f"/console/api/apps/{app_id}/permissions/inheritance")

        # Verify permission inheritance structure
        assert "inherited_permissions" in permissions_response["data"]
        assert "effective_permissions" in permissions_response["data"]

        effective_perms = permissions_response["data"]["effective_permissions"]
        assert "read" in effective_perms
        assert "chat" in effective_perms
        assert "create_conversation" in effective_perms
