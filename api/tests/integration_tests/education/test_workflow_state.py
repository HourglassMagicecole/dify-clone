import pytest

from tests.integration_tests.education.test_helpers import (
    DifyAPITestClient,
    EducationAPITestHelper,
    assert_api_response_structure,
)


@pytest.mark.integration
@pytest.mark.workflow
class TestWorkflowState:
    """Test Workflow state management via Dify API integration."""

    def test_workflow_state_initialization(self, mock_dify_api, education_test_config):
        """Test workflow state initialization on execution start."""
        client = DifyAPITestClient(education_test_config["dify_api_url"], education_test_config["dify_api_key"])

        app_id = "stateful-workflow"
        workflow_inputs = {"student_name": "Alice", "subject": "mathematics"}

        # Mock workflow state initialization
        mock_dify_api.post(
            "http://localhost:5001/v1/workflows/run",
            json={
                "workflow_run_id": "state-run-123",
                "task_id": "state-task-456",
                "status": "running",
                "data": {
                    "state": {
                        "session_id": "session-abc-123",
                        "current_step": 1,
                        "total_steps": 5,
                        "variables": {
                            "student_name": "Alice",
                            "subject": "mathematics",
                            "progress": 0,
                            "current_topic": None,
                            "completed_exercises": [],
                        },
                        "history": [
                            {
                                "timestamp": "2024-01-15T14:30:00Z",
                                "action": "workflow_started",
                                "data": {"inputs": workflow_inputs},
                            }
                        ],
                    }
                },
            },
        )

        response = client.run_workflow(app_id, workflow_inputs)

        # Verify state initialization
        assert response["status"] == "running"
        state = response["data"]["state"]
        assert state["current_step"] == 1
        assert state["total_steps"] == 5
        assert state["variables"]["student_name"] == "Alice"
        assert state["variables"]["progress"] == 0
        assert len(state["history"]) == 1

    def test_workflow_state_updates_during_execution(self, mock_dify_api, education_test_config):
        """Test workflow state updates as execution progresses."""
        client = DifyAPITestClient(education_test_config["dify_api_url"], education_test_config["dify_api_key"])

        task_id = "state-task-456"

        # Mock state progression through multiple steps
        state_updates = [
            {
                "current_step": 2,
                "variables": {"current_topic": "algebra", "progress": 25, "completed_exercises": ["basic_equations"]},
                "history": [{"action": "workflow_started"}, {"action": "topic_selected", "data": {"topic": "algebra"}}],
            },
            {
                "current_step": 3,
                "variables": {
                    "current_topic": "algebra",
                    "progress": 50,
                    "completed_exercises": ["basic_equations", "linear_systems"],
                },
                "history": [
                    {"action": "workflow_started"},
                    {"action": "topic_selected", "data": {"topic": "algebra"}},
                    {"action": "exercise_completed", "data": {"exercise": "linear_systems", "score": 85}},
                ],
            },
        ]

        for i, state_update in enumerate(state_updates):
            mock_dify_api.get(
                f"http://localhost:5001/v1/workflows/run/{task_id}",
                json={
                    "workflow_run_id": "state-run-123",
                    "task_id": task_id,
                    "status": "running" if i < len(state_updates) - 1 else "completed",
                    "data": {"state": state_update},
                },
            )

            response = client._make_request("GET", f"/v1/workflows/run/{task_id}")
            state = response["data"]["state"]

            assert state["current_step"] == state_update["current_step"]
            assert state["variables"]["progress"] == state_update["variables"]["progress"]
            assert len(state["history"]) == len(state_update["history"])

    def test_workflow_state_persistence_across_sessions(self, mock_dify_api, education_test_config):
        """Test workflow state persistence across different sessions."""
        client = DifyAPITestClient(education_test_config["dify_api_url"], education_test_config["dify_api_key"])

        session_id = "persistent-session-123"
        workflow_run_id = "persistent-run-456"

        # Mock state save
        mock_dify_api.post(
            f"http://localhost:5001/v1/workflows/run/{workflow_run_id}/save-state",
            json={
                "status": "saved",
                "data": {
                    "state_id": "state-abc-789",
                    "session_id": session_id,
                    "saved_at": "2024-01-15T14:35:00Z",
                    "state": {
                        "current_step": 3,
                        "variables": {"student_progress": 60, "completed_topics": ["algebra", "geometry"]},
                    },
                },
            },
        )

        # Mock state restore
        mock_dify_api.post(
            "http://localhost:5001/v1/workflows/run/restore-state",
            json={
                "workflow_run_id": "restored-run-789",
                "task_id": "restored-task-012",
                "status": "running",
                "data": {
                    "state": {
                        "current_step": 3,
                        "variables": {"student_progress": 60, "completed_topics": ["algebra", "geometry"]},
                        "restored_from": "state-abc-789",
                        "restored_at": "2024-01-15T15:00:00Z",
                    }
                },
            },
        )

        # Save current state
        save_response = client._make_request(
            "POST", f"/v1/workflows/run/{workflow_run_id}/save-state", data={"session_id": session_id}
        )
        assert save_response["status"] == "saved"
        state_id = save_response["data"]["state_id"]

        # Restore state in new session
        restore_response = client._make_request(
            "POST", "/v1/workflows/run/restore-state", data={"state_id": state_id, "session_id": session_id}
        )
        assert restore_response["status"] == "running"
        restored_state = restore_response["data"]["state"]
        assert restored_state["current_step"] == 3
        assert restored_state["variables"]["student_progress"] == 60

    def test_workflow_state_branching(self, mock_dify_api, education_test_config):
        """Test workflow state management with conditional branching."""
        client = DifyAPITestClient(education_test_config["dify_api_url"], education_test_config["dify_api_key"])

        app_id = "branching-workflow"
        workflow_inputs = {"student_level": "beginner", "topic": "calculus"}

        # Mock branching workflow execution
        mock_dify_api.post(
            "http://localhost:5001/v1/workflows/run",
            json={
                "workflow_run_id": "branch-run-123",
                "task_id": "branch-task-456",
                "status": "running",
                "data": {
                    "state": {
                        "current_step": 2,
                        "branch_history": [
                            {
                                "node_id": "level-check",
                                "condition": "student_level == 'beginner'",
                                "result": True,
                                "branch_taken": "beginner_path",
                            }
                        ],
                        "active_branch": "beginner_path",
                        "variables": {"difficulty_level": "easy", "explanation_style": "detailed", "examples_count": 5},
                        "skipped_branches": ["intermediate_path", "advanced_path"],
                    }
                },
            },
        )

        response = client.run_workflow(app_id, workflow_inputs)

        # Verify branching state
        assert response["status"] == "running"
        state = response["data"]["state"]
        assert state["active_branch"] == "beginner_path"
        assert len(state["branch_history"]) == 1
        assert state["branch_history"][0]["result"] is True
        assert "intermediate_path" in state["skipped_branches"]

    def test_workflow_state_rollback(self, mock_dify_api, education_test_config):
        """Test workflow state rollback functionality."""
        client = DifyAPITestClient(education_test_config["dify_api_url"], education_test_config["dify_api_key"])

        workflow_run_id = "rollback-run-123"
        task_id = "rollback-task-456"

        # Mock state rollback
        mock_dify_api.post(
            f"http://localhost:5001/v1/workflows/run/{workflow_run_id}/rollback",
            json={
                "workflow_run_id": workflow_run_id,
                "task_id": task_id,
                "status": "running",
                "data": {
                    "state": {
                        "current_step": 2,  # Rolled back from step 4
                        "variables": {
                            "student_answer": None,  # Reset
                            "attempts": 1,  # Preserved
                            "score": 0,  # Reset
                        },
                        "rollback_info": {
                            "from_step": 4,
                            "to_step": 2,
                            "reason": "incorrect_answer",
                            "rollback_timestamp": "2024-01-15T14:35:00Z",
                        },
                    }
                },
            },
        )

        rollback_response = client._make_request(
            "POST", f"/v1/workflows/run/{workflow_run_id}/rollback", data={"to_step": 2, "reason": "incorrect_answer"}
        )

        assert rollback_response["status"] == "running"
        state = rollback_response["data"]["state"]
        assert state["current_step"] == 2
        assert state["rollback_info"]["from_step"] == 4
        assert state["rollback_info"]["reason"] == "incorrect_answer"

    def test_workflow_state_validation(self, mock_dify_api, education_test_config):
        """Test workflow state validation and consistency checks."""
        client = DifyAPITestClient(education_test_config["dify_api_url"], education_test_config["dify_api_key"])

        workflow_run_id = "validation-run-123"

        # Mock state validation
        mock_dify_api.post(
            f"http://localhost:5001/v1/workflows/run/{workflow_run_id}/validate-state",
            json={
                "data": {
                    "validation_result": {
                        "is_valid": True,
                        "checks": {
                            "step_sequence": "valid",
                            "variable_types": "valid",
                            "required_variables": "valid",
                            "state_consistency": "valid",
                        },
                        "warnings": [],
                        "errors": [],
                    }
                }
            },
        )

        # Mock invalid state validation
        mock_dify_api.post(
            "http://localhost:5001/v1/workflows/run/invalid-run-456/validate-state",
            json={
                "data": {
                    "validation_result": {
                        "is_valid": False,
                        "checks": {
                            "step_sequence": "invalid",
                            "variable_types": "valid",
                            "required_variables": "invalid",
                            "state_consistency": "valid",
                        },
                        "warnings": ["Variable 'student_score' type mismatch"],
                        "errors": [
                            "Required variable 'student_id' is missing",
                            "Step sequence is out of order: step 5 before step 3",
                        ],
                    }
                }
            },
        )

        # Test valid state
        valid_response = client._make_request("POST", f"/v1/workflows/run/{workflow_run_id}/validate-state")
        validation = valid_response["data"]["validation_result"]
        assert validation["is_valid"] is True
        assert len(validation["errors"]) == 0

        # Test invalid state
        invalid_response = client._make_request("POST", "/v1/workflows/run/invalid-run-456/validate-state")
        invalid_validation = invalid_response["data"]["validation_result"]
        assert invalid_validation["is_valid"] is False
        assert len(invalid_validation["errors"]) == 2

    def test_workflow_state_variables_scoping(self, mock_dify_api, education_test_config):
        """Test workflow state variable scoping and isolation."""
        client = DifyAPITestClient(education_test_config["dify_api_url"], education_test_config["dify_api_key"])

        app_id = "scoped-workflow"

        # Mock workflow with variable scoping
        mock_dify_api.post(
            "http://localhost:5001/v1/workflows/run",
            json={
                "workflow_run_id": "scoped-run-123",
                "task_id": "scoped-task-456",
                "status": "running",
                "data": {
                    "state": {
                        "global_variables": {
                            "student_id": "student-123",
                            "session_id": "session-abc",
                            "workflow_version": "1.0",
                        },
                        "local_variables": {
                            "node-1": {"temp_calculation": 42, "local_result": "intermediate"},
                            "node-2": {"user_input": "calculus", "validation_status": "pending"},
                        },
                        "shared_variables": {
                            "current_problem": "derivative of x^2",
                            "difficulty_level": "intermediate",
                            "student_progress": 75,
                        },
                        "variable_access_map": {
                            "node-1": ["global_variables", "shared_variables", "local_variables.node-1"],
                            "node-2": ["global_variables", "shared_variables", "local_variables.node-2"],
                        },
                    }
                },
            },
        )

        response = client.run_workflow(app_id, {"problem_type": "calculus"})

        # Verify variable scoping
        assert response["status"] == "running"
        state = response["data"]["state"]
        assert "global_variables" in state
        assert "local_variables" in state
        assert "shared_variables" in state

        # Verify isolation
        assert "node-1" in state["local_variables"]
        assert "node-2" in state["local_variables"]
        assert state["local_variables"]["node-1"]["temp_calculation"] == 42
        assert state["local_variables"]["node-2"]["user_input"] == "calculus"

    def test_workflow_state_concurrency_handling(self, mock_dify_api, education_test_config):
        """Test workflow state handling with concurrent executions."""
        client = DifyAPITestClient(education_test_config["dify_api_url"], education_test_config["dify_api_key"])

        app_id = "concurrent-workflow"

        # Use a counter to track calls
        call_counter = {"count": 0}

        def concurrent_response(request, context):
            """Return different responses based on call order."""
            i = call_counter["count"]
            call_counter["count"] += 1
            return {
                "workflow_run_id": f"concurrent-run-{i}",
                "task_id": f"concurrent-task-{i}",
                "status": "running",
                "data": {
                    "state": {
                        "execution_id": f"exec-{i}",
                        "current_step": 1,
                        "variables": {
                            "student_id": f"student-{i}",
                            "problem": f"Problem {i}",
                            "start_time": f"2024-01-15T14:3{i}:00Z",
                        },
                        "isolation_level": "full",
                        "concurrent_execution": True,
                    }
                },
            }

        # Mock concurrent workflow executions with isolated states
        mock_dify_api.post(
            "http://localhost:5001/v1/workflows/run",
            json=concurrent_response
        )

        concurrent_responses = []
        for i in range(3):
            response = client.run_workflow(app_id, {"student_id": f"student-{i}", "problem": f"Problem {i}"})
            concurrent_responses.append(response)

        # Verify state isolation
        for i, response in enumerate(concurrent_responses):
            assert response["status"] == "running"
            state = response["data"]["state"]
            assert state["execution_id"] == f"exec-{i}"
            assert state["variables"]["student_id"] == f"student-{i}"
            assert state["concurrent_execution"] is True

    def test_workflow_state_cleanup(self, mock_dify_api, education_test_config):
        """Test workflow state cleanup after completion."""
        client = DifyAPITestClient(education_test_config["dify_api_url"], education_test_config["dify_api_key"])

        workflow_run_id = "cleanup-run-123"
        task_id = "cleanup-task-456"

        # Mock workflow completion and cleanup
        mock_dify_api.delete(
            f"http://localhost:5001/v1/workflows/run/{workflow_run_id}/state",
            json={
                "data": {
                    "cleanup_result": {
                        "state_removed": True,
                        "temporary_variables_cleared": True,
                        "session_data_preserved": True,
                        "cleanup_timestamp": "2024-01-15T14:40:00Z",
                        "preserved_data": {
                            "final_score": 95,
                            "completion_time": "2024-01-15T14:39:30Z",
                            "student_id": "student-123",
                        },
                    }
                }
            },
        )

        # Mock state access after cleanup (should fail)
        mock_dify_api.get(
            f"http://localhost:5001/v1/workflows/run/{task_id}",
            status_code=404,
            json={
                "error": {
                    "code": "state_not_found",
                    "message": "Workflow state has been cleaned up",
                    "details": {"workflow_run_id": workflow_run_id, "cleaned_up_at": "2024-01-15T14:40:00Z"},
                }
            },
        )

        # Test state cleanup
        cleanup_response = client._make_request("DELETE", f"/v1/workflows/run/{workflow_run_id}/state")
        cleanup_result = cleanup_response["data"]["cleanup_result"]
        assert cleanup_result["state_removed"] is True
        assert cleanup_result["temporary_variables_cleared"] is True
        assert cleanup_result["session_data_preserved"] is True

        # Test state access after cleanup
        with pytest.raises(Exception) as exc_info:
            client._make_request("GET", f"/v1/workflows/run/{task_id}")

        assert "API request failed" in str(exc_info.value)
