"""Educational Tools API endpoints."""

from flask import request
from flask_restx import Resource

from controllers.console import console_ns
from controllers.console.wraps import account_initialization_required
from libs.login import current_user, login_required
from services.education_management.tool_registry_service import ToolRegistryService


@console_ns.route("/education/tools")
class ToolListAPI(Resource):
    """List all educational tools."""

    @login_required
    @account_initialization_required
    def get(self):
        """
        Get list of all educational tools.

        Returns:
            200: List of tool providers with tools
            500: Server error

        Response format:
        {
            "result": "success",
            "data": [
                {
                    "name": "edu_tools",
                    "label": {"en_US": "Educational Tools", "ko_KR": "교육용 도구"},
                    "tools": [
                        {
                            "name": "calculator",
                            "label": {"en_US": "Calculator", "ko_KR": "계산기"},
                            "available": true,
                            "unavailable_reason": null
                        }
                    ]
                }
            ]
        }
        """
        try:
            # Get tenant_id and user_id with None check
            if not current_user or not current_user.current_tenant_id:  # pyright: ignore[reportOptionalMemberAccess]
                return {"result": "error", "message": "Tenant ID not found"}, 400

            tenant_id = current_user.current_tenant_id  # pyright: ignore[reportOptionalMemberAccess]
            user_id = current_user.id  # pyright: ignore[reportOptionalMemberAccess]

            tools = ToolRegistryService.list_edu_tools(tenant_id=tenant_id, user_id=user_id)

            return {"result": "success", "data": tools}, 200

        except Exception as e:
            return {"result": "error", "message": str(e)}, 500


@console_ns.route("/education/tools/<string:provider>/<string:tool_name>")
class ToolDetailAPI(Resource):
    """Get detailed information about a specific tool."""

    @login_required
    @account_initialization_required
    def get(self, provider: str, tool_name: str):
        """
        Get detailed information about a specific tool.

        Args:
            provider: Tool provider name (e.g., "edu_tools")
            tool_name: Tool name (e.g., "calculator")

        Returns:
            200: Tool details
            404: Tool not found
            500: Server error

        Response format:
        {
            "result": "success",
            "data": {
                "name": "calculator",
                "label": {"en_US": "Calculator", "ko_KR": "계산기"},
                "description": {
                    "human": {"en_US": "...", "ko_KR": "..."},
                    "llm": "..."
                },
                "parameters": [
                    {
                        "name": "expression",
                        "type": "string",
                        "required": true,
                        "label": {"en_US": "Expression", "ko_KR": "수식"}
                    }
                ],
                "icon": "icon.svg"
            }
        }
        """
        try:
            # Get tenant_id with None check
            if not current_user or not current_user.current_tenant_id:  # pyright: ignore[reportOptionalMemberAccess]
                return {"result": "error", "message": "Tenant ID not found"}, 400

            tenant_id = current_user.current_tenant_id  # pyright: ignore[reportOptionalMemberAccess]
            detail = ToolRegistryService.get_tool_detail(
                tenant_id=tenant_id,
                provider=provider,
                tool_name=tool_name,
            )

            return {"result": "success", "data": detail}, 200

        except Exception as e:
            return {"result": "error", "message": str(e)}, 404 if "not found" in str(e).lower() else 500


@console_ns.route("/education/tools/<string:provider>/<string:tool_name>/test")
class ToolTestAPI(Resource):
    """Test a tool with given parameters."""

    @login_required
    @account_initialization_required
    def post(self, provider: str, tool_name: str):
        """
        Test a tool with given parameters.

        Args:
            provider: Tool provider name (e.g., "edu_tools")
            tool_name: Tool name (e.g., "calculator")

        Request Body:
        {
            "parameters": {
                "expression": "2 + 2"
            }
        }

        Returns:
            200: Test result (success or failure)
            400: Invalid request
            500: Server error

        Response format (success):
        {
            "result": "success",
            "data": {
                "success": true,
                "results": [
                    {
                        "type": "text",
                        "message": "Result: 4"
                    }
                ]
            }
        }

        Response format (tool error):
        {
            "result": "error",
            "data": {
                "success": false,
                "error": "Division by zero is not allowed"
            }
        }
        """
        try:
            # Get tenant_id and user_id with None check
            if not current_user or not current_user.current_tenant_id:  # pyright: ignore[reportOptionalMemberAccess]
                return {"result": "error", "message": "Tenant ID not found"}, 400

            tenant_id = current_user.current_tenant_id  # pyright: ignore[reportOptionalMemberAccess]
            user_id = current_user.id  # pyright: ignore[reportOptionalMemberAccess]

            # Get request body
            req_data = request.get_json()
            if not req_data:
                return {"result": "error", "message": "Request body is required"}, 400

            test_parameters = req_data.get("parameters", {})

            # Test tool
            result = ToolRegistryService.test_tool(
                tenant_id=tenant_id,
                provider=provider,
                tool_name=tool_name,
                test_parameters=test_parameters,
                user_id=user_id,
            )

            # Return result (success or error)
            if result.get("success"):
                return {"result": "success", "data": result}, 200
            else:
                return {"result": "error", "data": result}, 200  # Still 200, but with success=false

        except Exception as e:
            return {"result": "error", "message": str(e)}, 500
