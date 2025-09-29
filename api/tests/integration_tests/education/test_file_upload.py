"""
File upload and download integration tests for education API.
"""

import tempfile
from pathlib import Path

import pytest

from tests.integration_tests.education.test_helpers import (
    DifyAPITestClient,
    EducationAPITestHelper,
    assert_api_response_structure,
)


@pytest.mark.integration
@pytest.mark.file
class TestFileUpload:
    """Test file upload and download functionality via Dify API."""

    def test_file_upload_success(self, mock_dify_api, education_test_config):
        """Test successful file upload."""
        client = DifyAPITestClient(education_test_config["dify_api_url"], education_test_config["dify_api_key"])

        # Create a temporary file
        with tempfile.NamedTemporaryFile(mode='w', suffix='.txt', delete=False) as temp_file:
            temp_file.write("This is a test document for education purposes.\n")
            temp_file.write("It contains sample content for RAG processing.")
            temp_file_path = temp_file.name

        # Mock successful upload response
        mock_dify_api.post(
            "http://localhost:5001/files/upload",
            json={
                "id": "file-123-456",
                "name": "test_document.txt",
                "size": 95,
                "extension": "txt",
                "mime_type": "text/plain",
                "created_by": "test-user",
                "created_at": "2024-01-15T14:30:00Z",
                "url": "/files/file-123-456/download",
            }
        )

        try:
            response = client.upload_file(temp_file_path, "test_document.txt")

            # Verify response structure
            assert_api_response_structure(
                response,
                required_fields=["id", "name", "size", "extension", "created_at"],
                optional_fields=["mime_type", "url", "created_by"]
            )

            assert response["name"] == "test_document.txt"
            assert response["extension"] == "txt"
            assert response["size"] == 95
        finally:
            # Clean up temporary file
            Path(temp_file_path).unlink(missing_ok=True)

    def test_file_upload_with_validation(self, mock_dify_api, education_test_config):
        """Test file upload with validation checks."""
        client = DifyAPITestClient(education_test_config["dify_api_url"], education_test_config["dify_api_key"])

        # Create a test PDF file
        with tempfile.NamedTemporaryFile(mode='wb', suffix='.pdf', delete=False) as temp_file:
            # Write minimal PDF header
            temp_file.write(b'%PDF-1.4\n')
            temp_file_path = temp_file.name

        # Mock validation response
        mock_dify_api.post(
            "http://localhost:5001/files/upload",
            json={
                "id": "file-pdf-789",
                "name": "test_document.pdf",
                "size": 9,
                "extension": "pdf",
                "mime_type": "application/pdf",
                "validation": {
                    "passed": True,
                    "checks": {
                        "file_type": "allowed",
                        "file_size": "within_limit",
                        "content_scan": "clean"
                    }
                },
                "created_at": "2024-01-15T14:30:00Z",
            }
        )

        try:
            response = client.upload_file(temp_file_path, "test_document.pdf")

            assert response["validation"]["passed"] is True
            assert response["validation"]["checks"]["file_type"] == "allowed"
            assert response["extension"] == "pdf"
        finally:
            Path(temp_file_path).unlink(missing_ok=True)

    def test_file_download_success(self, mock_dify_api, education_test_config):
        """Test successful file download."""
        client = DifyAPITestClient(education_test_config["dify_api_url"], education_test_config["dify_api_key"])

        file_id = "file-123-456"
        file_content = b"This is the downloaded file content"

        # Mock file download
        mock_dify_api.get(
            f"http://localhost:5001/files/{file_id}/download",
            content=file_content,
            headers={'Content-Type': 'application/octet-stream'}
        )

        # Make download request
        response = client.session.get(f"{client.base_url}/files/{file_id}/download")

        assert response.status_code == 200
        assert response.content == file_content

    def test_file_upload_size_limit(self, mock_dify_api, education_test_config):
        """Test file upload size limit enforcement."""
        client = DifyAPITestClient(education_test_config["dify_api_url"], education_test_config["dify_api_key"])

        # Create a large file (simulated)
        with tempfile.NamedTemporaryFile(mode='w', suffix='.txt', delete=False) as temp_file:
            # Write a large amount of data
            temp_file.write("x" * 1024 * 1024)  # 1MB of data
            temp_file_path = temp_file.name

        # Mock size limit error
        mock_dify_api.post(
            "http://localhost:5001/files/upload",
            status_code=413,
            json={
                "error": {
                    "type": "file_too_large",
                    "message": "File size exceeds maximum allowed size of 500KB",
                    "max_size": 512000,
                    "file_size": 1048576
                }
            }
        )

        try:
            with pytest.raises(Exception) as exc_info:
                client.upload_file(temp_file_path, "large_file.txt")

            assert "API request failed" in str(exc_info.value)
        finally:
            Path(temp_file_path).unlink(missing_ok=True)

    def test_file_upload_unsupported_type(self, mock_dify_api, education_test_config):
        """Test upload of unsupported file type."""
        client = DifyAPITestClient(education_test_config["dify_api_url"], education_test_config["dify_api_key"])

        # Create an executable file
        with tempfile.NamedTemporaryFile(mode='w', suffix='.exe', delete=False) as temp_file:
            temp_file.write("MZ")  # Minimal EXE header
            temp_file_path = temp_file.name

        # Mock unsupported type error
        mock_dify_api.post(
            "http://localhost:5001/files/upload",
            status_code=415,
            json={
                "error": {
                    "type": "unsupported_file_type",
                    "message": "File type .exe is not allowed",
                    "allowed_types": [".txt", ".pdf", ".doc", ".docx", ".csv", ".json"]
                }
            }
        )

        try:
            with pytest.raises(Exception) as exc_info:
                client.upload_file(temp_file_path, "program.exe")

            assert "API request failed" in str(exc_info.value)
        finally:
            Path(temp_file_path).unlink(missing_ok=True)

    def test_batch_file_upload(self, mock_dify_api, education_test_config):
        """Test uploading multiple files in batch."""
        client = DifyAPITestClient(education_test_config["dify_api_url"], education_test_config["dify_api_key"])

        # Create multiple temporary files
        temp_files = []
        for i in range(3):
            with tempfile.NamedTemporaryFile(mode='w', suffix='.txt', delete=False) as temp_file:
                temp_file.write(f"Content of file {i+1}")
                temp_files.append(temp_file.name)

        try:
            uploaded_files = []
            for i, file_path in enumerate(temp_files):
                # Mock each upload
                mock_dify_api.post(
                    "http://localhost:5001/files/upload",
                    json={
                        "id": f"file-batch-{i+1}",
                        "name": f"file_{i+1}.txt",
                        "size": 20,
                        "extension": "txt",
                        "created_at": "2024-01-15T14:30:00Z",
                    }
                )

                response = client.upload_file(file_path, f"file_{i+1}.txt")
                uploaded_files.append(response)

            # Verify all files uploaded
            assert len(uploaded_files) == 3
            for i, file_info in enumerate(uploaded_files):
                assert file_info["id"] == f"file-batch-{i+1}"
                assert file_info["name"] == f"file_{i+1}.txt"
        finally:
            # Clean up all temporary files
            for file_path in temp_files:
                Path(file_path).unlink(missing_ok=True)

    def test_file_metadata_retrieval(self, mock_dify_api, education_test_config):
        """Test retrieving file metadata."""
        client = DifyAPITestClient(education_test_config["dify_api_url"], education_test_config["dify_api_key"])

        file_id = "file-meta-123"

        # Mock metadata retrieval
        mock_dify_api.get(
            f"http://localhost:5001/files/{file_id}/metadata",
            json={
                "id": file_id,
                "name": "research_paper.pdf",
                "size": 2048000,
                "extension": "pdf",
                "mime_type": "application/pdf",
                "created_at": "2024-01-15T14:30:00Z",
                "updated_at": "2024-01-15T14:35:00Z",
                "created_by": "test-user",
                "tags": ["education", "research", "ai"],
                "usage": {
                    "datasets": 2,
                    "agents": 1,
                    "workflows": 3
                }
            }
        )

        response = client._make_request("GET", f"/files/{file_id}/metadata")

        assert response["id"] == file_id
        assert response["name"] == "research_paper.pdf"
        assert len(response["tags"]) == 3
        assert response["usage"]["workflows"] == 3

    def test_file_deletion(self, mock_dify_api, education_test_config):
        """Test file deletion."""
        client = DifyAPITestClient(education_test_config["dify_api_url"], education_test_config["dify_api_key"])

        file_id = "file-delete-456"

        # Mock file deletion
        mock_dify_api.delete(
            f"http://localhost:5001/files/{file_id}",
            json={
                "result": "success",
                "message": "File deleted successfully",
                "deleted_at": "2024-01-15T14:40:00Z"
            }
        )

        response = client._make_request("DELETE", f"/files/{file_id}")

        assert response["result"] == "success"
        assert "deleted_at" in response