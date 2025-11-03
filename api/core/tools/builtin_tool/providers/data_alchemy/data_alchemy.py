from typing import Any

from core.tools.builtin_tool.provider import BuiltinToolProviderController


class DataAlchemyProvider(BuiltinToolProviderController):
    """Automatic chart generation provider with LLM support."""

    def _validate_credentials(self, user_id: str, credentials: dict[str, Any]) -> None:
        """
        Validate credentials for Data Alchemy provider.

        No API credentials required. Uses LLM via BuiltinTool.invoke_model().

        Args:
            user_id: User ID
            credentials: Provider credentials (unused)
        """
        pass
