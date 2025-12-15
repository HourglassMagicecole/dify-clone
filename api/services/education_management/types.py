"""
Education Management Types
교육 관리 서비스에서 사용하는 타입 정의
"""

from dataclasses import dataclass
from datetime import date
from decimal import Decimal


@dataclass
class DailyApiUsage:
    """일별 API 사용량 데이터"""

    date: date
    call_count: int
    input_tokens: int
    output_tokens: int
    total_tokens: int
    estimated_cost: Decimal

    def to_dict(self) -> dict:
        return {
            "date": self.date.isoformat(),
            "callCount": self.call_count,
            "inputTokens": self.input_tokens,
            "outputTokens": self.output_tokens,
            "totalTokens": self.total_tokens,
            "estimatedCost": float(self.estimated_cost),
        }


@dataclass
class ApiUsageSummary:
    """API 사용량 요약 데이터"""

    total_calls: int
    total_tokens: int
    estimated_cost: Decimal
    daily_usage: list[DailyApiUsage]

    def to_dict(self) -> dict:
        return {
            "totalCalls": self.total_calls,
            "totalTokens": self.total_tokens,
            "estimatedCost": float(self.estimated_cost),
            "dailyUsage": [d.to_dict() for d in self.daily_usage],
        }
