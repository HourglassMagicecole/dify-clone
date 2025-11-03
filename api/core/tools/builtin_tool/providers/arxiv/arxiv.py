from typing import Any

from core.tools.builtin_tool.provider import BuiltinToolProviderController


class ArxivProvider(BuiltinToolProviderController):
    """ArXiv academic paper search provider."""

    def _validate_credentials(self, user_id: str, credentials: dict[str, Any]) -> None:
        """
        Validate credentials for ArXiv provider.

        ArXiv API doesn't require authentication.

        Args:
            user_id: User ID
            credentials: Provider credentials (unused)
        """
        pass
