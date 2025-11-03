from typing import Any

from core.tools.builtin_tool.provider import BuiltinToolProviderController


class GoogleTranslateProvider(BuiltinToolProviderController):
    """Google Translate provider using free public API."""

    def _validate_credentials(self, user_id: str, credentials: dict[str, Any]) -> None:
        """
        Validate credentials for Google Translate provider.

        Uses free public Google Translate API, no authentication required.

        Args:
            user_id: User ID
            credentials: Provider credentials (unused)
        """
        pass
