"""
Chart Templates Module - Provides template generation functions for various chart types
"""

import logging

import pandas as pd

logger = logging.getLogger("chart_templates")


class ChartTemplates:
    """
    Chart Templates Class - Provides template generation functions for various chart types
    """

    @staticmethod
    def get_template(
        chart_type: str,
        df: pd.DataFrame,
        title: str | None = None,
        custom_requirements: str | None = None,
        colors: list[str] | None = None,
    ) -> dict:
        """
        Get corresponding template function based on chart type and generate configuration

        Args:
            chart_type (str): Chart type
            df (pd.DataFrame): Data
            title (str, optional): Chart title
            custom_requirements (str, optional): Custom requirements
            colors (List[str], optional): Color scheme

        Returns:
            Dict: ECharts configuration
        """
        # Default color scheme
        if colors is None:
            colors = [
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
            ]

        # Select template function based on chart type
        template_map = {
            "bar": ChartTemplates.bar_chart_template,
            "line": ChartTemplates.line_chart_template,
            "pie": ChartTemplates.pie_chart_template,
            "scatter": ChartTemplates.scatter_chart_template,
            "radar": ChartTemplates.radar_chart_template,
            "funnel": ChartTemplates.funnel_chart_template,
            "heatmap": ChartTemplates.heatmap_chart_template,
            "boxplot": ChartTemplates.boxplot_chart_template,
        }

        # Get template function
        template_func = template_map.get(chart_type)

        # If corresponding template function not found, use bar chart template
        if template_func is None:
            logger.warning("Chart type not found '%s' 的模板，使用Bar chart模板", chart_type)
            template_func = ChartTemplates.bar_chart_template

        # Call template function to generate configuration
        return template_func(df, title, custom_requirements, colors)

    @staticmethod
    def bar_chart_template(
        df: pd.DataFrame,
        title: str | None = None,
        custom_requirements: str | None = None,
        colors: list[str] | None = None,
    ) -> dict:
        """Generate bar chart configuration"""
        # Identify categorical and numeric columns
        numeric_columns = df.select_dtypes(include=["number"]).columns.tolist()
        non_numeric_columns = [col for col in df.columns if col not in numeric_columns]

        # Select first non-numeric column as category axis, use index if none
        category_column = non_numeric_columns[0] if non_numeric_columns else None

        # Cannot create chart without numeric columns
        if not numeric_columns:
            return {"error": "No numeric columns found, cannot create bar chart"}

        # Ensure colors is not None
        if colors is None:
            colors = [
                "#5470c6",
                "#91cc75",
                "#fac858",
                "#ee6666",
                "#73c0de",
                "#3ba272",
                "#fc8452",
                "#9a60b4",
                "#ea7ccc",
            ]

        # Prepare data
        if category_column:
            categories = df[category_column].astype(str).tolist()
        else:
            categories = [str(i) for i in range(len(df))]

        # Prepare series data
        series = []
        for i, col in enumerate(numeric_columns):
            series.append(
                {"name": col, "type": "bar", "data": df[col].tolist(), "itemStyle": {"color": colors[i % len(colors)]}}
            )

        # Build configuration
        config = {
            "title": {"text": title or "Bar chart", "left": "center"},
            "tooltip": {"trigger": "axis", "axisPointer": {"type": "shadow"}},
            "legend": {"data": numeric_columns, "top": "bottom"},
            "xAxis": {
                "type": "category",
                "data": categories,
                "axisLabel": {"rotate": 45 if max([len(str(c)) for c in categories]) > 5 else 0},
            },
            "yAxis": {"type": "value"},
            "series": series,
        }

        return config

    @staticmethod
    def line_chart_template(
        df: pd.DataFrame,
        title: str | None = None,
        custom_requirements: str | None = None,
        colors: list[str] | None = None,
    ) -> dict:
        """Generate line chart configuration"""
        # Identify date, numeric and other columns
        numeric_columns = df.select_dtypes(include=["number"]).columns.tolist()
        logger.info("Line chart - numeric columns: %s", numeric_columns)

        # Check date columns
        date_columns = []
        for col in df.columns:
            if col in numeric_columns:
                continue

            # Try to convert to date
            try:
                pd.to_datetime(df[col], errors="raise")
                date_columns.append(col)
                logger.info("Line chart - Identified date column: %s", col)
            except Exception as e:
                logger.debug(f"Line chart - Column {col} is not date column: {str(e)}")

        # Select first date column as X axis，如果没有则使用第一个非numeric columns，如果还没有则使用索引
        other_columns = [col for col in df.columns if col not in numeric_columns and col not in date_columns]
        logger.info("Line chart - other columns: %s", other_columns)
        x_axis_column = None

        if date_columns:
            x_axis_column = date_columns[0]
            logger.info("Line chart - Use date column as X axis: %s", x_axis_column)
            # Convert date format
            x_axis_data = df[x_axis_column].apply(lambda x: pd.to_datetime(x).strftime("%Y-%m-%d")).tolist()
        elif other_columns:
            x_axis_column = other_columns[0]
            logger.info("Line chart - 使用other columns作为X轴: %s", x_axis_column)
            x_axis_data = df[x_axis_column].astype(str).tolist()
        else:
            logger.info("Line chart - No suitable X axis column, use index")
            x_axis_data = [str(i) for i in range(len(df))]

        # Cannot create chart without numeric columns
        if not numeric_columns:
            logger.error("Line chart - No numeric columns found, cannot create line chart")
            return {"error": "No numeric columns found, cannot create line chart"}

        # Ensure colors is not None
        if colors is None:
            colors = [
                "#5470c6",
                "#91cc75",
                "#fac858",
                "#ee6666",
                "#73c0de",
                "#3ba272",
                "#fc8452",
                "#9a60b4",
                "#ea7ccc",
            ]

        # Prepare series data
        series = []
        for i, col in enumerate(numeric_columns):
            series.append(
                {
                    "name": col,
                    "type": "line",
                    "data": df[col].tolist(),
                    "smooth": True,
                    "itemStyle": {"color": colors[i % len(colors)]},
                }
            )

        # Build configuration
        config = {
            "title": {"text": title or "Line chart", "left": "center"},
            "tooltip": {"trigger": "axis"},
            "legend": {"data": numeric_columns, "top": "bottom"},
            "xAxis": {
                "type": "category",
                "data": x_axis_data,
                "axisLabel": {"rotate": 45 if x_axis_column and x_axis_column in date_columns else 0},
            },
            "yAxis": {"type": "value"},
            "series": series,
        }

        return config

    @staticmethod
    def pie_chart_template(
        df: pd.DataFrame,
        title: str | None = None,
        custom_requirements: str | None = None,
        colors: list[str] | None = None,
    ) -> dict:
        """Generate pie chart configuration"""
        # Identify categorical and numeric columns
        numeric_columns = df.select_dtypes(include=["number"]).columns.tolist()
        non_numeric_columns = [col for col in df.columns if col not in numeric_columns]

        # Select first non-numeric column as category, use index if none
        category_column = non_numeric_columns[0] if non_numeric_columns else None

        # Cannot create chart without numeric columns
        if not numeric_columns:
            return {"error": "No numeric columns found, cannot create pie chart"}

        # Ensure colors is not None
        if colors is None:
            colors = [
                "#5470c6",
                "#91cc75",
                "#fac858",
                "#ee6666",
                "#73c0de",
                "#3ba272",
                "#fc8452",
                "#9a60b4",
                "#ea7ccc",
            ]

        # Select first numeric column as value
        value_column = numeric_columns[0]

        # Prepare data
        data = []
        if category_column:
            for i, (cat, val) in enumerate(zip(df[category_column], df[value_column])):
                if pd.notna(val) and pd.notna(cat):
                    data.append(
                        {"name": str(cat), "value": float(val), "itemStyle": {"color": colors[i % len(colors)]}}
                    )
        else:
            for i, val in enumerate(df[value_column]):
                if pd.notna(val):
                    data.append(
                        {"name": f"Item {i + 1}", "value": float(val), "itemStyle": {"color": colors[i % len(colors)]}}
                    )

        # Build configuration
        config = {
            "title": {"text": title or "Pie chart", "left": "center"},
            "tooltip": {"trigger": "item", "formatter": "{a} <br/>{b}: {c} ({d}%)"},
            "legend": {"orient": "vertical", "left": "left", "data": [item["name"] for item in data]},
            "series": [
                {
                    "name": value_column,
                    "type": "pie",
                    "radius": "50%",
                    "center": ["50%", "60%"],
                    "data": data,
                    "emphasis": {
                        "itemStyle": {"shadowBlur": 10, "shadowOffsetX": 0, "shadowColor": "rgba(0, 0, 0, 0.5)"}
                    },
                }
            ],
        }

        return config

    @staticmethod
    def scatter_chart_template(
        df: pd.DataFrame,
        title: str | None = None,
        custom_requirements: str | None = None,
        colors: list[str] | None = None,
    ) -> dict:
        """Generate scatter chart configuration"""
        # Identify numeric columns
        numeric_columns = df.select_dtypes(include=["number"]).columns.tolist()

        # Cannot create scatter chart with less than 2 numeric columns
        if len(numeric_columns) < 2:
            return {"error": "Need at least two numeric columns to create scatter chart"}

        # Ensure colors is not None
        if colors is None:
            colors = [
                "#5470c6",
                "#91cc75",
                "#fac858",
                "#ee6666",
                "#73c0de",
                "#3ba272",
                "#fc8452",
                "#9a60b4",
                "#ea7ccc",
            ]

        # Select first two numeric columns as X and Y axes
        x_column = numeric_columns[0]
        y_column = numeric_columns[1]

        # Prepare data
        data = []
        for x, y in zip(df[x_column], df[y_column]):
            if pd.notna(x) and pd.notna(y):
                data.append([float(x), float(y)])

        # Build configuration
        config = {
            "title": {"text": title or "Scatter chart", "left": "center"},
            "tooltip": {
                "trigger": "item",
                "formatter": f"function(params) {{ return '{x_column}: ' + params.value[0] + '<br/>{y_column}: ' + params.value[1]; }}",
            },
            "xAxis": {"type": "value", "name": x_column},
            "yAxis": {"type": "value", "name": y_column},
            "series": [{"type": "scatter", "data": data, "symbolSize": 10, "itemStyle": {"color": colors[0]}}],
        }

        return config

    @staticmethod
    def radar_chart_template(
        df: pd.DataFrame,
        title: str | None = None,
        custom_requirements: str | None = None,
        colors: list[str] | None = None,
    ) -> dict:
        """Generate radar chart configuration"""
        # Identify numeric columns
        numeric_columns = df.select_dtypes(include=["number"]).columns.tolist()

        # Cannot create chart without numeric columns
        if not numeric_columns:
            return {"error": "No numeric columns found, cannot create radar chart"}

        # Ensure colors is not None
        if colors is None:
            colors = [
                "#5470c6",
                "#91cc75",
                "#fac858",
                "#ee6666",
                "#73c0de",
                "#3ba272",
                "#fc8452",
                "#9a60b4",
                "#ea7ccc",
            ]

        # Prepare indicators
        indicators = []
        for col in numeric_columns:
            max_val = df[col].max()
            indicators.append(
                {
                    "name": col,
                    "max": max_val * 1.2,  # Set max value to 1.2 times data max value
                }
            )

        # Prepare data
        series_data = []
        non_numeric_columns = [col for col in df.columns if col not in numeric_columns]
        name_column = non_numeric_columns[0] if non_numeric_columns else None

        for i in range(len(df)):
            item_name = df.iloc[i][name_column] if name_column else f"Data item {i + 1}"
            data_item = {
                "value": [df.iloc[i][col] for col in numeric_columns],
                "name": str(item_name),
                "itemStyle": {"color": colors[i % len(colors)]},
            }
            series_data.append(data_item)

        # Build configuration
        config = {
            "title": {"text": title or "Radar chart", "left": "center"},
            "tooltip": {"trigger": "item"},
            "legend": {"data": [item["name"] for item in series_data], "top": "bottom"},
            "radar": {"indicator": indicators},
            "series": [{"type": "radar", "data": series_data}],
        }

        return config

    @staticmethod
    def funnel_chart_template(
        df: pd.DataFrame,
        title: str | None = None,
        custom_requirements: str | None = None,
        colors: list[str] | None = None,
    ) -> dict:
        """Generate funnel chart configuration"""
        # Identify categorical and numeric columns
        numeric_columns = df.select_dtypes(include=["number"]).columns.tolist()
        non_numeric_columns = [col for col in df.columns if col not in numeric_columns]

        # Select first non-numeric column as category, use index if none
        category_column = non_numeric_columns[0] if non_numeric_columns else None

        # Cannot create chart without numeric columns
        if not numeric_columns:
            return {"error": "No numeric columns found, cannot create funnel chart"}

        # Ensure colors is not None
        if colors is None:
            colors = [
                "#5470c6",
                "#91cc75",
                "#fac858",
                "#ee6666",
                "#73c0de",
                "#3ba272",
                "#fc8452",
                "#9a60b4",
                "#ea7ccc",
            ]

        # Select first numeric column as value
        value_column = numeric_columns[0]

        # Prepare data
        data = []
        if category_column:
            for i, (cat, val) in enumerate(zip(df[category_column], df[value_column])):
                if pd.notna(val) and pd.notna(cat):
                    data.append(
                        {"name": str(cat), "value": float(val), "itemStyle": {"color": colors[i % len(colors)]}}
                    )
        else:
            for i, val in enumerate(df[value_column]):
                if pd.notna(val):
                    data.append(
                        {"name": f"Stage {i + 1}", "value": float(val), "itemStyle": {"color": colors[i % len(colors)]}}
                    )

        # Sort by value in descending order
        data = sorted(data, key=lambda x: x["value"], reverse=True)

        # Build configuration
        config = {
            "title": {"text": title or "Funnel chart", "left": "center"},
            "tooltip": {"trigger": "item", "formatter": "{a} <br/>{b}: {c}"},
            "legend": {"data": [item["name"] for item in data], "top": "bottom"},
            "series": [
                {
                    "name": value_column,
                    "type": "funnel",
                    "left": "10%",
                    "top": "20%",
                    "bottom": "10%",
                    "width": "80%",
                    "min": 0,
                    "max": data[0]["value"] if data else 100,
                    "minSize": "0%",
                    "maxSize": "100%",
                    "sort": "descending",
                    "gap": 2,
                    "label": {"show": True, "position": "inside"},
                    "emphasis": {"label": {"fontSize": 20}},
                    "data": data,
                }
            ],
        }

        return config

    @staticmethod
    def heatmap_chart_template(
        df: pd.DataFrame,
        title: str | None = None,
        custom_requirements: str | None = None,
        colors: list[str] | None = None,
    ) -> dict:
        """Generate heatmap configuration"""
        # Identify numeric columns
        numeric_columns = df.select_dtypes(include=["number"]).columns.tolist()

        # Cannot create chart without numeric columns
        if not numeric_columns:
            return {"error": "No numeric columns found, cannot create heatmap"}

        # Ensure colors is not None
        if colors is None:
            colors = [
                "#5470c6",
                "#91cc75",
                "#fac858",
                "#ee6666",
                "#73c0de",
                "#3ba272",
                "#fc8452",
                "#9a60b4",
                "#ea7ccc",
            ]

        # Select first numeric column as value
        value_column = numeric_columns[0]

        # Identify non-numeric columns
        non_numeric_columns = [col for col in df.columns if col not in numeric_columns]

        # 如果非numeric columns少于2个，使用索引作为行或列
        if len(non_numeric_columns) < 2:
            if len(non_numeric_columns) == 1:
                row_column = non_numeric_columns[0]
                _col_values = [f"Column {i + 1}" for i in range(len(df))]  # Intentionally unused
            else:
                row_column = None
                _col_values = [f"Column {i + 1}" for i in range(len(df))]  # Intentionally unused
        else:
            row_column = non_numeric_columns[0]
            col_column = non_numeric_columns[1]
            _col_values = df[col_column].unique().tolist()  # Intentionally unused

        # Prepare data
        data = []
        x_categories = []
        y_categories = []

        if row_column:
            y_categories = df[row_column].unique().tolist()

            for i, y in enumerate(y_categories):
                row_data = df[df[row_column] == y]

                if len(non_numeric_columns) >= 2:
                    col_column = non_numeric_columns[1]
                    x_categories = row_data[col_column].unique().tolist()

                    for j, x in enumerate(x_categories):
                        cell_data = row_data[row_data[col_column] == x]
                        if not cell_data.empty:
                            value = cell_data[value_column].iloc[0]
                            if pd.notna(value):
                                data.append([j, i, float(value)])
                else:
                    for j, val in enumerate(row_data[value_column]):
                        if pd.notna(val):
                            data.append([j, i, float(val)])
                    x_categories = [f"列 {j + 1}" for j in range(len(row_data))]
        else:
            # If no suitable rows and columns, use data directly as heatmap
            for i, row in enumerate(df.itertuples()):
                for j, col in enumerate(numeric_columns):
                    val = getattr(row, col)
                    if pd.notna(val):
                        data.append([j, i, float(val)])

            x_categories = numeric_columns
            y_categories = [f"Row {i + 1}" for i in range(len(df))]

        # Build configuration
        config = {
            "title": {"text": title or "Heatmap", "left": "center"},
            "tooltip": {"position": "top"},
            "grid": {"height": "50%", "top": "10%"},
            "xAxis": {"type": "category", "data": x_categories, "splitArea": {"show": True}},
            "yAxis": {"type": "category", "data": y_categories, "splitArea": {"show": True}},
            "visualMap": {
                "min": min([d[2] for d in data]) if data else 0,
                "max": max([d[2] for d in data]) if data else 100,
                "calculable": True,
                "orient": "horizontal",
                "left": "center",
                "bottom": "15%",
            },
            "series": [
                {
                    "name": value_column,
                    "type": "heatmap",
                    "data": data,
                    "label": {"show": True},
                    "emphasis": {"itemStyle": {"shadowBlur": 10, "shadowColor": "rgba(0, 0, 0, 0.5)"}},
                }
            ],
        }

        return config

    @staticmethod
    def boxplot_chart_template(
        df: pd.DataFrame,
        title: str | None = None,
        custom_requirements: str | None = None,
        colors: list[str] | None = None,
    ) -> dict:
        """Generate boxplot configuration"""
        # Identify numeric columns
        numeric_columns = df.select_dtypes(include=["number"]).columns.tolist()

        # Cannot create chart without numeric columns
        if not numeric_columns:
            return {"error": "No numeric columns found, cannot create boxplot"}

        # Ensure colors is not None
        if colors is None:
            colors = [
                "#5470c6",
                "#91cc75",
                "#fac858",
                "#ee6666",
                "#73c0de",
                "#3ba272",
                "#fc8452",
                "#9a60b4",
                "#ea7ccc",
            ]

        # Prepare data
        data = []
        for col in numeric_columns:
            # Filter out NaN values
            values = df[col].dropna().tolist()
            if values:
                data.append(values)

        # Build configuration
        config = {
            "title": {"text": title or "Boxplot", "left": "center"},
            "tooltip": {"trigger": "item", "axisPointer": {"type": "shadow"}},
            "grid": {"left": "10%", "right": "10%", "bottom": "15%"},
            "xAxis": {
                "type": "category",
                "data": numeric_columns,
                "boundaryGap": True,
                "nameGap": 30,
                "splitArea": {"show": False},
                "axisLabel": {"rotate": 45 if len(numeric_columns) > 5 else 0},
                "splitLine": {"show": False},
            },
            "yAxis": {"type": "value", "splitArea": {"show": True}},
            "series": [
                {
                    "name": "Boxplot",
                    "type": "boxplot",
                    "data": data,
                    "tooltip": {
                        "formatter": "function(param) { return ['Data column: ' + param.name, 'Upper: ' + param.data[5], 'Upper quartile: ' + param.data[4], 'Median: ' + param.data[3], 'Lower quartile: ' + param.data[2], 'Lower: ' + param.data[1]].join('<br/>'); }"
                    },
                    "itemStyle": {"color": colors[0]},
                }
            ],
        }

        return config
