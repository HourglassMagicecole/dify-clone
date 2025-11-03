from typing import Any

from core.tools.builtin_tool.provider import BuiltinToolProviderController
from core.tools.errors import ToolProviderCredentialValidationError


class DataAnalysisProvider(BuiltinToolProviderController):
    """Data analysis provider using DigitForce API."""

    def _validate_credentials(self, user_id: str, credentials: dict[str, Any]) -> None:
        """
        Validate credentials for Data Analysis provider.

        Requires DigitForce API key for data analysis operations.

        Args:
            user_id: User ID
            credentials: Provider credentials containing 'api_key'

        Raises:
            ToolProviderCredentialValidationError: If API key is missing or invalid
        """
        api_key = credentials.get("api_key")
        if not api_key:
            raise ToolProviderCredentialValidationError("DigitForce API key is required")

        # Note: DigitForce API validation happens during actual tool invocation
        # as there's no dedicated validation endpoint
