"""
Template management service for educational platform.
"""

from datetime import datetime
from typing import Optional

from sqlalchemy import or_
from sqlalchemy.exc import IntegrityError

from extensions.ext_database import db
from models.education import EducationTemplate


class TemplateService:
    """Service for managing educational templates."""

    @staticmethod
    def create_template(
        name: str,
        description: Optional[str] = None,
        template_type: str = "workflow",
        content: Optional[dict] = None,
        created_by: Optional[str] = None,
        is_public: bool = False,
        tags: Optional[list[str]] = None,
    ) -> EducationTemplate:
        """
        Create a new educational template.

        Args:
            name: Template name
            description: Template description
            template_type: Type of template (workflow, agent, rag, etc.)
            content: Template content as JSON
            created_by: User ID who created the template
            is_public: Whether template is public
            tags: List of tags for categorization

        Returns:
            EducationTemplate: Created template

        Raises:
            ValueError: If validation fails
        """
        try:
            # Check if template name already exists for this user
            if created_by:
                existing = (
                    db.session.query(EducationTemplate)
                    .filter(EducationTemplate.name == name, EducationTemplate.created_by == created_by)
                    .first()
                )

                if existing:
                    raise ValueError(f"Template with name '{name}' already exists for this user")

            template = EducationTemplate(
                name=name,
                description=description,
                template_type=template_type,
                content=content,
                created_by=created_by,
                is_public=is_public,
                tags=tags or [],
            )

            db.session.add(template)
            db.session.commit()

            return template

        except IntegrityError as e:
            db.session.rollback()
            raise ValueError(f"Template creation failed: {str(e)}")
        except Exception as e:
            db.session.rollback()
            raise e

    @staticmethod
    def get_templates(
        limit: int = 20,
        offset: int = 0,
        template_type: Optional[str] = None,
        user_id: Optional[str] = None,
        is_public: Optional[bool] = None,
        search: Optional[str] = None,
        tags: Optional[list[str]] = None,
    ) -> list[EducationTemplate]:
        """
        Get templates with filtering and pagination.

        Args:
            limit: Number of templates to return
            offset: Offset for pagination
            template_type: Filter by template type
            user_id: Filter by creator user ID
            is_public: Filter by public/private status
            search: Search in name and description
            tags: Filter by tags

        Returns:
            List[EducationTemplate]: List of templates
        """
        try:
            query = db.session.query(EducationTemplate)

            if template_type:
                query = query.filter(EducationTemplate.template_type == template_type)

            if user_id:
                query = query.filter(EducationTemplate.created_by == user_id)

            if is_public is not None:
                query = query.filter(EducationTemplate.is_public == is_public)

            if search:
                search_pattern = f"%{search}%"
                query = query.filter(
                    or_(
                        EducationTemplate.name.ilike(search_pattern),
                        EducationTemplate.description.ilike(search_pattern),
                    )
                )

            if tags:
                # Filter templates that contain any of the specified tags
                for tag in tags:
                    query = query.filter(EducationTemplate.tags.contains([tag]))

            templates = query.order_by(EducationTemplate.created_at.desc()).offset(offset).limit(limit).all()

            return templates

        except Exception as e:
            raise e

    @staticmethod
    def get_template_by_id(template_id: str, user_id: Optional[str] = None) -> Optional[EducationTemplate]:
        """
        Get template by ID with permission check.

        Args:
            template_id: Template ID
            user_id: User ID for permission check

        Returns:
            Optional[EducationTemplate]: Template if found and accessible
        """
        try:
            query = db.session.query(EducationTemplate).filter_by(id=template_id)

            # If user_id is provided, check if user can access the template
            if user_id:
                query = query.filter(or_(EducationTemplate.is_public == True, EducationTemplate.created_by == user_id))

            return query.first()

        except Exception as e:
            raise e

    @staticmethod
    def update_template(template_id: str, user_id: Optional[str] = None, **kwargs) -> Optional[EducationTemplate]:
        """
        Update template information.

        Args:
            template_id: Template ID
            user_id: User ID for permission check
            **kwargs: Fields to update

        Returns:
            Optional[EducationTemplate]: Updated template if found and accessible
        """
        try:
            query = db.session.query(EducationTemplate).filter_by(id=template_id)

            # Permission check - only creator can update
            if user_id:
                query = query.filter(EducationTemplate.created_by == user_id)

            template = query.first()
            if not template:
                return None

            # Update fields
            for key, value in kwargs.items():
                if hasattr(template, key) and key not in ["id", "created_at", "created_by"]:
                    setattr(template, key, value)

            template.updated_at = datetime.utcnow()
            db.session.commit()

            return template

        except Exception as e:
            db.session.rollback()
            raise e

    @staticmethod
    def delete_template(template_id: str, user_id: Optional[str] = None) -> bool:
        """
        Delete a template.

        Args:
            template_id: Template ID
            user_id: User ID for permission check

        Returns:
            bool: Success status
        """
        try:
            query = db.session.query(EducationTemplate).filter_by(id=template_id)

            # Permission check - only creator can delete
            if user_id:
                query = query.filter(EducationTemplate.created_by == user_id)

            template = query.first()
            if not template:
                return False

            db.session.delete(template)
            db.session.commit()

            return True

        except Exception as e:
            db.session.rollback()
            raise e

    @staticmethod
    def clone_template(
        template_id: str, new_name: str, user_id: str, description: Optional[str] = None
    ) -> Optional[EducationTemplate]:
        """
        Clone an existing template.

        Args:
            template_id: Source template ID
            new_name: Name for the new template
            user_id: User ID creating the clone
            description: Description for the new template

        Returns:
            Optional[EducationTemplate]: Cloned template if successful
        """
        try:
            # Get source template (must be public or owned by user)
            source = TemplateService.get_template_by_id(template_id, user_id)
            if not source:
                raise ValueError("Template not found or not accessible")

            # Create clone
            clone = TemplateService.create_template(
                name=new_name,
                description=description or f"Clone of {source.name}",
                template_type=source.template_type,
                content=source.content,
                created_by=user_id,
                is_public=False,  # Clones are private by default
                tags=source.tags,
            )

            return clone

        except Exception as e:
            raise e

    @staticmethod
    def share_template(template_id: str, user_id: str, is_public: bool = True) -> Optional[EducationTemplate]:
        """
        Share or unshare a template.

        Args:
            template_id: Template ID
            user_id: User ID for permission check
            is_public: Whether to make template public

        Returns:
            Optional[EducationTemplate]: Updated template if successful
        """
        try:
            template = TemplateService.update_template(template_id=template_id, user_id=user_id, is_public=is_public)

            return template

        except Exception as e:
            raise e

    @staticmethod
    def get_template_usage_stats(template_id: str) -> dict:
        """
        Get usage statistics for a template.

        Args:
            template_id: Template ID

        Returns:
            Dict: Usage statistics
        """
        try:
            template = db.session.query(EducationTemplate).filter_by(id=template_id).first()
            if not template:
                raise ValueError("Template not found")

            # For now, return basic stats from the template itself
            # In a real implementation, you might track actual usage in a separate table
            return {
                "template_id": template_id,
                "name": template.name,
                "created_at": template.created_at.isoformat() if template.created_at else None,
                "updated_at": template.updated_at.isoformat() if template.updated_at else None,
                "is_public": template.is_public,
                "template_type": template.template_type,
                "tags": template.tags,
                # These would be actual usage metrics in a real implementation
                "view_count": 0,
                "clone_count": 0,
                "usage_count": 0,
            }

        except Exception as e:
            raise e

    @staticmethod
    def get_popular_templates(limit: int = 10, template_type: Optional[str] = None) -> list[dict]:
        """
        Get popular/recommended templates.

        Args:
            limit: Number of templates to return
            template_type: Filter by template type

        Returns:
            List[Dict]: List of popular templates with stats
        """
        try:
            query = db.session.query(EducationTemplate).filter_by(is_public=True)

            if template_type:
                query = query.filter(EducationTemplate.template_type == template_type)

            # For now, order by creation date (newest first)
            # In a real implementation, you might order by usage statistics
            templates = query.order_by(EducationTemplate.created_at.desc()).limit(limit).all()

            popular = []
            for template in templates:
                popular.append(
                    {
                        "id": template.id,
                        "name": template.name,
                        "description": template.description,
                        "template_type": template.template_type,
                        "tags": template.tags,
                        "created_by": template.created_by,
                        "created_at": template.created_at.isoformat() if template.created_at else None,
                        # Mock popularity metrics
                        "popularity_score": 100,
                        "usage_count": 0,
                    }
                )

            return popular

        except Exception as e:
            raise e

    @staticmethod
    def get_user_templates(
        user_id: str, include_public: bool = True, template_type: Optional[str] = None
    ) -> list[EducationTemplate]:
        """
        Get all templates accessible to a user.

        Args:
            user_id: User ID
            include_public: Whether to include public templates
            template_type: Filter by template type

        Returns:
            List[EducationTemplate]: List of accessible templates
        """
        try:
            query = db.session.query(EducationTemplate)

            if include_public:
                query = query.filter(or_(EducationTemplate.created_by == user_id, EducationTemplate.is_public == True))
            else:
                query = query.filter(EducationTemplate.created_by == user_id)

            if template_type:
                query = query.filter(EducationTemplate.template_type == template_type)

            return query.order_by(EducationTemplate.created_at.desc()).all()

        except Exception as e:
            raise e

    @staticmethod
    def get_template_tags() -> list[str]:
        """
        Get all unique tags used in templates.

        Returns:
            List[str]: List of unique tags
        """
        try:
            # Get all templates with tags
            templates = db.session.query(EducationTemplate).filter(EducationTemplate.tags.isnot(None)).all()

            # Collect all unique tags
            all_tags = set()
            for template in templates:
                if template.tags:
                    all_tags.update(template.tags)

            return sorted(all_tags)

        except Exception as e:
            raise e
