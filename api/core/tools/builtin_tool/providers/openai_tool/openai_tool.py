from typing import Any

from openai import OpenAI

from core.tools.builtin_tool.provider import BuiltinToolProviderController
from core.tools.errors import ToolProviderCredentialValidationError


class OpenAIProvider(BuiltinToolProviderController):
    def _validate_credentials(self, user_id: str, credentials: dict[str, Any]) -> None:
        """
        Validate credentials for OpenAI provider.

        Args:
            user_id: User ID
            credentials: Provider credentials containing 'openai_api_key'

        Raises:
            ToolProviderCredentialValidationError: If credentials are invalid
        """
        try:
            # Initialize OpenAI client with credentials
            base_url = credentials.get("openai_base_url") or None
            organization = credentials.get("openai_organization_id") or None

            client = OpenAI(api_key=credentials.get("openai_api_key"), base_url=base_url, organization=organization)

            # Test the API with a simple request (using cheapest model)
            client.chat.completions.create(
                model="gpt-4o-mini", messages=[{"role": "user", "content": "test"}], max_tokens=5
            )

            # If we get here without exception, credentials are valid

        except Exception as e:
            raise ToolProviderCredentialValidationError(str(e)) from e
