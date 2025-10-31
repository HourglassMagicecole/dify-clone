from typing import Any

from core.tools.builtin_tool.provider import BuiltinToolProviderController
from core.tools.errors import ToolProviderCredentialValidationError


class GoogleProvider(BuiltinToolProviderController):
    def _validate_credentials(self, user_id: str, credentials: dict[str, Any]) -> None:
        """
        Validate credentials for Google provider.

        Args:
            user_id: User ID
            credentials: Provider credentials containing 'serpapi_api_key'

        Raises:
            ToolProviderCredentialValidationError: If credentials are invalid
        """
        try:
            # Test SerpApi key with a simple request
            import requests

            params = {"api_key": credentials.get("serpapi_api_key"), "q": "test", "engine": "google", "num": 1}
            response = requests.get("https://serpapi.com/search", params=params, timeout=30)
            response.raise_for_status()

            # Check if response is valid JSON
            response.json()
        except Exception as e:
            raise ToolProviderCredentialValidationError(str(e)) from e
