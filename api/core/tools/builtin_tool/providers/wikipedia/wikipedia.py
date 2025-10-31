from typing import Any

from core.tools.builtin_tool.provider import BuiltinToolProviderController


class WikipediaProvider(BuiltinToolProviderController):
    def _validate_credentials(self, user_id: str, credentials: dict[str, Any]) -> None:
        """
        Validate credentials for Wikipedia provider.

        Wikipedia doesn't require API credentials, so this is a no-op.

        Args:
            user_id: User ID
            credentials: Provider credentials (unused for Wikipedia)
        """
        pass
