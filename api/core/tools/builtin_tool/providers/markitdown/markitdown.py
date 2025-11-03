from typing import Any

from core.tools.builtin_tool.provider import BuiltinToolProviderController


class MarkitdownProvider(BuiltinToolProviderController):
    """File to Markdown conversion provider."""

    def _validate_credentials(self, user_id: str, credentials: dict[str, Any]) -> None:
        """
        Validate credentials for Markitdown provider.

        No API credentials required for file conversion.

        Args:
            user_id: User ID
            credentials: Provider credentials (unused)
        """
        pass
