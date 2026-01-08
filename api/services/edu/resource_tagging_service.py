"""Resource tagging service for education management."""

import logging
import uuid
from datetime import UTC, datetime
from typing import Optional

from sqlalchemy import select

from extensions.ext_database import db
from models.education import SessionResourceTag
from services.edu.exceptions import ResourceAlreadyTaggedError, ResourceTagNotFoundError

logger = logging.getLogger(__name__)


class ResourceTaggingService:
    """Service for managing resource tags in education sessions."""

    def add_tag(
        self,
        session_id: str,
        resource_type: str,
        resource_id: str,
        account_id: str,
    ) -> SessionResourceTag:
        """
        Add a session tag to a resource.

        Args:
            session_id: Education session ID (UUID)
            resource_type: Resource type ("app", "dataset", "conversation", etc.)
            resource_id: Resource ID (UUID)
            account_id: User account ID (UUID)

        Returns:
            SessionResourceTag: Created tag object

        Raises:
            ResourceAlreadyTaggedError: If the same tag already exists
        """
        # Check if tag already exists
        existing_tag_stmt = select(SessionResourceTag).where(
            SessionResourceTag.session_id == session_id,
            SessionResourceTag.resource_type == resource_type,
            SessionResourceTag.resource_id == resource_id,
            SessionResourceTag.account_id == account_id,
        )
        existing_tag = db.session.scalar(existing_tag_stmt)

        if existing_tag:
            logger.warning("Resource already tagged: resource_id=%s, session_id=%s", resource_id, session_id)
            raise ResourceAlreadyTaggedError("Resource already tagged in this session")

        # Create new tag
        new_tag = SessionResourceTag(
            id=str(uuid.uuid4()),
            session_id=session_id,
            resource_type=resource_type,
            resource_id=resource_id,
            account_id=account_id,
            tagged_at=datetime.now(UTC),
            created_at=datetime.now(UTC),
        )

        db.session.add(new_tag)
        db.session.commit()

        return new_tag

    def remove_tag(self, tag_id: str) -> None:
        """
        Remove a resource tag.

        Args:
            tag_id: Tag ID (UUID)

        Raises:
            ResourceTagNotFoundError: If tag does not exist
        """
        stmt = select(SessionResourceTag).where(SessionResourceTag.id == tag_id)
        tag = db.session.scalar(stmt)

        if not tag:
            logger.warning("Tag not found: tag_id=%s", tag_id)
            raise ResourceTagNotFoundError(f"Tag not found: {tag_id}")

        db.session.delete(tag)
        db.session.commit()

    def get_tags_by_resource(
        self,
        resource_type: str,
        resource_id: str,
    ) -> list[SessionResourceTag]:
        """
        Get all tags for a specific resource.

        Args:
            resource_type: Resource type
            resource_id: Resource ID

        Returns:
            list[SessionResourceTag]: List of tags
        """
        stmt = select(SessionResourceTag).where(
            SessionResourceTag.resource_type == resource_type,
            SessionResourceTag.resource_id == resource_id,
        )
        tags = db.session.scalars(stmt).all()
        return list(tags)

    def get_resources_by_tag(
        self,
        session_id: str,
        resource_type: str,
        account_id: Optional[str] = None,
    ) -> list[str]:
        """
        Get resource IDs filtered by session and resource type.

        Args:
            session_id: Education session ID
            resource_type: Resource type
            account_id: User account ID (None for all users)

        Returns:
            list[str]: List of resource IDs
        """
        stmt = select(SessionResourceTag.resource_id).where(
            SessionResourceTag.session_id == session_id,
            SessionResourceTag.resource_type == resource_type,
        )

        if account_id:
            stmt = stmt.where(SessionResourceTag.account_id == account_id)

        resource_ids = db.session.scalars(stmt).all()
        return list(resource_ids)

    def check_access_permission(
        self,
        resource_id: str,
        account_id: str,
        is_admin: bool,
    ) -> bool:
        """
        Check if user has access permission to a resource.

        Args:
            resource_id: Resource ID
            account_id: User account ID
            is_admin: Whether user is an admin

        Returns:
            bool: True if access is granted, False otherwise
        """
        # Admins have access to all resources
        if is_admin:
            return True

        # Check if resource is tagged for this account
        stmt = select(SessionResourceTag).where(
            SessionResourceTag.resource_id == resource_id,
            SessionResourceTag.account_id == account_id,
        )
        tag = db.session.scalar(stmt)

        return tag is not None

    def __repr__(self) -> str:
        """Return string representation."""
        return "<ResourceTaggingService>"
