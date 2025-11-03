"""Math expression evaluation tool using NumExpr."""

import logging
from collections.abc import Generator
from typing import Any

import numexpr as ne  # pyright: ignore[reportMissingTypeStubs]

from core.tools.builtin_tool.tool import BuiltinTool
from core.tools.entities.tool_entities import ToolInvokeMessage


class EvaluateExpressionTool(BuiltinTool):
    """
    A tool for evaluating mathematical expressions using NumExpr.

    Supports complex mathematical expressions with NumExpr syntax.
    """

    def _invoke(
        self,
        user_id: str,
        tool_parameters: dict[str, Any],
        conversation_id: str | None = None,
        app_id: str | None = None,
        message_id: str | None = None,
    ) -> Generator[ToolInvokeMessage, None, None]:
        """
        Invoke math expression evaluation tool.

        Args:
            user_id: User ID
            tool_parameters: Tool parameters with 'expression'
            conversation_id: Conversation ID (optional)
            app_id: App ID (optional)
            message_id: Message ID (optional)

        Yields:
            ToolInvokeMessage: Evaluation result or error message
        """
        expression = tool_parameters.get("expression", "").strip()
        if not expression:
            yield self.create_text_message("Invalid expression")
            return

        try:
            result = ne.evaluate(expression)
            result_str = str(result)
            yield self.create_text_message(f'The result of the expression "{expression}" is {result_str}')
        except Exception as e:
            logging.exception("Error evaluating expression: %s", expression)
            yield self.create_text_message(f"Invalid expression: {expression}, error: {e!s}")
