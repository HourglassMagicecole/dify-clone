"""Calculator tool for basic arithmetic operations."""

import re
from collections.abc import Generator
from typing import Any

from core.tools.builtin_tool.tool import BuiltinTool
from core.tools.entities.tool_entities import ToolInvokeMessage
from core.tools.errors import ToolInvokeError


class CalculatorTool(BuiltinTool):
    """
    A simple calculator tool for basic arithmetic operations.

    Supports: addition (+), subtraction (-), multiplication (*), division (/),
    and parentheses for grouping.

    Security: Uses whitelist validation to prevent code injection attacks.
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
        Invoke calculator tool.

        Args:
            user_id: The user ID
            tool_parameters: Tool parameters containing 'expression'
            conversation_id: Optional conversation ID
            app_id: Optional app ID
            message_id: Optional message ID

        Yields:
            ToolInvokeMessage: Result message or error message

        Raises:
            ToolInvokeError: If expression is invalid or calculation fails
        """
        # Extract expression parameter
        expression = tool_parameters.get("expression", "")

        # Validate input
        if not expression:
            yield self.create_text_message("Please provide a mathematical expression")
            return

        # Strip whitespace
        expression = expression.strip()

        # Security: Whitelist validation - only allow numbers, operators, parentheses, spaces, and decimal points
        if not re.match(r"^[\d\s\+\-\*\/\(\)\.]+$", expression):
            raise ToolInvokeError(
                "Invalid expression: only numbers, basic operators (+, -, *, /), "
                "parentheses, and decimal points are allowed"
            )

        # Additional security: check for dangerous patterns
        # Block multiple dots in a row (e.g., "1..2")
        if ".." in expression:
            raise ToolInvokeError("Invalid expression: multiple consecutive dots are not allowed")

        # Block empty parentheses
        if "()" in expression:
            raise ToolInvokeError("Invalid expression: empty parentheses are not allowed")

        try:
            # Evaluate expression safely
            # Using eval with restricted globals and locals to prevent code execution
            # Security: Whitelist validation above ensures only safe expressions are evaluated
            result = eval(expression, {"__builtins__": {}}, {})  # noqa: S307

            # Validate result is a number
            if not isinstance(result, (int, float)):
                raise ToolInvokeError("Calculation did not produce a numeric result")

            # Format result
            # If result is a whole number, display as integer
            if isinstance(result, float) and result.is_integer():
                result_str = str(int(result))
            else:
                # Round to 10 decimal places to avoid floating point precision issues
                result_str = f"{result:.10f}".rstrip("0").rstrip(".")

            yield self.create_text_message(f"Result: {result_str}")

        except ZeroDivisionError:
            raise ToolInvokeError("Division by zero is not allowed")
        except SyntaxError as e:
            raise ToolInvokeError(f"Invalid syntax in expression: {e!s}")
        except Exception as e:
            raise ToolInvokeError(f"Calculation error: {e!s}")
