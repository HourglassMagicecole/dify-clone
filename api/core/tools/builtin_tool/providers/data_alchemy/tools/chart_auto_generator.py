import json
import logging
import re
import sys
from collections.abc import Generator
from typing import Any

import pandas as pd

from core.tools.builtin_tool.tool import BuiltinTool
from core.tools.entities.tool_entities import ToolInvokeMessage

from ..utils.chart_templates import ChartTemplates

# Configure logging
logging.basicConfig(
    level=logging.DEBUG,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    handlers=[logging.StreamHandler(sys.stdout)],
)
logger = logging.getLogger("chart_auto_generator")


class ChartAutoGenerator(BuiltinTool):
    """
    Automatic Chart Generator Tool - Intelligently selects and generates chart configurations based on data characteristics
    Reference TypeScript implementation, provides efficient JSON data to chart conversion
    """

    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        self.chart_type_mapping = {
            # Basic chart types
            "bar chart": "bar",
            "bar": "bar",
            "line chart": "line",
            "line": "line",
            "pie chart": "pie",
            "pie": "pie",
            "scatter chart": "scatter",
            "scatter": "scatter",
            "radar chart": "radar",
            "radar": "radar",
            "funnel chart": "funnel",
            "funnel": "funnel",
            "heatmap": "heatmap",
            "boxplot": "boxplot",
            # Other chart types (may not be supported currently, but keep mapping)
            "gauge": "gauge",
            "tree": "tree",
            "treemap": "treemap",
            "sunburst": "sunburst",
            "candlestick": "candlestick",
            "sankey": "sankey",
            "graph": "graph",
            "map": "map",
            "parallel": "parallel",
            "theme river": "themeRiver",
            "calendar": "calendar",
        }

        # Predefined color schemes
        self.predefined_color_schemes = {
            "default": [
                "#5470c6",
                "#91cc75",
                "#fac858",
                "#ee6666",
                "#73c0de",
                "#3ba272",
                "#fc8452",
                "#9a60b4",
                "#ea7ccc",
                "#c4ccd3",
            ],
            "vintage": [
                "#d87c7c",
                "#919e8b",
                "#d7ab82",
                "#6e7074",
                "#61a0a8",
                "#efa18d",
                "#787464",
                "#cc7e63",
                "#724e58",
                "#4b565b",
            ],
            "dark": [
                "#dd6b66",
                "#759aa0",
                "#e69d87",
                "#8dc1a9",
                "#ea7e53",
                "#eedd78",
                "#73a373",
                "#73b9bc",
                "#7289ab",
                "#91ca8c",
            ],
            "macarons": [
                "#2ec7c9",
                "#b6a2de",
                "#5ab1ef",
                "#ffb980",
                "#d87a80",
                "#8d98b3",
                "#e5cf0d",
                "#97b552",
                "#95706d",
                "#dc69aa",
            ],
            "infographic": [
                "#c1232b",
                "#27727b",
                "#fcce10",
                "#e87c25",
                "#b5c334",
                "#fe8463",
                "#9bca63",
                "#fad860",
                "#f3a43b",
                "#60c0dd",
            ],
            "shine": [
                "#c12e34",
                "#e6b600",
                "#0098d9",
                "#2b821d",
                "#005eaa",
                "#339ca8",
                "#cda819",
                "#32a487",
                "#3572a5",
                "#c4ccd3",
            ],
            "roma": [
                "#e01f54",
                "#001852",
                "#f5e8c8",
                "#b8d2c7",
                "#c6b38e",
                "#a4d8c2",
                "#f3d999",
                "#d3758f",
                "#dcc392",
                "#2e4783",
            ],
        }

        # Default color scheme
        self.colors = self.predefined_color_schemes["default"]

    def _invoke(
        self,
        user_id: str,
        tool_parameters: dict[str, Any],
        conversation_id: str | None = None,
        app_id: str | None = None,
        message_id: str | None = None,
    ) -> Generator[ToolInvokeMessage, None, None]:
        """
        Run tool to automatically generate chart configuration

        Args:
            tool_parameters: Dictionary containing tool parameters
                data: JSON format data string
                chart_type: Optional, specify chart type, auto-select if not specified
                title: Optional, chart title
                color_scheme: Optional, color scheme

        Returns:
            Generator[ToolInvokeMessage]: Response containing ECharts configuration
        """
        try:
            # Get parameters
            data = tool_parameters.get("data", "")
            chart_type = tool_parameters.get("chart_type")
            title = tool_parameters.get("title")
            color_scheme = tool_parameters.get("color_scheme")

            logger.info(
                f"Received parameters: data length={len(data)}, chart_type={chart_type}, title={title}, color_scheme={color_scheme}"
            )

            # Handle color scheme
            if color_scheme:
                self.colors = self._parse_color_scheme(color_scheme)
                logger.info(f"Using color scheme: {color_scheme}, parsed colors: {self.colors[:3]}...")
            logger.debug(f"Raw data: {data[:200]}...")  # Only print first 200 characters to avoid long logs

            # Parse JSON data
            json_data = self._parse_data(data)
            if not json_data:
                logger.error("Cannot parse JSON data")
                yield self.create_text_message("Cannot parse data, please ensure valid JSON data is provided")
                return

            logger.info(f"Successfully parsed JSON data, contains{len(json_data)}records")
            logger.debug(f"Parsed data: {json_data[:2]}...")  # Only print first two records

            # Convert to DataFrame for processing
            df = pd.DataFrame(json_data)
            logger.info(f"DataFrame columns: {df.columns.tolist()}")
            logger.info(f"DataFrame data types: {df.dtypes.to_dict()}")
            logger.debug(f"DataFrame first few rows: \n{df.head(2)}")

            # Data cleaning
            df = self._clean_data(df)
            if df.empty:
                logger.error("Data is empty after cleaning")
                yield self.create_text_message("Data is empty after cleaning, please check data format")
                return

            logger.info(f"After data cleaningDataFrame columns: {df.columns.tolist()}")

            # If chart type not specified, auto-select
            if not chart_type or chart_type.lower() == "auto":
                detected_chart_type = self._analyze_data_and_select_chart(df)
                chart_type = detected_chart_type
                auto_selected = True
                logger.info("Auto-selected chart type: %s", chart_type)
            else:
                # Handle chart type
                original_chart_type = chart_type
                chart_type = self._normalize_chart_type(chart_type)
                auto_selected = False
                logger.info("User-specified chart type: %s -> normalized to: %s", original_chart_type, chart_type)

            # Generate chart configuration
            logger.info("Starting to generate%schart configuration", chart_type)
            chart_config = self._generate_chart_config(df, chart_type, title)
            logger.info(
                f"chart configuration生成完成: {chart_config.keys() if isinstance(chart_config, dict) else 'Error'}"
            )

            # Build response - return as JSON message for proper chart rendering
            logger.info("Response generation completed, ready to return result")

            # Add auto-selected chart type information if applicable
            if auto_selected:
                yield self.create_text_message(f"Auto-selected chart type: {chart_type}")

            # Return chart configuration as JSON message for frontend visualization
            yield self.create_json_message(chart_config)

        except Exception as e:
            logger.exception(f"Error generating chart: {str(e)}")
            yield self.create_text_message(f"Error generating chart: {str(e)}")

    def _add_echarts_code_fence(self, data: dict) -> str:
        """
        Convert ECharts configuration dict to formatted string with code fence

        Args:
            data (dict): ECharts configuration dict

        Returns:
            str: 带标准代码块标记的格式化JSON字符串
        """
        # 执行带格式化的JSON序列化
        formatted_json = json.dumps(
            data,
            indent=2,  # 2空格缩进
            ensure_ascii=False,  # 支持中文
            separators=(",", ": "),  # 优化分隔符排版
        )

        # 构造标准代码块
        return f"```echarts\n{formatted_json}\n```"

    def _parse_data(self, data_str: str) -> list[dict]:
        """Parse input data string to JSON object"""
        try:
            # 尝试直接解析JSON
            logger.info("Attempting to parse JSON data")
            data = json.loads(data_str)
            logger.info(f"JSON parsing successful, data type: {type(data)}")

            # Handle common data structures
            if isinstance(data, dict):
                # 检查是否有data字段
                if "data" in data and (isinstance(data["data"], list) or isinstance(data["data"], dict)):
                    logger.info("Detected data nested in 'data' field")
                    nested_data = data["data"]
                    if isinstance(nested_data, dict):
                        return [nested_data]
                    elif isinstance(nested_data, list):
                        return nested_data
                # 如果是单个对象，转换为列表
                logger.info("将单个对象转换为列表")
                return [data]
            elif isinstance(data, list):
                logger.info(f"Data is already in list format, contains {len(data)} items")
                return data
            else:
                logger.warning(f"Cannot handle data type: {type(data)}")
                return []
        except json.JSONDecodeError as e:
            logger.error(f"JSON解析错误: {str(e)}")
            # 如果不是有效的JSON，尝试从文本中提取
            try:
                # 查找文本中的JSON部分
                import re

                logger.info("尝试从文本中提取JSON")
                json_pattern = r"```(?:json)?\s*([\s\S]*?)\s*```"
                matches = re.findall(json_pattern, data_str)

                if matches:
                    logger.info("在代码块中找到JSON")
                    data = json.loads(matches[0])
                    if isinstance(data, dict):
                        # 检查是否有data字段
                        if "data" in data and (isinstance(data["data"], list) or isinstance(data["data"], dict)):
                            nested_data = data["data"]
                            if isinstance(nested_data, dict):
                                return [nested_data]
                            elif isinstance(nested_data, list):
                                return nested_data
                        return [data]
                    elif isinstance(data, list):
                        return data

                logger.warning("未在代码块中找到有效JSON")
                # If JSON not found, try to parse table data
                # 这里可以添加更多的解析逻辑

                return []
            except Exception as e:
                logger.error(f"从文本提取JSON时出错: {str(e)}")
                return []

    def _clean_data(self, df: pd.DataFrame) -> pd.DataFrame:
        """
        Data cleaning and preprocessing
        """
        if df.empty:
            logger.warning("DataFrame为空，无法清洗")
            return df

        logger.info("Starting data cleaning")
        logger.info(f"清洗前的列: {df.columns.tolist()}")
        logger.info(f"Data types before cleaning: {df.dtypes.to_dict()}")

        # 删除全为空的行
        df = df.dropna(how="all")

        # Try to convert string numbers to numeric type
        for col in df.columns:
            try:
                # Check if can be converted to numeric
                if df[col].dtype == "object":
                    logger.info("Attempting to convert column %s to numeric type", col)
                    # 尝试转换非空值
                    numeric_mask = df[col].notna()
                    try_numeric = pd.to_numeric(df[col][numeric_mask], errors="coerce")
                    non_na_count = try_numeric.count()
                    total_count = numeric_mask.sum()
                    success_ratio = non_na_count / total_count if total_count > 0 else 0

                    logger.info(f"列 {col}: 成功转换率 {success_ratio:.2f} ({non_na_count}/{total_count})")

                    if not try_numeric.isna().all() and success_ratio > 0.5:
                        df.loc[numeric_mask, col] = try_numeric
                        logger.info("Column %s converted to numeric type", col)
            except Exception as e:
                logger.warning(f"转换列 {col} 时出错: {str(e)}")
                continue

        # Check if there are any numeric columns
        numeric_columns = df.select_dtypes(include=["number"]).columns.tolist()
        logger.info("Numeric columns after cleaning: %s", numeric_columns)

        # If no numeric columns, try more aggressive conversion
        if not numeric_columns:
            logger.warning("No numeric columns after cleaning, trying more aggressive conversion")
            df = self._try_aggressive_numeric_conversion(df)
            numeric_columns = df.select_dtypes(include=["number"]).columns.tolist()
            logger.info("Numeric columns after aggressive conversion: %s", numeric_columns)

        return df

    def _try_aggressive_numeric_conversion(self, df: pd.DataFrame) -> pd.DataFrame:
        """
        Try more aggressive method to convert columns to numeric type
        """
        logger.info("Starting aggressive numeric conversion")

        # Copy DataFrame to avoid modifying raw data
        result_df = df.copy()

        for col in df.columns:
            if df[col].dtype != "object":
                continue

            logger.info("Attempting aggressive conversion of column: %s", col)

            # 1. Try to extract numeric part
            try:
                # Use regex to extract numbers
                extracted = df[col].astype(str).str.extract(r"(-?\d+\.?\d*)")
                if not extracted.empty and not extracted[0].isna().all():
                    numeric_values = pd.to_numeric(extracted[0], errors="coerce")
                    non_na_count = numeric_values.count()
                    if non_na_count > 0:
                        new_col_name = f"{col}_numeric"
                        result_df[new_col_name] = numeric_values
                        logger.info(
                            "Extracted numeric values from column %s and created new column %s, valid values count: %s",
                            col,
                            new_col_name,
                            non_na_count,
                        )
            except Exception as e:
                logger.warning(f"Error extracting numeric values from column {col}: {str(e)}")

            # 2. 尝试替换常见的文本表示
            try:
                # 创建一个临时系列用于转换
                temp_series = df[col].astype(str).str.lower()

                # 替换常见的文本表示
                replacements = {
                    "yes": "1",
                    "no": "0",
                    "true": "1",
                    "false": "0",
                    "high": "3",
                    "medium": "2",
                    "low": "1",
                    "good": "3",
                    "average": "2",
                    "poor": "1",
                }

                for text, value in replacements.items():
                    temp_series = temp_series.str.replace(r"\b" + text + r"\b", value, regex=True)

                # Try to convert to numeric
                numeric_values = pd.to_numeric(temp_series, errors="coerce")
                non_na_count = numeric_values.count()
                if non_na_count > 0:
                    new_col_name = f"{col}_converted"
                    result_df[new_col_name] = numeric_values
                    logger.info(
                        "Converted text values of column %s to numeric and created new column %s, valid values count: %s",
                        col,
                        new_col_name,
                        non_na_count,
                    )
            except Exception as e:
                logger.warning(f"转换列 {col} 的文本值时出错: {str(e)}")

        return result_df

    def _normalize_chart_type(self, chart_type: str) -> str:
        """Normalize chart type name"""
        chart_type = chart_type.lower()

        # Check Chinese chart type
        for cn_type, en_type in self.chart_type_mapping.items():
            if cn_type in chart_type:
                return en_type

        # Check English chart type
        for en_type in set(self.chart_type_mapping.values()):
            if en_type in chart_type:
                return en_type

        # Default to return bar chart
        return "bar"

    def _analyze_data_and_select_chart(self, df: pd.DataFrame) -> str:
        """
        Analyze data and intelligently select the most suitable chart type

        Select appropriate chart type based on data characteristics, supports intelligent selection of more chart types
        """
        if df.empty:
            return "bar"

        # Analyze data types
        numeric_columns = df.select_dtypes(include=["number"]).columns.tolist()

        # 检查日期列
        date_columns = []
        for col in df.columns:
            if col in numeric_columns:
                continue

            # 尝试转换为日期
            try:
                pd.to_datetime(df[col], errors="raise")
                date_columns.append(col)
            except:
                pass

        # 分类列 = 非数值列且非日期列
        categorical_columns = [col for col in df.columns if col not in numeric_columns and col not in date_columns]

        logger.info(
            f"数据分析 - 数值列: {len(numeric_columns)}, 日期列: {len(date_columns)}, 分类列: {len(categorical_columns)}"
        )

        # Intelligently select chart type

        # 1. 检查是否适合箱线图（多个数值列，需要比较分布）
        if len(numeric_columns) >= 3:
            # 检查数据是否有明显的分布特征
            has_distribution_features = False
            for col in numeric_columns:
                # 计算四分位数
                q1 = df[col].quantile(0.25)
                q3 = df[col].quantile(0.75)
                iqr = q3 - q1
                # 检查是否有离群值
                outliers = df[(df[col] < q1 - 1.5 * iqr) | (df[col] > q3 + 1.5 * iqr)]
                if len(outliers) > 0:
                    has_distribution_features = True
                    break

            if has_distribution_features:
                logger.info("选择箱线图 - 数据有明显的分布特征")
                return "boxplot"

        # 2. 检查是否适合雷达图（多个维度的比较）
        if len(numeric_columns) >= 3 and len(df) <= 10:
            # 雷达图适合比较少量实体在多个维度上的表现
            logger.info("选择雷达图 - 多个维度的少量实体比较")
            return "radar"

        # 3. 检查是否适合热力图（矩阵数据）
        if len(categorical_columns) >= 2 and len(numeric_columns) >= 1:
            # 两个分类变量和一个数值变量，可能适合热力图
            cat1_unique = df[categorical_columns[0]].nunique()
            cat2_unique = df[categorical_columns[1]].nunique()
            if cat1_unique >= 3 and cat2_unique >= 3 and cat1_unique * cat2_unique <= 100:
                logger.info("选择热力图 - 两个分类变量形成矩阵")
                return "heatmap"

        # 4. 检查是否适合漏斗图（递减序列）
        if len(categorical_columns) == 1 and len(numeric_columns) == 1:
            unique_categories = df[categorical_columns[0]].nunique()
            if 3 <= unique_categories <= 7:
                # 检查数值是否呈递减趋势
                sorted_df = df.sort_values(by=numeric_columns[0], ascending=False)
                values = sorted_df[numeric_columns[0]].tolist()
                is_decreasing = all(values[i] >= values[i + 1] for i in range(len(values) - 1))
                if is_decreasing:
                    logger.info("选择漏斗图 - 数据呈递减趋势")
                    return "funnel"

        # 5. 原有的图表类型选择逻辑
        if date_columns and numeric_columns:
            # 有时间序列数据，适合折线图
            logger.info("选择折线图 - 有时间序列数据")
            return "line"

        if len(categorical_columns) == 1 and len(numeric_columns) >= 1:
            # 计算唯一类别数
            unique_categories = df[categorical_columns[0]].nunique()

            # 类别较少且为比例数据，适合饼图
            if unique_categories <= 6 and self._is_proportion(df, numeric_columns[0]):
                logger.info("选择饼图 - 少量类别的比例数据")
                return "pie"

            # 类别数据，适合柱状图
            logger.info("选择柱状图 - 类别数据")
            return "bar"

        if len(numeric_columns) >= 2:
            # 两个或更多数值列，可能适合散点图
            logger.info("选择散点图 - 两个或更多数值列")
            return "scatter"

        # 默认使用柱状图
        logger.info("默认选择柱状图")
        return "bar"

    def _is_proportion(self, df: pd.DataFrame, column: str) -> bool:
        """Determine if proportion data"""
        values = df[column].dropna()
        if values.empty:
            return False

        # 检查是否所有值都是非负的
        if (values < 0).any():
            return False

        # 计算总和
        total = values.sum()
        if total <= 0:
            return False

        # 检查是否每个值都小于等于总和
        return (values <= total).all()

    def _parse_color_scheme(self, color_scheme: str) -> list[str]:
        """
        解析配色方案参数

        Args:
            color_scheme (str): 配色方案参数，可以是预定义方案名称或自定义颜色列表

        Returns:
            List[str]: 颜色列表
        """
        if not color_scheme:
            return self.predefined_color_schemes["default"]

        # 检查是否是预定义方案
        color_scheme = color_scheme.lower().strip()
        if color_scheme in self.predefined_color_schemes:
            logger.info("使用预定义配色方案: %s", color_scheme)
            return self.predefined_color_schemes[color_scheme]

        # 尝试解析为自定义颜色列表
        try:
            # 分割颜色值并清理
            colors = [c.strip() for c in color_scheme.split(",")]

            # 验证颜色格式
            valid_colors = []
            for color in colors:
                # 检查是否是有效的十六进制颜色值
                if re.match(r"^#(?:[0-9a-fA-F]{3}){1,2}$", color):
                    valid_colors.append(color)
                else:
                    logger.warning("忽略无效的颜色值: %s", color)

            if valid_colors:
                logger.info(f"使用自定义配色方案，有效颜色数量: {len(valid_colors)}")
                return valid_colors
            else:
                logger.warning("自定义配色方案无有效颜色, using default scheme")
                return self.predefined_color_schemes["default"]

        except Exception as e:
            logger.error(f"Error parsing color scheme: {str(e)}, using default scheme")
            return self.predefined_color_schemes["default"]

    def _generate_chart_config(self, df: pd.DataFrame, chart_type: str, title: str | None = None) -> dict:
        """
        Generate ECharts configuration based on chart type

        Use ChartTemplates class to generate chart configuration, supports multiple chart types and flexible configuration

        Args:
            df (pd.DataFrame): DataFrame containing chart data
            chart_type (str): Chart type (e.g.'bar', 'line', 'pie'等）
            title (str, optional): Chart title. Defaults to None

        Returns:
            Dict: ECharts configuration dict
        """
        logger.info("Using ChartTemplates to generate%schart configuration", chart_type)

        # Use ChartTemplates.get_template method to generate chart configuration
        try:
            chart_config = ChartTemplates.get_template(chart_type=chart_type, df=df, title=title, colors=self.colors)
            logger.info("成功Using ChartTemplates to generatechart configuration")
            return chart_config
        except Exception as e:
            logger.error(f"Using ChartTemplates to generatechart configuration时出错: {str(e)}")
            # If error occurs, return error message
            return {
                "error": f"Error generating {chart_type} chart configuration: {str(e)}",
                "title": {"text": "Chart generation error", "left": "center"},
                "series": [],
            }

    def _is_date_column(self, series: pd.Series) -> bool:
        """Determine if column is date type"""
        try:
            pd.to_datetime(series, errors="raise")
            return True
        except:
            return False
