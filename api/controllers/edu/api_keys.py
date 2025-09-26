"""
API Key management endpoints for educational platform.
"""

from flask import g, request
from flask_restx import Resource, fields

from controllers.edu import api, edu_ns
from extensions.ext_database import db
from middlewares.auth_middleware import require_auth
from models.education import EducationApiKey, EducationUsageLimit

api.add_namespace(edu_ns)

# Define models for Swagger documentation
api_key_model = edu_ns.model(
    "ApiKey",
    {
        "id": fields.String(required=True, description="API Key ID"),
        "key_name": fields.String(required=True, description="API Key name"),
        "key_type": fields.String(required=True, description="API Key type"),
        "masked_key": fields.String(description="Masked API key (for display)"),
        "created_by": fields.String(description="Creator user ID"),
        "is_active": fields.Boolean(description="Whether key is active"),
        "expires_at": fields.DateTime(description="Expiration timestamp"),
        "created_at": fields.DateTime(description="Creation timestamp"),
        "last_used_at": fields.DateTime(description="Last usage timestamp"),
    },
)

api_key_create_model = edu_ns.model(
    "ApiKeyCreate",
    {
        "key_name": fields.String(required=True, description="API Key name"),
        "key_type": fields.String(required=True, description="API Key type (openai, anthropic, etc.)"),
        "api_key": fields.String(required=True, description="The actual API key to store"),
        "expires_at": fields.DateTime(description="Expiration timestamp (ISO format)"),
    },
)

api_key_update_model = edu_ns.model(
    "ApiKeyUpdate",
    {
        "key_name": fields.String(description="API Key name"),
        "is_active": fields.Boolean(description="Whether key is active"),
        "expires_at": fields.DateTime(description="Expiration timestamp (ISO format)"),
    },
)

usage_limit_model = edu_ns.model(
    "UsageLimit",
    {
        "id": fields.String(required=True, description="Usage limit ID"),
        "user_id": fields.String(description="User ID (if user-specific)"),
        "session_id": fields.String(description="Session ID (if session-specific)"),
        "limit_type": fields.String(required=True, description="Type of limit"),
        "limit_value": fields.Integer(required=True, description="Limit value"),
        "time_period": fields.String(description="Time period (daily, weekly, monthly)"),
        "is_active": fields.Boolean(description="Whether limit is active"),
        "created_at": fields.DateTime(description="Creation timestamp"),
    },
)

usage_limit_create_model = edu_ns.model(
    "UsageLimitCreate",
    {
        "user_id": fields.String(description="User ID (optional)"),
        "session_id": fields.String(description="Session ID (optional)"),
        "limit_type": fields.String(required=True, description="Type of limit (requests, tokens, etc.)"),
        "limit_value": fields.Integer(required=True, description="Limit value"),
        "time_period": fields.String(description="Time period", default="daily"),
    },
)


@edu_ns.route("/api-keys")
class ApiKeysAPI(Resource):
    @edu_ns.doc("list_api_keys", description="Get list of API keys")
    @edu_ns.marshal_list_with(api_key_model)
    @require_auth
    def get(self):
        """Get list of API keys with pagination"""
        try:
            page = request.args.get("page", 1, type=int)
            per_page = min(request.args.get("per_page", 20, type=int), 100)
            key_type = request.args.get("type")
            is_active = request.args.get("is_active", type=bool) if request.args.get("is_active") else None

            # Get user from headers (mock authentication)
            user_id = request.headers.get("X-User-ID")

            query = db.session.query(EducationApiKey)

            if user_id:
                query = query.filter(EducationApiKey.created_by == user_id)

            if key_type:
                query = query.filter(EducationApiKey.key_type == key_type)

            if is_active is not None:
                query = query.filter(EducationApiKey.is_active == is_active)

            offset = (page - 1) * per_page
            api_keys = query.order_by(EducationApiKey.created_at.desc()).offset(offset).limit(per_page).all()

            result = []
            for key in api_keys:
                # Mask the API key for display
                masked_key = (
                    key.api_key[:8] + "*" * 20 + key.api_key[-4:] if len(key.api_key) > 12 else "*" * len(key.api_key)
                )

                result.append(
                    {
                        "id": key.id,
                        "key_name": key.key_name,
                        "key_type": key.key_type,
                        "masked_key": masked_key,
                        "created_by": key.created_by,
                        "is_active": key.is_active,
                        "expires_at": key.expires_at.isoformat() if key.expires_at else None,
                        "created_at": key.created_at.isoformat() if key.created_at else None,
                        "last_used_at": key.last_used_at.isoformat() if key.last_used_at else None,
                    }
                )

            return result

        except Exception as e:
            return {"error": str(e)}, 500

    @edu_ns.doc("create_api_key", description="Create a new API key")
    @edu_ns.expect(api_key_create_model)
    @edu_ns.marshal_with(api_key_model)
    @require_auth
    def post(self):
        """Create a new API key"""
        try:
            data = request.get_json()

            # Validate required fields
            required_fields = ["key_name", "key_type", "api_key"]
            for field in required_fields:
                if not data.get(field):
                    return {"error": f"Field {field} is required"}, 400

            # Get creator from authenticated user
            created_by = g.current_user.id if hasattr(g, 'current_user') else None

            # Parse expiration date if provided
            expires_at = None
            if data.get("expires_at"):
                from datetime import datetime

                try:
                    expires_at = datetime.fromisoformat(data["expires_at"])
                except ValueError:
                    return {"error": "Invalid expires_at format. Use ISO format."}, 400

            # Create new API key
            new_key = EducationApiKey(
                key_name=data["key_name"], key_type=data["key_type"], created_by=created_by, expires_at=expires_at
            )

            # Set encrypted API key
            try:
                new_key.set_encrypted_api_key(data["api_key"])
            except ValueError as e:
                return {"error": f"API key encryption failed: {str(e)}"}, 500

            db.session.add(new_key)
            db.session.commit()

            # Mask the key for response
            masked_key = (
                data["api_key"][:8] + "*" * 20 + data["api_key"][-4:]
                if len(data["api_key"]) > 12
                else "*" * len(data["api_key"])
            )

            return {
                "id": new_key.id,
                "key_name": new_key.key_name,
                "key_type": new_key.key_type,
                "masked_key": masked_key,
                "created_by": new_key.created_by,
                "is_active": new_key.is_active,
                "expires_at": new_key.expires_at.isoformat() if new_key.expires_at else None,
                "created_at": new_key.created_at.isoformat() if new_key.created_at else None,
                "last_used_at": None,
            }, 201

        except Exception as e:
            db.session.rollback()
            return {"error": str(e)}, 500


@edu_ns.route("/api-keys/<string:key_id>")
class ApiKeyAPI(Resource):
    @edu_ns.doc("get_api_key", description="Get API key by ID")
    @edu_ns.marshal_with(api_key_model)
    def get(self, key_id):
        """Get API key by ID"""
        try:
            user_id = request.headers.get("X-User-ID")

            query = db.session.query(EducationApiKey).filter_by(id=key_id)
            if user_id:
                query = query.filter(EducationApiKey.created_by == user_id)

            key = query.first()
            if not key:
                return {"error": "API key not found"}, 404

            # Mask the key for response
            masked_key = (
                key.api_key[:8] + "*" * 20 + key.api_key[-4:] if len(key.api_key) > 12 else "*" * len(key.api_key)
            )

            return {
                "id": key.id,
                "key_name": key.key_name,
                "key_type": key.key_type,
                "masked_key": masked_key,
                "created_by": key.created_by,
                "is_active": key.is_active,
                "expires_at": key.expires_at.isoformat() if key.expires_at else None,
                "created_at": key.created_at.isoformat() if key.created_at else None,
                "last_used_at": key.last_used_at.isoformat() if key.last_used_at else None,
            }

        except Exception as e:
            return {"error": str(e)}, 500

    @edu_ns.doc("update_api_key", description="Update API key")
    @edu_ns.expect(api_key_update_model)
    @edu_ns.marshal_with(api_key_model)
    def put(self, key_id):
        """Update API key information"""
        try:
            data = request.get_json()
            user_id = request.headers.get("X-User-ID")

            query = db.session.query(EducationApiKey).filter_by(id=key_id)
            if user_id:
                query = query.filter(EducationApiKey.created_by == user_id)

            key = query.first()
            if not key:
                return {"error": "API key not found"}, 404

            # Update fields
            if "key_name" in data:
                key.key_name = data["key_name"]

            if "is_active" in data:
                key.is_active = data["is_active"]

            if "expires_at" in data:
                if data["expires_at"]:
                    from datetime import datetime

                    try:
                        key.expires_at = datetime.fromisoformat(data["expires_at"])
                    except ValueError:
                        return {"error": "Invalid expires_at format. Use ISO format."}, 400
                else:
                    key.expires_at = None

            from datetime import datetime

            key.updated_at = datetime.utcnow()
            db.session.commit()

            # Mask the key for response
            masked_key = (
                key.api_key[:8] + "*" * 20 + key.api_key[-4:] if len(key.api_key) > 12 else "*" * len(key.api_key)
            )

            return {
                "id": key.id,
                "key_name": key.key_name,
                "key_type": key.key_type,
                "masked_key": masked_key,
                "created_by": key.created_by,
                "is_active": key.is_active,
                "expires_at": key.expires_at.isoformat() if key.expires_at else None,
                "created_at": key.created_at.isoformat() if key.created_at else None,
                "last_used_at": key.last_used_at.isoformat() if key.last_used_at else None,
            }

        except Exception as e:
            db.session.rollback()
            return {"error": str(e)}, 500

    @edu_ns.doc("delete_api_key", description="Delete API key")
    def delete(self, key_id):
        """Delete API key"""
        try:
            user_id = request.headers.get("X-User-ID")

            query = db.session.query(EducationApiKey).filter_by(id=key_id)
            if user_id:
                query = query.filter(EducationApiKey.created_by == user_id)

            key = query.first()
            if not key:
                return {"error": "API key not found"}, 404

            db.session.delete(key)
            db.session.commit()

            return {"message": "API key deleted successfully"}

        except Exception as e:
            db.session.rollback()
            return {"error": str(e)}, 500


@edu_ns.route("/usage-limits")
class UsageLimitsAPI(Resource):
    @edu_ns.doc("list_usage_limits", description="Get list of usage limits")
    @edu_ns.marshal_list_with(usage_limit_model)
    def get(self):
        """Get list of usage limits"""
        try:
            page = request.args.get("page", 1, type=int)
            per_page = min(request.args.get("per_page", 20, type=int), 100)
            user_id = request.args.get("user_id")
            session_id = request.args.get("session_id")
            limit_type = request.args.get("limit_type")

            query = db.session.query(EducationUsageLimit)

            if user_id:
                query = query.filter(EducationUsageLimit.user_id == user_id)

            if session_id:
                query = query.filter(EducationUsageLimit.session_id == session_id)

            if limit_type:
                query = query.filter(EducationUsageLimit.limit_type == limit_type)

            offset = (page - 1) * per_page
            limits = query.order_by(EducationUsageLimit.created_at.desc()).offset(offset).limit(per_page).all()

            result = []
            for limit in limits:
                result.append(
                    {
                        "id": limit.id,
                        "user_id": limit.user_id,
                        "session_id": limit.session_id,
                        "limit_type": limit.limit_type,
                        "limit_value": limit.limit_value,
                        "time_period": limit.time_period,
                        "is_active": limit.is_active,
                        "created_at": limit.created_at.isoformat() if limit.created_at else None,
                    }
                )

            return result

        except Exception as e:
            return {"error": str(e)}, 500

    @edu_ns.doc("create_usage_limit", description="Create a new usage limit")
    @edu_ns.expect(usage_limit_create_model)
    @edu_ns.marshal_with(usage_limit_model)
    def post(self):
        """Create a new usage limit"""
        try:
            data = request.get_json()

            # Validate required fields
            required_fields = ["limit_type", "limit_value"]
            for field in required_fields:
                if data.get(field) is None:
                    return {"error": f"Field {field} is required"}, 400

            new_limit = EducationUsageLimit(
                user_id=data.get("user_id"),
                session_id=data.get("session_id"),
                limit_type=data["limit_type"],
                limit_value=data["limit_value"],
                time_period=data.get("time_period", "daily"),
            )

            db.session.add(new_limit)
            db.session.commit()

            return {
                "id": new_limit.id,
                "user_id": new_limit.user_id,
                "session_id": new_limit.session_id,
                "limit_type": new_limit.limit_type,
                "limit_value": new_limit.limit_value,
                "time_period": new_limit.time_period,
                "is_active": new_limit.is_active,
                "created_at": new_limit.created_at.isoformat() if new_limit.created_at else None,
            }, 201

        except Exception as e:
            db.session.rollback()
            return {"error": str(e)}, 500


@edu_ns.route("/usage-limits/<string:limit_id>")
class UsageLimitAPI(Resource):
    @edu_ns.doc("delete_usage_limit", description="Delete usage limit")
    def delete(self, limit_id):
        """Delete usage limit"""
        try:
            limit = db.session.query(EducationUsageLimit).filter_by(id=limit_id).first()
            if not limit:
                return {"error": "Usage limit not found"}, 404

            db.session.delete(limit)
            db.session.commit()

            return {"message": "Usage limit deleted successfully"}

        except Exception as e:
            db.session.rollback()
            return {"error": str(e)}, 500
