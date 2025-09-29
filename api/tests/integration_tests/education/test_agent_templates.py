import pytest

from tests.integration_tests.education.test_helpers import (
    DifyAPITestClient,
    EducationAPITestHelper,
    assert_api_response_structure,
)


@pytest.mark.integration
@pytest.mark.agent
@pytest.mark.template
class TestAgentTemplates:
    """Test Agent template functionality via Dify API integration."""

    def test_create_agent_from_template(self, mock_dify_api, education_test_config):
        """Test creating agent from educational template."""
        client = DifyAPITestClient(education_test_config["dify_api_url"], education_test_config["dify_api_key"])

        template_data = EducationAPITestHelper.create_test_template_data(name="Math Tutor Template", type="agent")

        # Mock template-based agent creation
        mock_dify_api.post(
            "http://localhost:5001/console/api/apps",
            json={
                "data": {
                    "id": "template-agent-id",
                    "name": "Math Tutor Agent",
                    "mode": "agent-chat",
                    "template_id": "math-tutor-template",
                    "config": {
                        "prompt_template": {
                            "prompt": "You are a helpful math tutor. Help students learn mathematics step by step."
                        },
                        "model": {
                            "provider": "openai",
                            "name": "gpt-4",
                            "mode": "chat",
                            "completion_params": {"temperature": 0.7, "max_tokens": 2000},
                        },
                    },
                }
            },
        )

        agent_config = {
            "name": "Math Tutor Agent",
            "template_id": "math-tutor-template",
            "config": template_data["config"],
        }

        response = client.create_agent(**agent_config)

        # Verify template-based agent structure
        assert_api_response_structure(
            response["data"],
            required_fields=["id", "name", "mode", "template_id"],
            optional_fields=["config", "created_at"],
        )

        assert response["data"]["name"] == "Math Tutor Agent"
        assert response["data"]["template_id"] == "math-tutor-template"
        assert "config" in response["data"]

    def test_create_multiple_agents_from_same_template(self, mock_dify_api, education_test_config):
        """Test creating multiple agents from the same template."""
        client = DifyAPITestClient(education_test_config["dify_api_url"], education_test_config["dify_api_key"])

        template_id = "science-tutor-template"
        agent_names = ["Physics Helper", "Chemistry Assistant", "Biology Guide"]

        created_agents = []

        for i, name in enumerate(agent_names):
            agent_id = f"science-agent-{i + 1}"
            mock_dify_api.post(
                "http://localhost:5001/console/api/apps",
                json={"data": {"id": agent_id, "name": name, "mode": "agent-chat", "template_id": template_id}},
            )

            response = client.create_agent(name=name, template_id=template_id)
            created_agents.append(response["data"])

        # Verify all agents were created with same template
        assert len(created_agents) == 3
        for agent in created_agents:
            assert agent["template_id"] == template_id
            assert agent["name"] in agent_names

    def test_template_validation_success(self, mock_dify_api, education_test_config):
        """Test template validation for educational agents."""
        client = DifyAPITestClient(education_test_config["dify_api_url"], education_test_config["dify_api_key"])

        # Mock template validation endpoint
        mock_dify_api.post(
            "http://localhost:5001/console/api/apps/templates/validate",
            json={
                "data": {
                    "valid": True,
                    "validation_results": {
                        "prompt_template": "valid",
                        "model_config": "valid",
                        "tools_config": "valid",
                    },
                }
            },
        )

        template_config = {
            "prompt_template": {"prompt": "You are an educational assistant specialized in {{subject}}."},
            "model": {"provider": "openai", "name": "gpt-3.5-turbo"},
        }

        # This would be a custom validation method
        validation_response = client._make_request("POST", "/console/api/apps/templates/validate", data=template_config)

        assert validation_response["data"]["valid"] is True
        assert all(result == "valid" for result in validation_response["data"]["validation_results"].values())

    def test_template_validation_failure(self, mock_dify_api, education_test_config):
        """Test template validation failure scenarios."""
        client = DifyAPITestClient(education_test_config["dify_api_url"], education_test_config["dify_api_key"])

        # Mock validation failure
        mock_dify_api.post(
            "http://localhost:5001/console/api/apps/templates/validate",
            json={
                "data": {
                    "valid": False,
                    "validation_results": {
                        "prompt_template": "missing_required_variables",
                        "model_config": "unsupported_model",
                        "tools_config": "valid",
                    },
                    "errors": [
                        "Prompt template missing required variable: {{subject}}",
                        "Model 'gpt-5' is not supported",
                    ],
                }
            },
        )

        invalid_template_config = {
            "prompt_template": {
                "prompt": "You are an assistant."  # Missing {{subject}} variable
            },
            "model": {
                "provider": "openai",
                "name": "gpt-5",  # Non-existent model
            },
        }

        validation_response = client._make_request(
            "POST", "/console/api/apps/templates/validate", data=invalid_template_config
        )

        assert validation_response["data"]["valid"] is False
        assert len(validation_response["data"]["errors"]) > 0

    def test_agent_template_customization(self, mock_dify_api, education_test_config):
        """Test customizing agent template during creation."""
        client = DifyAPITestClient(education_test_config["dify_api_url"], education_test_config["dify_api_key"])

        # Mock customized template agent creation
        mock_dify_api.post(
            "http://localhost:5001/console/api/apps",
            json={
                "data": {
                    "id": "custom-template-agent",
                    "name": "Customized Math Tutor",
                    "mode": "agent-chat",
                    "template_id": "math-tutor-template",
                    "config": {
                        "prompt_template": {
                            "prompt": "You are a patient math tutor for grade 5 students. Use simple language and provide step-by-step solutions."
                        },
                        "model": {
                            "provider": "openai",
                            "name": "gpt-3.5-turbo",
                            "completion_params": {
                                "temperature": 0.3,  # Lower temperature for more consistent educational responses
                                "max_tokens": 1500,
                            },
                        },
                        "tools": ["calculator", "graphing_tool"],
                    },
                    "customizations": {"grade_level": "5", "subject_focus": "arithmetic", "language_style": "simple"},
                }
            },
        )

        customized_config = {
            "name": "Customized Math Tutor",
            "template_id": "math-tutor-template",
            "config": {
                "prompt_template": {
                    "prompt": "You are a patient math tutor for grade 5 students. Use simple language and provide step-by-step solutions."
                },
                "model": {"completion_params": {"temperature": 0.3}},
            },
            "customizations": {"grade_level": "5", "subject_focus": "arithmetic"},
        }

        response = client.create_agent(**customized_config)

        assert response["data"]["name"] == "Customized Math Tutor"
        assert response["data"]["config"]["model"]["completion_params"]["temperature"] == 0.3
        assert "customizations" in response["data"]

    def test_template_inheritance_and_overrides(self, mock_dify_api, education_test_config):
        """Test template inheritance with specific overrides."""
        client = DifyAPITestClient(education_test_config["dify_api_url"], education_test_config["dify_api_key"])

        base_template_id = "language-tutor-template"

        # Mock creation with overrides
        mock_dify_api.post(
            "http://localhost:5001/console/api/apps",
            json={
                "data": {
                    "id": "spanish-tutor-agent",
                    "name": "Spanish Conversation Tutor",
                    "mode": "agent-chat",
                    "template_id": base_template_id,
                    "config": {
                        "prompt_template": {
                            "prompt": "You are a Spanish conversation tutor. Conduct conversations in Spanish and provide corrections in English."
                        },
                        "model": {
                            "provider": "openai",
                            "name": "gpt-4",  # Override: Use GPT-4 for better language understanding
                            "completion_params": {
                                "temperature": 0.8  # Override: Higher temperature for more natural conversations
                            },
                        },
                    },
                    "inherited_from": {
                        "template_id": base_template_id,
                        "overrides": ["model.name", "model.completion_params.temperature", "prompt_template.prompt"],
                    },
                }
            },
        )

        override_config = {
            "name": "Spanish Conversation Tutor",
            "template_id": base_template_id,
            "config": {
                "prompt_template": {
                    "prompt": "You are a Spanish conversation tutor. Conduct conversations in Spanish and provide corrections in English."
                },
                "model": {"name": "gpt-4", "completion_params": {"temperature": 0.8}},
            },
        }

        response = client.create_agent(**override_config)

        assert response["data"]["template_id"] == base_template_id
        assert response["data"]["config"]["model"]["name"] == "gpt-4"
        assert response["data"]["config"]["model"]["completion_params"]["temperature"] == 0.8

    def test_list_available_templates(self, mock_dify_api, education_test_config):
        """Test listing available educational templates."""
        client = DifyAPITestClient(education_test_config["dify_api_url"], education_test_config["dify_api_key"])

        # Mock template listing endpoint
        mock_dify_api.get(
            "http://localhost:5001/console/api/apps/templates",
            json={
                "data": [
                    {
                        "id": "math-tutor-template",
                        "name": "Math Tutor",
                        "description": "Template for creating math tutoring agents",
                        "category": "education",
                        "grade_levels": ["K-12"],
                        "subjects": ["mathematics", "algebra", "geometry"],
                    },
                    {
                        "id": "science-lab-template",
                        "name": "Science Lab Assistant",
                        "description": "Template for virtual science lab experiments",
                        "category": "education",
                        "grade_levels": ["6-12"],
                        "subjects": ["chemistry", "physics", "biology"],
                    },
                ],
                "total": 2,
                "category_filters": ["education", "business", "creative"],
            },
        )

        response = client._make_request("GET", "/console/api/apps/templates")

        templates = response["data"]
        assert len(templates) == 2
        assert all(template["category"] == "education" for template in templates)

        # Verify template structure
        for template in templates:
            assert_api_response_structure(
                template,
                required_fields=["id", "name", "description", "category"],
                optional_fields=["grade_levels", "subjects", "created_at"],
            )

    def test_template_performance_with_large_config(self, mock_dify_api, education_test_config):
        """Test template-based agent creation performance with complex configuration."""
        client = DifyAPITestClient(education_test_config["dify_api_url"], education_test_config["dify_api_key"])

        # Mock complex template configuration
        complex_config = {
            "name": "Advanced Multi-Subject Tutor",
            "template_id": "advanced-tutor-template",
            "config": {
                "prompt_template": {
                    "prompt": "You are an advanced AI tutor capable of teaching multiple subjects...",
                    "variables": {"subject": "mathematics", "grade_level": "high_school", "learning_style": "visual"},
                },
                "model": {
                    "provider": "openai",
                    "name": "gpt-4",
                    "completion_params": {
                        "temperature": 0.7,
                        "max_tokens": 3000,
                        "top_p": 0.9,
                        "frequency_penalty": 0.1,
                    },
                },
                "tools": [
                    {"name": "calculator", "config": {"precision": 10}},
                    {"name": "graphing_tool", "config": {"grid_size": "20x20"}},
                    {"name": "code_executor", "config": {"languages": ["python", "javascript"]}},
                    {"name": "document_search", "config": {"max_results": 5}},
                ],
                "memory": {"type": "conversation", "max_tokens": 8000, "retrieval_method": "semantic"},
            },
        }

        mock_dify_api.post(
            "http://localhost:5001/console/api/apps",
            json={"data": {"id": "complex-agent", "name": "Advanced Multi-Subject Tutor", "mode": "agent-chat"}},
        )

        from tests.integration_tests.education.test_helpers import PerformanceTestHelper

        def create_complex_agent():
            return client.create_agent(**complex_config)

        result, response_time = PerformanceTestHelper.measure_response_time(create_complex_agent)

        # Even with complex configuration, should meet performance requirements
        PerformanceTestHelper.assert_response_time(response_time, 5.0, "p95")

    def test_template_version_compatibility(self, mock_dify_api, education_test_config):
        """Test template version compatibility and migration."""
        client = DifyAPITestClient(education_test_config["dify_api_url"], education_test_config["dify_api_key"])

        # Mock template version check
        mock_dify_api.get(
            "http://localhost:5001/console/api/apps/templates/language-tutor-template/versions",
            json={
                "data": {
                    "current_version": "2.0",
                    "available_versions": ["1.0", "1.5", "2.0"],
                    "compatibility": {"1.0": "deprecated", "1.5": "compatible_with_migration", "2.0": "current"},
                }
            },
        )

        version_info = client._make_request("GET", "/console/api/apps/templates/language-tutor-template/versions")

        assert version_info["data"]["current_version"] == "2.0"
        assert "1.0" in version_info["data"]["available_versions"]
        assert version_info["data"]["compatibility"]["2.0"] == "current"
