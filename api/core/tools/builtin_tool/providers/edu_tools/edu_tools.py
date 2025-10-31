"""EduTools Provider Controller."""

from typing import Any

from core.tools.builtin_tool.provider import BuiltinToolProviderController


class EduToolsProvider(BuiltinToolProviderController):
    """
    Educational tools provider for EduAI Studio.

    This provider offers simple, educational tools that don't require API keys,
    making them ideal for learning AI concepts.
    """

    def _validate_credentials(self, user_id: str, credentials: dict[str, Any]) -> None:
        """
        Validate credentials.

        Educational tools don't require any credentials/API keys.

        Args:
            user_id: The user ID
            credentials: The credentials dictionary (empty for edu_tools)
        """
        # No credentials needed for educational tools
        pass
