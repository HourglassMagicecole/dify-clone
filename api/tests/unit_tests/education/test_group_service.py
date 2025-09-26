"""
Unit tests for GroupService.
"""

from unittest.mock import MagicMock, patch

import pytest

from services.group_service import GroupService


class TestGroupService:
    """Test cases for GroupService."""

    def test_create_group_success(self):
        """Test successful group creation."""
        group = GroupService.create_group(name="Test Group", description="Test Description", created_by="user123")

        assert group["name"] == "Test Group"
        assert group["description"] == "Test Description"
        assert group["created_by"] == "user123"
        assert "id" in group

    def test_create_group_without_description(self):
        """Test group creation without description."""
        group = GroupService.create_group(name="Test Group")

        assert group["name"] == "Test Group"
        assert group["description"] is None
        assert "id" in group

    @patch("services.group_service.db")
    def test_add_user_to_group_success(self, mock_db):
        """Test successful user addition to group."""
        # Mock database objects
        mock_user = MagicMock()
        mock_user.id = "user123"

        mock_db.session.query.return_value.filter_by.return_value.first.return_value = mock_user
        mock_db.session.add = MagicMock()
        mock_db.session.commit = MagicMock()

        result = GroupService.add_user_to_group("group123", "user123", "admin")

        assert result is True
        mock_db.session.add.assert_called_once()
        mock_db.session.commit.assert_called_once()

    @patch("services.group_service.db")
    def test_add_user_to_group_user_not_found(self, mock_db):
        """Test adding non-existent user to group."""
        mock_db.session.query.return_value.filter_by.return_value.first.return_value = None

        with pytest.raises(ValueError, match="User user123 not found"):
            GroupService.add_user_to_group("group123", "user123")

    @patch("services.group_service.db")
    def test_remove_user_from_group_success(self, mock_db):
        """Test successful user removal from group."""
        mock_role = MagicMock()
        mock_db.session.query.return_value.filter_by.return_value.first.return_value = mock_role
        mock_db.session.delete = MagicMock()
        mock_db.session.commit = MagicMock()

        result = GroupService.remove_user_from_group("group123", "user123")

        assert result is True
        mock_db.session.delete.assert_called_once_with(mock_role)
        mock_db.session.commit.assert_called_once()

    @patch("services.group_service.db")
    def test_remove_user_from_group_not_found(self, mock_db):
        """Test removing user that's not in group."""
        mock_db.session.query.return_value.filter_by.return_value.first.return_value = None

        result = GroupService.remove_user_from_group("group123", "user123")

        assert result is False

    @patch("services.group_service.db")
    def test_get_group_members(self, mock_db):
        """Test getting group members."""
        # Mock role and user data
        mock_role = MagicMock()
        mock_role.user_id = "user123"
        mock_role.role_type = "admin"
        mock_role.created_at = "2023-01-01T00:00:00"

        mock_user = MagicMock()
        mock_user.id = "user123"
        mock_user.name = "Test User"
        mock_user.email = "test@example.com"

        mock_db.session.query.return_value.join.return_value.filter.return_value.all.return_value = [
            (mock_role, mock_user)
        ]

        members = GroupService.get_group_members("group123")

        assert len(members) == 1
        assert members[0]["user_id"] == "user123"
        assert members[0]["name"] == "Test User"
        assert members[0]["email"] == "test@example.com"
        assert members[0]["role"] == "admin"

    @patch("services.group_service.db")
    def test_delete_group_success(self, mock_db):
        """Test successful group deletion."""
        mock_db.session.query.return_value.filter_by.return_value.delete.return_value = 3
        mock_db.session.commit = MagicMock()

        result = GroupService.delete_group("group123")

        assert result is True
        mock_db.session.commit.assert_called_once()

    def test_get_groups_empty(self):
        """Test getting empty groups list."""
        groups = GroupService.get_groups()
        assert groups == []

    def test_get_group_by_id_not_found(self):
        """Test getting non-existent group."""
        group = GroupService.get_group_by_id("nonexistent")
        assert group is None

    def test_update_group_placeholder(self):
        """Test group update placeholder."""
        result = GroupService.update_group("group123", name="New Name")
        assert result is True
