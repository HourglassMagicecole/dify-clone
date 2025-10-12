"""Tests for ResourceTaggingService."""

import uuid
from unittest.mock import MagicMock, patch

import pytest

from services.edu.exceptions import ResourceAlreadyTaggedError, ResourceTagNotFoundError
from services.edu.resource_tagging_service import ResourceTaggingService


class TestResourceTaggingService:
    """Test ResourceTaggingService methods."""

    def test_add_tag_success(self):
        """Test successfully adding a tag to a resource."""
        # Arrange
        service = ResourceTaggingService()
        session_id = str(uuid.uuid4())
        resource_id = str(uuid.uuid4())
        account_id = str(uuid.uuid4())

        mock_tag = MagicMock()
        mock_tag.id = str(uuid.uuid4())
        mock_tag.session_id = session_id
        mock_tag.resource_type = "app"
        mock_tag.resource_id = resource_id
        mock_tag.account_id = account_id

        with (
            patch("services.edu.resource_tagging_service.db") as mock_db,
            patch("services.edu.resource_tagging_service.select") as mock_select,
            patch("services.edu.resource_tagging_service.SessionResourceTag") as MockResourceTag,
        ):
            mock_db.session.scalar.return_value = None  # No existing tag
            mock_db.session.add.return_value = None
            mock_db.session.commit.return_value = None
            MockResourceTag.return_value = mock_tag

            # Act
            tag = service.add_tag(
                session_id=session_id,
                resource_type="app",
                resource_id=resource_id,
                account_id=account_id,
            )

            # Assert
            assert tag is not None
            assert tag.session_id == session_id
            assert tag.resource_type == "app"
            mock_db.session.add.assert_called_once()

    def test_add_tag_duplicate_error(self):
        """Test adding duplicate tag raises ResourceAlreadyTaggedError."""
        # Arrange
        service = ResourceTaggingService()
        session_id = str(uuid.uuid4())
        resource_id = str(uuid.uuid4())
        account_id = str(uuid.uuid4())

        existing_tag = MagicMock()
        existing_tag.id = str(uuid.uuid4())

        with patch("services.edu.resource_tagging_service.db") as mock_db:
            mock_db.session.scalar.return_value = existing_tag  # Tag already exists

            # Act & Assert
            with pytest.raises(ResourceAlreadyTaggedError, match="Resource already tagged"):
                service.add_tag(session_id, "app", resource_id, account_id)

    def test_get_tags_by_resource_success(self):
        """Test retrieving tags for a specific resource."""
        # Arrange
        service = ResourceTaggingService()
        resource_id = str(uuid.uuid4())

        mock_tag1 = MagicMock()
        mock_tag1.resource_id = resource_id
        mock_tag2 = MagicMock()
        mock_tag2.resource_id = resource_id

        mock_scalars = MagicMock()
        mock_scalars.all.return_value = [mock_tag1, mock_tag2]

        with patch("services.edu.resource_tagging_service.db") as mock_db:
            mock_db.session.scalars.return_value = mock_scalars

            # Act
            tags = service.get_tags_by_resource("app", resource_id)

            # Assert
            assert len(tags) == 2

    def test_get_resources_by_tag_success(self):
        """Test retrieving resource IDs filtered by session and type."""
        # Arrange
        service = ResourceTaggingService()
        session_id = str(uuid.uuid4())
        resource_id1 = str(uuid.uuid4())
        resource_id2 = str(uuid.uuid4())

        mock_scalars = MagicMock()
        mock_scalars.all.return_value = [resource_id1, resource_id2]

        with patch("services.edu.resource_tagging_service.db") as mock_db:
            mock_db.session.scalars.return_value = mock_scalars

            # Act
            resource_ids = service.get_resources_by_tag(session_id, "app")

            # Assert
            assert len(resource_ids) == 2
            assert resource_id1 in resource_ids
            assert resource_id2 in resource_ids

    def test_get_resources_by_tag_with_account_filter(self):
        """Test filtering resources by account_id."""
        # Arrange
        service = ResourceTaggingService()
        session_id = str(uuid.uuid4())
        account_id1 = str(uuid.uuid4())
        resource_id1 = str(uuid.uuid4())

        mock_scalars = MagicMock()
        mock_scalars.all.return_value = [resource_id1]

        with patch("services.edu.resource_tagging_service.db") as mock_db:
            mock_db.session.scalars.return_value = mock_scalars

            # Act
            resource_ids = service.get_resources_by_tag(session_id, "app", account_id1)

            # Assert
            assert len(resource_ids) == 1
            assert resource_id1 in resource_ids

    def test_check_access_permission_admin(self):
        """Test admin has access to all resources."""
        # Arrange
        service = ResourceTaggingService()
        resource_id = str(uuid.uuid4())
        account_id = str(uuid.uuid4())

        # Act
        has_access = service.check_access_permission(resource_id, account_id, is_admin=True)

        # Assert
        assert has_access is True

    def test_check_access_permission_owner(self):
        """Test resource owner has access."""
        # Arrange
        service = ResourceTaggingService()
        resource_id = str(uuid.uuid4())
        account_id = str(uuid.uuid4())

        mock_tag = MagicMock()

        with patch("services.edu.resource_tagging_service.db") as mock_db:
            mock_db.session.scalar.return_value = mock_tag  # Tag exists

            # Act
            has_access = service.check_access_permission(resource_id, account_id, is_admin=False)

            # Assert
            assert has_access is True

    def test_check_access_permission_denied(self):
        """Test access denied for non-owner."""
        # Arrange
        service = ResourceTaggingService()
        resource_id = str(uuid.uuid4())
        other_user_id = str(uuid.uuid4())

        with patch("services.edu.resource_tagging_service.db") as mock_db:
            mock_db.session.scalar.return_value = None  # No tag found

            # Act
            has_access = service.check_access_permission(resource_id, other_user_id, is_admin=False)

            # Assert
            assert has_access is False

    def test_remove_tag_success(self):
        """Test successfully removing a tag."""
        # Arrange
        service = ResourceTaggingService()
        tag_id = str(uuid.uuid4())
        mock_tag = MagicMock()

        with patch("services.edu.resource_tagging_service.db") as mock_db:
            mock_db.session.scalar.return_value = mock_tag
            mock_db.session.delete.return_value = None
            mock_db.session.commit.return_value = None

            # Act
            service.remove_tag(tag_id)

            # Assert
            mock_db.session.delete.assert_called_once_with(mock_tag)

    def test_remove_tag_not_found_error(self):
        """Test removing non-existent tag raises ResourceTagNotFoundError."""
        # Arrange
        service = ResourceTaggingService()
        non_existent_tag_id = str(uuid.uuid4())

        with patch("services.edu.resource_tagging_service.db") as mock_db:
            mock_db.session.scalar.return_value = None  # Tag not found

            # Act & Assert
            with pytest.raises(ResourceTagNotFoundError, match="Tag not found"):
                service.remove_tag(non_existent_tag_id)

    def test_repr_method(self):
        """Test __repr__ method."""
        # Arrange
        service = ResourceTaggingService()

        # Act
        repr_str = repr(service)

        # Assert
        assert repr_str == "<ResourceTaggingService>"
