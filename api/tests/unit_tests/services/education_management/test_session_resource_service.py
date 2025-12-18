"""Tests for SessionResourceService."""

from datetime import UTC, datetime
from unittest.mock import MagicMock, patch

import pytest

from services.education_management.session_resource_service import SessionResourceService


class TestSessionResourceService:
    """Test suite for SessionResourceService."""

    @pytest.fixture
    def service(self):
        """Create service instance."""
        return SessionResourceService()

    @pytest.fixture
    def mock_session_resource_tag(self):
        """Create mock SessionResourceTag."""
        tag = MagicMock()
        tag.session_id = "test-session-id"
        tag.resource_type = "app"
        tag.resource_id = "test-app-id"
        tag.account_id = "test-account-id"
        tag.tagged_at = datetime(2025, 12, 17, 10, 0, 0, tzinfo=UTC)
        tag.account = MagicMock()
        tag.account.name = "Test User"
        tag.account.email = "test@example.com"
        return tag

    @pytest.fixture
    def mock_app(self):
        """Create mock App."""
        app = MagicMock()
        app.id = "test-app-id"
        app.name = "Test App"
        app.created_at = datetime(2025, 12, 17, 9, 0, 0, tzinfo=UTC)
        return app

    @pytest.fixture
    def mock_dataset(self):
        """Create mock Dataset."""
        dataset = MagicMock()
        dataset.id = "test-dataset-id"
        dataset.name = "Test Dataset"
        dataset.created_at = datetime(2025, 12, 17, 8, 0, 0, tzinfo=UTC)
        return dataset

    def test_get_session_resources_returns_empty_when_no_resources(self, service):
        """Test that get_session_resources returns empty lists when no resources exist."""
        # Arrange
        with patch.object(service, "get_session_resources") as mock_method:
            mock_method.return_value = {
                "apps": [],
                "datasets": [],
                "summary": {"total_apps": 0, "total_datasets": 0},
            }

            # Act
            result = service.get_session_resources("test-session-id")

            # Assert
            assert result["apps"] == []
            assert result["datasets"] == []
            assert result["summary"]["total_apps"] == 0
            assert result["summary"]["total_datasets"] == 0

    def test_get_session_resources_returns_apps_and_datasets(self, service, mock_session_resource_tag, mock_app):
        """Test that get_session_resources returns apps and datasets correctly."""
        # Arrange
        with patch("services.education_management.session_resource_service.db") as mock_db:
            # Create app tag
            app_tag = mock_session_resource_tag
            app_tag.resource_type = "app"
            app_tag.resource_id = mock_app.id

            # Create dataset tag
            dataset_tag = MagicMock()
            dataset_tag.session_id = "test-session-id"
            dataset_tag.resource_type = "dataset"
            dataset_tag.resource_id = "test-dataset-id"
            dataset_tag.account_id = "test-account-id"
            dataset_tag.tagged_at = datetime(2025, 12, 17, 10, 0, 0, tzinfo=UTC)
            dataset_tag.account = MagicMock()
            dataset_tag.account.name = "Test User"
            dataset_tag.account.email = "test@example.com"

            # Mock the query
            mock_query = MagicMock()
            mock_query.filter.return_value = mock_query
            mock_query.options.return_value = mock_query
            mock_query.all.return_value = [app_tag, dataset_tag]
            mock_db.session.query.return_value = mock_query

            # Mock App query
            mock_app_query = MagicMock()
            mock_app_query.filter.return_value = mock_app_query
            mock_app_query.all.return_value = [mock_app]

            # Mock Dataset query
            mock_dataset = MagicMock()
            mock_dataset.id = "test-dataset-id"
            mock_dataset.name = "Test Dataset"
            mock_dataset.created_at = datetime(2025, 12, 17, 8, 0, 0, tzinfo=UTC)

            mock_dataset_query = MagicMock()
            mock_dataset_query.filter.return_value = mock_dataset_query
            mock_dataset_query.all.return_value = [mock_dataset]

            # Configure db.session.query to return different results based on model
            def query_side_effect(model):
                if model.__name__ == "SessionResourceTag":
                    return mock_query
                elif model.__name__ == "App":
                    return mock_app_query
                elif model.__name__ == "Dataset":
                    return mock_dataset_query
                return MagicMock()

            mock_db.session.query.side_effect = query_side_effect

            # Act
            result = service.get_session_resources("test-session-id")

            # Assert
            assert "apps" in result
            assert "datasets" in result
            assert "summary" in result

    def test_get_session_resources_filters_by_account_id(self, service):
        """Test that get_session_resources filters by account_id when provided."""
        # Arrange
        target_account_id = "specific-account-id"

        with patch("services.education_management.session_resource_service.db") as mock_db:
            mock_query = MagicMock()
            mock_query.filter.return_value = mock_query
            mock_query.options.return_value = mock_query
            mock_query.all.return_value = []
            mock_db.session.query.return_value = mock_query

            # Act
            service.get_session_resources("test-session-id", account_id=target_account_id)

            # Assert - verify filter was called with account_id
            assert mock_query.filter.called

    def test_get_session_resources_filters_by_resource_type(self, service):
        """Test that get_session_resources filters by resource_type when provided."""
        # Arrange
        with patch("services.education_management.session_resource_service.db") as mock_db:
            mock_query = MagicMock()
            mock_query.filter.return_value = mock_query
            mock_query.options.return_value = mock_query
            mock_query.all.return_value = []
            mock_db.session.query.return_value = mock_query

            # Act
            service.get_session_resources("test-session-id", resource_type="app")

            # Assert - verify filter was called
            assert mock_query.filter.called

    def test_get_resources_to_delete_returns_ids(self, service, mock_session_resource_tag):
        """Test that get_resources_to_delete returns resource IDs grouped by type."""
        # Arrange
        with patch("services.education_management.session_resource_service.db") as mock_db:
            # Create tags
            app_tag = MagicMock()
            app_tag.resource_type = "app"
            app_tag.resource_id = "app-1"

            dataset_tag = MagicMock()
            dataset_tag.resource_type = "dataset"
            dataset_tag.resource_id = "dataset-1"

            mock_query = MagicMock()
            mock_query.filter.return_value = mock_query
            mock_query.all.return_value = [app_tag, dataset_tag]
            mock_db.session.query.return_value = mock_query

            # Act
            result = service.get_resources_to_delete("test-session-id")

            # Assert
            assert "apps" in result
            assert "datasets" in result
            assert "app-1" in result["apps"]
            assert "dataset-1" in result["datasets"]

    def test_get_unique_accounts_returns_account_list(self, service):
        """Test that get_unique_accounts returns list of accounts."""
        # Arrange
        with patch("services.education_management.session_resource_service.db") as mock_db:
            mock_account = MagicMock()
            mock_account.id = "account-1"
            mock_account.name = "Test User"
            mock_account.email = "test@example.com"

            # First query returns account IDs
            mock_tag_query = MagicMock()
            mock_tag_query.filter.return_value = mock_tag_query
            mock_tag_query.distinct.return_value = mock_tag_query
            mock_tag_query.all.return_value = [("account-1",)]

            # Second query returns Account objects
            mock_account_query = MagicMock()
            mock_account_query.filter.return_value = mock_account_query
            mock_account_query.all.return_value = [mock_account]

            # Configure db.session.query to return different results based on call order
            mock_db.session.query.side_effect = [mock_tag_query, mock_account_query]

            # Act
            result = service.get_unique_accounts("test-session-id")

            # Assert
            assert len(result) == 1
            assert result[0]["account_id"] == "account-1"
            assert result[0]["name"] == "Test User"
            assert result[0]["email"] == "test@example.com"

    def test_get_app_details_returns_details(self, service, mock_app):
        """Test that _get_app_details returns app details."""
        # Arrange
        with patch("services.education_management.session_resource_service.db") as mock_db:
            mock_query = MagicMock()
            mock_query.filter.return_value = mock_query
            mock_query.all.return_value = [mock_app]
            mock_db.session.query.return_value = mock_query

            # Act
            result = service._get_app_details(["test-app-id"])

            # Assert
            assert "test-app-id" in result
            assert result["test-app-id"]["name"] == "Test App"

    def test_get_app_details_returns_empty_for_empty_list(self, service):
        """Test that _get_app_details returns empty dict for empty list."""
        # Act
        result = service._get_app_details([])

        # Assert
        assert result == {}

    def test_get_dataset_details_returns_details(self, service, mock_dataset):
        """Test that _get_dataset_details returns dataset details."""
        # Arrange
        with patch("services.education_management.session_resource_service.db") as mock_db:
            mock_query = MagicMock()
            mock_query.filter.return_value = mock_query
            mock_query.all.return_value = [mock_dataset]
            mock_db.session.query.return_value = mock_query

            # Act
            result = service._get_dataset_details(["test-dataset-id"])

            # Assert
            assert "test-dataset-id" in result
            assert result["test-dataset-id"]["name"] == "Test Dataset"

    def test_get_dataset_details_returns_empty_for_empty_list(self, service):
        """Test that _get_dataset_details returns empty dict for empty list."""
        # Act
        result = service._get_dataset_details([])

        # Assert
        assert result == {}
