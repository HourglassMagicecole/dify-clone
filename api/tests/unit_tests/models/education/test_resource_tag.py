"""Unit tests for SessionResourceTag model."""

from datetime import datetime

from models.education.resource_tag import SessionResourceTag


def test_session_resource_tag_repr():
    """Test __repr__ method of SessionResourceTag."""
    # Arrange
    tag = SessionResourceTag(
        id="tag-id-123",
        session_id="session-456",
        resource_type="app",
        resource_id="app-789",
    )

    # Act
    repr_str = repr(tag)

    # Assert
    assert "SessionResourceTag" in repr_str
    assert "tag-id-123" in repr_str
    assert "session-456" in repr_str
    assert "app" in repr_str
    assert "app-789" in repr_str


def test_session_resource_tag_attributes():
    """Test SessionResourceTag model attributes."""
    # Arrange
    tag_id = "tag-001"
    session_id = "session-002"
    resource_type = "dataset"
    resource_id = "dataset-003"
    account_id = "account-004"
    tagged_at = datetime(2025, 10, 12)

    # Act
    tag = SessionResourceTag(
        id=tag_id,
        session_id=session_id,
        resource_type=resource_type,
        resource_id=resource_id,
        account_id=account_id,
        tagged_at=tagged_at,
    )

    # Assert
    assert tag.id == tag_id
    assert tag.session_id == session_id
    assert tag.resource_type == resource_type
    assert tag.resource_id == resource_id
    assert tag.account_id == account_id
    assert tag.tagged_at == tagged_at


def test_session_resource_tag_tablename():
    """Test SessionResourceTag table name."""
    # Assert
    assert SessionResourceTag.__tablename__ == "session_resource_tags"


def test_session_resource_tag_resource_types():
    """Test SessionResourceTag with different resource types."""
    # Arrange & Act
    app_tag = SessionResourceTag(
        id="tag-1",
        session_id="session-1",
        resource_type="app",
        resource_id="app-1",
        account_id="account-1",
        tagged_at=datetime.now(),
    )

    dataset_tag = SessionResourceTag(
        id="tag-2",
        session_id="session-1",
        resource_type="dataset",
        resource_id="dataset-1",
        account_id="account-1",
        tagged_at=datetime.now(),
    )

    conversation_tag = SessionResourceTag(
        id="tag-3",
        session_id="session-1",
        resource_type="conversation",
        resource_id="conversation-1",
        account_id="account-1",
        tagged_at=datetime.now(),
    )

    # Assert
    assert app_tag.resource_type == "app"
    assert dataset_tag.resource_type == "dataset"
    assert conversation_tag.resource_type == "conversation"
