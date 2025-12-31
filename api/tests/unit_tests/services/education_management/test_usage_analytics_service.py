"""
UsageAnalyticsService Unit Tests
사용량 분석 서비스 단위 테스트
"""

from datetime import date, datetime
from decimal import Decimal
from unittest.mock import MagicMock

import pytest

from services.education_management.usage_analytics_service import (
    DailyUsageData,
    ModelUsageData,
    UsageAnalyticsService,
    UsageSummaryData,
    UserUsageData,
    UserUsageLogData,
)


class TestUsageAnalyticsService:
    """UsageAnalyticsService 기본 테스트"""

    @pytest.fixture
    def mock_session(self):
        """테스트용 SQLAlchemy 세션 모킹"""
        return MagicMock()

    @pytest.fixture
    def sample_tenant_id(self):
        """테스트용 tenant ID"""
        return "test-tenant-001"

    @pytest.fixture
    def sample_session_id(self):
        """테스트용 education session ID"""
        return "edu-session-001"

    @pytest.fixture
    def sample_account_id(self):
        """테스트용 account ID"""
        return "account-001"


class TestGetSessionUsageSummary:
    """get_session_usage_summary() 메서드 테스트"""

    @pytest.fixture
    def mock_session(self):
        """테스트용 SQLAlchemy 세션 모킹"""
        return MagicMock()

    @pytest.fixture
    def sample_tenant_id(self):
        """테스트용 tenant ID"""
        return "test-tenant-001"

    @pytest.fixture
    def sample_session_id(self):
        """테스트용 education session ID"""
        return "edu-session-001"

    # 4.1-UNIT-200: 빈 세션 요약
    def test_get_session_usage_summary_empty(self, mock_session, sample_tenant_id, sample_session_id):
        """사용량이 없을 때 빈 목록 반환 (4.1-UNIT-200)"""
        # Arrange
        mock_session.execute.return_value.all.return_value = []

        # Act
        result = UsageAnalyticsService.get_session_usage_summary(
            session=mock_session,
            tenant_id=sample_tenant_id,
            edu_session_id=sample_session_id,
        )

        # Assert
        assert result == []

    # 4.1-UNIT-201: 사용량 타입별 집계
    def test_get_session_usage_summary_by_type(self, mock_session, sample_tenant_id, sample_session_id):
        """usage_type별 집계 (4.1-UNIT-201)"""
        # Arrange
        mock_row_llm = MagicMock()
        mock_row_llm.usage_type = "llm"
        mock_row_llm.request_count = 100
        mock_row_llm.total_input_tokens = 5000
        mock_row_llm.total_output_tokens = 2000
        mock_row_llm.total_tokens = 7000
        mock_row_llm.total_price = Decimal("0.15")
        mock_row_llm.currency = "USD"

        mock_row_embedding = MagicMock()
        mock_row_embedding.usage_type = "embedding"
        mock_row_embedding.request_count = 50
        mock_row_embedding.total_input_tokens = 10000
        mock_row_embedding.total_output_tokens = 0
        mock_row_embedding.total_tokens = 10000
        mock_row_embedding.total_price = Decimal("0.01")
        mock_row_embedding.currency = "USD"

        mock_session.execute.return_value.all.return_value = [mock_row_llm, mock_row_embedding]

        # Act
        result = UsageAnalyticsService.get_session_usage_summary(
            session=mock_session,
            tenant_id=sample_tenant_id,
            edu_session_id=sample_session_id,
        )

        # Assert
        assert len(result) == 2
        assert isinstance(result[0], UsageSummaryData)
        assert result[0].usage_type == "llm"
        assert result[0].request_count == 100
        assert result[1].usage_type == "embedding"

    # 4.1-UNIT-202: 날짜 필터 적용
    def test_get_session_usage_summary_with_date_filter(self, mock_session, sample_tenant_id, sample_session_id):
        """날짜 필터 적용 테스트 (4.1-UNIT-202)"""
        # Arrange
        mock_session.execute.return_value.all.return_value = []

        start_date = date(2025, 1, 1)
        end_date = date(2025, 1, 31)

        # Act
        result = UsageAnalyticsService.get_session_usage_summary(
            session=mock_session,
            tenant_id=sample_tenant_id,
            edu_session_id=sample_session_id,
            start_date=start_date,
            end_date=end_date,
        )

        # Assert
        assert result == []
        # execute가 호출되었는지 확인
        mock_session.execute.assert_called_once()

    # 4.1-UNIT-203: 시스템 전체 조회 (session_id 없음)
    def test_get_session_usage_summary_system_wide(self, mock_session, sample_tenant_id):
        """edu_session_id 없이 시스템 전체 조회 (4.1-UNIT-203)"""
        # Arrange
        mock_row = MagicMock()
        mock_row.usage_type = "llm"
        mock_row.request_count = 500
        mock_row.total_input_tokens = 25000
        mock_row.total_output_tokens = 10000
        mock_row.total_tokens = 35000
        mock_row.total_price = Decimal("0.75")
        mock_row.currency = "USD"

        mock_session.execute.return_value.all.return_value = [mock_row]

        # Act
        result = UsageAnalyticsService.get_session_usage_summary(
            session=mock_session,
            tenant_id=sample_tenant_id,
            edu_session_id=None,  # 시스템 전체
        )

        # Assert
        assert len(result) == 1
        assert result[0].request_count == 500


class TestGetDailyUsageTrend:
    """get_daily_usage_trend() 메서드 테스트"""

    @pytest.fixture
    def mock_session(self):
        """테스트용 SQLAlchemy 세션 모킹"""
        return MagicMock()

    @pytest.fixture
    def sample_tenant_id(self):
        """테스트용 tenant ID"""
        return "test-tenant-001"

    @pytest.fixture
    def sample_session_id(self):
        """테스트용 education session ID"""
        return "edu-session-001"

    # 4.1-UNIT-210: 빈 일별 추이
    def test_get_daily_usage_trend_empty(self, mock_session, sample_tenant_id, sample_session_id):
        """일별 사용량이 없을 때 빈 목록 반환 (4.1-UNIT-210)"""
        # Arrange
        mock_session.execute.return_value.all.return_value = []

        # Act
        result = UsageAnalyticsService.get_daily_usage_trend(
            session=mock_session,
            tenant_id=sample_tenant_id,
            edu_session_id=sample_session_id,
        )

        # Assert
        assert result == []

    # 4.1-UNIT-211: 일별 추이 데이터 구조
    def test_get_daily_usage_trend_structure(self, mock_session, sample_tenant_id, sample_session_id):
        """일별 추이 데이터 구조 확인 (4.1-UNIT-211)"""
        # Arrange
        mock_row = MagicMock()
        mock_row.date = date(2025, 1, 15)
        mock_row.usage_type = "llm"
        mock_row.request_count = 50
        mock_row.total_tokens = 5000
        mock_row.total_price = Decimal("0.10")

        mock_session.execute.return_value.all.return_value = [mock_row]

        # Act
        result = UsageAnalyticsService.get_daily_usage_trend(
            session=mock_session,
            tenant_id=sample_tenant_id,
            edu_session_id=sample_session_id,
        )

        # Assert
        assert len(result) == 1
        assert isinstance(result[0], DailyUsageData)
        assert result[0].date == date(2025, 1, 15)
        assert result[0].usage_type == "llm"
        assert result[0].request_count == 50

    # 4.1-UNIT-212: usage_type 필터 적용
    def test_get_daily_usage_trend_with_type_filter(self, mock_session, sample_tenant_id, sample_session_id):
        """usage_type 필터 적용 테스트 (4.1-UNIT-212)"""
        # Arrange
        mock_session.execute.return_value.all.return_value = []

        # Act
        result = UsageAnalyticsService.get_daily_usage_trend(
            session=mock_session,
            tenant_id=sample_tenant_id,
            edu_session_id=sample_session_id,
            usage_type="embedding",
        )

        # Assert
        mock_session.execute.assert_called_once()


class TestGetUserUsageBreakdown:
    """get_user_usage_breakdown() 메서드 테스트"""

    @pytest.fixture
    def mock_session(self):
        """테스트용 SQLAlchemy 세션 모킹"""
        return MagicMock()

    @pytest.fixture
    def sample_tenant_id(self):
        """테스트용 tenant ID"""
        return "test-tenant-001"

    @pytest.fixture
    def sample_session_id(self):
        """테스트용 education session ID"""
        return "edu-session-001"

    # 4.1-UNIT-220: 빈 사용자별 집계
    def test_get_user_usage_breakdown_empty(self, mock_session, sample_tenant_id, sample_session_id):
        """사용자가 없을 때 빈 목록 반환 (4.1-UNIT-220)"""
        # Arrange
        mock_session.execute.return_value.all.return_value = []

        # Act
        result = UsageAnalyticsService.get_user_usage_breakdown(
            session=mock_session,
            tenant_id=sample_tenant_id,
            edu_session_id=sample_session_id,
        )

        # Assert
        assert result == []

    # 4.1-UNIT-221: 사용자별 집계 데이터 구조
    def test_get_user_usage_breakdown_structure(self, mock_session, sample_tenant_id, sample_session_id):
        """사용자별 집계 데이터 구조 확인 (4.1-UNIT-221)"""
        # Arrange
        mock_row = MagicMock()
        mock_row.account_id = "user-001"
        mock_row.account_name = "Test User"
        mock_row.usage_type = "llm"
        mock_row.request_count = 30
        mock_row.total_tokens = 3000
        mock_row.total_price = Decimal("0.06")
        mock_row.session_id = sample_session_id
        mock_row.session_name = "Test Session"

        mock_session.execute.return_value.all.return_value = [mock_row]

        # Act
        result = UsageAnalyticsService.get_user_usage_breakdown(
            session=mock_session,
            tenant_id=sample_tenant_id,
            edu_session_id=sample_session_id,
        )

        # Assert
        assert len(result) == 1
        assert isinstance(result[0], UserUsageData)
        assert result[0].account_id == "user-001"
        assert result[0].account_name == "Test User"

    # 4.1-UNIT-222: null account_id 처리
    def test_get_user_usage_breakdown_null_account(self, mock_session, sample_tenant_id, sample_session_id):
        """account_id가 null일 때 '미분류'로 처리 (4.1-UNIT-222)"""
        # Arrange
        mock_row = MagicMock()
        mock_row.account_id = None
        mock_row.account_name = None
        mock_row.usage_type = "llm"
        mock_row.request_count = 10
        mock_row.total_tokens = 1000
        mock_row.total_price = Decimal("0.02")
        mock_row.session_id = sample_session_id
        mock_row.session_name = "Test Session"

        mock_session.execute.return_value.all.return_value = [mock_row]

        # Act
        result = UsageAnalyticsService.get_user_usage_breakdown(
            session=mock_session,
            tenant_id=sample_tenant_id,
            edu_session_id=sample_session_id,
        )

        # Assert
        assert len(result) == 1
        assert result[0].account_id == "unknown"
        assert result[0].account_name == "미분류"


class TestGetModelUsageBreakdown:
    """get_model_usage_breakdown() 메서드 테스트"""

    @pytest.fixture
    def mock_session(self):
        """테스트용 SQLAlchemy 세션 모킹"""
        return MagicMock()

    @pytest.fixture
    def sample_tenant_id(self):
        """테스트용 tenant ID"""
        return "test-tenant-001"

    @pytest.fixture
    def sample_session_id(self):
        """테스트용 education session ID"""
        return "edu-session-001"

    # 4.1-UNIT-230: 빈 모델별 집계
    def test_get_model_usage_breakdown_empty(self, mock_session, sample_tenant_id, sample_session_id):
        """모델별 사용량이 없을 때 빈 목록 반환 (4.1-UNIT-230)"""
        # Arrange
        mock_session.execute.return_value.all.return_value = []

        # Act
        result = UsageAnalyticsService.get_model_usage_breakdown(
            session=mock_session,
            tenant_id=sample_tenant_id,
            edu_session_id=sample_session_id,
        )

        # Assert
        assert result == []

    # 4.1-UNIT-231: 모델별 집계 데이터 구조
    def test_get_model_usage_breakdown_structure(self, mock_session, sample_tenant_id, sample_session_id):
        """모델별 집계 데이터 구조 확인 (4.1-UNIT-231)"""
        # Arrange
        mock_row = MagicMock()
        mock_row.model_provider = "openai"
        mock_row.model_id = "gpt-4"
        mock_row.usage_type = "llm"
        mock_row.request_count = 80
        mock_row.total_tokens = 8000
        mock_row.total_price = Decimal("0.24")

        mock_session.execute.return_value.all.return_value = [mock_row]

        # Act
        result = UsageAnalyticsService.get_model_usage_breakdown(
            session=mock_session,
            tenant_id=sample_tenant_id,
            edu_session_id=sample_session_id,
        )

        # Assert
        assert len(result) == 1
        assert isinstance(result[0], ModelUsageData)
        assert result[0].model_provider == "openai"
        assert result[0].model_id == "gpt-4"


class TestGetUserOwnUsage:
    """get_user_own_usage() 메서드 테스트 (MyUsageService 통합)"""

    @pytest.fixture
    def mock_session(self):
        """테스트용 SQLAlchemy 세션 모킹"""
        return MagicMock()

    @pytest.fixture
    def sample_tenant_id(self):
        """테스트용 tenant ID"""
        return "test-tenant-001"

    @pytest.fixture
    def sample_account_id(self):
        """테스트용 account ID"""
        return "account-001"

    # 4.1-UNIT-240: 빈 본인 사용량
    def test_get_user_own_usage_empty(self, mock_session, sample_tenant_id, sample_account_id):
        """본인 사용량이 없을 때 빈 목록 반환 (4.1-UNIT-240)"""
        # Arrange
        mock_session.execute.return_value.all.return_value = []

        # Act
        result = UsageAnalyticsService.get_user_own_usage(
            session=mock_session,
            tenant_id=sample_tenant_id,
            account_id=sample_account_id,
        )

        # Assert
        assert result == []

    # 4.1-UNIT-241: 본인 사용량 조회
    def test_get_user_own_usage_success(self, mock_session, sample_tenant_id, sample_account_id):
        """본인 사용량 정상 조회 (4.1-UNIT-241)"""
        # Arrange
        mock_row = MagicMock()
        mock_row.usage_type = "llm"
        mock_row.request_count = 20
        mock_row.total_input_tokens = 1000
        mock_row.total_output_tokens = 500
        mock_row.total_tokens = 1500
        mock_row.total_price = Decimal("0.03")
        mock_row.currency = "USD"

        mock_session.execute.return_value.all.return_value = [mock_row]

        # Act
        result = UsageAnalyticsService.get_user_own_usage(
            session=mock_session,
            tenant_id=sample_tenant_id,
            account_id=sample_account_id,
        )

        # Assert
        assert len(result) == 1
        assert isinstance(result[0], UsageSummaryData)
        assert result[0].request_count == 20

    # 4.1-UNIT-242: tenant_id 없이 조회 (학생 계정)
    def test_get_user_own_usage_without_tenant(self, mock_session, sample_account_id):
        """tenant_id 없이 학생 본인 사용량 조회 (4.1-UNIT-242)"""
        # Arrange
        mock_session.execute.return_value.all.return_value = []

        # Act
        result = UsageAnalyticsService.get_user_own_usage(
            session=mock_session,
            tenant_id=None,  # 학생은 tenant_id가 없을 수 있음
            account_id=sample_account_id,
        )

        # Assert
        mock_session.execute.assert_called_once()


class TestGetUserDailyUsage:
    """get_user_daily_usage() 메서드 테스트"""

    @pytest.fixture
    def mock_session(self):
        """테스트용 SQLAlchemy 세션 모킹"""
        return MagicMock()

    @pytest.fixture
    def sample_tenant_id(self):
        """테스트용 tenant ID"""
        return "test-tenant-001"

    @pytest.fixture
    def sample_account_id(self):
        """테스트용 account ID"""
        return "account-001"

    # 4.1-UNIT-250: 일별 사용량 조회
    def test_get_user_daily_usage(self, mock_session, sample_tenant_id, sample_account_id):
        """사용자 일별 사용량 조회 (4.1-UNIT-250)"""
        # Arrange
        mock_row = MagicMock()
        mock_row.date = date(2025, 1, 15)
        mock_row.usage_type = "llm"
        mock_row.request_count = 10
        mock_row.total_tokens = 1000
        mock_row.total_price = Decimal("0.02")

        mock_session.execute.return_value.all.return_value = [mock_row]

        # Act
        result = UsageAnalyticsService.get_user_daily_usage(
            session=mock_session,
            tenant_id=sample_tenant_id,
            account_id=sample_account_id,
            days=30,
        )

        # Assert
        assert len(result) == 1
        assert isinstance(result[0], DailyUsageData)


class TestGetUserUsageLogs:
    """get_user_usage_logs() 메서드 테스트"""

    @pytest.fixture
    def mock_session(self):
        """테스트용 SQLAlchemy 세션 모킹"""
        return MagicMock()

    @pytest.fixture
    def sample_session_id(self):
        """테스트용 education session ID"""
        return "edu-session-001"

    @pytest.fixture
    def sample_account_id(self):
        """테스트용 account ID"""
        return "account-001"

    # 4.1-UNIT-260: 빈 로그
    def test_get_user_usage_logs_empty(self, mock_session, sample_session_id, sample_account_id):
        """사용 로그가 없을 때 빈 목록과 0 반환 (4.1-UNIT-260)"""
        # Arrange
        mock_session.execute.return_value.scalar.return_value = 0
        mock_session.execute.return_value.scalars.return_value.all.return_value = []

        # Act
        logs, total = UsageAnalyticsService.get_user_usage_logs(
            session=mock_session,
            edu_session_id=sample_session_id,
            account_id=sample_account_id,
        )

        # Assert
        assert logs == []
        assert total == 0

    # 4.1-UNIT-261: 로그 조회 성공
    def test_get_user_usage_logs_success(self, mock_session, sample_session_id, sample_account_id):
        """사용 로그 정상 조회 (4.1-UNIT-261)"""
        # Arrange
        mock_log = MagicMock()
        mock_log.id = "log-001"
        mock_log.created_at = datetime(2025, 1, 15, 10, 30, 0)
        mock_log.model_provider = "openai"
        mock_log.model_id = "gpt-4"
        mock_log.usage_type = "llm"
        mock_log.app_name = "Test Agent"
        mock_log.input_tokens = 100
        mock_log.output_tokens = 50
        mock_log.total_tokens = 150
        mock_log.total_price = Decimal("0.01")
        mock_log.currency = "USD"
        mock_log.invoke_source = "agent"

        # 첫 번째 execute 호출 (count)
        mock_count_result = MagicMock()
        mock_count_result.scalar.return_value = 1

        # 두 번째 execute 호출 (data)
        mock_data_result = MagicMock()
        mock_data_result.scalars.return_value.all.return_value = [mock_log]

        mock_session.execute.side_effect = [mock_count_result, mock_data_result]

        # Act
        logs, total = UsageAnalyticsService.get_user_usage_logs(
            session=mock_session,
            edu_session_id=sample_session_id,
            account_id=sample_account_id,
        )

        # Assert
        assert len(logs) == 1
        assert total == 1
        assert isinstance(logs[0], UserUsageLogData)
        assert logs[0].model_provider == "openai"

    # 4.1-UNIT-262: 페이지네이션 테스트
    def test_get_user_usage_logs_pagination(self, mock_session, sample_session_id, sample_account_id):
        """로그 페이지네이션 테스트 (4.1-UNIT-262)"""
        # Arrange
        mock_count_result = MagicMock()
        mock_count_result.scalar.return_value = 100  # 총 100개

        mock_data_result = MagicMock()
        mock_data_result.scalars.return_value.all.return_value = []

        mock_session.execute.side_effect = [mock_count_result, mock_data_result]

        # Act
        logs, total = UsageAnalyticsService.get_user_usage_logs(
            session=mock_session,
            edu_session_id=sample_session_id,
            account_id=sample_account_id,
            limit=10,
            offset=20,
        )

        # Assert
        assert total == 100
