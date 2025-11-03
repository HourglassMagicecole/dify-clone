from typing import Any

from core.tools.builtin_tool.provider import BuiltinToolProviderController


class JsonProcessProvider(BuiltinToolProviderController):
    """JSON manipulation provider using JSONPath."""

    def _validate_credentials(self, user_id: str, credentials: dict[str, Any]) -> None:
        """
        Validate credentials for JSON Process provider.

        No API credentials required for JSON operations.

        Args:
            user_id: User ID
            credentials: Provider credentials (unused)
        """
        pass
