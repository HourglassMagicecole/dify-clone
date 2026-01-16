"""API Key management controller for Story 1.8."""

import logging

from flask import Blueprint, jsonify, request
from werkzeug.exceptions import BadRequest

from controllers.console.edu.auth_decorators import jwt_required, owner_required
from services.education_management.api_key_service import APIKeyService
from services.education_management.provider_sync_service import ProviderSyncService

logger = logging.getLogger(__name__)

# Blueprint 생성
bp = Blueprint("edu_api_keys", __name__, url_prefix="/console/api/edu/api-keys")


def _get_api_key_service() -> APIKeyService:
    """Get API Key service instance (lazy initialization)."""
    return APIKeyService()


@bp.route("", methods=["GET"])
@jwt_required
@owner_required
def list_api_keys():
    """
    API Key 목록 조회 (소유자만).

    Query Parameters:
        provider (str, optional): Provider 필터
        is_active (bool, optional): 활성 상태 필터

    Returns:
        JSON response with API key list
    """
    try:
        # Query parameters
        provider = request.args.get("provider")
        is_active_str = request.args.get("is_active")
        is_active = None
        if is_active_str is not None:
            is_active = is_active_str.lower() == "true"

        # Service 호출
        api_keys = _get_api_key_service().list_api_keys(
            current_user_id=request.user.id,
            current_user_role="owner",
            provider=provider,
            is_active=is_active,
        )

        # 마스킹된 키 반환
        result = []
        service = _get_api_key_service()
        for key in api_keys:
            decrypted = service.get_decrypted_key(key.id)
            result.append(
                {
                    "id": key.id,
                    "key_name": key.key_name,
                    "provider": key.provider,
                    "api_key_masked": key.get_masked_key(decrypted),
                    "is_active": key.is_active,
                    "priority": key.priority,
                    "created_by": key.created_by,
                    "created_at": key.created_at.isoformat(),
                    "updated_at": key.updated_at.isoformat(),
                }
            )

        return jsonify({"result": "success", "data": result}), 200

    except Exception as e:
        logger.error("Failed to list API keys: %s", str(e), exc_info=True)
        return jsonify({"result": "error", "message": str(e)}), 500


@bp.route("", methods=["POST"])
@jwt_required
@owner_required
def create_api_key():
    """
    API Key 추가 (테스트 성공 후에만 저장).

    Request Body:
        key_name (str): Key 이름
        provider (str): Provider 타입
        api_key (str): 평문 API Key
        priority (str): 우선순위 (primary, secondary, tertiary)

    Returns:
        JSON response with created API key info
    """
    try:
        # Request body 파싱
        data = request.get_json()
        if not data:
            raise BadRequest("Missing request body")

        # 필수 필드 검증
        key_name = data.get("key_name")
        provider = data.get("provider")
        api_key = data.get("api_key")
        priority = data.get("priority", "secondary")

        if not all([key_name, provider, api_key]):
            raise BadRequest("Missing required fields: key_name, provider, api_key")

        # API Key 생성 (암호화)
        service = _get_api_key_service()
        api_key_config = service.create_api_key(
            key_name=key_name,
            provider=provider,
            api_key=api_key,
            priority=priority,
            created_by=request.user.id,
        )

        # API Key 테스트
        test_result = service.test_api_key(api_key_config.id)

        # 테스트 실패 시 삭제
        if not test_result["success"]:
            service.delete_api_key(api_key_config.id)
            logger.warning(
                "API key creation failed due to test failure: %s (provider: %s)",
                test_result["message"],
                provider,
            )
            return jsonify({"result": "error", "message": test_result["message"]}), 400

        # Sync to Dify Provider system for TTS/STT/Model-dependent tools
        # Use request.tenant_id which is set by owner_required decorator
        tenant_id = request.tenant_id
        sync_service = ProviderSyncService()
        sync_result = sync_service.sync_api_key_to_provider(
            tenant_id=tenant_id,
            api_key_config_id=api_key_config.id,
        )

        if not sync_result["success"]:
            logger.warning(
                "API key created but provider sync failed: %s (provider: %s)",
                sync_result["message"],
                provider,
            )
            # Note: We don't fail the request, just log the warning
            # The API key is still valid for tools that don't need Provider system

        # 성공 응답
        decrypted = service.get_decrypted_key(api_key_config.id)
        return (
            jsonify(
                {
                    "result": "success",
                    "data": {
                        "id": api_key_config.id,
                        "key_name": api_key_config.key_name,
                        "provider": api_key_config.provider,
                        "api_key_masked": api_key_config.get_masked_key(decrypted),
                        "is_active": api_key_config.is_active,
                        "priority": api_key_config.priority,
                        "created_by": api_key_config.created_by,
                        "created_at": api_key_config.created_at.isoformat(),
                        "updated_at": api_key_config.updated_at.isoformat(),
                        "test_result": test_result,
                        "sync_result": sync_result,
                    },
                }
            ),
            201,
        )

    except BadRequest as e:
        return jsonify({"result": "error", "message": str(e)}), 400
    except ValueError as e:
        return jsonify({"result": "error", "message": str(e)}), 400
    except Exception as e:
        logger.error("Failed to create API key: %s", str(e), exc_info=True)
        return jsonify({"result": "error", "message": "Internal server error"}), 500


@bp.route("/<key_id>", methods=["PUT"])
@jwt_required
@owner_required
def update_api_key(key_id: str):
    """
    API Key 수정 (이름, 우선순위, 활성 상태만).

    Path Parameters:
        key_id (str): API Key ID

    Request Body:
        key_name (str, optional): 새 이름
        priority (str, optional): 새 우선순위
        is_active (bool, optional): 활성 상태

    Returns:
        JSON response with updated API key info
    """
    try:
        # Request body 파싱
        data = request.get_json()
        if not data:
            raise BadRequest("Missing request body")

        # Get current API key to check if key_name changed
        service = _get_api_key_service()
        current_api_key = service.get_api_key_by_id(key_id)
        if not current_api_key:
            raise ValueError("API Key not found")

        old_key_name = current_api_key.key_name
        new_key_name = data.get("key_name")

        # API Key 수정
        api_key_config = service.update_api_key(
            key_id=key_id,
            key_name=new_key_name,
            priority=data.get("priority"),
            is_active=data.get("is_active"),
        )

        # If key_name changed and was synced, re-sync to Provider with new name
        if new_key_name and new_key_name != old_key_name and api_key_config.provider_credential_name:
            logger.info(
                "API key name changed from '%s' to '%s', re-syncing Provider credential",
                old_key_name,
                new_key_name,
            )

            # Get tenant_id from request (set by owner_required decorator)
            tenant_id = request.tenant_id

            # Remove old Provider credential
            sync_service = ProviderSyncService()
            sync_service.remove_synced_credentials(
                tenant_id=tenant_id,
                provider=api_key_config.provider,
                credential_name=api_key_config.provider_credential_name,
            )

            # Re-sync with new name
            sync_result = sync_service.sync_api_key_to_provider(
                tenant_id=tenant_id,
                api_key_config_id=api_key_config.id,
            )

            if not sync_result["success"]:
                logger.warning(
                    "API key updated but provider re-sync failed: %s",
                    sync_result.get("message"),
                )

        # 응답
        decrypted = service.get_decrypted_key(api_key_config.id)
        return (
            jsonify(
                {
                    "result": "success",
                    "data": {
                        "id": api_key_config.id,
                        "key_name": api_key_config.key_name,
                        "provider": api_key_config.provider,
                        "api_key_masked": api_key_config.get_masked_key(decrypted),
                        "is_active": api_key_config.is_active,
                        "priority": api_key_config.priority,
                        "created_by": api_key_config.created_by,
                        "created_at": api_key_config.created_at.isoformat(),
                        "updated_at": api_key_config.updated_at.isoformat(),
                    },
                }
            ),
            200,
        )

    except BadRequest as e:
        return jsonify({"result": "error", "message": str(e)}), 400
    except ValueError as e:
        return jsonify({"result": "error", "message": str(e)}), 404
    except Exception as e:
        logger.error("Failed to update API key: %s", str(e), exc_info=True)
        return jsonify({"result": "error", "message": "Internal server error"}), 500


@bp.route("/<key_id>", methods=["DELETE"])
@jwt_required
@owner_required
def delete_api_key(key_id: str):
    """
    API Key 삭제.

    Path Parameters:
        key_id (str): API Key ID

    Returns:
        JSON response with success message
    """
    try:
        # Get API Key info before deletion (for sync)
        service = _get_api_key_service()
        api_key_config = service.get_api_key_by_id(key_id)

        if not api_key_config:
            return jsonify({"result": "error", "message": "API Key not found"}), 404

        # Store info for sync
        provider = api_key_config.provider
        # Use stored credential_name (saved during sync) for accurate deletion
        # Fallback to current name if not stored (for backward compatibility)
        credential_name = api_key_config.provider_credential_name or f"MAI-{api_key_config.key_name}"
        # Use request.tenant_id which is set by owner_required decorator
        tenant_id = request.tenant_id

        # Delete API Key from database
        service.delete_api_key(key_id)

        # Remove synced credentials from Dify Provider system
        sync_service = ProviderSyncService()
        sync_result = sync_service.remove_synced_credentials(
            tenant_id=tenant_id,
            provider=provider,
            credential_name=credential_name,
        )

        if not sync_result["success"]:
            logger.warning(
                "API key deleted but provider credential removal failed: %s (provider: %s)",
                sync_result["message"],
                provider,
            )
            # Note: We don't fail the request, API key is already deleted

        logger.info(
            "API key deleted successfully: %s (provider: %s, sync: %s)",
            key_id,
            provider,
            sync_result["success"],
        )

        return (
            jsonify(
                {
                    "result": "success",
                    "message": "API Key deleted successfully",
                    "sync_result": sync_result,
                }
            ),
            200,
        )

    except ValueError as e:
        return jsonify({"result": "error", "message": str(e)}), 404
    except Exception as e:
        logger.error("Failed to delete API key: %s", str(e), exc_info=True)
        return jsonify({"result": "error", "message": "Internal server error"}), 500


@bp.route("/<key_id>/test", methods=["POST"])
@jwt_required
@owner_required
def test_api_key(key_id: str):
    """
    API Key 재테스트.

    Path Parameters:
        key_id (str): API Key ID

    Returns:
        JSON response with test result
    """
    try:
        # API Key 테스트
        test_result = _get_api_key_service().test_api_key(key_id)

        status_code = 200 if test_result["success"] else 400
        return (
            jsonify(
                {
                    "result": "success" if test_result["success"] else "error",
                    "data": test_result,
                }
            ),
            status_code,
        )

    except ValueError as e:
        return jsonify({"result": "error", "message": str(e)}), 404
    except Exception as e:
        logger.error("Failed to test API key: %s", str(e), exc_info=True)
        return jsonify({"result": "error", "message": "Internal server error"}), 500
