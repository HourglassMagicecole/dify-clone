import pytest

from tests.integration_tests.education.test_helpers import (
    DifyAPITestClient,
    EducationAPITestHelper,
    PerformanceTestHelper,
    assert_api_response_structure,
)


@pytest.mark.integration
@pytest.mark.rag
class TestDatasetCRUD:
    """Test Dataset CRUD operations via Dify API integration."""

    def test_create_dataset_success(self, mock_dify_api, education_test_config):
        """Test successful dataset creation."""
        client = DifyAPITestClient(education_test_config["dify_api_url"], education_test_config["dify_api_key"])

        dataset_name = "Mathematics Knowledge Base"
        dataset_description = "Comprehensive mathematics knowledge base for educational purposes"

        # Mock dataset creation
        mock_dify_api.post(
            "http://localhost:5001/console/api/datasets",
            json={
                "data": {
                    "id": "dataset-math-kb-123",
                    "name": dataset_name,
                    "description": dataset_description,
                    "provider": "vendor",
                    "permission": "only_me",
                    "data_source_type": "upload_file",
                    "indexing_technique": "high_quality",
                    "app_count": 0,
                    "document_count": 0,
                    "word_count": 0,
                    "created_by": "test-user-001",
                    "created_at": "2024-01-15T14:30:00Z",
                }
            },
        )

        response = client.create_dataset(dataset_name, dataset_description)

        # Verify dataset creation response
        assert_api_response_structure(
            response["data"],
            required_fields=["id", "name", "description", "provider", "permission"],
            optional_fields=["data_source_type", "indexing_technique", "created_at", "created_by"],
        )

        assert response["data"]["name"] == dataset_name
        assert response["data"]["description"] == dataset_description
        assert response["data"]["document_count"] == 0
        assert response["data"]["word_count"] == 0

    def test_create_dataset_with_advanced_config(self, mock_dify_api, education_test_config):
        """Test dataset creation with advanced configuration."""
        client = DifyAPITestClient(education_test_config["dify_api_url"], education_test_config["dify_api_key"])

        advanced_config = {
            "name": "Advanced Physics Dataset",
            "description": "Advanced physics concepts and formulas",
            "indexing_technique": "high_quality",
            "permission": "all_team_members",
            "retrieval_model": {
                "search_method": "semantic_search",
                "reranking_enable": True,
                "reranking_model": {"reranking_provider_name": "cohere", "reranking_model_name": "rerank-english-v2.0"},
                "top_k": 5,
                "score_threshold_enabled": True,
                "score_threshold": 0.7,
            },
            "embedding_model": {"embedding_provider_name": "openai", "embedding_model_name": "text-embedding-ada-002"},
        }

        mock_dify_api.post(
            "http://localhost:5001/console/api/datasets",
            json={
                "data": {
                    "id": "dataset-advanced-physics-456",
                    "name": "Advanced Physics Dataset",
                    "description": "Advanced physics concepts and formulas",
                    "indexing_technique": "high_quality",
                    "permission": "all_team_members",
                    "retrieval_model": advanced_config["retrieval_model"],
                    "embedding_model": advanced_config["embedding_model"],
                    "created_at": "2024-01-15T14:30:00Z",
                }
            },
        )

        response = client.create_dataset(**advanced_config)

        # Verify advanced configuration
        assert response["data"]["indexing_technique"] == "high_quality"
        assert response["data"]["permission"] == "all_team_members"
        assert response["data"]["retrieval_model"]["search_method"] == "semantic_search"
        assert response["data"]["retrieval_model"]["reranking_enable"] is True
        assert response["data"]["embedding_model"]["embedding_provider_name"] == "openai"

    def test_get_dataset_success(self, mock_dify_api, education_test_config):
        """Test successful dataset retrieval."""
        client = DifyAPITestClient(education_test_config["dify_api_url"], education_test_config["dify_api_key"])

        dataset_id = "dataset-chemistry-789"

        mock_dify_api.get(
            f"http://localhost:5001/console/api/datasets/{dataset_id}",
            json={
                "data": {
                    "id": dataset_id,
                    "name": "Chemistry Reference",
                    "description": "Comprehensive chemistry reference materials",
                    "provider": "vendor",
                    "permission": "only_me",
                    "data_source_type": "upload_file",
                    "indexing_technique": "high_quality",
                    "app_count": 3,
                    "document_count": 45,
                    "word_count": 125000,
                    "hit_count": 2847,
                    "embedding_available": True,
                    "created_by": "test-teacher-001",
                    "created_at": "2024-01-10T10:15:00Z",
                    "updated_at": "2024-01-15T09:22:00Z",
                }
            },
        )

        response = client._make_request("GET", f"/console/api/datasets/{dataset_id}")

        # Verify dataset retrieval
        assert_api_response_structure(
            response["data"],
            required_fields=["id", "name", "description", "document_count"],
            optional_fields=["word_count", "hit_count", "embedding_available", "updated_at"],
        )

        assert response["data"]["id"] == dataset_id
        assert response["data"]["document_count"] == 45
        assert response["data"]["word_count"] == 125000
        assert response["data"]["hit_count"] == 2847
        assert response["data"]["embedding_available"] is True

    def test_update_dataset_success(self, mock_dify_api, education_test_config):
        """Test successful dataset update."""
        client = DifyAPITestClient(education_test_config["dify_api_url"], education_test_config["dify_api_key"])

        dataset_id = "dataset-biology-012"
        updated_name = "Advanced Biology Knowledge Base"
        updated_description = "Updated comprehensive biology knowledge base with latest research"

        mock_dify_api.patch(
            f"http://localhost:5001/console/api/datasets/{dataset_id}",
            json={
                "data": {
                    "id": dataset_id,
                    "name": updated_name,
                    "description": updated_description,
                    "permission": "all_team_members",  # Updated permission
                    "retrieval_model": {
                        "search_method": "hybrid_search",  # Updated search method
                        "top_k": 10,  # Updated top_k
                        "score_threshold": 0.75,  # Updated threshold
                    },
                    "updated_at": "2024-01-15T14:45:00Z",
                }
            },
        )

        update_data = {
            "name": updated_name,
            "description": updated_description,
            "permission": "all_team_members",
            "retrieval_model": {"search_method": "hybrid_search", "top_k": 10, "score_threshold": 0.75},
        }

        response = client._make_request("PATCH", f"/console/api/datasets/{dataset_id}", data=update_data)

        # Verify dataset update
        assert response["data"]["name"] == updated_name
        assert response["data"]["description"] == updated_description
        assert response["data"]["permission"] == "all_team_members"
        assert response["data"]["retrieval_model"]["search_method"] == "hybrid_search"
        assert response["data"]["retrieval_model"]["top_k"] == 10

    def test_delete_dataset_success(self, mock_dify_api, education_test_config):
        """Test successful dataset deletion."""
        client = DifyAPITestClient(education_test_config["dify_api_url"], education_test_config["dify_api_key"])

        dataset_id = "dataset-old-content-345"

        mock_dify_api.delete(
            f"http://localhost:5001/console/api/datasets/{dataset_id}",
            json={"result": "success", "message": "Dataset deleted successfully"},
        )

        response = client._make_request("DELETE", f"/console/api/datasets/{dataset_id}")

        assert response["result"] == "success"
        assert "deleted successfully" in response["message"]

    def test_list_datasets_success(self, mock_dify_api, education_test_config):
        """Test successful dataset listing."""
        client = DifyAPITestClient(education_test_config["dify_api_url"], education_test_config["dify_api_key"])

        mock_datasets = [
            {
                "id": f"dataset-{i}",
                "name": f"Educational Dataset {i}",
                "description": f"Dataset {i} for educational purposes",
                "document_count": i * 10,
                "word_count": i * 5000,
                "app_count": i,
                "created_at": f"2024-01-{10 + i}T14:30:00Z",
            }
            for i in range(1, 6)
        ]

        mock_dify_api.get(
            "http://localhost:5001/console/api/datasets",
            json={"data": mock_datasets, "has_more": False, "limit": 20, "page": 1, "total": 5},
        )

        response = client._make_request("GET", "/console/api/datasets")

        # Verify dataset listing
        assert "data" in response
        assert len(response["data"]) == 5
        assert response["total"] == 5
        assert response["has_more"] is False

        # Verify dataset structure
        for dataset in response["data"]:
            assert_api_response_structure(
                dataset,
                required_fields=["id", "name", "description"],
                optional_fields=["document_count", "word_count", "app_count", "created_at"],
            )

    def test_list_datasets_with_filters(self, mock_dify_api, education_test_config):
        """Test dataset listing with filters."""
        client = DifyAPITestClient(education_test_config["dify_api_url"], education_test_config["dify_api_key"])

        # Mock filtered dataset listing
        mock_dify_api.get(
            "http://localhost:5001/console/api/datasets?tag=mathematics&permission=all_team_members",
            json={
                "data": [
                    {
                        "id": "dataset-math-001",
                        "name": "Algebra Fundamentals",
                        "description": "Basic algebra concepts",
                        "tags": ["mathematics", "algebra", "fundamentals"],
                        "permission": "all_team_members",
                        "document_count": 25,
                        "app_count": 3,
                    },
                    {
                        "id": "dataset-math-002",
                        "name": "Calculus Advanced",
                        "description": "Advanced calculus topics",
                        "tags": ["mathematics", "calculus", "advanced"],
                        "permission": "all_team_members",
                        "document_count": 40,
                        "app_count": 2,
                    },
                ],
                "has_more": False,
                "total": 2,
                "applied_filters": {"tag": "mathematics", "permission": "all_team_members"},
            },
        )

        response = client._make_request("GET", "/console/api/datasets?tag=mathematics&permission=all_team_members")

        # Verify filtered results
        assert len(response["data"]) == 2
        assert response["applied_filters"]["tag"] == "mathematics"
        assert response["applied_filters"]["permission"] == "all_team_members"

        for dataset in response["data"]:
            assert "mathematics" in dataset["tags"]
            assert dataset["permission"] == "all_team_members"

    def test_dataset_statistics(self, mock_dify_api, education_test_config):
        """Test dataset statistics retrieval."""
        client = DifyAPITestClient(education_test_config["dify_api_url"], education_test_config["dify_api_key"])

        dataset_id = "dataset-stats-test-678"

        mock_dify_api.get(
            f"http://localhost:5001/console/api/datasets/{dataset_id}/statistics",
            json={
                "data": {
                    "dataset_id": dataset_id,
                    "total_documents": 150,
                    "total_chunks": 2400,
                    "total_words": 485000,
                    "total_tokens": 642000,
                    "average_chunk_size": 202,
                    "embedding_dimensions": 1536,
                    "languages": {"en": 120, "ko": 20, "zh": 10},
                    "document_types": {"pdf": 80, "txt": 45, "docx": 25},
                    "indexing_status": {"completed": 145, "processing": 3, "failed": 2},
                    "usage_stats": {
                        "total_queries": 12450,
                        "avg_daily_queries": 415,
                        "most_queried_topics": [
                            {"topic": "calculus", "count": 3200},
                            {"topic": "algebra", "count": 2800},
                            {"topic": "geometry", "count": 2100},
                        ],
                    },
                    "last_updated": "2024-01-15T14:30:00Z",
                }
            },
        )

        response = client._make_request("GET", f"/console/api/datasets/{dataset_id}/statistics")

        # Verify statistics
        stats = response["data"]
        assert stats["total_documents"] == 150
        assert stats["total_chunks"] == 2400
        assert stats["total_words"] == 485000
        assert stats["embedding_dimensions"] == 1536

        # Verify language distribution
        assert stats["languages"]["en"] == 120
        assert stats["languages"]["ko"] == 20

        # Verify usage statistics
        usage_stats = stats["usage_stats"]
        assert usage_stats["total_queries"] == 12450
        assert len(usage_stats["most_queried_topics"]) == 3
        assert usage_stats["most_queried_topics"][0]["topic"] == "calculus"

    def test_dataset_export_functionality(self, mock_dify_api, education_test_config):
        """Test dataset export functionality."""
        client = DifyAPITestClient(education_test_config["dify_api_url"], education_test_config["dify_api_key"])

        dataset_id = "dataset-export-test-901"

        # Mock dataset export
        mock_dify_api.post(
            f"http://localhost:5001/console/api/datasets/{dataset_id}/export",
            json={
                "data": {
                    "export_id": "export-job-123",
                    "status": "processing",
                    "export_format": "jsonl",
                    "include_embeddings": False,
                    "include_metadata": True,
                    "estimated_file_size": "15.2MB",
                    "estimated_completion_time": "2024-01-15T14:35:00Z",
                    "download_url": None,  # Will be available when completed
                }
            },
        )

        # Mock export status check
        mock_dify_api.get(
            f"http://localhost:5001/console/api/datasets/{dataset_id}/export/export-job-123",
            json={
                "data": {
                    "export_id": "export-job-123",
                    "status": "completed",
                    "export_format": "jsonl",
                    "file_size": "14.8MB",
                    "download_url": f"https://api.dify.ai/datasets/{dataset_id}/exports/export-job-123/download",
                    "expires_at": "2024-01-22T14:35:00Z",  # 7 days from completion
                    "completed_at": "2024-01-15T14:33:45Z",
                }
            },
        )

        export_config = {"format": "jsonl", "include_embeddings": False, "include_metadata": True}

        # Start export
        export_response = client._make_request("POST", f"/console/api/datasets/{dataset_id}/export", data=export_config)

        assert export_response["data"]["status"] == "processing"
        export_id = export_response["data"]["export_id"]

        # Check export status
        status_response = client._make_request("GET", f"/console/api/datasets/{dataset_id}/export/{export_id}")

        assert status_response["data"]["status"] == "completed"
        assert status_response["data"]["download_url"] is not None
        assert status_response["data"]["file_size"] == "14.8MB"

    def test_dataset_import_functionality(self, mock_dify_api, education_test_config):
        """Test dataset import functionality."""
        client = DifyAPITestClient(education_test_config["dify_api_url"], education_test_config["dify_api_key"])

        # Mock dataset import
        mock_dify_api.post(
            "http://localhost:5001/console/api/datasets/import",
            json={
                "data": {
                    "import_id": "import-job-456",
                    "status": "processing",
                    "dataset_id": "dataset-imported-234",
                    "dataset_name": "Imported Physics Dataset",
                    "source_format": "jsonl",
                    "total_documents": 85,
                    "processed_documents": 0,
                    "estimated_completion_time": "2024-01-15T14:40:00Z",
                }
            },
        )

        # Mock import status check
        mock_dify_api.get(
            "http://localhost:5001/console/api/datasets/import/import-job-456",
            json={
                "data": {
                    "import_id": "import-job-456",
                    "status": "completed",
                    "dataset_id": "dataset-imported-234",
                    "dataset_name": "Imported Physics Dataset",
                    "total_documents": 85,
                    "processed_documents": 85,
                    "successful_documents": 83,
                    "failed_documents": 2,
                    "warnings": [
                        "Document 'quantum_theory.pdf' contains unsupported formatting",
                        "Document 'relativity.txt' exceeds recommended size limit",
                    ],
                    "completed_at": "2024-01-15T14:38:22Z",
                }
            },
        )

        import_config = {
            "name": "Imported Physics Dataset",
            "source_url": "https://example.com/physics_dataset.jsonl",
            "format": "jsonl",
            "indexing_technique": "high_quality",
        }

        # Start import
        import_response = client._make_request("POST", "/console/api/datasets/import", data=import_config)

        assert import_response["data"]["status"] == "processing"
        import_id = import_response["data"]["import_id"]

        # Check import status
        status_response = client._make_request("GET", f"/console/api/datasets/import/{import_id}")

        assert status_response["data"]["status"] == "completed"
        assert status_response["data"]["successful_documents"] == 83
        assert status_response["data"]["failed_documents"] == 2
        assert len(status_response["data"]["warnings"]) == 2

    @pytest.mark.performance
    def test_dataset_crud_performance(self, mock_dify_api, education_test_config):
        """Test dataset CRUD operations performance."""
        client = DifyAPITestClient(education_test_config["dify_api_url"], education_test_config["dify_api_key"])

        # Mock fast dataset operations
        mock_dify_api.post(
            "http://localhost:5001/console/api/datasets",
            json={
                "data": {
                    "id": "perf-dataset-123",
                    "name": "Performance Test Dataset",
                    "description": "Dataset for performance testing",
                }
            },
        )

        mock_dify_api.get(
            "http://localhost:5001/console/api/datasets",
            json={
                "data": [{"id": f"dataset-{i}", "name": f"Dataset {i}"} for i in range(100)],
                "total": 100,
                "has_more": False,
            },
        )

        def create_dataset():
            return client.create_dataset("Performance Test Dataset", "Performance testing")

        def list_datasets():
            return client._make_request("GET", "/console/api/datasets")

        # Test create performance
        create_result, create_time = PerformanceTestHelper.measure_response_time(create_dataset)
        PerformanceTestHelper.assert_response_time(create_time, 3.0, "p90")

        # Test list performance
        list_result, list_time = PerformanceTestHelper.measure_response_time(list_datasets)
        PerformanceTestHelper.assert_response_time(list_time, 3.0, "p90")

    def test_dataset_validation(self, mock_dify_api, education_test_config):
        """Test dataset validation during creation and updates."""
        client = DifyAPITestClient(education_test_config["dify_api_url"], education_test_config["dify_api_key"])

        # Mock validation error
        mock_dify_api.post(
            "http://localhost:5001/console/api/datasets",
            status_code=400,
            json={
                "error": {
                    "type": "validation_error",
                    "code": "invalid_dataset_config",
                    "message": "Dataset configuration validation failed",
                    "details": {
                        "errors": [
                            {"field": "name", "message": "Dataset name must be between 1 and 100 characters"},
                            {
                                "field": "retrieval_model.score_threshold",
                                "message": "Score threshold must be between 0 and 1",
                            },
                        ]
                    },
                }
            },
        )

        invalid_config = {
            "name": "",  # Empty name
            "description": "Test dataset",
            "retrieval_model": {
                "score_threshold": 1.5  # Invalid threshold > 1
            },
        }

        with pytest.raises(Exception) as exc_info:
            client.create_dataset(**invalid_config)

        assert "API request failed" in str(exc_info.value)

    def test_dataset_permissions_management(self, mock_dify_api, education_test_config):
        """Test dataset permissions management."""
        client = DifyAPITestClient(education_test_config["dify_api_url"], education_test_config["dify_api_key"])

        dataset_id = "dataset-permissions-test-789"

        # Mock permission update
        mock_dify_api.patch(
            f"http://localhost:5001/console/api/datasets/{dataset_id}/permissions",
            json={
                "data": {
                    "dataset_id": dataset_id,
                    "permission": "partial_members",
                    "permitted_members": [
                        {"user_id": "teacher-001", "role": "editor", "granted_at": "2024-01-15T14:30:00Z"},
                        {"user_id": "teacher-002", "role": "viewer", "granted_at": "2024-01-15T14:31:00Z"},
                    ],
                    "updated_at": "2024-01-15T14:35:00Z",
                }
            },
        )

        permission_config = {
            "permission": "partial_members",
            "permitted_members": [
                {"user_id": "teacher-001", "role": "editor"},
                {"user_id": "teacher-002", "role": "viewer"},
            ],
        }

        response = client._make_request(
            "PATCH", f"/console/api/datasets/{dataset_id}/permissions", data=permission_config
        )

        # Verify permission update
        assert response["data"]["permission"] == "partial_members"
        assert len(response["data"]["permitted_members"]) == 2
        assert response["data"]["permitted_members"][0]["role"] == "editor"
        assert response["data"]["permitted_members"][1]["role"] == "viewer"
