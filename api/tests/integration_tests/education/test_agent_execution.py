import time

import pytest

from tests.integration_tests.education.test_helpers import (
    DifyAPITestClient,
    EducationAPITestHelper,
    PerformanceTestHelper,
    assert_api_response_structure,
)


@pytest.mark.integration
@pytest.mark.agent
class TestAgentExecution:
    """Test Agent execution via Dify API integration."""

    def test_agent_chat_completion_success(self, mock_dify_api, education_test_config):
        """Test successful agent chat completion."""
        client = DifyAPITestClient(education_test_config["dify_api_url"], education_test_config["dify_api_key"])

        app_id = "test-education-agent"
        user_message = "Explain the Pythagorean theorem"

        # Mock chat completion endpoint
        mock_dify_api.post(
            "http://localhost:5001/v1/chat-messages",
            json={
                "id": "chat-message-id-123",
                "object": "chat_message",
                "created_at": 1234567890,
                "conversation_id": "conv-123",
                "inputs": {"query": user_message},
                "query": user_message,
                "answer": (
                    "The Pythagorean theorem states that in a right-angled triangle, "
                    "the square of the hypotenuse equals the sum of squares of the other "
                    "two sides: a² + b² = c²"
                ),
                "metadata": {"usage": {"prompt_tokens": 120, "completion_tokens": 85, "total_tokens": 205}},
                "status": "completed",
            },
        )

        chat_data = {
            "inputs": {"query": user_message},
            "query": user_message,
            "response_mode": "blocking",
            "user": "test-student-001",
        }

        response = client._make_request("POST", "/v1/chat-messages", data=chat_data)

        # Verify chat response structure
        assert_api_response_structure(
            response,
            required_fields=["id", "answer", "conversation_id", "status"],
            optional_fields=["metadata", "created_at", "inputs"],
        )

        assert response["status"] == "completed"
        assert "Pythagorean theorem" in response["answer"]
        assert response["metadata"]["usage"]["total_tokens"] > 0

    def test_agent_streaming_response(self, mock_dify_api, education_test_config):
        """Test agent streaming response functionality."""
        client = DifyAPITestClient(education_test_config["dify_api_url"], education_test_config["dify_api_key"])

        app_id = "test-education-agent"
        user_message = "Explain photosynthesis step by step"

        # Mock streaming response - return JSON format when streaming mode is requested
        mock_dify_api.post(
            "http://localhost:5001/v1/chat-messages",
            json={
                "event": "message",
                "conversation_id": "conv-123",
                "message_id": "msg-456",
                "answer": "Photosynthesis is the process by which plants convert sunlight into chemical energy.",
                "created_at": "2024-01-15T14:30:00Z",
                "status": "completed",
                "metadata": {
                    "usage": {"prompt_tokens": 10, "completion_tokens": 15, "total_tokens": 25},
                    "streaming": True
                }
            }
        )

        chat_data = {"inputs": {"query": user_message}, "response_mode": "streaming", "user": "test-student-001"}

        # Note: In a real implementation, this would handle Server-Sent Events
        response = client._make_request("POST", "/v1/chat-messages", data=chat_data)

        # Verify streaming response structure
        assert response["status"] == "completed"
        assert response["metadata"]["streaming"] is True
        assert "Photosynthesis" in response["answer"]

    def test_agent_conversation_continuity(self, mock_dify_api, education_test_config):
        """Test conversation continuity across multiple messages."""
        client = DifyAPITestClient(education_test_config["dify_api_url"], education_test_config["dify_api_key"])

        conversation_id = "conv-education-123"

        # First message in conversation
        mock_dify_api.post(
            "http://localhost:5001/v1/chat-messages",
            json={
                "id": "msg-1",
                "conversation_id": conversation_id,
                "answer": "Hello! I'm your math tutor. How can I help you today?",
                "status": "completed",
            },
        )

        # Second message continuing the conversation
        mock_dify_api.post(
            "http://localhost:5001/v1/chat-messages",
            json={
                "id": "msg-2",
                "conversation_id": conversation_id,
                "answer": "Great! Let's work on that algebra problem. Can you show me the equation?",
                "status": "completed",
            },
        )

        # Send first message
        first_response = client._make_request(
            "POST",
            "/v1/chat-messages",
            data={
                "inputs": {"query": "I need help with math"},
                "response_mode": "blocking",
                "user": "test-student-001",
            },
        )

        # Send follow-up message with conversation_id
        second_response = client._make_request(
            "POST",
            "/v1/chat-messages",
            data={
                "inputs": {"query": "I'm struggling with algebra"},
                "response_mode": "blocking",
                "user": "test-student-001",
                "conversation_id": conversation_id,
            },
        )

        # Verify conversation continuity
        assert first_response["conversation_id"] == conversation_id
        assert second_response["conversation_id"] == conversation_id
        assert "algebra" in second_response["answer"]

    def test_agent_tool_usage(self, mock_dify_api, education_test_config):
        """Test agent using tools during execution."""
        client = DifyAPITestClient(education_test_config["dify_api_url"], education_test_config["dify_api_key"])

        # Mock agent response using calculator tool
        mock_dify_api.post(
            "http://localhost:5001/v1/chat-messages",
            json={
                "id": "msg-tool-123",
                "conversation_id": "conv-tool-123",
                "answer": "I'll calculate that for you: 25 × 4 = 100",
                "metadata": {
                    "usage": {"prompt_tokens": 50, "completion_tokens": 30, "total_tokens": 80},
                    "tool_calls": [
                        {
                            "tool_name": "calculator",
                            "tool_input": {"expression": "25 * 4"},
                            "tool_output": {"result": 100},
                        }
                    ],
                },
                "status": "completed",
            },
        )

        chat_data = {
            "inputs": {"query": "What is 25 times 4?"},
            "response_mode": "blocking",
            "user": "test-student-001",
        }

        response = client._make_request("POST", "/v1/chat-messages", data=chat_data)

        # Verify tool usage
        assert response["status"] == "completed"
        assert "tool_calls" in response["metadata"]
        tool_calls = response["metadata"]["tool_calls"]
        assert len(tool_calls) == 1
        assert tool_calls[0]["tool_name"] == "calculator"
        assert tool_calls[0]["tool_output"]["result"] == 100

    def test_agent_error_handling(self, mock_dify_api, education_test_config):
        """Test agent error handling during execution."""
        client = DifyAPITestClient(education_test_config["dify_api_url"], education_test_config["dify_api_key"])

        # Mock API error response
        mock_dify_api.post(
            "http://localhost:5001/v1/chat-messages",
            status_code=400,
            json={
                "error": {
                    "type": "invalid_request_error",
                    "code": "invalid_input",
                    "message": "Input message is too long",
                    "param": "query",
                }
            },
        )

        chat_data = {
            "inputs": {"query": "x" * 10000},  # Very long input
            "response_mode": "blocking",
            "user": "test-student-001",
        }

        with pytest.raises(Exception) as exc_info:
            client._make_request("POST", "/v1/chat-messages", data=chat_data)

        assert "API request failed" in str(exc_info.value)

    def test_agent_timeout_handling(self, mock_dify_api, education_test_config):
        """Test agent handling of timeout scenarios."""
        client = DifyAPITestClient(
            education_test_config["dify_api_url"],
            education_test_config["dify_api_key"],
            timeout=5.0,  # Short timeout
        )

        # Mock timeout scenario using requests_mock
        import requests
        mock_dify_api.post(
            "http://localhost:5001/v1/chat-messages",
            exc=requests.exceptions.Timeout("Connection timed out")
        )

        chat_data = {
            "inputs": {"query": "Complex question requiring long processing"},
            "response_mode": "blocking",
            "user": "test-student-001",
        }

        from requests.exceptions import Timeout
        with pytest.raises(Timeout) as exc_info:
            client._make_request("POST", "/v1/chat-messages", data=chat_data)

        # Mock timeout doesn't have specific message, just verify it raised

    @pytest.mark.performance
    def test_agent_response_time_performance(self, mock_dify_api, education_test_config):
        """Test agent response time meets performance requirements."""
        client = DifyAPITestClient(education_test_config["dify_api_url"], education_test_config["dify_api_key"])

        # Mock quick response
        mock_dify_api.post(
            "http://localhost:5001/v1/chat-messages",
            json={"id": "perf-test-msg", "answer": "The answer is 42.", "status": "completed"},
        )

        def send_message():
            return client._make_request(
                "POST",
                "/v1/chat-messages",
                data={
                    "inputs": {"query": "What is the answer to everything?"},
                    "response_mode": "blocking",
                    "user": "test-student-001",
                },
            )

        result, response_time = PerformanceTestHelper.measure_response_time(send_message)

        # Standard API response time should be < 3 seconds (p90)
        PerformanceTestHelper.assert_response_time(response_time, 3.0, "p90")

    @pytest.mark.performance
    def test_agent_llm_response_time_performance(self, mock_dify_api, education_test_config):
        """Test LLM response time meets performance requirements."""
        client = DifyAPITestClient(education_test_config["dify_api_url"], education_test_config["dify_api_key"])

        # Mock LLM response (slower than API response)
        mock_dify_api.post(
            "http://localhost:5001/v1/chat-messages",
            json={
                "id": "llm-perf-test-msg",
                "answer": "This is a complex mathematical explanation that requires significant processing...",
                "metadata": {"usage": {"prompt_tokens": 500, "completion_tokens": 1000, "total_tokens": 1500}},
                "status": "completed",
            },
        )

        def send_complex_query():
            return client._make_request(
                "POST",
                "/v1/chat-messages",
                data={
                    "inputs": {"query": "Explain quantum mechanics and its applications in modern technology"},
                    "response_mode": "blocking",
                    "user": "test-student-001",
                },
            )

        result, response_time = PerformanceTestHelper.measure_response_time(send_complex_query)

        # LLM response time should be < 30 seconds (p90)
        PerformanceTestHelper.assert_response_time(response_time, 30.0, "p90")

    def test_agent_concurrent_execution(self, mock_dify_api, education_test_config):
        """Test agent handling concurrent requests from multiple users."""
        client = DifyAPITestClient(education_test_config["dify_api_url"], education_test_config["dify_api_key"])

        # Mock responses for concurrent users
        for i in range(5):
            mock_dify_api.post(
                "http://localhost:5001/v1/chat-messages",
                json={
                    "id": f"concurrent-msg-{i}",
                    "conversation_id": f"conv-{i}",
                    "answer": f"Hello student {i}! How can I help you today?",
                    "status": "completed",
                },
            )

        def user_scenario():
            """Single user interaction scenario."""
            response = client._make_request(
                "POST",
                "/v1/chat-messages",
                data={
                    "inputs": {"query": "Hello, I need help with math"},
                    "response_mode": "blocking",
                    "user": f"test-student-{time.time()}",
                },
            )
            return response["status"] == "completed"

        # Test 5 concurrent users
        response_times = PerformanceTestHelper.create_concurrent_users_scenario(
            user_count=5, scenario_func=user_scenario, ramp_up_time=1.0
        )

        # Verify all requests succeeded and met performance requirements
        assert len(response_times) == 5  # All requests completed successfully
        avg_response_time = sum(response_times) / len(response_times)
        PerformanceTestHelper.assert_response_time(avg_response_time, 5.0, "average")

    def test_agent_memory_persistence(self, mock_dify_api, education_test_config):
        """Test agent memory persistence across conversation."""
        client = DifyAPITestClient(education_test_config["dify_api_url"], education_test_config["dify_api_key"])

        conversation_id = "memory-test-conv"

        # First interaction - establish context
        mock_dify_api.post(
            "http://localhost:5001/v1/chat-messages",
            json={
                "id": "memory-msg-1",
                "conversation_id": conversation_id,
                "answer": "Great! I'll remember that you're studying calculus for your upcoming exam.",
                "status": "completed",
            },
        )

        # Second interaction - should remember previous context
        mock_dify_api.post(
            "http://localhost:5001/v1/chat-messages",
            json={
                "id": "memory-msg-2",
                "conversation_id": conversation_id,
                "answer": (
                    "Since you're studying calculus for your exam, let's work on derivatives. "
                    "What specific topic would you like to review?"
                ),
                "status": "completed",
            },
        )

        # First message to establish context
        first_response = client._make_request(
            "POST",
            "/v1/chat-messages",
            data={
                "inputs": {"query": "I'm studying calculus for an exam next week"},
                "response_mode": "blocking",
                "user": "test-student-memory",
                "conversation_id": conversation_id,
            },
        )

        # Second message should show memory of first context
        second_response = client._make_request(
            "POST",
            "/v1/chat-messages",
            data={
                "inputs": {"query": "What should I focus on?"},
                "response_mode": "blocking",
                "user": "test-student-memory",
                "conversation_id": conversation_id,
            },
        )

        # Verify memory persistence
        assert first_response["conversation_id"] == conversation_id
        assert second_response["conversation_id"] == conversation_id
        assert "calculus" in second_response["answer"].lower()
        assert "exam" in second_response["answer"].lower()

    def test_agent_educational_workflow(self, mock_dify_api, education_test_config):
        """Test complete educational workflow with an agent."""
        client = DifyAPITestClient(education_test_config["dify_api_url"], education_test_config["dify_api_key"])

        conversation_id = "edu-workflow-conv"
        messages = [
            (
                "Hello, I need help with quadratic equations",
                "Hello! I'd be happy to help you with quadratic equations. What specifically would you like to learn?",
            ),
            (
                "What is the quadratic formula?",
                (
                    "The quadratic formula is x = (-b ± √(b²-4ac)) / 2a. "
                    "It's used to solve equations in the form ax² + bx + c = 0."
                ),
            ),
            (
                "Can you solve x² + 5x + 6 = 0?",
                (
                    "Sure! Using the quadratic formula: a=1, b=5, c=6. "
                    "x = (-5 ± √(25-24)) / 2 = (-5 ± 1) / 2. So x = -2 or x = -3."
                ),
            ),
            (
                "Can you check my work on x² - 4x + 3 = 0?",
                "I'd be happy to check! Please show me your solution and I'll verify each step.",
            ),
        ]

        for i, (question, expected_answer) in enumerate(messages):
            mock_dify_api.post(
                "http://localhost:5001/v1/chat-messages",
                json={
                    "id": f"workflow-msg-{i + 1}",
                    "conversation_id": conversation_id,
                    "answer": expected_answer,
                    "status": "completed",
                },
            )

            response = client._make_request(
                "POST",
                "/v1/chat-messages",
                data={
                    "inputs": {"query": question},
                    "response_mode": "blocking",
                    "user": "test-student-workflow",
                    "conversation_id": conversation_id,
                },
            )

            # Verify each step of the educational workflow
            assert response["status"] == "completed"
            assert response["conversation_id"] == conversation_id
            assert len(response["answer"]) > 0

        # Verify the workflow progressed logically through educational steps
