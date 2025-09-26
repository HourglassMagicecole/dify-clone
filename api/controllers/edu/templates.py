"""
Template management API endpoints for educational platform.
"""

from flask import request
from flask_restx import Resource, fields

from controllers.edu import api, edu_ns
from services.template_service import TemplateService

api.add_namespace(edu_ns)

# Define models for Swagger documentation
template_model = edu_ns.model(
    "Template",
    {
        "id": fields.String(required=True, description="Template ID"),
        "name": fields.String(required=True, description="Template name"),
        "description": fields.String(description="Template description"),
        "template_type": fields.String(required=True, description="Template type (workflow, agent, rag, etc.)"),
        "content": fields.Raw(description="Template content as JSON"),
        "created_by": fields.String(description="Creator user ID"),
        "is_public": fields.Boolean(description="Whether template is public"),
        "tags": fields.List(fields.String, description="Template tags"),
        "created_at": fields.DateTime(description="Creation timestamp"),
        "updated_at": fields.DateTime(description="Last update timestamp"),
    },
)

template_create_model = edu_ns.model(
    "TemplateCreate",
    {
        "name": fields.String(required=True, description="Template name"),
        "description": fields.String(description="Template description"),
        "template_type": fields.String(required=True, description="Template type", default="workflow"),
        "content": fields.Raw(description="Template content as JSON"),
        "is_public": fields.Boolean(description="Whether template is public", default=False),
        "tags": fields.List(fields.String, description="Template tags"),
    },
)

template_update_model = edu_ns.model(
    "TemplateUpdate",
    {
        "name": fields.String(description="Template name"),
        "description": fields.String(description="Template description"),
        "content": fields.Raw(description="Template content as JSON"),
        "is_public": fields.Boolean(description="Whether template is public"),
        "tags": fields.List(fields.String, description="Template tags"),
    },
)

template_clone_model = edu_ns.model(
    "TemplateClone",
    {
        "new_name": fields.String(required=True, description="Name for the cloned template"),
        "description": fields.String(description="Description for the cloned template"),
    },
)

template_share_model = edu_ns.model(
    "TemplateShare",
    {
        "is_public": fields.Boolean(required=True, description="Whether to make template public"),
    },
)

template_stats_model = edu_ns.model(
    "TemplateStats",
    {
        "template_id": fields.String(required=True, description="Template ID"),
        "name": fields.String(required=True, description="Template name"),
        "created_at": fields.DateTime(description="Creation timestamp"),
        "updated_at": fields.DateTime(description="Update timestamp"),
        "is_public": fields.Boolean(description="Whether template is public"),
        "template_type": fields.String(description="Template type"),
        "tags": fields.List(fields.String, description="Template tags"),
        "view_count": fields.Integer(description="Number of views"),
        "clone_count": fields.Integer(description="Number of clones"),
        "usage_count": fields.Integer(description="Number of uses"),
    },
)

popular_template_model = edu_ns.model(
    "PopularTemplate",
    {
        "id": fields.String(required=True, description="Template ID"),
        "name": fields.String(required=True, description="Template name"),
        "description": fields.String(description="Template description"),
        "template_type": fields.String(description="Template type"),
        "tags": fields.List(fields.String, description="Template tags"),
        "created_by": fields.String(description="Creator user ID"),
        "created_at": fields.DateTime(description="Creation timestamp"),
        "popularity_score": fields.Integer(description="Popularity score"),
        "usage_count": fields.Integer(description="Usage count"),
    },
)


@edu_ns.route("/templates")
class TemplatesAPI(Resource):
    @edu_ns.doc("list_templates", description="Get list of templates")
    @edu_ns.marshal_list_with(template_model)
    def get(self):
        """Get list of templates with filtering and pagination"""
        try:
            page = request.args.get("page", 1, type=int)
            per_page = min(request.args.get("per_page", 20, type=int), 100)
            template_type = request.args.get("type")
            user_id = request.args.get("user_id")
            is_public = request.args.get("is_public", type=bool) if request.args.get("is_public") else None
            search = request.args.get("search", "").strip() or None
            tags = request.args.getlist("tags") or None

            offset = (page - 1) * per_page

            templates = TemplateService.get_templates(
                limit=per_page,
                offset=offset,
                template_type=template_type,
                user_id=user_id,
                is_public=is_public,
                search=search,
                tags=tags,
            )

            result = []
            for template in templates:
                result.append(
                    {
                        "id": template.id,
                        "name": template.name,
                        "description": template.description,
                        "template_type": template.template_type,
                        "content": template.content,
                        "created_by": template.created_by,
                        "is_public": template.is_public,
                        "tags": template.tags,
                        "created_at": template.created_at.isoformat() if template.created_at else None,
                        "updated_at": template.updated_at.isoformat() if template.updated_at else None,
                    }
                )

            return result

        except Exception as e:
            return {"error": str(e)}, 500

    @edu_ns.doc("create_template", description="Create a new template")
    @edu_ns.expect(template_create_model)
    @edu_ns.marshal_with(template_model)
    def post(self):
        """Create a new template"""
        try:
            data = request.get_json()

            # Validate required fields
            if not data.get("name"):
                return {"error": "Template name is required"}, 400

            if not data.get("template_type"):
                return {"error": "Template type is required"}, 400

            # Get creator from headers (mock authentication)
            created_by = request.headers.get("X-User-ID")

            template = TemplateService.create_template(
                name=data["name"],
                description=data.get("description"),
                template_type=data["template_type"],
                content=data.get("content"),
                created_by=created_by,
                is_public=data.get("is_public", False),
                tags=data.get("tags"),
            )

            return {
                "id": template.id,
                "name": template.name,
                "description": template.description,
                "template_type": template.template_type,
                "content": template.content,
                "created_by": template.created_by,
                "is_public": template.is_public,
                "tags": template.tags,
                "created_at": template.created_at.isoformat() if template.created_at else None,
                "updated_at": template.updated_at.isoformat() if template.updated_at else None,
            }, 201

        except ValueError as e:
            return {"error": str(e)}, 400
        except Exception as e:
            return {"error": str(e)}, 500


@edu_ns.route("/templates/<string:template_id>")
class TemplateAPI(Resource):
    @edu_ns.doc("get_template", description="Get template by ID")
    @edu_ns.marshal_with(template_model)
    def get(self, template_id):
        """Get template by ID"""
        try:
            user_id = request.headers.get("X-User-ID")
            template = TemplateService.get_template_by_id(template_id, user_id)

            if not template:
                return {"error": "Template not found or not accessible"}, 404

            return {
                "id": template.id,
                "name": template.name,
                "description": template.description,
                "template_type": template.template_type,
                "content": template.content,
                "created_by": template.created_by,
                "is_public": template.is_public,
                "tags": template.tags,
                "created_at": template.created_at.isoformat() if template.created_at else None,
                "updated_at": template.updated_at.isoformat() if template.updated_at else None,
            }

        except Exception as e:
            return {"error": str(e)}, 500

    @edu_ns.doc("update_template", description="Update template")
    @edu_ns.expect(template_update_model)
    @edu_ns.marshal_with(template_model)
    def put(self, template_id):
        """Update template information"""
        try:
            data = request.get_json()
            user_id = request.headers.get("X-User-ID")

            template = TemplateService.update_template(template_id=template_id, user_id=user_id, **data)

            if not template:
                return {"error": "Template not found or permission denied"}, 404

            return {
                "id": template.id,
                "name": template.name,
                "description": template.description,
                "template_type": template.template_type,
                "content": template.content,
                "created_by": template.created_by,
                "is_public": template.is_public,
                "tags": template.tags,
                "created_at": template.created_at.isoformat() if template.created_at else None,
                "updated_at": template.updated_at.isoformat() if template.updated_at else None,
            }

        except Exception as e:
            return {"error": str(e)}, 500

    @edu_ns.doc("delete_template", description="Delete template")
    def delete(self, template_id):
        """Delete template"""
        try:
            user_id = request.headers.get("X-User-ID")
            success = TemplateService.delete_template(template_id, user_id)

            if success:
                return {"message": "Template deleted successfully"}
            else:
                return {"error": "Template not found or permission denied"}, 404

        except Exception as e:
            return {"error": str(e)}, 500


@edu_ns.route("/templates/<string:template_id>/clone")
class TemplateCloneAPI(Resource):
    @edu_ns.doc("clone_template", description="Clone an existing template")
    @edu_ns.expect(template_clone_model)
    @edu_ns.marshal_with(template_model)
    def post(self, template_id):
        """Clone an existing template"""
        try:
            data = request.get_json()
            user_id = request.headers.get("X-User-ID")

            if not data.get("new_name"):
                return {"error": "New template name is required"}, 400

            if not user_id:
                return {"error": "User authentication required"}, 401

            clone = TemplateService.clone_template(
                template_id=template_id, new_name=data["new_name"], user_id=user_id, description=data.get("description")
            )

            if not clone:
                return {"error": "Template not found or not accessible"}, 404

            return {
                "id": clone.id,
                "name": clone.name,
                "description": clone.description,
                "template_type": clone.template_type,
                "content": clone.content,
                "created_by": clone.created_by,
                "is_public": clone.is_public,
                "tags": clone.tags,
                "created_at": clone.created_at.isoformat() if clone.created_at else None,
                "updated_at": clone.updated_at.isoformat() if clone.updated_at else None,
            }, 201

        except ValueError as e:
            return {"error": str(e)}, 400
        except Exception as e:
            return {"error": str(e)}, 500


@edu_ns.route("/templates/<string:template_id>/share")
class TemplateShareAPI(Resource):
    @edu_ns.doc("share_template", description="Share or unshare template")
    @edu_ns.expect(template_share_model)
    @edu_ns.marshal_with(template_model)
    def patch(self, template_id):
        """Share or unshare a template"""
        try:
            data = request.get_json()
            user_id = request.headers.get("X-User-ID")

            if "is_public" not in data:
                return {"error": "is_public field is required"}, 400

            template = TemplateService.share_template(
                template_id=template_id, user_id=user_id, is_public=data["is_public"]
            )

            if not template:
                return {"error": "Template not found or permission denied"}, 404

            return {
                "id": template.id,
                "name": template.name,
                "description": template.description,
                "template_type": template.template_type,
                "content": template.content,
                "created_by": template.created_by,
                "is_public": template.is_public,
                "tags": template.tags,
                "created_at": template.created_at.isoformat() if template.created_at else None,
                "updated_at": template.updated_at.isoformat() if template.updated_at else None,
            }

        except Exception as e:
            return {"error": str(e)}, 500


@edu_ns.route("/templates/<string:template_id>/stats")
class TemplateStatsAPI(Resource):
    @edu_ns.doc("get_template_stats", description="Get template usage statistics")
    @edu_ns.marshal_with(template_stats_model)
    def get(self, template_id):
        """Get template usage statistics"""
        try:
            stats = TemplateService.get_template_usage_stats(template_id)
            return stats

        except ValueError as e:
            return {"error": str(e)}, 404
        except Exception as e:
            return {"error": str(e)}, 500


@edu_ns.route("/templates/popular")
class PopularTemplatesAPI(Resource):
    @edu_ns.doc("get_popular_templates", description="Get popular/recommended templates")
    @edu_ns.marshal_list_with(popular_template_model)
    def get(self):
        """Get popular/recommended templates"""
        try:
            limit = min(request.args.get("limit", 10, type=int), 50)
            template_type = request.args.get("type")

            popular = TemplateService.get_popular_templates(limit=limit, template_type=template_type)

            return popular

        except Exception as e:
            return {"error": str(e)}, 500


@edu_ns.route("/templates/tags")
class TemplateTagsAPI(Resource):
    @edu_ns.doc("get_template_tags", description="Get all available template tags")
    def get(self):
        """Get all unique tags used in templates"""
        try:
            tags = TemplateService.get_template_tags()
            return {"tags": tags}

        except Exception as e:
            return {"error": str(e)}, 500


@edu_ns.route("/users/<string:user_id>/templates")
class UserTemplatesAPI(Resource):
    @edu_ns.doc("get_user_templates", description="Get templates accessible to user")
    @edu_ns.marshal_list_with(template_model)
    def get(self, user_id):
        """Get all templates accessible to a user"""
        try:
            include_public = request.args.get("include_public", True, type=bool)
            template_type = request.args.get("type")

            templates = TemplateService.get_user_templates(
                user_id=user_id, include_public=include_public, template_type=template_type
            )

            result = []
            for template in templates:
                result.append(
                    {
                        "id": template.id,
                        "name": template.name,
                        "description": template.description,
                        "template_type": template.template_type,
                        "content": template.content,
                        "created_by": template.created_by,
                        "is_public": template.is_public,
                        "tags": template.tags,
                        "created_at": template.created_at.isoformat() if template.created_at else None,
                        "updated_at": template.updated_at.isoformat() if template.updated_at else None,
                    }
                )

            return result

        except Exception as e:
            return {"error": str(e)}, 500
