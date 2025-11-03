from typing import Any

from core.tools.builtin_tool.provider import BuiltinToolProviderController


class MdExporterProvider(BuiltinToolProviderController):
    """Markdown export provider supporting 14+ output formats."""

    def _validate_credentials(self, user_id: str, credentials: dict[str, Any]) -> None:
        """
        Validate credentials for Markdown Exporter provider.

        No API credentials required for markdown conversion.

        Args:
            user_id: User ID
            credentials: Provider credentials (unused)
        """
        pass
