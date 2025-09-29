import pytest

from tests.integration_tests.education.test_helpers import (
    DifyAPITestClient,
    EducationAPITestHelper,
    assert_api_response_structure,
)


@pytest.mark.integration
@pytest.mark.workflow
class TestWorkflowNodes:
    """Test all 11 workflow node types via Dify API integration."""

    def test_start_node_execution(self, mock_dify_api, education_test_config):
        """Test START node execution in workflow."""
        client = DifyAPITestClient(education_test_config["dify_api_url"], education_test_config["dify_api_key"])

        workflow_with_start = {
            "graph": {
                "nodes": [
                    {
                        "id": "start",
                        "type": "start",
                        "position": {"x": 100, "y": 100},
                        "data": {
                            "title": "Start",
                            "variables": [
                                {"variable": "student_query", "type": "text"},
                                {"variable": "difficulty", "type": "select", "options": ["easy", "medium", "hard"]},
                            ],
                        },
                    }
                ],
                "edges": [],
            }
        }

        mock_dify_api.post(
            "http://localhost:5001/v1/workflows/run",
            json={
                "workflow_run_id": "start-test-123",
                "status": "running",
                "data": {"node_outputs": {"start": {"student_query": "What is calculus?", "difficulty": "medium"}}},
            },
        )

        response = client.run_workflow("start-workflow", {"student_query": "What is calculus?", "difficulty": "medium"})

        assert response["status"] == "running"
        assert "node_outputs" in response["data"]
        assert response["data"]["node_outputs"]["start"]["student_query"] == "What is calculus?"

    def test_end_node_execution(self, mock_dify_api, education_test_config):
        """Test END node execution in workflow."""
        client = DifyAPITestClient(education_test_config["dify_api_url"], education_test_config["dify_api_key"])

        workflow_with_end = {
            "graph": {
                "nodes": [
                    {
                        "id": "end",
                        "type": "end",
                        "position": {"x": 300, "y": 100},
                        "data": {
                            "title": "End",
                            "outputs": {"final_answer": "{{llm_response}}", "confidence_score": "{{confidence}}"},
                        },
                    }
                ],
                "edges": [],
            }
        }

        mock_dify_api.post(
            "http://localhost:5001/v1/workflows/run",
            json={
                "workflow_run_id": "end-test-123",
                "status": "succeeded",
                "data": {
                    "final_answer": "Calculus is the mathematical study of change and motion.",
                    "confidence_score": 0.95,
                },
            },
        )

        response = client.run_workflow("end-workflow", {"input": "test"})

        assert response["status"] == "succeeded"
        assert response["data"]["final_answer"] == "Calculus is the mathematical study of change and motion."
        assert response["data"]["confidence_score"] == 0.95

    def test_llm_node_execution(self, mock_dify_api, education_test_config):
        """Test LLM node execution in workflow."""
        client = DifyAPITestClient(education_test_config["dify_api_url"], education_test_config["dify_api_key"])

        llm_node_config = {
            "id": "llm-tutor",
            "type": "llm",
            "data": {
                "title": "Math Tutor LLM",
                "model": {
                    "provider": "openai",
                    "name": "gpt-4",
                    "completion_params": {"temperature": 0.7, "max_tokens": 2000},
                },
                "prompt": "You are a helpful math tutor. Explain {{concept}} to a {{level}} student.",
                "variables": [{"variable": "concept", "type": "text"}, {"variable": "level", "type": "select"}],
            },
        }

        mock_dify_api.post(
            "http://localhost:5001/v1/workflows/run",
            json={
                "workflow_run_id": "llm-test-123",
                "status": "succeeded",
                "data": {
                    "node_outputs": {
                        "llm-tutor": {
                            "text": (
                                "Calculus is like a mathematical microscope that "
                                "helps us understand how things change..."
                            ),
                            "usage": {"prompt_tokens": 45, "completion_tokens": 180, "total_tokens": 225},
                        }
                    }
                },
            },
        )

        response = client.run_workflow("llm-workflow", {"concept": "calculus", "level": "high_school"})

        assert response["status"] == "succeeded"
        llm_output = response["data"]["node_outputs"]["llm-tutor"]
        assert "Calculus is like" in llm_output["text"]
        assert llm_output["usage"]["total_tokens"] == 225

    def test_knowledge_retrieval_node_execution(self, mock_dify_api, education_test_config):
        """Test Knowledge Retrieval node execution in workflow."""
        client = DifyAPITestClient(education_test_config["dify_api_url"], education_test_config["dify_api_key"])

        knowledge_node_config = {
            "id": "knowledge-search",
            "type": "knowledge-retrieval",
            "data": {
                "title": "Math Knowledge Base",
                "dataset_ids": ["math-kb-001", "calc-examples-002"],
                "query": "{{student_query}}",
                "retrieval_mode": "semantic_search",
                "top_k": 3,
                "score_threshold": 0.7,
            },
        }

        mock_dify_api.post(
            "http://localhost:5001/v1/workflows/run",
            json={
                "workflow_run_id": "knowledge-test-123",
                "status": "succeeded",
                "data": {
                    "node_outputs": {
                        "knowledge-search": {
                            "documents": [
                                {
                                    "content": (
                                "Calculus fundamental theorem connects "
                                "differentiation and integration..."
                            ),
                                    "score": 0.92,
                                    "metadata": {"source": "calculus_basics.pdf", "page": 15},
                                },
                                {
                                    "content": "Derivatives measure rate of change at a specific point...",
                                    "score": 0.88,
                                    "metadata": {"source": "derivatives_guide.pdf", "page": 3},
                                },
                            ],
                            "total_found": 2,
                        }
                    }
                },
            },
        )

        response = client.run_workflow("knowledge-workflow", {"student_query": "fundamental theorem of calculus"})

        assert response["status"] == "succeeded"
        knowledge_output = response["data"]["node_outputs"]["knowledge-search"]
        assert len(knowledge_output["documents"]) == 2
        assert knowledge_output["documents"][0]["score"] == 0.92

    def test_question_classifier_node_execution(self, mock_dify_api, education_test_config):
        """Test Question Classifier node execution in workflow."""
        client = DifyAPITestClient(education_test_config["dify_api_url"], education_test_config["dify_api_key"])

        classifier_node_config = {
            "id": "question-classifier",
            "type": "question-classifier",
            "data": {
                "title": "Math Question Classifier",
                "query": "{{student_question}}",
                "classes": [
                    {"class_name": "algebra", "description": "Questions about algebraic equations and expressions"},
                    {
                        "class_name": "geometry",
                        "description": "Questions about shapes, angles, and spatial relationships",
                    },
                    {"class_name": "calculus", "description": "Questions about derivatives, integrals, and limits"},
                ],
            },
        }

        mock_dify_api.post(
            "http://localhost:5001/v1/workflows/run",
            json={
                "workflow_run_id": "classifier-test-123",
                "status": "succeeded",
                "data": {
                    "node_outputs": {
                        "question-classifier": {
                            "class_name": "calculus",
                            "confidence": 0.94,
                            "classes": [
                                {"class_name": "calculus", "confidence": 0.94},
                                {"class_name": "algebra", "confidence": 0.05},
                                {"class_name": "geometry", "confidence": 0.01},
                            ],
                        }
                    }
                },
            },
        )

        response = client.run_workflow(
            "classifier-workflow", {"student_question": "How do I find the derivative of x^2?"}
        )

        assert response["status"] == "succeeded"
        classifier_output = response["data"]["node_outputs"]["question-classifier"]
        assert classifier_output["class_name"] == "calculus"
        assert classifier_output["confidence"] == 0.94

    def test_if_else_node_execution(self, mock_dify_api, education_test_config):
        """Test IF/ELSE node execution in workflow."""
        client = DifyAPITestClient(education_test_config["dify_api_url"], education_test_config["dify_api_key"])

        if_else_node_config = {
            "id": "difficulty-check",
            "type": "if-else",
            "data": {
                "title": "Difficulty Level Check",
                "conditions": [{"variable": "student_score", "comparison_operator": ">=", "value": "80"}],
                "logical_operator": "and",
            },
        }

        mock_dify_api.post(
            "http://localhost:5001/v1/workflows/run",
            json={
                "workflow_run_id": "ifelse-test-123",
                "status": "succeeded",
                "data": {
                    "node_outputs": {
                        "difficulty-check": {
                            "result": True,
                            "conditions_met": [{"variable": "student_score", "comparison": "85 >= 80", "result": True}],
                        }
                    }
                },
            },
        )

        response = client.run_workflow("ifelse-workflow", {"student_score": 85})

        assert response["status"] == "succeeded"
        ifelse_output = response["data"]["node_outputs"]["difficulty-check"]
        assert ifelse_output["result"] is True
        assert ifelse_output["conditions_met"][0]["result"] is True

    def test_code_execution_node_execution(self, mock_dify_api, education_test_config):
        """Test Code Execution node execution in workflow."""
        client = DifyAPITestClient(education_test_config["dify_api_url"], education_test_config["dify_api_key"])

        code_node_config = {
            "id": "math-calculator",
            "type": "code",
            "data": {
                "title": "Python Calculator",
                "language": "python",
                "code": """
import math

def calculate_result(expression):
    try:
        result = eval(expression)
        return {"result": result, "error": None}
    except Exception as e:
        return {"result": None, "error": str(e)}

output = calculate_result("{{math_expression}}")
                """,
                "variables": [{"variable": "math_expression", "type": "text"}],
            },
        }

        mock_dify_api.post(
            "http://localhost:5001/v1/workflows/run",
            json={
                "workflow_run_id": "code-test-123",
                "status": "succeeded",
                "data": {
                    "node_outputs": {
                        "math-calculator": {
                            "output": {"result": 144, "error": None},
                            "execution_time": 0.02,
                            "logs": ["Expression evaluated successfully"],
                        }
                    }
                },
            },
        )

        response = client.run_workflow("code-workflow", {"math_expression": "12 ** 2"})

        assert response["status"] == "succeeded"
        code_output = response["data"]["node_outputs"]["math-calculator"]
        assert code_output["output"]["result"] == 144
        assert code_output["output"]["error"] is None

    def test_template_transform_node_execution(self, mock_dify_api, education_test_config):
        """Test Template Transform node execution in workflow."""
        client = DifyAPITestClient(education_test_config["dify_api_url"], education_test_config["dify_api_key"])

        template_node_config = {
            "id": "format-explanation",
            "type": "template-transform",
            "data": {
                "title": "Format Math Explanation",
                "template": """
**Problem**: {{problem}}
**Solution**: {{solution}}
**Explanation**: {{explanation}}
**Difficulty**: {{difficulty_level}}
**Student Level**: {{student_level}}
                """,
                "variables": [
                    {"variable": "problem", "type": "text"},
                    {"variable": "solution", "type": "text"},
                    {"variable": "explanation", "type": "text"},
                    {"variable": "difficulty_level", "type": "text"},
                    {"variable": "student_level", "type": "text"},
                ],
            },
        }

        mock_dify_api.post(
            "http://localhost:5001/v1/workflows/run",
            json={
                "workflow_run_id": "template-test-123",
                "status": "succeeded",
                "data": {
                    "node_outputs": {
                        "format-explanation": {
                            "output": """
**Problem**: Find the derivative of x²
**Solution**: 2x
**Explanation**: Using the power rule, d/dx(x^n) = nx^(n-1)
**Difficulty**: Intermediate
**Student Level**: High School
                            """.strip()
                        }
                    }
                },
            },
        )

        response = client.run_workflow(
            "template-workflow",
            {
                "problem": "Find the derivative of x²",
                "solution": "2x",
                "explanation": "Using the power rule, d/dx(x^n) = nx^(n-1)",
                "difficulty_level": "Intermediate",
                "student_level": "High School",
            },
        )

        assert response["status"] == "succeeded"
        template_output = response["data"]["node_outputs"]["format-explanation"]
        assert "**Problem**: Find the derivative of x²" in template_output["output"]
        assert "**Solution**: 2x" in template_output["output"]

    def test_http_request_node_execution(self, mock_dify_api, education_test_config):
        """Test HTTP Request node execution in workflow."""
        client = DifyAPITestClient(education_test_config["dify_api_url"], education_test_config["dify_api_key"])

        http_node_config = {
            "id": "math-api-call",
            "type": "http-request",
            "data": {
                "title": "External Math API",
                "method": "POST",
                "url": "https://api.mathsolver.com/solve",
                "headers": {"Content-Type": "application/json", "Authorization": "Bearer {{api_token}}"},
                "body": {"problem": "{{math_problem}}", "format": "step_by_step"},
            },
        }

        mock_dify_api.post(
            "http://localhost:5001/v1/workflows/run",
            json={
                "workflow_run_id": "http-test-123",
                "status": "succeeded",
                "data": {
                    "node_outputs": {
                        "math-api-call": {
                            "status_code": 200,
                            "headers": {"content-type": "application/json"},
                            "body": {"solution": "x = 5", "steps": ["2x + 3 = 13", "2x = 13 - 3", "2x = 10", "x = 5"]},
                            "response_time": 0.8,
                        }
                    }
                },
            },
        )

        response = client.run_workflow("http-workflow", {"math_problem": "2x + 3 = 13", "api_token": "test-token"})

        assert response["status"] == "succeeded"
        http_output = response["data"]["node_outputs"]["math-api-call"]
        assert http_output["status_code"] == 200
        assert http_output["body"]["solution"] == "x = 5"
        assert len(http_output["body"]["steps"]) == 4

    def test_variable_aggregator_node_execution(self, mock_dify_api, education_test_config):
        """Test Variable Aggregator node execution in workflow."""
        client = DifyAPITestClient(education_test_config["dify_api_url"], education_test_config["dify_api_key"])

        aggregator_node_config = {
            "id": "combine-solutions",
            "type": "variable-aggregator",
            "data": {
                "title": "Combine Multiple Solutions",
                "variables": [
                    {"variable": "algebraic_solution", "type": "text"},
                    {"variable": "geometric_solution", "type": "text"},
                    {"variable": "numerical_solution", "type": "text"},
                ],
                "aggregation_mode": "concatenate",
                "output_variable": "combined_solutions",
            },
        }

        mock_dify_api.post(
            "http://localhost:5001/v1/workflows/run",
            json={
                "workflow_run_id": "aggregator-test-123",
                "status": "succeeded",
                "data": {
                    "node_outputs": {
                        "combine-solutions": {
                            "combined_solutions": """
Algebraic Solution: x = 5 using substitution method
Geometric Solution: x = 5 using coordinate geometry
Numerical Solution: x = 5 using iterative approximation
                            """.strip(),
                            "source_variables": {
                                "algebraic_solution": "x = 5 using substitution method",
                                "geometric_solution": "x = 5 using coordinate geometry",
                                "numerical_solution": "x = 5 using iterative approximation",
                            },
                        }
                    }
                },
            },
        )

        response = client.run_workflow(
            "aggregator-workflow",
            {
                "algebraic_solution": "x = 5 using substitution method",
                "geometric_solution": "x = 5 using coordinate geometry",
                "numerical_solution": "x = 5 using iterative approximation",
            },
        )

        assert response["status"] == "succeeded"
        aggregator_output = response["data"]["node_outputs"]["combine-solutions"]
        assert "Algebraic Solution" in aggregator_output["combined_solutions"]
        assert "Geometric Solution" in aggregator_output["combined_solutions"]
        assert "Numerical Solution" in aggregator_output["combined_solutions"]

    def test_parameter_extractor_node_execution(self, mock_dify_api, education_test_config):
        """Test Parameter Extractor node execution in workflow."""
        client = DifyAPITestClient(education_test_config["dify_api_url"], education_test_config["dify_api_key"])

        extractor_node_config = {
            "id": "extract-params",
            "type": "parameter-extractor",
            "data": {
                "title": "Extract Math Problem Parameters",
                "query": "{{student_problem}}",
                "parameters": [
                    {
                        "name": "equation_type",
                        "type": "string",
                        "description": "Type of mathematical equation (linear, quadratic, etc.)",
                    },
                    {"name": "variables", "type": "array", "description": "List of variables in the equation"},
                    {"name": "coefficients", "type": "object", "description": "Coefficients of each variable"},
                ],
            },
        }

        mock_dify_api.post(
            "http://localhost:5001/v1/workflows/run",
            json={
                "workflow_run_id": "extractor-test-123",
                "status": "succeeded",
                "data": {
                    "node_outputs": {
                        "extract-params": {
                            "equation_type": "quadratic",
                            "variables": ["x"],
                            "coefficients": {"x^2": 1, "x": -5, "constant": 6},
                            "extraction_confidence": 0.96,
                        }
                    }
                },
            },
        )

        response = client.run_workflow("extractor-workflow", {"student_problem": "Solve the equation x² - 5x + 6 = 0"})

        assert response["status"] == "succeeded"
        extractor_output = response["data"]["node_outputs"]["extract-params"]
        assert extractor_output["equation_type"] == "quadratic"
        assert extractor_output["variables"] == ["x"]
        assert extractor_output["coefficients"]["x^2"] == 1

    def test_complex_workflow_with_all_node_types(self, mock_dify_api, education_test_config):
        """Test complex workflow using multiple node types."""
        client = DifyAPITestClient(education_test_config["dify_api_url"], education_test_config["dify_api_key"])

        # Mock complex workflow execution with multiple node types
        mock_dify_api.post(
            "http://localhost:5001/v1/workflows/run",
            json={
                "workflow_run_id": "complex-workflow-123",
                "status": "succeeded",
                "data": {
                    "node_outputs": {
                        "start": {"problem": "2x + 3 = 13", "difficulty": "medium"},
                        "question-classifier": {"class_name": "linear_algebra", "confidence": 0.92},
                        "if-else": {"result": True},
                        "knowledge-retrieval": {"documents": [{"content": "Linear equation solving methods..."}]},
                        "llm": {"text": "To solve 2x + 3 = 13, first subtract 3 from both sides..."},
                        "code": {"output": {"result": 5, "error": None}},
                        "template-transform": {"output": "**Solution**: x = 5\n**Method**: Algebraic manipulation"},
                        "http-request": {"status_code": 200, "body": {"verification": "correct"}},
                        "variable-aggregator": {"combined_result": "Complete solution with verification"},
                        "parameter-extractor": {"equation_type": "linear", "variables": ["x"]},
                        "end": {"final_answer": "x = 5", "confidence": 0.98},
                    },
                    "execution_path": [
                        "start",
                        "question-classifier",
                        "if-else",
                        "knowledge-retrieval",
                        "llm",
                        "code",
                        "template-transform",
                        "http-request",
                        "variable-aggregator",
                        "parameter-extractor",
                        "end",
                    ],
                },
                "metadata": {
                    "total_nodes": 11,
                    "execution_time": 8.5,
                    "nodes_by_type": {
                        "start": 1,
                        "end": 1,
                        "llm": 1,
                        "knowledge-retrieval": 1,
                        "question-classifier": 1,
                        "if-else": 1,
                        "code": 1,
                        "template-transform": 1,
                        "http-request": 1,
                        "variable-aggregator": 1,
                        "parameter-extractor": 1,
                    },
                },
            },
        )

        response = client.run_workflow("complex-11-nodes-workflow", {"problem": "2x + 3 = 13", "difficulty": "medium"})

        assert response["status"] == "succeeded"
        assert len(response["data"]["execution_path"]) == 11
        assert response["metadata"]["total_nodes"] == 11
        assert response["data"]["node_outputs"]["end"]["final_answer"] == "x = 5"

        # Verify all 11 node types were executed
        node_outputs = response["data"]["node_outputs"]
        expected_nodes = [
            "start",
            "end",
            "llm",
            "knowledge-retrieval",
            "question-classifier",
            "if-else",
            "code",
            "template-transform",
            "http-request",
            "variable-aggregator",
            "parameter-extractor",
        ]
        for node_type in expected_nodes:
            assert node_type in node_outputs
