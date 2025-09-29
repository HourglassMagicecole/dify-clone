import time

import pytest

from tests.integration_tests.education.test_helpers import (
    DifyAPITestClient,
    EducationAPITestHelper,
    PerformanceTestHelper,
    assert_api_response_structure,
)


@pytest.mark.integration
@pytest.mark.workflow
class TestWorkflowExecution:
    """Test Workflow execution and monitoring via Dify API integration."""

    def test_workflow_execution_success(self, mock_dify_api, education_test_config):
        """Test successful workflow execution."""
        client = DifyAPITestClient(education_test_config["dify_api_url"], education_test_config["dify_api_key"])

        app_id = "test-education-workflow"
        workflow_inputs = {"math_problem": "What is the square root of 144?", "difficulty_level": "intermediate"}

        # Mock workflow execution
        mock_dify_api.post(
            "http://localhost:5001/v1/workflows/run",
            json={
                "workflow_run_id": "run-123",
                "task_id": "task-456",
                "status": "running",
                "data": {"inputs": workflow_inputs, "started_at": "2024-01-15T14:30:00Z"},
            },
        )

        response = client.run_workflow(app_id, workflow_inputs)

        # Verify workflow execution response
        assert_api_response_structure(
            response, required_fields=["workflow_run_id", "task_id", "status"], optional_fields=["data", "started_at"]
        )

        assert response["status"] == "running"
        assert response["data"]["inputs"] == workflow_inputs

    def test_workflow_execution_completion(self, mock_dify_api, education_test_config):
        """Test workflow execution completion monitoring."""
        client = DifyAPITestClient(education_test_config["dify_api_url"], education_test_config["dify_api_key"])

        workflow_run_id = "run-123"
        task_id = "task-456"

        # Mock workflow completion check
        mock_dify_api.get(
            f"http://localhost:5001/v1/workflows/run/{task_id}",
            json={
                "workflow_run_id": workflow_run_id,
                "task_id": task_id,
                "status": "succeeded",
                "data": {
                    "answer": "The square root of 144 is 12.",
                    "explanation": "144 = 12 × 12, so √144 = 12",
                    "steps": [
                        {"step": 1, "action": "analyze_problem", "result": "Find square root of 144"},
                        {"step": 2, "action": "calculate", "result": "√144 = 12"},
                        {"step": 3, "action": "verify", "result": "12² = 144 ✓"},
                    ],
                },
                "metadata": {
                    "total_tokens": 150,
                    "execution_time": 2.5,
                    "nodes_executed": ["start", "llm-analyze", "calculator", "end"],
                },
                "finished_at": "2024-01-15T14:30:05Z",
            },
        )

        response = client._make_request("GET", f"/v1/workflows/run/{task_id}")

        # Verify completion response
        assert response["status"] == "succeeded"
        assert "answer" in response["data"]
        assert "steps" in response["data"]
        assert len(response["data"]["steps"]) == 3
        assert response["metadata"]["execution_time"] == 2.5

    def test_workflow_streaming_execution(self, mock_dify_api, education_test_config):
        """Test workflow streaming execution."""
        client = DifyAPITestClient(education_test_config["dify_api_url"], education_test_config["dify_api_key"])

        app_id = "streaming-workflow"
        workflow_inputs = {"query": "Explain photosynthesis step by step"}

        # Mock streaming workflow execution - return JSON response
        mock_dify_api.post(
            "http://localhost:5001/v1/workflows/run",
            json={
                "workflow_run_id": "stream-run-123",
                "task_id": "stream-task-456",
                "status": "succeeded",
                "data": {
                    "final_output": (
                        "Photosynthesis is the process by which plants "
                        "convert sunlight into chemical energy"
                    ),
                    "streaming": True
                },
                "metadata": {
                    "streaming_mode": "enabled",
                    "events_count": 8
                }
            }
        )

        workflow_data = {"inputs": workflow_inputs, "response_mode": "streaming", "user": "test-student-001"}

        # Note: In real implementation, this would handle Server-Sent Events
        response = client._make_request("POST", "/v1/workflows/run", data=workflow_data)

        # Verify streaming response
        assert response["status"] == "succeeded"
        assert response["metadata"]["streaming_mode"] == "enabled"
        assert "Photosynthesis" in response["data"]["final_output"]

    def test_workflow_error_handling(self, mock_dify_api, education_test_config):
        """Test workflow error handling during execution."""
        client = DifyAPITestClient(education_test_config["dify_api_url"], education_test_config["dify_api_key"])

        app_id = "error-workflow"
        workflow_inputs = {"invalid_input": ""}

        # Mock workflow execution error
        mock_dify_api.post(
            "http://localhost:5001/v1/workflows/run",
            json={
                "workflow_run_id": "error-run-123",
                "task_id": "error-task-456",
                "status": "failed",
                "error": {
                    "type": "workflow_execution_error",
                    "code": "node_execution_failed",
                    "message": "LLM node failed to process input",
                    "details": {"failed_node": "llm-analyze", "error_reason": "Empty input provided"},
                },
            },
        )

        response = client.run_workflow(app_id, workflow_inputs)

        assert response["status"] == "failed"
        assert "error" in response
        assert response["error"]["details"]["failed_node"] == "llm-analyze"

    def test_workflow_timeout_handling(self, mock_dify_api, education_test_config):
        """Test workflow execution timeout handling."""
        client = DifyAPITestClient(
            education_test_config["dify_api_url"], education_test_config["dify_api_key"], timeout=5.0
        )

        app_id = "timeout-workflow"
        workflow_inputs = {"complex_query": "Very complex question requiring long processing"}

        # Mock timeout scenario using requests_mock
        import requests
        mock_dify_api.post(
            "http://localhost:5001/v1/workflows/run",
            exc=requests.exceptions.Timeout("Connection timed out")
        )

        from requests.exceptions import Timeout
        with pytest.raises(Timeout) as exc_info:
            client.run_workflow(app_id, workflow_inputs)

        # Mock timeout doesn't have specific message, just verify it raised

    def test_workflow_node_execution_tracking(self, mock_dify_api, education_test_config):
        """Test tracking individual node execution within workflow."""
        client = DifyAPITestClient(education_test_config["dify_api_url"], education_test_config["dify_api_key"])

        workflow_run_id = "tracking-run-123"
        task_id = "tracking-task-456"

        # Mock detailed execution tracking
        mock_dify_api.get(
            f"http://localhost:5001/v1/workflows/run/{task_id}/details",
            json={
                "workflow_run_id": workflow_run_id,
                "task_id": task_id,
                "status": "succeeded",
                "execution_details": {
                    "total_nodes": 5,
                    "executed_nodes": 5,
                    "node_executions": [
                        {
                            "node_id": "start",
                            "node_type": "start",
                            "status": "succeeded",
                            "started_at": "2024-01-15T14:30:00Z",
                            "finished_at": "2024-01-15T14:30:00.1Z",
                            "execution_time": 0.1,
                            "output": {"message": "Workflow started"},
                        },
                        {
                            "node_id": "llm-analyze",
                            "node_type": "llm",
                            "status": "succeeded",
                            "started_at": "2024-01-15T14:30:00.1Z",
                            "finished_at": "2024-01-15T14:30:02.5Z",
                            "execution_time": 2.4,
                            "output": {"analysis": "This is a square root problem"},
                            "metadata": {"model_used": "gpt-4", "tokens_used": 120},
                        },
                        {
                            "node_id": "calculator",
                            "node_type": "tool",
                            "status": "succeeded",
                            "started_at": "2024-01-15T14:30:02.5Z",
                            "finished_at": "2024-01-15T14:30:02.8Z",
                            "execution_time": 0.3,
                            "output": {"result": 12},
                            "metadata": {"tool_name": "calculator", "operation": "sqrt(144)"},
                        },
                    ],
                },
                "total_execution_time": 3.2,
                "finished_at": "2024-01-15T14:30:03.2Z",
            },
        )

        response = client._make_request("GET", f"/v1/workflows/run/{task_id}/details")

        # Verify detailed tracking
        execution_details = response["execution_details"]
        assert execution_details["total_nodes"] == 5
        assert execution_details["executed_nodes"] == 5
        assert len(execution_details["node_executions"]) == 3

        # Verify node execution details
        llm_node = execution_details["node_executions"][1]
        assert llm_node["node_type"] == "llm"
        assert llm_node["status"] == "succeeded"
        assert llm_node["execution_time"] == 2.4
        assert "tokens_used" in llm_node["metadata"]

    def test_workflow_parallel_node_execution(self, mock_dify_api, education_test_config):
        """Test workflow with parallel node execution."""
        client = DifyAPITestClient(education_test_config["dify_api_url"], education_test_config["dify_api_key"])

        app_id = "parallel-workflow"
        workflow_inputs = {"problem": "Solve this math problem from multiple approaches"}

        # Mock parallel execution workflow
        mock_dify_api.post(
            "http://localhost:5001/v1/workflows/run",
            json={
                "workflow_run_id": "parallel-run-123",
                "task_id": "parallel-task-456",
                "status": "succeeded",
                "data": {
                    "parallel_results": {
                        "algebraic_approach": "x = 5 using algebraic method",
                        "geometric_approach": "x = 5 using geometric visualization",
                        "numerical_approach": "x = 5 using numerical methods",
                    },
                    "combined_result": "All approaches confirm x = 5",
                },
                "metadata": {
                    "parallel_nodes_executed": ["algebra-solver", "geometry-solver", "numerical-solver"],
                    "parallel_execution_time": 4.2,
                    "sequential_equivalent_time": 12.6,
                },
            },
        )

        response = client.run_workflow(app_id, workflow_inputs)

        assert response["status"] == "succeeded"
        assert "parallel_results" in response["data"]
        assert len(response["data"]["parallel_results"]) == 3
        assert response["metadata"]["parallel_execution_time"] < response["metadata"]["sequential_equivalent_time"]

    @pytest.mark.performance
    def test_workflow_execution_performance(self, mock_dify_api, education_test_config):
        """Test workflow execution performance meets requirements."""
        client = DifyAPITestClient(education_test_config["dify_api_url"], education_test_config["dify_api_key"])

        app_id = "performance-workflow"
        workflow_inputs = {"query": "Quick calculation: 2 + 2"}

        # Mock fast workflow execution
        mock_dify_api.post(
            "http://localhost:5001/v1/workflows/run",
            json={
                "workflow_run_id": "perf-run-123",
                "task_id": "perf-task-456",
                "status": "succeeded",
                "data": {"answer": "4"},
            },
        )

        def execute_workflow():
            return client.run_workflow(app_id, workflow_inputs)

        result, response_time = PerformanceTestHelper.measure_response_time(execute_workflow)

        # Workflow execution should meet performance requirements
        PerformanceTestHelper.assert_response_time(response_time, 3.0, "p90")

    @pytest.mark.performance
    def test_complex_workflow_performance(self, mock_dify_api, education_test_config):
        """Test complex workflow performance meets LLM response requirements."""
        client = DifyAPITestClient(education_test_config["dify_api_url"], education_test_config["dify_api_key"])

        app_id = "complex-workflow"
        workflow_inputs = {
            "complex_problem": "Explain quantum mechanics and solve related equations",
            "detail_level": "comprehensive",
        }

        # Mock complex workflow with multiple LLM calls
        mock_dify_api.post(
            "http://localhost:5001/v1/workflows/run",
            json={
                "workflow_run_id": "complex-run-123",
                "task_id": "complex-task-456",
                "status": "succeeded",
                "data": {
                    "answer": "Comprehensive explanation of quantum mechanics...",
                    "equations_solved": 5,
                    "visualizations_created": 3,
                },
                "metadata": {"total_tokens": 3000, "llm_calls": 4, "execution_time": 25.5},
            },
        )

        def execute_complex_workflow():
            return client.run_workflow(app_id, workflow_inputs)

        result, response_time = PerformanceTestHelper.measure_response_time(execute_complex_workflow)

        # Complex workflow should meet LLM response time requirements (30s)
        PerformanceTestHelper.assert_response_time(response_time, 30.0, "p90")

    def test_workflow_concurrent_execution(self, mock_dify_api, education_test_config):
        """Test concurrent workflow executions."""
        client = DifyAPITestClient(education_test_config["dify_api_url"], education_test_config["dify_api_key"])

        app_id = "concurrent-workflow"

        # Mock concurrent execution responses
        for i in range(5):
            mock_dify_api.post(
                "http://localhost:5001/v1/workflows/run",
                json={
                    "workflow_run_id": f"concurrent-run-{i}",
                    "task_id": f"concurrent-task-{i}",
                    "status": "succeeded",
                    "data": {"answer": f"Result {i}"},
                },
            )

        def single_workflow_execution():
            """Single workflow execution scenario."""
            workflow_inputs = {"query": f"Query {time.time()}"}
            response = client.run_workflow(app_id, workflow_inputs)
            return response["status"] == "succeeded"

        # Test 5 concurrent workflow executions
        response_times = PerformanceTestHelper.create_concurrent_users_scenario(
            user_count=5, scenario_func=single_workflow_execution, ramp_up_time=1.0
        )

        # Verify all executions succeeded and met performance requirements
        assert len(response_times) == 5
        avg_response_time = sum(response_times) / len(response_times)
        PerformanceTestHelper.assert_response_time(avg_response_time, 5.0, "average")

    def test_workflow_state_persistence(self, mock_dify_api, education_test_config):
        """Test workflow state persistence across execution."""
        client = DifyAPITestClient(education_test_config["dify_api_url"], education_test_config["dify_api_key"])

        app_id = "stateful-workflow"
        workflow_run_id = "stateful-run-123"

        # Mock stateful workflow execution
        mock_dify_api.post(
            "http://localhost:5001/v1/workflows/run",
            json={
                "workflow_run_id": workflow_run_id,
                "task_id": "stateful-task-456",
                "status": "paused",
                "data": {
                    "current_state": {
                        "step": 2,
                        "variables": {"student_answer": "12", "correct_answer": "12", "attempts": 1},
                    },
                    "next_action": "provide_feedback",
                },
            },
        )

        # Mock workflow resume
        mock_dify_api.post(
            f"http://localhost:5001/v1/workflows/run/{workflow_run_id}/resume",
            json={
                "workflow_run_id": workflow_run_id,
                "task_id": "stateful-task-456",
                "status": "succeeded",
                "data": {
                    "feedback": "Correct! You got the right answer on your first attempt.",
                    "final_state": {
                        "step": 3,
                        "variables": {"student_answer": "12", "correct_answer": "12", "attempts": 1, "score": 100},
                    },
                },
            },
        )

        # Initial execution that pauses
        initial_response = client.run_workflow(app_id, {"problem": "sqrt(144)"})
        assert initial_response["status"] == "paused"
        assert initial_response["data"]["current_state"]["step"] == 2

        # Resume execution
        resume_response = client._make_request(
            "POST", f"/v1/workflows/run/{workflow_run_id}/resume", data={"user_input": "continue"}
        )
        assert resume_response["status"] == "succeeded"
        assert resume_response["data"]["final_state"]["variables"]["score"] == 100

    def test_workflow_branching_execution(self, mock_dify_api, education_test_config):
        """Test workflow with conditional branching."""
        client = DifyAPITestClient(education_test_config["dify_api_url"], education_test_config["dify_api_key"])

        app_id = "branching-workflow"

        # Mock workflow with conditional branches
        mock_dify_api.post(
            "http://localhost:5001/v1/workflows/run",
            json={
                "workflow_run_id": "branching-run-123",
                "task_id": "branching-task-456",
                "status": "succeeded",
                "data": {
                    "branch_taken": "beginner_path",
                    "condition": "difficulty_level == 'easy'",
                    "result": "Simplified explanation provided for beginner level",
                    "skipped_nodes": ["advanced_explanation", "complex_examples"],
                    "executed_nodes": ["start", "difficulty_check", "beginner_explanation", "simple_examples", "end"],
                },
                "metadata": {
                    "branching_decisions": [
                        {
                            "node_id": "difficulty_check",
                            "condition": "difficulty_level == 'easy'",
                            "result": "true",
                            "branch_taken": "beginner_path",
                        }
                    ]
                },
            },
        )

        workflow_inputs = {"problem": "What is addition?", "difficulty_level": "easy"}

        response = client.run_workflow(app_id, workflow_inputs)

        assert response["status"] == "succeeded"
        assert response["data"]["branch_taken"] == "beginner_path"
        assert "advanced_explanation" in response["data"]["skipped_nodes"]
        assert len(response["metadata"]["branching_decisions"]) == 1
