"""Rookie Data Alchemy tool for intelligent chart generation using LLM."""

import json
import re
from collections.abc import Generator
from typing import Any

from core.model_runtime.entities.message_entities import SystemPromptMessage
from core.tools.builtin_tool.tool import BuiltinTool
from core.tools.entities.tool_entities import ToolInvokeMessage

from ..utils.prompt_loader import PromptLoader


class RookieDataAlchemyTool(BuiltinTool):
    """
    A tool for intelligent chart generation using LLM.

    Uses LLM to analyze data and generate ECharts configuration.
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
        Invoke rookie data alchemy tool.

        Args:
            user_id: User ID
            tool_parameters: Tool parameters
            conversation_id: Conversation ID (optional)
            app_id: App ID (optional)
            message_id: Message ID (optional)

        Yields:
            ToolInvokeMessage: Chart configuration or error message
        """
        # Initialize template loader
        prompt_loader = PromptLoader()

        # Build template context
        context = {
            "raw_data": tool_parameters["data"],
            "title": tool_parameters["title"],
            "chart_type": self._get_chart_english(tool_parameters["chart_type"]),
            "custom_requirements": tool_parameters.get("custom_requirements", ""),
        }

        system_prompt = prompt_loader.get_prompt(context)

        # Invoke LLM using built-in tool API
        response = self.invoke_model(
            user_id=user_id,
            prompt_messages=[
                SystemPromptMessage(content=system_prompt),
            ],
            stop=[],
        )

        # Parse response
        content = response.message.content
        if not isinstance(content, str):
            # If content is list or None, convert to string or use empty string
            content = str(content) if content else "{}"
        json_res = self.robust_json_parser(content)

        # Return chart configuration as JSON message for frontend visualization
        yield self.create_json_message(json_res)

    def _safe_json_parse(self, input_str):
        """Safely parse JSON with preprocessing."""
        # Preprocess: replace single quotes with double quotes, remove trailing commas
        input_str = re.sub(
            r"'([^']+)'",  # Match single-quoted strings
            r'"\1"',
            input_str,
        )
        input_str = re.sub(
            r",\s*}(\s*)$",  # Remove trailing commas in objects
            r"\1}",
            input_str,
        )
        input_str = re.sub(
            r",\s*](\s*)$",  # Remove trailing commas in arrays
            r"\1]",
            input_str,
        )
        return json.loads(input_str)

    def _add_echarts_code_fence(self, data: dict) -> str:
        """
        Convert ECharts config dict to formatted string with code fence.

        Args:
            data: ECharts configuration dictionary

        Returns:
            str: Formatted JSON string with code fence
        """
        # Type validation
        if not isinstance(data, dict):
            raise TypeError(f"Expected dict type, but got {type(data).__name__}")

        # Execute formatted JSON serialization
        formatted_json = json.dumps(
            data,
            indent=2,  # 2-space indent
            ensure_ascii=False,  # Support Chinese
            separators=(",", ": "),  # Optimize separator formatting
        )

        # Build standard code block
        return f"```echarts\n{formatted_json}\n```"

    def _get_chart_english(self, chinese_name):
        """
        Convert Chinese chart name to English type.

        Args:
            chinese_name: User input Chinese chart name

        Returns:
            str: Corresponding English type (defaults to 'line' if not found)
        """
        chart_mapping = {
            "柱状图": "bar",
            "折线图": "line",
            "饼图": "pie",
            "散点图": "scatter",
            "带有涟漪特效动画的散点（气泡）图": "effectScatter",
            "K线图": "candlestick",
            "雷达图": "radar",
            "热力图": "heatmap",
            "树图": "tree",
            "矩形树图": "treemap",
            "旭日图": "sunburst",
            "地图": "map",
            "路径图": "lines",
        }
        return chart_mapping.get(chinese_name, "line")

    def robust_json_parser(self, raw_str: str) -> dict:
        """
        Intelligently parse JSON string with or without code block markers.

        Features:
        1. Auto-remove ```json ``` code block markers
        2. Handle leading/trailing whitespace
        3. Compatible with single/multi-level nested JSON
        4. Auto-escape illegal control characters

        Args:
            raw_str: Raw string to parse

        Returns:
            Parsed dictionary object

        Raises:
            json.JSONDecodeError when JSON format is incorrect
        """
        # Regex pattern to match outermost code block markers (case-insensitive and whitespace-tolerant)
        code_block_pattern = r"^\s*`{3,}json\s*?(.*?)`{3,}\s*$"

        # Try to remove code block markers
        cleaned_str = re.sub(
            pattern=code_block_pattern,
            repl=r"\1",  # Keep first capture group content
            string=str(raw_str).strip(),
            flags=re.DOTALL | re.IGNORECASE,  # Cross-line matching and case-insensitive
        )

        try:
            # Try to parse processed string
            return json.loads(cleaned_str)
        except json.JSONDecodeError:
            # Second pass: handle special characters
            sanitized_str = re.sub(
                r"[\x00-\x1F\x7F-\x9F]",  # Match control characters
                lambda m: f"\\u{ord(m.group(0)):04x}",  # Escape to Unicode
                cleaned_str,
            )
            return json.loads(sanitized_str)
