"""Resource tags API endpoints for education management."""

import logging
import uuid
from datetime import UTC

from flask import Blueprint, request
from flask_login import current_user, login_required

from controllers.console.wraps import account_initialization_required, setup_required
from services.edu.exceptions import ResourceAlreadyTaggedError, ResourceTagNotFoundError
from services.edu.resource_tagging_service import ResourceTaggingService

logger = logging.getLogger(__name__)

bp = Blueprint("resource_tags", __name__, url_prefix="/console/api/edu/resource-tags")


@bp.route("", methods=["POST"])
@setup_required
@login_required
@account_initialization_required
def create_tag():
    """
    Create a new resource tag.

    Request Body:
        {
            "session_id": "uuid",
            "resource_type": "app",
            "resource_id": "uuid",
            "account_id": "uuid"
        }

    Returns:
        JSON response with created tag data
    """
    data = request.get_json()

    if not data:
        return {"result": "error", "message": "Request body is required"}, 400

    # Validate required fields (account_id is no longer accepted from request body)
    required_fields = ["session_id", "resource_type", "resource_id"]
    for field in required_fields:
        if field not in data:
            return {"result": "error", "message": f"{field} is required"}, 400

    # Validate UUID format
    uuid_fields = ["session_id", "resource_id"]
    for field in uuid_fields:
        try:
            uuid.UUID(data[field])
        except (ValueError, AttributeError):
            return {"result": "error", "message": f"Invalid UUID format for {field}"}, 400

    # 세션 멤버십 검증: 요청자가 해당 세션의 멤버인지 확인
    service = ResourceTaggingService()
    if not service.check_session_membership(data["session_id"], str(current_user.id)):
        return {"result": "error", "message": "You are not a member of this session"}, 403

    try:
        # account_id는 요청 본문이 아닌 current_user에서 가져옴 (IDOR 방어)
        tag = service.add_tag(
            session_id=data["session_id"],
            resource_type=data["resource_type"],
            resource_id=data["resource_id"],
            account_id=str(current_user.id),
        )

        logger.info("Tag created via API: tag_id=%s, resource_type=%s", tag.id, tag.resource_type)

        return {
            "result": "success",
            "data": {
                "tag_id": tag.id,
                "session_id": tag.session_id,
                "resource_type": tag.resource_type,
                "resource_id": tag.resource_id,
                "account_id": tag.account_id,
                "tagged_at": tag.tagged_at.replace(tzinfo=UTC).isoformat() if tag.tagged_at else None,
            },
        }, 201

    except ResourceAlreadyTaggedError as e:
        logger.warning("Tag creation failed - already tagged: %s", str(e))
        return {"result": "error", "message": str(e)}, 400
    except Exception as e:
        logger.error("Tag creation failed with exception: %s", str(e), exc_info=True)
        return {"result": "error", "message": "Internal server error"}, 500


@bp.route("/<tag_id>", methods=["DELETE"])
@setup_required
@login_required
@account_initialization_required
def delete_tag(tag_id: str):
    """
    Delete a resource tag.

    Args:
        tag_id: Tag ID (UUID)

    Returns:
        JSON response with success message
    """
    # Validate UUID format
    try:
        uuid.UUID(tag_id)
    except (ValueError, AttributeError):
        return {"result": "error", "message": "Invalid UUID format for tag_id"}, 400

    try:
        # 태그 조회 및 권한 검증 (서비스 레이어에서 처리)
        service = ResourceTaggingService()
        tag, has_permission = service.check_delete_permission(tag_id, str(current_user.id))

        if not tag:
            return {"result": "error", "message": f"Tag not found: {tag_id}"}, 404

        if not has_permission:
            return {"result": "error", "message": "Only the tag creator or admin can delete this tag"}, 403

        service.remove_tag(tag_id)

        logger.info("Tag deleted via API: tag_id=%s", tag_id)

        return {"result": "success"}, 200

    except ResourceTagNotFoundError as e:
        logger.warning("Tag deletion failed - not found: %s", str(e))
        return {"result": "error", "message": str(e)}, 404
    except Exception as e:
        logger.error("Tag deletion failed with exception: %s", str(e), exc_info=True)
        return {"result": "error", "message": "Internal server error"}, 500


@bp.route("/resource/<resource_type>/<resource_id>", methods=["GET"])
@setup_required
@login_required
@account_initialization_required
def get_tags_by_resource(resource_type: str, resource_id: str):
    """
    Get all tags for a specific resource.

    Args:
        resource_type: Resource type (app, dataset, conversation, etc.)
        resource_id: Resource ID (UUID)

    Returns:
        JSON response with list of tags
    """
    try:
        # Validate resource_id UUID format
        try:
            uuid.UUID(resource_id)
        except (ValueError, AttributeError):
            return {"result": "error", "message": "Invalid UUID format for resource_id"}, 400

        service = ResourceTaggingService()
        tags = service.get_tags_by_resource(resource_type, resource_id)

        logger.debug(
            "Retrieved %d tags for resource: resource_type=%s, resource_id=%s", len(tags), resource_type, resource_id
        )

        return {
            "result": "success",
            "data": [
                {
                    "tag_id": tag.id,
                    "session_id": tag.session_id,
                    "account_id": tag.account_id,
                    "tagged_at": tag.tagged_at.replace(tzinfo=UTC).isoformat() if tag.tagged_at else None,
                }
                for tag in tags
            ],
        }, 200

    except Exception as e:
        logger.error("Failed to retrieve tags by resource: %s", str(e), exc_info=True)
        return {"result": "error", "message": "Internal server error"}, 500


@bp.route("/session/<session_id>/<resource_type>", methods=["GET"])
@setup_required
@login_required
@account_initialization_required
def get_resources_by_tag(session_id: str, resource_type: str):
    """
    Get resource IDs filtered by session and resource type.

    Args:
        session_id: Education session ID (UUID)
        resource_type: Resource type (app, dataset, conversation, etc.)

    Query Parameters:
        account_id: User account ID (optional)

    Returns:
        JSON response with list of resource IDs
    """
    try:
        # Validate session_id UUID format
        try:
            uuid.UUID(session_id)
        except (ValueError, AttributeError):
            return {"result": "error", "message": "Invalid UUID format for session_id"}, 400

        service = ResourceTaggingService()

        # admin이면 쿼리 파라미터 허용, 아닌 경우 current_user.id 강제
        is_admin = service.is_privileged_user(str(current_user.id))
        if is_admin:
            account_id = request.args.get("account_id", str(current_user.id))
        else:
            account_id = str(current_user.id)

        # Validate account_id UUID format if provided
        if account_id:
            try:
                uuid.UUID(account_id)
            except (ValueError, AttributeError):
                return {"result": "error", "message": "Invalid UUID format for account_id"}, 400
        resource_ids = service.get_resources_by_tag(
            session_id=session_id,
            resource_type=resource_type,
            account_id=account_id,
        )

        logger.debug(
            "Retrieved %d resources by tag: session_id=%s, resource_type=%s, account_id=%s",
            len(resource_ids),
            session_id,
            resource_type,
            account_id,
        )

        return {
            "result": "success",
            "data": {"resource_ids": resource_ids},
        }, 200

    except Exception as e:
        logger.error("Failed to retrieve resources by tag: %s", str(e), exc_info=True)
        return {"result": "error", "message": "Internal server error"}, 500
