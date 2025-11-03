import base64
import json
import re
from collections.abc import Generator
from typing import Any

from pyecharts import options as opts  # pyright: ignore[reportMissingTypeStubs]
from pyecharts.charts import Bar, HeatMap, Line, Pie, Scatter  # pyright: ignore[reportMissingTypeStubs]
from pyecharts.globals import ThemeType  # pyright: ignore[reportMissingTypeStubs]

from core.tools.builtin_tool.tool import BuiltinTool
from core.tools.entities.tool_entities import ToolInvokeMessage
from extensions.ext_storage import storage

from ..utils.digitforce_api import DigitForceApi

MAX_QUERY_LENGTH = 1000
API_MODULE_NAME = "EchartsVisualization"


class DataVisualizationTool(BuiltinTool):
    def _extract_json_from_text(self, text: str) -> list[dict]:
        """Extract JSON configurations from text that might contain markdown or other formatting."""
        # Try to find all JSON-like content between ```json and ``` markers
        json_matches = re.finditer(r"```(?:json|echarts)?\s*(\{[\s\S]*?\})\s*```", text)
        configs = []
        for match in json_matches:
            try:
                configs.append(json.loads(match.group(1)))
            except json.JSONDecodeError:
                continue

        if not configs:
            # Try to find any JSON object in the text
            json_match = re.search(r"(\{[\s\S]*?\})", text)
            if json_match:
                try:
                    configs.append(json.loads(json_match.group(1)))
                except json.JSONDecodeError:
                    pass

        if not configs:
            # If no JSON found, try to parse the entire text
            try:
                configs.append(json.loads(text))
            except json.JSONDecodeError:
                raise ValueError("Could not find valid JSON configuration in the result")

        return configs

    def _create_chart_html(self, configs: list[dict]) -> str:
        charts_html = []
        for _, config in enumerate(configs):
            # Get chart type from series
            chart_type = config.get("series", [{}])[0].get("type", "").lower()

            # Create the appropriate chart based on type
            if chart_type == "bar":
                chart = Bar(init_opts=opts.InitOpts(theme=ThemeType.LIGHT))
            elif chart_type == "line":
                chart = Line(init_opts=opts.InitOpts(theme=ThemeType.LIGHT))
            elif chart_type == "pie":
                chart = Pie(init_opts=opts.InitOpts(theme=ThemeType.LIGHT))
            elif chart_type == "scatter":
                chart = Scatter(init_opts=opts.InitOpts(theme=ThemeType.LIGHT))
            elif chart_type == "heatmap":
                chart = HeatMap(init_opts=opts.InitOpts(theme=ThemeType.LIGHT))
            else:
                raise ValueError(f"Unsupported chart type: {chart_type}")

            # 动态调整 legend 位置和方向
            legend_data = config.get("legend", {}).get("data", [])
            legend_count = len(legend_data)
            if legend_count > 6:
                legend_opts = opts.LegendOpts(
                    is_show=True,
                    orient="horizontal",
                    pos_top=40,
                    pos_left="center",
                    type_="scroll",
                )
                title_top = "10"
            else:
                legend_opts = opts.LegendOpts(
                    is_show=True,
                    orient="vertical",
                    pos_right=10,
                    pos_top=20,
                )
                title_top = "20"
            # 判断是否需要 dataZoom
            datazoom_opts_list = None
            if chart_type in ["bar", "line"]:
                xaxis_data = config.get("xAxis", {}).get("data", [])
                if isinstance(xaxis_data, list) and len(xaxis_data) > 12:
                    datazoom_opts_list = [
                        opts.DataZoomOpts(
                            type_="slider", orient="horizontal", xaxis_index=0, range_start=0, range_end=100
                        ),
                        opts.DataZoomOpts(type_="inside", xaxis_index=0),
                    ]
            # Set global options
            chart.set_global_opts(
                title_opts=opts.TitleOpts(
                    title=config.get("title", {}).get("text", ""),
                    pos_left=config.get("title", {}).get("left", "center"),
                    pos_top=title_top,
                ),
                legend_opts=legend_opts,
                tooltip_opts=opts.TooltipOpts(
                    trigger=config.get("tooltip", {}).get(
                        "trigger", "axis" if chart_type in ["bar", "line"] else "item"
                    ),
                    formatter=config.get("tooltip", {}).get("formatter", None) or None,
                ),
                xaxis_opts=opts.AxisOpts(
                    name=(config.get("xAxis", {}).get("name", "") if isinstance(config.get("xAxis", {}), dict) else ""),
                ),
                yaxis_opts=opts.AxisOpts(
                    name=(config.get("yAxis", {}).get("name", "") if isinstance(config.get("yAxis", {}), dict) else ""),
                ),
                datazoom_opts=datazoom_opts_list,
            )

            # Add series data
            for series in config.get("series", []):
                if chart_type == "pie":
                    chart.add(
                        series_name=series.get("name", ""),
                        data_pair=[(item["name"], item["value"]) for item in series.get("data", [])],
                        radius=series.get("radius", "50%"),
                        center=series.get("center", ["50%", "50%"]),
                        label_opts=opts.LabelOpts(
                            is_show=False, formatter=series.get("label", {}).get("formatter", "{b}: {c} ({d}%)")
                        ),
                    )
                elif chart_type in ["bar", "line"]:
                    if "xAxis" in config:
                        chart.add_xaxis(config["xAxis"].get("data", []))
                    chart.add_yaxis(  # type: ignore[call-arg]
                        series.get("name", ""),
                        series.get("data", []),
                        label_opts=opts.LabelOpts(is_show=False),
                    )

            # Add chart container and render
            charts_html.append(chart.render_embed())

        # Create HTML content with proper styling
        html_content = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <title>ECharts Visualization</title>
            <script src="https://cdn.jsdelivr.net/npm/echarts@5.4.3/dist/echarts.min.js"></script>
            <style>
                body {{
                    margin: 0;
                    padding: 0;
                    background: white;
                    font-family: Arial, sans-serif;
                }}
                .chart-container {{
                    width: 800px;
                    height: 600px;
                    margin: 20px auto;
                    border: 1px solid #eee;
                    border-radius: 4px;
                    box-shadow: 0 2px 4px rgba(0,0,0,0.1);
                }}
            </style>
        </head>
        <body>
            {"".join(charts_html)}
        </body>
        </html>
        """
        return html_content

    def _invoke(
        self,
        user_id: str,
        tool_parameters: dict[str, Any],
        conversation_id: str | None = None,
        app_id: str | None = None,
        message_id: str | None = None,
    ) -> Generator[ToolInvokeMessage]:
        try:
            # Retrieve the API key
            api_key = self.runtime.credentials["digitforce_api_key"]
            # Extract variables from the tool_parameters
            query = tool_parameters["query"]
            input_data = tool_parameters.get("input_data")
            file = tool_parameters.get("input_file")

            if not input_data and not file:
                yield self.create_text_message("Please provide input_data or file")
                return

            if len(query) > MAX_QUERY_LENGTH:
                yield self.create_text_message(
                    "The query is too long. Please check if you have entered any incorrect variables"
                )
                return

            post_data = {"query": query, "input_data": input_data}
            if file:
                post_data["file_extension"] = file.extension.lower()
                post_data["file_url"] = file.generate_url()
                # Load file from storage and encode as base64
                file_blob = storage.load(file.storage_key)
                if file_blob:
                    post_data["file_blob"] = base64.b64encode(file_blob).decode("utf-8")
                post_data["sheet_name"] = None  # None means read all sheets

            result = DigitForceApi(api_key).dify_api_post(post_data, service_name=API_MODULE_NAME)
            if result:
                # First yield the original ECharts configuration
                yield self.create_text_message(result)

                try:
                    # Extract and parse the ECharts configurations
                    configs = self._extract_json_from_text(result)
                    # Create HTML content
                    html_content = self._create_chart_html(configs)
                    # Yield the HTML content
                    yield self.create_blob_message(
                        blob=html_content.encode("utf-8"),
                        meta={"mime_type": "text/html", "filename": "visualization.html"},
                    )
                except Exception as e:
                    yield self.create_text_message(
                        f"Failed to create visualization: {str(e)}\n\nDebug info - Raw result:\n{result}"
                    )
            else:
                yield self.create_text_message(
                    "Result is empty.Possible data source or code generation issue. Check input data and retry."
                )
        except Exception as e:
            yield self.create_text_message(str(e))
