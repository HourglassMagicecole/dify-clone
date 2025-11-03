"""
配色方案模块 - 提供多种预定义的图表配色方案
"""

# 配色方案集合
COLOR_SCHEMES = {
    # 默认配色方案 - ECharts默认
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
    # 蓝色系 - 适合商务/金融场景
    "blue": [
        "#1f77b4",
        "#4682b4",
        "#6495ed",
        "#7b68ee",
        "#4169e1",
        "#0000ff",
        "#0000cd",
        "#00008b",
        "#191970",
        "#87cefa",
    ],
    # 绿色系 - 适合环保/自然主题
    "green": [
        "#2ca02c",
        "#98df8a",
        "#64c987",
        "#3cb371",
        "#32cd32",
        "#00ff7f",
        "#7cfc00",
        "#adff2f",
        "#9acd32",
        "#6b8e23",
    ],
    # 暖色系 - 适合营销/零售场景
    "warm": [
        "#ff7f0e",
        "#ffbb78",
        "#ff4500",
        "#ff6347",
        "#ff7f50",
        "#ffa07a",
        "#fa8072",
        "#e9967a",
        "#f08080",
        "#cd5c5c",
    ],
    # 冷色系 - 适合科技/医疗场景
    "cool": [
        "#17becf",
        "#9edae5",
        "#00ced1",
        "#48d1cc",
        "#40e0d0",
        "#00ffff",
        "#e0ffff",
        "#afeeee",
        "#7fffd4",
        "#66cdaa",
    ],
    # 柔和色系 - 适合教育/非营利场景
    "pastel": [
        "#c7c7c7",
        "#d9d9d9",
        "#f7f7f7",
        "#e7e7e7",
        "#bcbd22",
        "#dbdb8d",
        "#ffed6f",
        "#c49c94",
        "#c5b0d5",
        "#f7b6d2",
    ],
    # 高对比度 - 适合可访问性要求高的场景
    "contrast": [
        "#000000",
        "#e69f00",
        "#56b4e9",
        "#009e73",
        "#f0e442",
        "#0072b2",
        "#d55e00",
        "#cc79a7",
        "#999999",
        "#ffffff",
    ],
    # 单色蓝 - 适合单一指标多维度对比
    "monoblue": [
        "#08306b",
        "#08519c",
        "#2171b5",
        "#4292c6",
        "#6baed6",
        "#9ecae1",
        "#c6dbef",
        "#deebf7",
        "#f7fbff",
        "#ffffff",
    ],
    # 单色红 - 适合热力图/风险指标
    "monored": [
        "#67000d",
        "#a50f15",
        "#cb181d",
        "#ef3b2c",
        "#fb6a4a",
        "#fc9272",
        "#fcbba1",
        "#fee0d2",
        "#fff5f0",
        "#ffffff",
    ],
    # 彩虹色 - 适合多分类数据
    "rainbow": [
        "#6e40aa",
        "#bf3caf",
        "#fe4b83",
        "#ff7847",
        "#e2b72f",
        "#aff05b",
        "#52f667",
        "#1ddfa3",
        "#23abd8",
        "#4c6edb",
    ],
}


def get_color_scheme(scheme_name: str = "default"):
    """
    获取指定名称的配色方案

    参数:
        scheme_name (str): 配色方案名称，默认为"default"

    返回:
        list: 颜色列表
    """
    return COLOR_SCHEMES.get(scheme_name.lower(), COLOR_SCHEMES["default"])


def get_available_schemes():
    """
    获取所有可用的配色方案名称

    返回:
        list: 配色方案名称列表
    """
    return list(COLOR_SCHEMES.keys())
