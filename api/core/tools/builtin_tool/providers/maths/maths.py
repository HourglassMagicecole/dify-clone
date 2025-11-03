from typing import Any

from core.tools.builtin_tool.provider import BuiltinToolProviderController


class MathsProvider(BuiltinToolProviderController):
    """Mathematical expression evaluation provider using NumExpr."""

    def _validate_credentials(self, user_id: str, credentials: dict[str, Any]) -> None:
        """
        Validate credentials for Maths provider.

        No API credentials required for mathematical operations.

        Args:
            user_id: User ID
            credentials: Provider credentials (unused)
        """
        pass
