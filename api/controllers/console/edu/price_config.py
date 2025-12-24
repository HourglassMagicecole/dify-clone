"""
Admin Price Config API
API endpoints for managing manual API pricing configuration.
"""

import logging
from decimal import Decimal

from flask import Blueprint, jsonify, request

from controllers.console.edu.auth_decorators import jwt_required
from core.model_runtime.entities.model_entities import ModelType
from core.provider_manager import ProviderManager
from extensions.ext_database import db
from services.education_management.price_config_service import PriceConfigService

logger = logging.getLogger(__name__)

bp = Blueprint("price_config", __name__, url_prefix="/console/api/edu/price-configs")


def _config_to_dict(config, model_status: str | None = None) -> dict:
    """Convert AdminPriceConfig to dictionary."""
    result = {
        "id": config.id,
        "tenant_id": config.tenant_id,
        "provider": config.provider,
        "model_id": config.model_id,
        "usage_type": config.usage_type,
        "input_modality": config.input_modality,
        "output_modality": config.output_modality,
        "quality": config.quality,
        "resolution": config.resolution,
        "tool_name": config.tool_name,
        "price_unit": config.price_unit,
        "unit_scale": config.unit_scale,
        "input_price": str(config.input_price) if config.input_price else None,
        "output_price": str(config.output_price) if config.output_price else None,
        "currency": config.currency,
        "is_active": config.is_active,
        "created_at": config.created_at.isoformat(),
        "updated_at": config.updated_at.isoformat(),
    }
    if model_status is not None:
        result["model_status"] = model_status
    return result


# Mapping from usage_type to Dify model_type
USAGE_TYPE_TO_MODEL_TYPE = {
    "llm": "llm",
    "embedding": "text-embedding",
    "rerank": "rerank",
    "tts": "tts",
    "stt": "speech2text",
}


def _get_model_status_map(tenant_id: str | None) -> dict[str, str]:
    """
    Get model status map for all model types (including disabled models).

    Returns:
        Dict mapping "provider#model_id" to status (e.g., "active", "disabled")
    """
    if not tenant_id:
        logger.debug("No tenant_id provided, skipping model status lookup")
        return {}

    status_map: dict[str, str] = {}
    provider_manager = ProviderManager()

    try:
        provider_configurations = provider_manager.get_configurations(tenant_id)
    except Exception:
        logger.debug("Failed to get provider configurations for tenant %s", tenant_id)
        return {}

    for _, model_type_str in USAGE_TYPE_TO_MODEL_TYPE.items():
        try:
            model_type = ModelType.value_of(model_type_str)
            # Get all models including disabled ones (only_active=False)
            models = provider_configurations.get_models(model_type=model_type, only_active=False)

            for model in models:
                provider_name = model.provider.provider
                # Simplify provider name: "langgenius/openai/openai" -> "openai"
                simple_provider = provider_name.split("/")[-1] if "/" in provider_name else provider_name
                # Key format: "provider#model_id"
                key = f"{simple_provider}#{model.model}"
                status = model.status.value if hasattr(model.status, "value") else str(model.status)
                status_map[key] = status
        except Exception:
            logger.debug("Failed to get models for type %s", model_type_str)
            continue

    logger.debug("Model status map has %d entries", len(status_map))
    return status_map


@bp.route("", methods=["GET"])
@jwt_required
def list_price_configs():
    """
    List price configurations.

    Query params:
        usage_type: Filter by usage type (optional)
        provider: Filter by provider (optional)
        is_active: Filter by active status (optional)
        page: Page number (default: 1)
        page_size: Items per page (default: 20)
    """
    tenant_id = request.user.current_tenant_id

    usage_type = request.args.get("usage_type")
    provider = request.args.get("provider")
    is_active_str = request.args.get("is_active")
    is_active = None
    if is_active_str is not None:
        is_active = is_active_str.lower() == "true"

    page = int(request.args.get("page", 1))
    page_size = int(request.args.get("page_size", 20))

    configs, total = PriceConfigService.list_price_configs(
        session=db.session,  # type: ignore[arg-type]
        tenant_id=tenant_id,
        usage_type=usage_type,
        provider=provider,
        is_active=is_active,
        page=page,
        page_size=page_size,
    )

    # Get model status map to show actual model status
    # Use config's tenant_id, or find a tenant if configs have NULL tenant_id
    config_tenant_ids = {c.tenant_id for c in configs if c.tenant_id}

    # If no tenant_id in configs (global prices), find a tenant to use for model status
    if not config_tenant_ids:
        from models import Tenant

        first_tenant = db.session.query(Tenant.id).first()
        if first_tenant:
            config_tenant_ids = {str(first_tenant.id)}

    model_status_map: dict[str, str] = {}
    for config_tenant_id in config_tenant_ids:
        model_status_map.update(_get_model_status_map(config_tenant_id))

    def config_with_status(config):
        # Build key to lookup model status
        key = f"{config.provider}#{config.model_id}"
        model_status = model_status_map.get(key)
        return _config_to_dict(config, model_status=model_status)

    return jsonify(
        {
            "result": "success",
            "data": {
                "items": [config_with_status(c) for c in configs],
                "total": total,
                "page": page,
                "page_size": page_size,
            },
        }
    )


@bp.route("/<config_id>", methods=["GET"])
@jwt_required
def get_price_config(config_id: str):
    """Get a specific price configuration."""
    tenant_id = request.user.current_tenant_id

    config = PriceConfigService.get_price_config(
        session=db.session,  # type: ignore[arg-type]
        tenant_id=tenant_id,
        config_id=config_id,
    )

    if not config:
        return jsonify({"result": "fail", "message": "Price config not found"}), 404

    return jsonify({"result": "success", "data": _config_to_dict(config)})


@bp.route("", methods=["POST"])
@jwt_required
def create_price_config():
    """
    Create a new price configuration.

    Request body:
        provider: Model provider (required)
        model_id: Model ID (required)
        usage_type: API type (required)
        price_unit: Pricing unit (required)
        unit_scale: Scale factor (default: 1)
        input_price: Price per input unit (optional)
        output_price: Price per output unit (optional)
        currency: Currency code (default: USD)
        input_modality: Input modality (optional)
        output_modality: Output modality (optional)
        quality: Image quality (optional)
        resolution: Image resolution (optional)
        tool_name: Tool name (optional)
    """
    tenant_id = request.user.current_tenant_id
    data = request.get_json()

    if not data:
        return jsonify({"result": "fail", "message": "Request body is required"}), 400

    required_fields = ["provider", "model_id", "usage_type", "price_unit"]
    for field in required_fields:
        if field not in data:
            return jsonify({"result": "fail", "message": f"{field} is required"}), 400

    try:
        config = PriceConfigService.create_price_config(
            session=db.session,  # type: ignore[arg-type]
            tenant_id=tenant_id,
            provider=data["provider"],
            model_id=data["model_id"],
            usage_type=data["usage_type"],
            price_unit=data["price_unit"],
            unit_scale=data.get("unit_scale", 1),
            input_price=Decimal(data["input_price"]) if data.get("input_price") else None,
            output_price=Decimal(data["output_price"]) if data.get("output_price") else None,
            currency=data.get("currency", "USD"),
            input_modality=data.get("input_modality"),
            output_modality=data.get("output_modality"),
            quality=data.get("quality"),
            resolution=data.get("resolution"),
            tool_name=data.get("tool_name"),
        )
        db.session.commit()

        return jsonify({"result": "success", "data": _config_to_dict(config)}), 201

    except ValueError as e:
        db.session.rollback()
        return jsonify({"result": "fail", "message": str(e)}), 400
    except Exception as e:
        db.session.rollback()
        return jsonify({"result": "fail", "message": f"Failed to create: {e}"}), 500


@bp.route("/<config_id>", methods=["PUT"])
@jwt_required
def update_price_config(config_id: str):
    """
    Update a price configuration.

    Request body:
        input_price: New input price (optional)
        output_price: New output price (optional)
        unit_scale: New unit scale (optional)
        currency: New currency (optional)
        is_active: New active status (optional)
    """
    tenant_id = request.user.current_tenant_id
    data = request.get_json()

    if not data:
        return jsonify({"result": "fail", "message": "Request body is required"}), 400

    try:
        config = PriceConfigService.update_price_config(
            session=db.session,  # type: ignore[arg-type]
            tenant_id=tenant_id,
            config_id=config_id,
            input_price=Decimal(data["input_price"]) if data.get("input_price") else None,
            output_price=Decimal(data["output_price"]) if data.get("output_price") else None,
            unit_scale=data.get("unit_scale"),
            currency=data.get("currency"),
            is_active=data.get("is_active"),
        )
        db.session.commit()

        if not config:
            return jsonify({"result": "fail", "message": "Price config not found"}), 404

        return jsonify({"result": "success", "data": _config_to_dict(config)})

    except Exception as e:
        db.session.rollback()
        return jsonify({"result": "fail", "message": f"Failed to update: {e}"}), 500


@bp.route("/<config_id>", methods=["DELETE"])
@jwt_required
def delete_price_config(config_id: str):
    """Delete a price configuration."""
    tenant_id = request.user.current_tenant_id

    try:
        deleted = PriceConfigService.delete_price_config(
            session=db.session,  # type: ignore[arg-type]
            tenant_id=tenant_id,
            config_id=config_id,
        )
        db.session.commit()

        if not deleted:
            return jsonify({"result": "fail", "message": "Price config not found"}), 404

        return jsonify({"result": "success", "message": "Price config deleted"})

    except Exception as e:
        db.session.rollback()
        return jsonify({"result": "fail", "message": f"Failed to delete: {e}"}), 500
