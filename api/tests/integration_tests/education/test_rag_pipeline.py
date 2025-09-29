import pytest

from tests.integration_tests.education.test_helpers import (
    DifyAPITestClient,
    EducationAPITestHelper,
    PerformanceTestHelper,
    assert_api_response_structure,
    cleanup_test_file,
    create_test_file,
)


@pytest.mark.integration
@pytest.mark.rag
class TestRAGPipeline:
    """Test RAG (Retrieval-Augmented Generation) pipeline via Dify API integration."""

    def test_document_indexing_success(self, mock_dify_api, education_test_config):
        """Test successful document indexing in RAG pipeline."""
        client = DifyAPITestClient(education_test_config["dify_api_url"], education_test_config["dify_api_key"])

        dataset_id = "math-textbook-dataset"
        document_content = """
        Chapter 1: Introduction to Calculus

        Calculus is the mathematical study of continuous change. It has two main branches:
        - Differential calculus: deals with rates of change and slopes
        - Integral calculus: deals with accumulation and areas under curves

        The fundamental theorem of calculus connects these two branches.
        """

        # Mock document indexing
        mock_dify_api.post(
            f"http://localhost:5001/console/api/datasets/{dataset_id}/documents",
            json={
                "data": {
                    "id": "doc-calculus-intro-123",
                    "name": "Calculus Introduction",
                    "type": "text",
                    "indexing_status": "completed",
                    "tokens": 125,
                    "chunks": [
                        {
                            "id": "chunk-1",
                            "content": "Calculus is the mathematical study of continuous change...",
                            "tokens": 45,
                            "embedding_vector": [0.1, 0.2, 0.3],  # Simplified
                        },
                        {
                            "id": "chunk-2",
                            "content": "The fundamental theorem of calculus connects...",
                            "tokens": 30,
                            "embedding_vector": [0.4, 0.5, 0.6],  # Simplified
                        },
                    ],
                    "metadata": {"subject": "mathematics", "topic": "calculus", "difficulty": "introductory"},
                }
            },
        )

        indexing_data = {
            "name": "Calculus Introduction",
            "content": document_content,
            "type": "text",
            "metadata": {"subject": "mathematics", "topic": "calculus", "difficulty": "introductory"},
        }

        response = client._make_request("POST", f"/console/api/datasets/{dataset_id}/documents", data=indexing_data)

        # Verify indexing response
        assert_api_response_structure(
            response["data"],
            required_fields=["id", "name", "indexing_status", "tokens"],
            optional_fields=["chunks", "metadata", "type"],
        )

        assert response["data"]["indexing_status"] == "completed"
        assert response["data"]["tokens"] == 125
        assert len(response["data"]["chunks"]) == 2

    def test_semantic_search_success(self, mock_dify_api, education_test_config):
        """Test successful semantic search in RAG pipeline."""
        client = DifyAPITestClient(education_test_config["dify_api_url"], education_test_config["dify_api_key"])

        dataset_id = "math-knowledge-base"
        search_query = "What is the fundamental theorem of calculus?"

        # Mock semantic search
        mock_dify_api.post(
            f"http://localhost:5001/console/api/datasets/{dataset_id}/retrieve",
            json={
                "data": {
                    "query": search_query,
                    "results": [
                        {
                            "id": "result-1",
                            "content": "The fundamental theorem of calculus connects differential and integral calculus, stating that differentiation and integration are inverse operations.",
                            "score": 0.92,
                            "metadata": {
                                "source": "calculus_fundamentals.pdf",
                                "page": 15,
                                "chunk_id": "chunk-theorem-001",
                            },
                        },
                        {
                            "id": "result-2",
                            "content": "There are two parts to the fundamental theorem: Part I establishes the connection between derivatives and integrals...",
                            "score": 0.87,
                            "metadata": {
                                "source": "advanced_calculus.pdf",
                                "page": 42,
                                "chunk_id": "chunk-theorem-002",
                            },
                        },
                        {
                            "id": "result-3",
                            "content": "Newton and Leibniz independently developed calculus and discovered this fundamental relationship...",
                            "score": 0.75,
                            "metadata": {"source": "history_of_math.pdf", "page": 125, "chunk_id": "chunk-history-003"},
                        },
                    ],
                    "total_results": 3,
                    "retrieval_method": "semantic_search",
                    "search_params": {"top_k": 3, "score_threshold": 0.7},
                }
            },
        )

        search_data = {"query": search_query, "top_k": 3, "score_threshold": 0.7, "retrieval_method": "semantic_search"}

        response = client._make_request("POST", f"/console/api/datasets/{dataset_id}/retrieve", data=search_data)

        # Verify search response
        search_results = response["data"]["results"]
        assert len(search_results) == 3
        assert search_results[0]["score"] == 0.92
        assert "fundamental theorem" in search_results[0]["content"].lower()

        # Verify results are sorted by score (descending)
        scores = [result["score"] for result in search_results]
        assert scores == sorted(scores, reverse=True)

    def test_rag_generation_with_context(self, mock_dify_api, education_test_config):
        """Test RAG generation with retrieved context."""
        client = DifyAPITestClient(education_test_config["dify_api_url"], education_test_config["dify_api_key"])

        app_id = "rag-math-tutor"
        user_question = "Explain the fundamental theorem of calculus with examples"

        # Mock RAG generation
        mock_dify_api.post(
            "http://localhost:5001/v1/chat-messages",
            json={
                "id": "rag-message-123",
                "conversation_id": "rag-conv-456",
                "answer": """Based on the retrieved knowledge, the fundamental theorem of calculus is a central theorem that connects differential and integral calculus. Here's an explanation with examples:

**The Theorem**: The fundamental theorem states that differentiation and integration are inverse operations.

**Part I**: If f is continuous on [a,b] and F(x) = ∫[a to x] f(t) dt, then F'(x) = f(x).

**Example**: Let f(x) = x². If F(x) = ∫[0 to x] t² dt = x³/3, then F'(x) = x² = f(x).

**Part II**: If f is continuous on [a,b] and F is any antiderivative of f, then ∫[a to b] f(x) dx = F(b) - F(a).

This theorem revolutionized calculus by showing that finding areas (integration) and finding rates of change (differentiation) are fundamentally related operations.""",
                "metadata": {
                    "rag_context": {
                        "retrieved_chunks": [
                            {
                                "content": "The fundamental theorem of calculus connects differential and integral calculus...",
                                "score": 0.92,
                                "source": "calculus_fundamentals.pdf",
                            },
                            {
                                "content": "There are two parts to the fundamental theorem...",
                                "score": 0.87,
                                "source": "advanced_calculus.pdf",
                            },
                        ],
                        "retrieval_query": "fundamental theorem calculus examples",
                        "context_used": True,
                    },
                    "usage": {"prompt_tokens": 450, "completion_tokens": 180, "total_tokens": 630},
                },
                "status": "completed",
            },
        )

        chat_data = {"inputs": {"query": user_question}, "response_mode": "blocking", "user": "test-student-001"}

        response = client._make_request("POST", "/v1/chat-messages", data=chat_data)

        # Verify RAG response
        assert response["status"] == "completed"
        assert "fundamental theorem" in response["answer"].lower()
        assert "example" in response["answer"].lower()

        # Verify RAG context
        rag_context = response["metadata"]["rag_context"]
        assert rag_context["context_used"] is True
        assert len(rag_context["retrieved_chunks"]) == 2
        assert rag_context["retrieved_chunks"][0]["score"] == 0.92

    def test_hybrid_search_functionality(self, mock_dify_api, education_test_config):
        """Test hybrid search (semantic + keyword) in RAG pipeline."""
        client = DifyAPITestClient(education_test_config["dify_api_url"], education_test_config["dify_api_key"])

        dataset_id = "comprehensive-math-db"
        search_query = "derivative chain rule examples"

        # Mock hybrid search
        mock_dify_api.post(
            f"http://localhost:5001/console/api/datasets/{dataset_id}/retrieve",
            json={
                "data": {
                    "query": search_query,
                    "results": [
                        {
                            "id": "hybrid-result-1",
                            "content": "The chain rule for derivatives: if f(g(x)), then f'(g(x)) × g'(x). Example: d/dx[sin(x²)] = cos(x²) × 2x",
                            "score": 0.95,
                            "search_scores": {"semantic_score": 0.88, "keyword_score": 0.92, "hybrid_weight": 0.6},
                            "metadata": {
                                "source": "calculus_rules.pdf",
                                "matched_keywords": ["derivative", "chain rule", "examples"],
                            },
                        },
                        {
                            "id": "hybrid-result-2",
                            "content": "Chain rule applications: composite functions, nested functions, implicit differentiation examples...",
                            "score": 0.89,
                            "search_scores": {"semantic_score": 0.85, "keyword_score": 0.88, "hybrid_weight": 0.6},
                            "metadata": {
                                "source": "derivative_examples.pdf",
                                "matched_keywords": ["chain rule", "examples"],
                            },
                        },
                    ],
                    "total_results": 2,
                    "retrieval_method": "hybrid_search",
                    "search_params": {"top_k": 5, "semantic_weight": 0.6, "keyword_weight": 0.4},
                }
            },
        )

        hybrid_search_data = {
            "query": search_query,
            "top_k": 5,
            "retrieval_method": "hybrid_search",
            "semantic_weight": 0.6,
            "keyword_weight": 0.4,
        }

        response = client._make_request("POST", f"/console/api/datasets/{dataset_id}/retrieve", data=hybrid_search_data)

        # Verify hybrid search response
        results = response["data"]["results"]
        assert len(results) == 2
        assert results[0]["score"] == 0.95

        # Verify hybrid scoring
        first_result = results[0]
        assert "search_scores" in first_result
        assert "semantic_score" in first_result["search_scores"]
        assert "keyword_score" in first_result["search_scores"]
        assert "matched_keywords" in first_result["metadata"]

    def test_rag_pipeline_with_filters(self, mock_dify_api, education_test_config):
        """Test RAG pipeline with metadata filters."""
        client = DifyAPITestClient(education_test_config["dify_api_url"], education_test_config["dify_api_key"])

        dataset_id = "filtered-math-content"
        search_query = "integration techniques"

        # Mock filtered search
        mock_dify_api.post(
            f"http://localhost:5001/console/api/datasets/{dataset_id}/retrieve",
            json={
                "data": {
                    "query": search_query,
                    "results": [
                        {
                            "id": "filtered-result-1",
                            "content": "Integration by parts: ∫u dv = uv - ∫v du. This technique is useful for products of functions.",
                            "score": 0.91,
                            "metadata": {
                                "subject": "calculus",
                                "difficulty": "intermediate",
                                "topic": "integration",
                                "grade_level": "college",
                            },
                        },
                        {
                            "id": "filtered-result-2",
                            "content": "Substitution method: ∫f(g(x))g'(x)dx = ∫f(u)du where u = g(x). Example: ∫2x·e^(x²)dx",
                            "score": 0.87,
                            "metadata": {
                                "subject": "calculus",
                                "difficulty": "intermediate",
                                "topic": "integration",
                                "grade_level": "college",
                            },
                        },
                    ],
                    "total_results": 2,
                    "applied_filters": {"subject": "calculus", "difficulty": "intermediate", "topic": "integration"},
                    "filtered_from": 25,  # Total documents before filtering
                }
            },
        )

        filtered_search_data = {
            "query": search_query,
            "top_k": 5,
            "filters": {"subject": "calculus", "difficulty": "intermediate", "topic": "integration"},
        }

        response = client._make_request(
            "POST", f"/console/api/datasets/{dataset_id}/retrieve", data=filtered_search_data
        )

        # Verify filtered search
        assert response["data"]["total_results"] == 2
        assert response["data"]["filtered_from"] == 25

        for result in response["data"]["results"]:
            metadata = result["metadata"]
            assert metadata["subject"] == "calculus"
            assert metadata["difficulty"] == "intermediate"
            assert metadata["topic"] == "integration"

    @pytest.mark.performance
    def test_rag_pipeline_performance(self, mock_dify_api, education_test_config):
        """Test RAG pipeline performance meets requirements."""
        client = DifyAPITestClient(education_test_config["dify_api_url"], education_test_config["dify_api_key"])

        dataset_id = "large-math-corpus"
        search_query = "quadratic formula derivation"

        # Mock performance test search
        mock_dify_api.post(
            f"http://localhost:5001/console/api/datasets/{dataset_id}/retrieve",
            json={
                "data": {
                    "query": search_query,
                    "results": [
                        {
                            "id": "perf-result-1",
                            "content": (
                                "The quadratic formula x = (-b ± √(b²-4ac)) / 2a is "
                                "derived by completing the square..."
                            ),
                            "score": 0.94,
                        }
                    ],
                    "total_results": 1,
                    "search_time_ms": 850,  # Mock search time
                }
            },
        )

        def perform_rag_search():
            return client._make_request(
                "POST", f"/console/api/datasets/{dataset_id}/retrieve", data={"query": search_query, "top_k": 5}
            )

        result, response_time = PerformanceTestHelper.measure_response_time(perform_rag_search)

        # RAG search should meet performance requirements
        PerformanceTestHelper.assert_response_time(response_time, 3.0, "p90")
        assert result["data"]["search_time_ms"] <= 1000  # Internal search time under 1s

    def test_rag_context_window_management(self, mock_dify_api, education_test_config):
        """Test RAG context window management for large retrievals."""
        client = DifyAPITestClient(education_test_config["dify_api_url"], education_test_config["dify_api_key"])

        app_id = "context-aware-rag"
        user_question = "Comprehensive overview of calculus concepts"

        # Mock RAG with context window management
        mock_dify_api.post(
            "http://localhost:5001/v1/chat-messages",
            json={
                "id": "context-managed-123",
                "conversation_id": "context-conv-456",
                "answer": (
                    "Based on the most relevant retrieved content, "
                    "here's a comprehensive overview of calculus..."
                ),
                "metadata": {
                    "rag_context": {
                        "retrieved_chunks": 15,
                        "chunks_used": 8,  # Context window limit applied
                        "chunks_truncated": 7,
                        "total_context_tokens": 2048,
                        "context_window_limit": 2048,
                        "selection_strategy": "relevance_score_ranking",
                        "average_chunk_relevance": 0.86,
                    },
                    "usage": {
                        "prompt_tokens": 2100,  # Including context
                        "completion_tokens": 300,
                        "total_tokens": 2400,
                    },
                },
                "status": "completed",
            },
        )

        chat_data = {"inputs": {"query": user_question}, "response_mode": "blocking", "user": "test-student-001"}

        response = client._make_request("POST", "/v1/chat-messages", data=chat_data)

        # Verify context window management
        rag_context = response["metadata"]["rag_context"]
        assert rag_context["retrieved_chunks"] == 15
        assert rag_context["chunks_used"] == 8
        assert rag_context["chunks_truncated"] == 7
        assert rag_context["total_context_tokens"] <= rag_context["context_window_limit"]

    def test_rag_multilingual_support(self, mock_dify_api, education_test_config):
        """Test RAG pipeline multilingual support."""
        client = DifyAPITestClient(education_test_config["dify_api_url"], education_test_config["dify_api_key"])

        dataset_id = "multilingual-math-kb"
        search_query = "미적분학의 기본 정리"  # Korean: "Fundamental theorem of calculus"

        # Mock multilingual search
        mock_dify_api.post(
            f"http://localhost:5001/console/api/datasets/{dataset_id}/retrieve",
            json={
                "data": {
                    "query": search_query,
                    "results": [
                        {
                            "id": "multilingual-result-1",
                            "content": (
            "미적분학의 기본정리는 미분과 적분이 서로 역연산 관계임을 "
            "보여주는 중요한 정리입니다."
        ),
                            "score": 0.89,
                            "metadata": {"language": "ko", "translated_from": None},
                        },
                        {
                            "id": "multilingual-result-2",
                            "content": (
                                "The fundamental theorem of calculus connects "
                                "differentiation and integration..."
                            ),
                            "score": 0.85,
                            "metadata": {
                                "language": "en",
                                "translated_to_query_language": "미적분학의 기본정리는 미분과 적분을 연결하는...",
                            },
                        },
                    ],
                    "total_results": 2,
                    "query_language": "ko",
                    "supported_languages": ["en", "ko", "zh", "ja"],
                }
            },
        )

        multilingual_search_data = {"query": search_query, "top_k": 5, "language": "ko"}

        response = client._make_request(
            "POST", f"/console/api/datasets/{dataset_id}/retrieve", data=multilingual_search_data
        )

        # Verify multilingual support
        assert response["data"]["query_language"] == "ko"
        assert len(response["data"]["results"]) == 2

        # Verify language metadata
        korean_result = response["data"]["results"][0]
        english_result = response["data"]["results"][1]
        assert korean_result["metadata"]["language"] == "ko"
        assert english_result["metadata"]["language"] == "en"
        assert "translated_to_query_language" in english_result["metadata"]

    def test_rag_error_handling(self, mock_dify_api, education_test_config):
        """Test RAG pipeline error handling scenarios."""
        client = DifyAPITestClient(education_test_config["dify_api_url"], education_test_config["dify_api_key"])

        dataset_id = "error-test-dataset"

        # Mock dataset not found error
        mock_dify_api.post(
            f"http://localhost:5001/console/api/datasets/{dataset_id}/retrieve",
            status_code=404,
            json={
                "error": {
                    "type": "dataset_not_found",
                    "code": "dataset_missing",
                    "message": f"Dataset {dataset_id} not found or not accessible",
                    "details": {
                        "dataset_id": dataset_id,
                        "possible_causes": [
                            "Dataset was deleted",
                            "Access permissions revoked",
                            "Dataset ID is incorrect",
                        ],
                    },
                }
            },
        )

        # Mock empty search results
        mock_dify_api.post(
            "http://localhost:5001/console/api/datasets/empty-dataset/retrieve",
            json={
                "data": {
                    "query": "nonexistent topic",
                    "results": [],
                    "total_results": 0,
                    "message": "No relevant documents found for the query",
                }
            },
        )

        # Test dataset not found error
        with pytest.raises(Exception) as exc_info:
            client._make_request("POST", f"/console/api/datasets/{dataset_id}/retrieve", data={"query": "test query"})
        assert "API request failed" in str(exc_info.value)

        # Test empty results handling
        empty_response = client._make_request(
            "POST", "/console/api/datasets/empty-dataset/retrieve", data={"query": "nonexistent topic"}
        )
        assert empty_response["data"]["total_results"] == 0
        assert len(empty_response["data"]["results"]) == 0

    def test_rag_pipeline_with_citations(self, mock_dify_api, education_test_config):
        """Test RAG pipeline with source citations."""
        client = DifyAPITestClient(education_test_config["dify_api_url"], education_test_config["dify_api_key"])

        app_id = "citation-rag-tutor"
        user_question = "What is the chain rule in calculus?"

        # Mock RAG response with citations
        mock_dify_api.post(
            "http://localhost:5001/v1/chat-messages",
            json={
                "id": "citation-message-123",
                "answer": """The chain rule is a fundamental rule for differentiating composite functions [1]. It states that if you have a composite function f(g(x)), then its derivative is f'(g(x)) × g'(x) [2].

**Example**: To find the derivative of sin(x²):
- Let f(u) = sin(u) and g(x) = x²
- Then f'(u) = cos(u) and g'(x) = 2x
- By the chain rule: d/dx[sin(x²)] = cos(x²) × 2x [3]

This rule is essential for differentiating complex nested functions in calculus [1].

**Sources:**
[1] Calculus Fundamentals, Chapter 3, p. 45
[2] Advanced Calculus Methods, Section 2.3, p. 89
[3] Derivative Examples and Applications, p. 156""",
                "metadata": {
                    "rag_context": {
                        "retrieved_chunks": [
                            {
                                "id": "chunk-chain-rule-1",
                                "content": (
                            "The chain rule is a fundamental rule for "
                            "differentiating composite functions..."
                        ),
                                "score": 0.94,
                                "citation": {
                                    "source": "Calculus Fundamentals",
                                    "page": 45,
                                    "chapter": "Chapter 3",
                                    "reference_id": "[1]",
                                },
                            },
                            {
                                "id": "chunk-chain-rule-2",
                                "content": "For composite function f(g(x)), derivative is f'(g(x)) × g'(x)...",
                                "score": 0.91,
                                "citation": {
                                    "source": "Advanced Calculus Methods",
                                    "page": 89,
                                    "section": "Section 2.3",
                                    "reference_id": "[2]",
                                },
                            },
                        ],
                        "citations_included": True,
                    }
                },
                "status": "completed",
            },
        )

        chat_data = {"inputs": {"query": user_question}, "response_mode": "blocking", "user": "test-student-001"}

        response = client._make_request("POST", "/v1/chat-messages", data=chat_data)

        # Verify citations in response
        assert "[1]" in response["answer"]
        assert "[2]" in response["answer"]
        assert "**Sources:**" in response["answer"]

        # Verify citation metadata
        rag_context = response["metadata"]["rag_context"]
        assert rag_context["citations_included"] is True
        for chunk in rag_context["retrieved_chunks"]:
            assert "citation" in chunk
            assert "reference_id" in chunk["citation"]
            assert "source" in chunk["citation"]
