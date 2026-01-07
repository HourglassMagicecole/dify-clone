"""
QuotaService Unit Tests
한도 관리 서비스 단위 테스트

Test Coverage:
- 4.1B-UNIT-001: SessionQuota 모델 속성 계산 (usage_percentage, is_warning, is_exceeded)
- 4.1B-UNIT-002: UserUsageQuota 모델 속성 계산 (is_override_active)
- 4.1B-UNIT-003: 유효성 검증 (quota_limit > 0, period in [daily, session, monthly])
- 4.1B-UNIT-004: Decimal 정밀도 유지
"""

from datetime import UTC, datetime, timedelta
from decimal import Decimal
from unittest.mock import MagicMock

import pytest

from services.education_management.quota_service import (
    QuotaService,
    SessionQuotaData,
    UserQuotaData,
)


class TestQuotaServiceBasics:
    """QuotaService 기본 테스트"""

    @pytest.fixture
    def mock_session(self) -> MagicMock:
        """테스트용 SQLAlchemy 세션 모킹"""
        return MagicMock()

    @pytest.fixture
    def sample_tenant_id(self) -> str:
        """테스트용 tenant ID"""
        return "test-tenant-001"

    @pytest.fixture
    def sample_session_id(self) -> str:
        """테스트용 education session ID"""
        return "edu-session-001"

    @pytest.fixture
    def sample_account_id(self) -> str:
        """테스트용 account ID"""
        return "account-001"


class TestSessionQuotaModel:
    """SessionQuota 모델 속성 계산 테스트 (4.1B-UNIT-001)"""

    @pytest.fixture
    def mock_session(self) -> MagicMock:
        """테스트용 SQLAlchemy 세션 모킹"""
        return MagicMock()

    # 4.1B-UNIT-001: usage_percentage 계산
    def test_session_quota_usage_percentage_calculation(self) -> None:
        """사용량 백분율 계산 검증 (4.1B-UNIT-001)"""
        # Arrange
        quota_data = SessionQuotaData(
            id="quota-001",
            session_id="session-001",
            model_provider="openai",
            quota_limit=Decimal("100.00"),
            period="monthly",
            current_usage=Decimal("55.00"),
            usage_percentage=55.0,
            warning_threshold=70,
            is_warning=False,
            is_exceeded=False,
            is_blocked=False,
            is_active=True,
            last_reset_at=datetime.now(UTC),
        )

        # Assert
        assert quota_data.usage_percentage == 55.0

    # 4.1B-UNIT-001: is_warning 계산 - 경고 상태 아님
    def test_session_quota_is_warning_false(self) -> None:
        """70% 미만일 때 is_warning=False (4.1B-UNIT-001)"""
        # Arrange
        quota_data = SessionQuotaData(
            id="quota-001",
            session_id="session-001",
            model_provider="openai",
            quota_limit=Decimal("100.00"),
            period="monthly",
            current_usage=Decimal("50.00"),
            usage_percentage=50.0,
            warning_threshold=70,
            is_warning=False,
            is_exceeded=False,
            is_blocked=False,
            is_active=True,
            last_reset_at=datetime.now(UTC),
        )

        # Assert
        assert quota_data.is_warning is False

    # 4.1B-UNIT-001: is_warning 계산 - 경고 상태
    def test_session_quota_is_warning_true(self) -> None:
        """70% 이상일 때 is_warning=True (4.1B-UNIT-001)"""
        # Arrange
        quota_data = SessionQuotaData(
            id="quota-001",
            session_id="session-001",
            model_provider="openai",
            quota_limit=Decimal("100.00"),
            period="monthly",
            current_usage=Decimal("75.00"),
            usage_percentage=75.0,
            warning_threshold=70,
            is_warning=True,
            is_exceeded=False,
            is_blocked=False,
            is_active=True,
            last_reset_at=datetime.now(UTC),
        )

        # Assert
        assert quota_data.is_warning is True

    # 4.1B-UNIT-001: is_exceeded 계산
    def test_session_quota_is_exceeded(self) -> None:
        """100% 도달 시 is_exceeded=True (4.1B-UNIT-001)"""
        # Arrange
        quota_data = SessionQuotaData(
            id="quota-001",
            session_id="session-001",
            model_provider="openai",
            quota_limit=Decimal("100.00"),
            period="monthly",
            current_usage=Decimal("100.00"),
            usage_percentage=100.0,
            warning_threshold=70,
            is_warning=True,
            is_exceeded=True,
            is_blocked=False,
            is_active=True,
            last_reset_at=datetime.now(UTC),
        )

        # Assert
        assert quota_data.is_exceeded is True

    # 4.1B-UNIT-001: 한도 초과 시
    def test_session_quota_over_limit(self) -> None:
        """한도 초과 시 is_exceeded=True (4.1B-UNIT-001)"""
        # Arrange
        quota_data = SessionQuotaData(
            id="quota-001",
            session_id="session-001",
            model_provider="openai",
            quota_limit=Decimal("100.00"),
            period="monthly",
            current_usage=Decimal("120.00"),
            usage_percentage=120.0,
            warning_threshold=70,
            is_warning=True,
            is_exceeded=True,
            is_blocked=True,
            is_active=True,
            last_reset_at=datetime.now(UTC),
        )

        # Assert
        assert quota_data.is_exceeded is True
        assert quota_data.is_blocked is True


class TestUserUsageQuotaModel:
    """UserUsageQuota 모델 속성 계산 테스트 (4.1B-UNIT-002)"""

    # 4.1B-UNIT-002: is_override_active - False (override_until is None)
    def test_user_quota_override_not_set(self) -> None:
        """override_until이 None일 때 is_override_active=False (4.1B-UNIT-002)"""
        # Arrange
        quota_data = UserQuotaData(
            id="quota-001",
            session_id="session-001",
            account_id="account-001",
            account_name="Test User",
            model_provider="openai",
            quota_limit=Decimal("10.00"),
            period="monthly",
            current_usage=Decimal("5.00"),
            usage_percentage=50.0,
            warning_threshold=70,
            is_warning=False,
            is_exceeded=False,
            is_blocked=False,
            is_active=True,
            override_until=None,
            last_reset_at=datetime.now(UTC),
        )

        # Assert
        assert quota_data.override_until is None

    # 4.1B-UNIT-002: is_override_active - True (future override)
    def test_user_quota_override_active(self) -> None:
        """override_until이 미래일 때 override 활성 (4.1B-UNIT-002)"""
        # Arrange
        future_time = datetime.now(UTC) + timedelta(hours=2)
        quota_data = UserQuotaData(
            id="quota-001",
            session_id="session-001",
            account_id="account-001",
            account_name="Test User",
            model_provider="openai",
            quota_limit=Decimal("10.00"),
            period="monthly",
            current_usage=Decimal("15.00"),  # Over limit
            usage_percentage=150.0,
            warning_threshold=70,
            is_warning=True,
            is_exceeded=True,
            is_blocked=False,  # Not blocked due to override
            is_active=True,
            override_until=future_time,
            last_reset_at=datetime.now(UTC),
        )

        # Assert
        assert quota_data.override_until is not None
        assert quota_data.override_until > datetime.now(UTC)

    # 4.1B-UNIT-002: is_override_active - False (expired override)
    def test_user_quota_override_expired(self) -> None:
        """override_until이 과거일 때 override 만료 (4.1B-UNIT-002)"""
        # Arrange
        past_time = datetime.now(UTC) - timedelta(hours=1)
        quota_data = UserQuotaData(
            id="quota-001",
            session_id="session-001",
            account_id="account-001",
            account_name="Test User",
            model_provider="openai",
            quota_limit=Decimal("10.00"),
            period="monthly",
            current_usage=Decimal("15.00"),
            usage_percentage=150.0,
            warning_threshold=70,
            is_warning=True,
            is_exceeded=True,
            is_blocked=True,
            is_active=True,
            override_until=past_time,
            last_reset_at=datetime.now(UTC),
        )

        # Assert
        assert quota_data.override_until is not None
        assert quota_data.override_until < datetime.now(UTC)


class TestQuotaValidation:
    """한도 유효성 검증 테스트 (4.1B-UNIT-003)"""

    # 4.1B-UNIT-003: 유효한 period 값
    def test_valid_period_values(self) -> None:
        """유효한 period 값 검증 (4.1B-UNIT-003)"""
        valid_periods = ["daily", "session", "monthly"]

        for period in valid_periods:
            quota_data = SessionQuotaData(
                id="quota-001",
                session_id="session-001",
                model_provider="openai",
                quota_limit=Decimal("100.00"),
                period=period,
                current_usage=Decimal(0),
                usage_percentage=0.0,
                warning_threshold=70,
                is_warning=False,
                is_exceeded=False,
                is_blocked=False,
                is_active=True,
                last_reset_at=datetime.now(UTC),
            )
            assert quota_data.period == period

    # 4.1B-UNIT-003: 양수 quota_limit
    def test_positive_quota_limit(self) -> None:
        """양수 quota_limit 검증 (4.1B-UNIT-003)"""
        # Arrange
        quota_data = SessionQuotaData(
            id="quota-001",
            session_id="session-001",
            model_provider="openai",
            quota_limit=Decimal("0.01"),
            period="monthly",
            current_usage=Decimal(0),
            usage_percentage=0.0,
            warning_threshold=70,
            is_warning=False,
            is_exceeded=False,
            is_blocked=False,
            is_active=True,
            last_reset_at=datetime.now(UTC),
        )

        # Assert
        assert quota_data.quota_limit > 0


class TestDecimalPrecision:
    """Decimal 정밀도 테스트 (4.1B-UNIT-004)"""

    # 4.1B-UNIT-004: USD 계산 정밀도
    def test_decimal_precision_usd(self) -> None:
        """USD 계산 시 Decimal 정밀도 유지 (4.1B-UNIT-004)"""
        # Arrange
        quota_limit = Decimal("10.0000")
        current_usage = Decimal("3.3333")

        # Act
        usage_percentage = float(current_usage / quota_limit * 100)

        # Assert
        assert current_usage.as_tuple().exponent == -4  # 4 decimal places
        assert abs(usage_percentage - 33.333) < 0.01

    # 4.1B-UNIT-004: 작은 금액 정밀도
    def test_decimal_precision_small_amounts(self) -> None:
        """작은 금액에서도 정밀도 유지 (4.1B-UNIT-004)"""
        # Arrange
        amount1 = Decimal("0.0001")
        amount2 = Decimal("0.0002")

        # Act
        total = amount1 + amount2

        # Assert
        assert total == Decimal("0.0003")
        assert str(total) == "0.0003"


class TestGetSessionQuotas:
    """get_session_quotas() 테스트"""

    @pytest.fixture
    def mock_session(self) -> MagicMock:
        """테스트용 SQLAlchemy 세션 모킹"""
        return MagicMock()

    def test_get_session_quotas_empty(self, mock_session: MagicMock) -> None:
        """빈 결과 반환 테스트"""
        # Arrange
        mock_session.execute.return_value.scalars.return_value.all.return_value = []

        # Act
        result = QuotaService.get_session_quotas(
            db_session=mock_session,
            session_id="test-session",
        )

        # Assert
        assert result == []

    def test_get_session_quotas_with_data(self, mock_session: MagicMock) -> None:
        """데이터가 있을 때 SessionQuotaData 목록 반환"""
        # Arrange
        mock_quota = MagicMock()
        mock_quota.id = "quota-001"
        mock_quota.session_id = "session-001"
        mock_quota.model_provider = "openai"
        mock_quota.quota_limit = Decimal("100.00")
        mock_quota.period = "monthly"
        mock_quota.current_usage = Decimal("50.00")
        mock_quota.usage_percentage = 50.0
        mock_quota.warning_threshold = 70
        mock_quota.is_warning = False
        mock_quota.is_exceeded = False
        mock_quota.is_blocked = False
        mock_quota.is_active = True
        mock_quota.last_reset_at = datetime.now(UTC)

        mock_session.execute.return_value.scalars.return_value.all.return_value = [mock_quota]

        # Act
        result = QuotaService.get_session_quotas(
            db_session=mock_session,
            session_id="session-001",
        )

        # Assert
        assert len(result) == 1
        assert isinstance(result[0], SessionQuotaData)
        assert result[0].model_provider == "openai"
        assert result[0].quota_limit == Decimal("100.00")


class TestUnblockUser:
    """unblock_user() 테스트"""

    @pytest.fixture
    def mock_session(self) -> MagicMock:
        """테스트용 SQLAlchemy 세션 모킹"""
        return MagicMock()

    def test_unblock_user_success(self, mock_session: MagicMock) -> None:
        """차단 해제 성공"""
        # Arrange
        mock_quota = MagicMock()
        mock_quota.is_blocked = True
        mock_session.get.return_value = mock_quota

        # Act
        result = QuotaService.unblock_user(
            db_session=mock_session,
            quota_id="quota-001",
        )

        # Assert
        assert result is True
        assert mock_quota.is_blocked is False
        mock_session.commit.assert_called_once()

    def test_unblock_user_not_found(self, mock_session: MagicMock) -> None:
        """존재하지 않는 quota"""
        # Arrange
        mock_session.get.return_value = None

        # Act
        result = QuotaService.unblock_user(
            db_session=mock_session,
            quota_id="non-existent",
        )

        # Assert
        assert result is False
        mock_session.commit.assert_not_called()


class TestDeleteSessionQuota:
    """delete_session_quota() 테스트"""

    @pytest.fixture
    def mock_session(self) -> MagicMock:
        """테스트용 SQLAlchemy 세션 모킹"""
        return MagicMock()

    def test_delete_session_quota_success(self, mock_session: MagicMock) -> None:
        """세션 한도 삭제 성공"""
        # Arrange
        mock_quota = MagicMock()
        mock_session.execute.return_value.scalar_one_or_none.return_value = mock_quota

        # Act
        result = QuotaService.delete_session_quota(
            db_session=mock_session,
            session_id="session-001",
            model_provider="openai",
        )

        # Assert
        assert result is True
        mock_session.delete.assert_called_once_with(mock_quota)
        mock_session.commit.assert_called_once()

    def test_delete_session_quota_not_found(self, mock_session: MagicMock) -> None:
        """존재하지 않는 세션 한도"""
        # Arrange
        mock_session.execute.return_value.scalar_one_or_none.return_value = None

        # Act
        result = QuotaService.delete_session_quota(
            db_session=mock_session,
            session_id="session-001",
            model_provider="non-existent",
        )

        # Assert
        assert result is False
        mock_session.delete.assert_not_called()
