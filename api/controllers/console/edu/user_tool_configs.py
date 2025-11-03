"""User Tool Configuration API endpoints."""

from flask import request
from flask_restx import Resource

from controllers.console import console_ns
from controllers.console.wraps import account_initialization_required
from libs.login import current_user, login_required
from services.education_management.user_tool_config_service import UserToolConfigService


@console_ns.route("/education/user-tool-configs")
class UserToolConfigListAPI(Resource):
    """List and create user tool configurations."""

    @login_required
    @account_initialization_required
    def get(self):
        """
        Get list of user tool configurations.

        Query Parameters:
            provider (optional): Filter by provider name

        Returns:
            200: List of user tool configurations
            400: Invalid request
            500: Server error

        Response format:
        {
            "result": "success",
            "data": [
                {
                    "id": "uuid",
                    "user_id": "uuid",
                    "provider": "google",
                    "api_key_masked": "AIzaSyA****ABCD",
                    "config_json": {"timeout": 30},
                    "is_active": true,
                    "created_at": "2025-11-01T00:00:00Z",
                    "updated_at": "2025-11-01T00:00:00Z"
                }
            ]
        }
        """
        try:
            # Get current user ID
            if not current_user or not current_user.id:  # pyright: ignore[reportOptionalMemberAccess]
                return {"result": "error", "message": "User not authenticated"}, 401

            user_id = current_user.id  # pyright: ignore[reportOptionalMemberAccess]

            # Get query parameters
            provider = request.args.get("provider")

            # Get user tool configs
            service = UserToolConfigService()
            configs = service.list_user_tool_configs(
                user_id=user_id,
                provider=provider,
                is_active=True,
            )

            # Convert to dict with masked keys
            result = []
            for config in configs:
                decrypted_key = service.get_decrypted_key(config.id, user_id)
                result.append(
                    {
                        "id": config.id,
                        "user_id": config.user_id,
                        "provider": config.provider,
                        "api_key_masked": config.get_masked_key(decrypted_key),
                        "config_json": config.config_json,
                        "is_active": config.is_active,
                        "created_at": config.created_at.isoformat(),
                        "updated_at": config.updated_at.isoformat(),
                    }
                )

            return {"result": "success", "data": result}, 200

        except Exception as e:
            return {"result": "error", "message": str(e)}, 500

    @login_required
    @account_initialization_required
    def post(self):
        """
        Create a new user tool configuration.

        Request Body:
        {
            "provider": "google",
            "api_key": "plaintext_api_key",
            "config_json": {"timeout": 30}  // optional
        }

        Returns:
            201: Tool configuration created
            400: Invalid request (validation error, duplicate config)
            500: Server error

        Response format:
        {
            "result": "success",
            "data": {
                "id": "uuid",
                "user_id": "uuid",
                "provider": "google",
                "api_key_masked": "AIzaSyA****ABCD",
                "config_json": {"timeout": 30},
                "is_active": true,
                "created_at": "2025-11-01T00:00:00Z",
                "updated_at": "2025-11-01T00:00:00Z"
            }
        }
        """
        try:
            # Get current user ID
            if not current_user or not current_user.id:  # pyright: ignore[reportOptionalMemberAccess]
                return {"result": "error", "message": "User not authenticated"}, 401

            user_id = current_user.id  # pyright: ignore[reportOptionalMemberAccess]

            # Get request body
            req_data = request.get_json()
            if not req_data:
                return {"result": "error", "message": "Request body is required"}, 400

            provider = req_data.get("provider")
            api_key = req_data.get("api_key")
            config_json = req_data.get("config_json")

            # Validation
            if not provider:
                return {"result": "error", "message": "provider is required"}, 400
            if not api_key:
                return {"result": "error", "message": "api_key is required"}, 400

            # Create tool config
            service = UserToolConfigService()
            config = service.create_user_tool_config(
                user_id=user_id,
                provider=provider,
                api_key=api_key,
                config_json=config_json,
            )

            # Get decrypted key for masking
            decrypted_key = service.get_decrypted_key(config.id, user_id)

            # Return created config
            result = {
                "id": config.id,
                "user_id": config.user_id,
                "provider": config.provider,
                "api_key_masked": config.get_masked_key(decrypted_key),
                "config_json": config.config_json,
                "is_active": config.is_active,
                "created_at": config.created_at.isoformat(),
                "updated_at": config.updated_at.isoformat(),
            }

            return {"result": "success", "data": result}, 201

        except ValueError as e:
            # Validation errors (duplicate config, unsupported provider, etc.)
            return {"result": "error", "message": str(e)}, 400
        except Exception as e:
            return {"result": "error", "message": str(e)}, 500


@console_ns.route("/education/user-tool-configs/<string:config_id>")
class UserToolConfigDetailAPI(Resource):
    """Get, update, or delete a specific user tool configuration."""

    @login_required
    @account_initialization_required
    def get(self, config_id: str):
        """
        Get a specific user tool configuration.

        Args:
            config_id: Configuration ID

        Returns:
            200: Tool configuration details
            401: User not authenticated
            404: Configuration not found
            500: Server error

        Response format:
        {
            "result": "success",
            "data": {
                "id": "uuid",
                "user_id": "uuid",
                "provider": "google",
                "api_key_masked": "AIzaSyA****ABCD",
                "config_json": {"timeout": 30},
                "is_active": true,
                "created_at": "2025-11-01T00:00:00Z",
                "updated_at": "2025-11-01T00:00:00Z"
            }
        }
        """
        try:
            # Get current user ID
            if not current_user or not current_user.id:  # pyright: ignore[reportOptionalMemberAccess]
                return {"result": "error", "message": "User not authenticated"}, 401

            user_id = current_user.id  # pyright: ignore[reportOptionalMemberAccess]

            # Get config
            service = UserToolConfigService()

            # Verify ownership and get decrypted key
            decrypted_key = service.get_decrypted_key(config_id, user_id)

            # Get config from database
            from extensions.ext_database import db
            from models.education.user_tool_config import UserToolConfig

            config = db.session.query(UserToolConfig).filter(UserToolConfig.id == config_id).first()

            if not config:
                return {"result": "error", "message": "Configuration not found"}, 404

            # Return config
            result = {
                "id": config.id,
                "user_id": config.user_id,
                "provider": config.provider,
                "api_key_masked": config.get_masked_key(decrypted_key),
                "config_json": config.config_json,
                "is_active": config.is_active,
                "created_at": config.created_at.isoformat(),
                "updated_at": config.updated_at.isoformat(),
            }

            return {"result": "success", "data": result}, 200

        except ValueError as e:
            # Ownership verification failed
            return {"result": "error", "message": str(e)}, 403
        except Exception as e:
            return {"result": "error", "message": str(e)}, 500

    @login_required
    @account_initialization_required
    def put(self, config_id: str):
        """
        Update a user tool configuration.

        Args:
            config_id: Configuration ID

        Request Body:
        {
            "api_key": "new_plaintext_api_key",  // optional
            "config_json": {"timeout": 60},      // optional
            "is_active": false                   // optional
        }

        Returns:
            200: Tool configuration updated
            400: Invalid request
            401: User not authenticated
            403: Permission denied
            500: Server error

        Response format:
        {
            "result": "success",
            "data": {
                "id": "uuid",
                "user_id": "uuid",
                "provider": "google",
                "api_key_masked": "AIzaSyA****WXYZ",
                "config_json": {"timeout": 60},
                "is_active": false,
                "created_at": "2025-11-01T00:00:00Z",
                "updated_at": "2025-11-01T01:00:00Z"
            }
        }
        """
        try:
            # Get current user ID
            if not current_user or not current_user.id:  # pyright: ignore[reportOptionalMemberAccess]
                return {"result": "error", "message": "User not authenticated"}, 401

            user_id = current_user.id  # pyright: ignore[reportOptionalMemberAccess]

            # Get request body
            req_data = request.get_json()
            if not req_data:
                return {"result": "error", "message": "Request body is required"}, 400

            api_key = req_data.get("api_key")
            config_json = req_data.get("config_json")
            is_active = req_data.get("is_active")

            # Update config
            service = UserToolConfigService()
            config = service.update_user_tool_config(
                config_id=config_id,
                user_id=user_id,
                api_key=api_key,
                config_json=config_json,
                is_active=is_active,
            )

            # Get decrypted key for masking
            decrypted_key = service.get_decrypted_key(config.id, user_id)

            # Return updated config
            result = {
                "id": config.id,
                "user_id": config.user_id,
                "provider": config.provider,
                "api_key_masked": config.get_masked_key(decrypted_key),
                "config_json": config.config_json,
                "is_active": config.is_active,
                "created_at": config.created_at.isoformat(),
                "updated_at": config.updated_at.isoformat(),
            }

            return {"result": "success", "data": result}, 200

        except ValueError as e:
            # Ownership verification or validation errors
            return {"result": "error", "message": str(e)}, 403
        except Exception as e:
            return {"result": "error", "message": str(e)}, 500

    @login_required
    @account_initialization_required
    def delete(self, config_id: str):
        """
        Delete a user tool configuration.

        Args:
            config_id: Configuration ID

        Returns:
            200: Tool configuration deleted
            401: User not authenticated
            403: Permission denied
            500: Server error

        Response format:
        {
            "result": "success",
            "message": "Tool configuration deleted successfully"
        }
        """
        try:
            # Get current user ID
            if not current_user or not current_user.id:  # pyright: ignore[reportOptionalMemberAccess]
                return {"result": "error", "message": "User not authenticated"}, 401

            user_id = current_user.id  # pyright: ignore[reportOptionalMemberAccess]

            # Delete config
            service = UserToolConfigService()
            service.delete_user_tool_config(
                config_id=config_id,
                user_id=user_id,
            )

            return {"result": "success", "message": "Tool configuration deleted successfully"}, 200

        except ValueError as e:
            # Ownership verification failed
            return {"result": "error", "message": str(e)}, 403
        except Exception as e:
            return {"result": "error", "message": str(e)}, 500
