import pytest

from tests.integration_tests.education.test_helpers import (
    DifyAPITestClient,
    EducationAPITestHelper,
    PerformanceTestHelper,
    assert_api_response_structure,
)


@pytest.mark.integration
@pytest.mark.workflow
class TestWorkflowCRUD:
    """Test Workflow CRUD operations via Dify API integration."""

    def test_create_workflow_success(self, mock_dify_api, education_test_config):
        """Test successful workflow creation."""
        client = DifyAPITestClient(education_test_config["dify_api_url"], education_test_config["dify_api_key"])

        workflow_name = "Educational Math Workflow"
        workflow_description = "Step-by-step math problem solving workflow"

        # Mock workflow creation
        mock_dify_api.post(
            "http://localhost:5001/console/api/apps",
            json={
                "data": {
                    "id": "test-workflow-id",
                    "name": workflow_name,
                    "mode": "workflow",
                    "description": workflow_description,
                    "workflow_config": {"graph": {"nodes": [], "edges": []}},
                }
            },
        )

        response = client.create_agent(workflow_name, workflow_description, mode="workflow")

        # Verify response structure
        assert_api_response_structure(
            response["data"],
            required_fields=["id", "name", "mode"],
            optional_fields=["description", "workflow_config", "created_at"],
        )

        assert response["data"]["name"] == workflow_name
        assert response["data"]["mode"] == "workflow"

    def test_create_workflow_with_nodes(self, mock_dify_api, education_test_config):
        """Test workflow creation with predefined nodes."""
        client = DifyAPITestClient(education_test_config["dify_api_url"], education_test_config["dify_api_key"])

        workflow_config = {
            "name": "Math Problem Solver",
            "mode": "workflow",
            "workflow_config": {
                "graph": {
                    "nodes": [
                        {"id": "start", "type": "start", "position": {"x": 100, "y": 100}, "data": {"title": "Start"}},
                        {
                            "id": "llm-analyze",
                            "type": "llm",
                            "position": {"x": 300, "y": 100},
                            "data": {
                                "title": "Analyze Problem",
                                "model": {"provider": "openai", "name": "gpt-4"},
                                "prompt": "Analyze this math problem: {{problem}}",
                            },
                        },
                        {
                            "id": "calculator",
                            "type": "tool",
                            "position": {"x": 500, "y": 100},
                            "data": {"title": "Calculate", "tool_name": "calculator", "tool_input": "{{llm_result}}"},
                        },
                        {
                            "id": "end",
                            "type": "end",
                            "position": {"x": 700, "y": 100},
                            "data": {"title": "End", "output": "{{calculator_result}}"},
                        },
                    ],
                    "edges": [
                        {"source": "start", "target": "llm-analyze"},
                        {"source": "llm-analyze", "target": "calculator"},
                        {"source": "calculator", "target": "end"},
                    ],
                }
            },
        }

        mock_dify_api.post(
            "http://localhost:5001/console/api/apps",
            json={
                "data": {
                    "id": "workflow-with-nodes-id",
                    "name": "Math Problem Solver",
                    "mode": "workflow",
                    "workflow_config": workflow_config["workflow_config"],
                }
            },
        )

        response = client.create_agent(**workflow_config)

        assert response["data"]["mode"] == "workflow"
        assert "workflow_config" in response["data"]
        assert len(response["data"]["workflow_config"]["graph"]["nodes"]) == 4
        assert len(response["data"]["workflow_config"]["graph"]["edges"]) == 3

    def test_get_workflow_success(self, mock_dify_api, education_test_config):
        """Test successful workflow retrieval."""
        client = DifyAPITestClient(education_test_config["dify_api_url"], education_test_config["dify_api_key"])

        app_id = "test-workflow-id"
        mock_dify_api.get(
            f"http://localhost:5001/console/api/apps/{app_id}",
            json={
                "data": {
                    "id": app_id,
                    "name": "Educational Workflow",
                    "mode": "workflow",
                    "description": "Educational workflow for testing",
                    "workflow_config": {"graph": {"nodes": [{"id": "start", "type": "start"}], "edges": []}},
                }
            },
        )

        response = client.get_agent(app_id)

        assert_api_response_structure(
            response["data"],
            required_fields=["id", "name", "mode"],
            optional_fields=["description", "workflow_config", "created_at"],
        )

        assert response["data"]["id"] == app_id
        assert response["data"]["mode"] == "workflow"
        assert "workflow_config" in response["data"]

    def test_update_workflow_success(self, mock_dify_api, education_test_config):
        """Test successful workflow update."""
        client = DifyAPITestClient(education_test_config["dify_api_url"], education_test_config["dify_api_key"])

        app_id = "test-workflow-id"
        updated_name = "Updated Educational Workflow"

        mock_dify_api.put(
            f"http://localhost:5001/console/api/apps/{app_id}",
            json={
                "data": {
                    "id": app_id,
                    "name": updated_name,
                    "mode": "workflow",
                    "workflow_config": {
                        "graph": {
                            "nodes": [{"id": "start", "type": "start"}, {"id": "new-node", "type": "llm"}],
                            "edges": [{"source": "start", "target": "new-node"}],
                        }
                    },
                }
            },
        )

        update_data = {
            "name": updated_name,
            "workflow_config": {
                "graph": {
                    "nodes": [{"id": "start", "type": "start"}, {"id": "new-node", "type": "llm"}],
                    "edges": [{"source": "start", "target": "new-node"}],
                }
            },
        }

        response = client.update_agent(app_id, **update_data)

        assert response["data"]["name"] == updated_name
        assert len(response["data"]["workflow_config"]["graph"]["nodes"]) == 2

    def test_delete_workflow_success(self, mock_dify_api, education_test_config):
        """Test successful workflow deletion."""
        client = DifyAPITestClient(education_test_config["dify_api_url"], education_test_config["dify_api_key"])

        app_id = "test-workflow-id"
        mock_dify_api.delete(f"http://localhost:5001/console/api/apps/{app_id}", json={"result": "success"})

        response = client.delete_agent(app_id)
        assert response["result"] == "success"

    def test_list_workflows_success(self, mock_dify_api, education_test_config):
        """Test successful workflow listing."""
        client = DifyAPITestClient(education_test_config["dify_api_url"], education_test_config["dify_api_key"])

        mock_workflows = [
            {
                "id": f"workflow-{i}",
                "name": f"Educational Workflow {i}",
                "mode": "workflow",
                "description": f"Workflow {i} for education",
            }
            for i in range(3)
        ]

        mock_dify_api.get(
            "http://localhost:5001/console/api/apps?mode=workflow",
            json={"data": mock_workflows, "has_more": False, "limit": 20, "page": 1, "total": 3},
        )

        response = client._make_request("GET", "/console/api/apps?mode=workflow")

        assert "data" in response
        assert len(response["data"]) == 3
        assert response["total"] == 3

        # Verify all returned items are workflows
        for workflow in response["data"]:
            assert workflow["mode"] == "workflow"
            assert_api_response_structure(workflow, required_fields=["id", "name", "mode"])

    def test_workflow_validation_success(self, mock_dify_api, education_test_config):
        """Test workflow validation before creation."""
        client = DifyAPITestClient(education_test_config["dify_api_url"], education_test_config["dify_api_key"])

        workflow_graph = {
            "nodes": [
                {"id": "start", "type": "start"},
                {"id": "llm", "type": "llm", "data": {"model": {"provider": "openai", "name": "gpt-3.5-turbo"}}},
                {"id": "end", "type": "end"},
            ],
            "edges": [{"source": "start", "target": "llm"}, {"source": "llm", "target": "end"}],
        }

        mock_dify_api.post(
            "http://localhost:5001/console/api/workflows/validate",
            json={
                "data": {
                    "valid": True,
                    "validation_results": {
                        "graph_structure": "valid",
                        "node_configurations": "valid",
                        "edge_connections": "valid",
                    },
                }
            },
        )

        validation_response = client._make_request(
            "POST", "/console/api/workflows/validate", data={"graph": workflow_graph}
        )

        assert validation_response["data"]["valid"] is True
        assert validation_response["data"]["validation_results"]["graph_structure"] == "valid"

    def test_workflow_validation_failure(self, mock_dify_api, education_test_config):
        """Test workflow validation with invalid configuration."""
        client = DifyAPITestClient(education_test_config["dify_api_url"], education_test_config["dify_api_key"])

        invalid_workflow_graph = {
            "nodes": [
                {"id": "start", "type": "start"},
                {"id": "llm", "type": "llm"},  # Missing required model configuration
                {"id": "end", "type": "end"},
            ],
            "edges": [
                {"source": "start", "target": "missing-node"},  # Edge to non-existent node
                {"source": "llm", "target": "end"},
            ],
        }

        mock_dify_api.post(
            "http://localhost:5001/console/api/workflows/validate",
            json={
                "data": {
                    "valid": False,
                    "validation_results": {
                        "graph_structure": "invalid",
                        "node_configurations": "invalid",
                        "edge_connections": "invalid",
                    },
                    "errors": [
                        "LLM node 'llm' is missing required model configuration",
                        "Edge references non-existent node 'missing-node'",
                    ],
                }
            },
        )

        validation_response = client._make_request(
            "POST", "/console/api/workflows/validate", data={"graph": invalid_workflow_graph}
        )

        assert validation_response["data"]["valid"] is False
        assert len(validation_response["data"]["errors"]) == 2

    def test_workflow_duplication(self, mock_dify_api, education_test_config):
        """Test workflow duplication functionality."""
        client = DifyAPITestClient(education_test_config["dify_api_url"], education_test_config["dify_api_key"])

        source_workflow_id = "source-workflow-id"

        mock_dify_api.post(
            f"http://localhost:5001/console/api/apps/{source_workflow_id}/duplicate",
            json={
                "data": {
                    "id": "duplicated-workflow-id",
                    "name": "Copy of Educational Workflow",
                    "mode": "workflow",
                    "workflow_config": {
                        "graph": {
                            "nodes": [
                                {"id": "start", "type": "start"},
                                {"id": "llm", "type": "llm"},
                                {"id": "end", "type": "end"},
                            ],
                            "edges": [{"source": "start", "target": "llm"}, {"source": "llm", "target": "end"}],
                        }
                    },
                    "duplicated_from": source_workflow_id,
                }
            },
        )

        duplicate_config = {"name": "Copy of Educational Workflow", "include_data": True}

        response = client._make_request(
            "POST", f"/console/api/apps/{source_workflow_id}/duplicate", data=duplicate_config
        )

        assert response["data"]["duplicated_from"] == source_workflow_id
        assert "Copy of" in response["data"]["name"]
        assert response["data"]["mode"] == "workflow"

    @pytest.mark.performance
    def test_create_workflow_performance(self, mock_dify_api, education_test_config):
        """Test workflow creation performance meets requirements."""
        client = DifyAPITestClient(education_test_config["dify_api_url"], education_test_config["dify_api_key"])

        # Mock workflow with reasonable complexity
        complex_workflow = {
            "name": "Performance Test Workflow",
            "mode": "workflow",
            "workflow_config": {
                "graph": {
                    "nodes": [{"id": f"node-{i}", "type": "llm" if i % 2 == 0 else "tool"} for i in range(10)],
                    "edges": [{"source": f"node-{i}", "target": f"node-{i + 1}"} for i in range(9)],
                }
            },
        }

        mock_dify_api.post(
            "http://localhost:5001/console/api/apps",
            json={"data": {"id": "perf-workflow", "name": "Performance Test Workflow", "mode": "workflow"}},
        )

        def create_complex_workflow():
            return client.create_agent(**complex_workflow)

        result, response_time = PerformanceTestHelper.measure_response_time(create_complex_workflow)

        # Workflow creation should meet performance requirements
        PerformanceTestHelper.assert_response_time(response_time, 3.0, "p90")

    @pytest.mark.performance
    def test_list_workflows_performance(self, mock_dify_api, education_test_config):
        """Test workflow listing performance with large dataset."""
        client = DifyAPITestClient(education_test_config["dify_api_url"], education_test_config["dify_api_key"])

        # Mock large workflow list
        large_workflow_list = [
            {
                "id": f"workflow-{i}",
                "name": f"Workflow {i}",
                "mode": "workflow",
                "description": f"Educational workflow {i}",
            }
            for i in range(50)
        ]

        mock_dify_api.get(
            "http://localhost:5001/console/api/apps?mode=workflow",
            json={
                "data": large_workflow_list[:20],  # Return first page
                "has_more": True,
                "limit": 20,
                "page": 1,
                "total": 50,
            },
        )

        def list_workflows():
            return client._make_request("GET", "/console/api/apps?mode=workflow")

        result, response_time = PerformanceTestHelper.measure_response_time(list_workflows)

        # Listing performance should meet requirements
        PerformanceTestHelper.assert_response_time(response_time, 3.0, "p90")

    def test_workflow_crud_workflow(self, mock_dify_api, education_test_config):
        """Test complete CRUD workflow for workflows."""
        client = DifyAPITestClient(education_test_config["dify_api_url"], education_test_config["dify_api_key"])

        workflow_name = "CRUD Test Workflow"
        app_id = "crud-workflow-id"

        # Step 1: Create workflow
        mock_dify_api.post(
            "http://localhost:5001/console/api/apps",
            json={"data": {"id": app_id, "name": workflow_name, "mode": "workflow"}},
        )
        create_response = client.create_agent(workflow_name, mode="workflow")
        assert create_response["data"]["name"] == workflow_name

        # Step 2: Get created workflow
        mock_dify_api.get(
            f"http://localhost:5001/console/api/apps/{app_id}",
            json={"data": {"id": app_id, "name": workflow_name, "mode": "workflow"}},
        )
        get_response = client.get_agent(app_id)
        assert get_response["data"]["name"] == workflow_name

        # Step 3: Update workflow
        updated_name = "Updated CRUD Workflow"
        mock_dify_api.put(
            f"http://localhost:5001/console/api/apps/{app_id}",
            json={"data": {"id": app_id, "name": updated_name, "mode": "workflow"}},
        )
        update_response = client.update_agent(app_id, name=updated_name)
        assert update_response["data"]["name"] == updated_name

        # Step 4: Delete workflow
        mock_dify_api.delete(f"http://localhost:5001/console/api/apps/{app_id}", json={"result": "success"})
        delete_response = client.delete_agent(app_id)
        assert delete_response["result"] == "success"

    def test_workflow_import_export(self, mock_dify_api, education_test_config):
        """Test workflow import and export functionality."""
        client = DifyAPITestClient(education_test_config["dify_api_url"], education_test_config["dify_api_key"])

        app_id = "export-workflow-id"

        # Mock workflow export
        mock_dify_api.get(
            f"http://localhost:5001/console/api/apps/{app_id}/export",
            json={
                "data": {
                    "workflow_definition": {
                        "name": "Exported Workflow",
                        "mode": "workflow",
                        "workflow_config": {"graph": {"nodes": [{"id": "start", "type": "start"}], "edges": []}},
                    },
                    "export_version": "1.0",
                    "exported_at": "2024-01-15T14:30:00Z",
                }
            },
        )

        # Mock workflow import
        mock_dify_api.post(
            "http://localhost:5001/console/api/apps/import",
            json={
                "data": {
                    "id": "imported-workflow-id",
                    "name": "Imported Workflow",
                    "mode": "workflow",
                    "import_status": "success",
                }
            },
        )

        # Test export
        export_response = client._make_request("GET", f"/console/api/apps/{app_id}/export")
        assert "workflow_definition" in export_response["data"]
        assert export_response["data"]["export_version"] == "1.0"

        # Test import
        import_data = export_response["data"]["workflow_definition"]
        import_response = client._make_request("POST", "/console/api/apps/import", data=import_data)
        assert import_response["data"]["import_status"] == "success"
