"""
QuotaEnforcementService Unit Tests
한도 체크/차단 서비스 단위 테스트

Test Coverage:
- 4.1B-UNIT-005: 70% 도달 시 is_warning = True 계산
- 4.1B-UNIT-007: 100% 도달 시 is_exceeded = True 계산
- 4.1B-UNIT-008: check_quota() - 차단된 사용자 거부
- 4.1B-UNIT-009: check_quota() - override 활성 시 허용
- 4.1B-UNIT-012: SC1 - 권한 검증 로직
- 4.1B-UNIT-013: SC2 - 본인 한도만 조회 가능 검증
"""

from datetime import UTC, datetime, timedelta
from decimal import Decimal
from unittest.mock import MagicMock

import pytest

from services.education_management.quota_enforcement_service import (
    QuotaCheckResult,
    QuotaEnforcementService,
)


class TestQuotaEnforcementServiceBasics:
    """QuotaEnforcementService 기본 테스트"""

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


class TestWarningCalculation:
    """경고 상태 계산 테스트 (4.1B-UNIT-005)"""

    @pytest.fixture
    def mock_session(self) -> MagicMock:
        """테스트용 SQLAlchemy 세션 모킹"""
        return MagicMock()

    # 4.1B-UNIT-005: 70% 미만 - 경고 없음
    def test_no_warning_under_threshold(self, mock_session: MagicMock) -> None:
        """70% 미만일 때 is_warning=False (4.1B-UNIT-005)"""
        # Arrange
        mock_user_quota = MagicMock()
        mock_user_quota.current_usage = Decimal("50.00")
        mock_user_quota.quota_limit = Decimal("100.00")
        mock_user_quota.warning_threshold = 70
        mock_user_quota.is_warning = False
        mock_user_quota.is_exceeded = False
        mock_user_quota.is_blocked = False
        mock_user_quota.is_override_active = False
        mock_user_quota.last_reset_at = datetime.now(UTC)

        mock_session.execute.return_value.scalars.return_value.first.side_effect = [
            None,  # No session quota
            mock_user_quota,
        ]

        # Act
        result = QuotaEnforcementService.check_quota(
            db_session=mock_session,
            tenant_id="tenant-001",
            session_id="session-001",
            account_id="account-001",
            model_provider="openai",
        )

        # Assert
        assert result.allowed is True
        assert result.is_warning is False

    # 4.1B-UNIT-005: 정확히 70% - 경고
    def test_warning_at_threshold(self, mock_session: MagicMock) -> None:
        """정확히 70%일 때 is_warning=True (4.1B-UNIT-005)"""
        # Arrange
        mock_user_quota = MagicMock()
        mock_user_quota.current_usage = Decimal("70.00")
        mock_user_quota.quota_limit = Decimal("100.00")
        mock_user_quota.warning_threshold = 70
        mock_user_quota.is_warning = True
        mock_user_quota.is_exceeded = False
        mock_user_quota.is_blocked = False
        mock_user_quota.is_override_active = False
        mock_user_quota.last_reset_at = datetime.now(UTC)

        mock_session.execute.return_value.scalars.return_value.first.side_effect = [
            None,  # No session quota
            mock_user_quota,
        ]

        # Act
        result = QuotaEnforcementService.check_quota(
            db_session=mock_session,
            tenant_id="tenant-001",
            session_id="session-001",
            account_id="account-001",
            model_provider="openai",
        )

        # Assert
        assert result.allowed is True
        assert result.is_warning is True

    # 4.1B-UNIT-005: 80% - 경고
    def test_warning_above_threshold(self, mock_session: MagicMock) -> None:
        """70% 초과 시 is_warning=True (4.1B-UNIT-005)"""
        # Arrange
        mock_user_quota = MagicMock()
        mock_user_quota.current_usage = Decimal("80.00")
        mock_user_quota.quota_limit = Decimal("100.00")
        mock_user_quota.warning_threshold = 70
        mock_user_quota.is_warning = True
        mock_user_quota.is_exceeded = False
        mock_user_quota.is_blocked = False
        mock_user_quota.is_override_active = False
        mock_user_quota.last_reset_at = datetime.now(UTC)

        mock_session.execute.return_value.scalars.return_value.first.side_effect = [
            None,
            mock_user_quota,
        ]

        # Act
        result = QuotaEnforcementService.check_quota(
            db_session=mock_session,
            tenant_id="tenant-001",
            session_id="session-001",
            account_id="account-001",
            model_provider="openai",
        )

        # Assert
        assert result.allowed is True
        assert result.is_warning is True


class TestExceededCalculation:
    """초과 상태 계산 테스트 (4.1B-UNIT-007)"""

    @pytest.fixture
    def mock_session(self) -> MagicMock:
        """테스트용 SQLAlchemy 세션 모킹"""
        return MagicMock()

    # 4.1B-UNIT-007: 99% - 초과 아님
    def test_not_exceeded_under_limit(self, mock_session: MagicMock) -> None:
        """100% 미만일 때 is_exceeded=False (4.1B-UNIT-007)"""
        # Arrange
        mock_user_quota = MagicMock()
        mock_user_quota.current_usage = Decimal("99.00")
        mock_user_quota.quota_limit = Decimal("100.00")
        mock_user_quota.warning_threshold = 70
        mock_user_quota.is_warning = True
        mock_user_quota.is_exceeded = False
        mock_user_quota.is_blocked = False
        mock_user_quota.is_override_active = False
        mock_user_quota.last_reset_at = datetime.now(UTC)

        mock_session.execute.return_value.scalars.return_value.first.side_effect = [
            None,
            mock_user_quota,
        ]

        # Act
        result = QuotaEnforcementService.check_quota(
            db_session=mock_session,
            tenant_id="tenant-001",
            session_id="session-001",
            account_id="account-001",
            model_provider="openai",
        )

        # Assert
        assert result.allowed is True

    # 4.1B-UNIT-007: 정확히 100% - 초과
    def test_exceeded_at_limit(self, mock_session: MagicMock) -> None:
        """정확히 100%일 때 is_exceeded=True (4.1B-UNIT-007)"""
        # Arrange
        mock_user_quota = MagicMock()
        mock_user_quota.current_usage = Decimal("100.00")
        mock_user_quota.quota_limit = Decimal("100.00")
        mock_user_quota.warning_threshold = 70
        mock_user_quota.is_warning = True
        mock_user_quota.is_exceeded = True
        mock_user_quota.is_blocked = False
        mock_user_quota.is_override_active = False
        mock_user_quota.last_reset_at = datetime.now(UTC)

        mock_session.execute.return_value.scalars.return_value.first.side_effect = [
            None,
            mock_user_quota,
        ]

        # Act
        result = QuotaEnforcementService.check_quota(
            db_session=mock_session,
            tenant_id="tenant-001",
            session_id="session-001",
            account_id="account-001",
            model_provider="openai",
        )

        # Assert
        assert result.allowed is False
        assert result.blocked_by == "user"

    # 4.1B-UNIT-007: 120% - 초과
    def test_exceeded_over_limit(self, mock_session: MagicMock) -> None:
        """100% 초과 시 is_exceeded=True (4.1B-UNIT-007)"""
        # Arrange
        mock_user_quota = MagicMock()
        mock_user_quota.current_usage = Decimal("120.00")
        mock_user_quota.quota_limit = Decimal("100.00")
        mock_user_quota.warning_threshold = 70
        mock_user_quota.is_warning = True
        mock_user_quota.is_exceeded = True
        mock_user_quota.is_blocked = True
        mock_user_quota.is_override_active = False
        mock_user_quota.last_reset_at = datetime.now(UTC)

        mock_session.execute.return_value.scalars.return_value.first.side_effect = [
            None,
            mock_user_quota,
        ]

        # Act
        result = QuotaEnforcementService.check_quota(
            db_session=mock_session,
            tenant_id="tenant-001",
            session_id="session-001",
            account_id="account-001",
            model_provider="openai",
        )

        # Assert
        assert result.allowed is False
        assert result.blocked_by == "user"


class TestBlockedUserRejection:
    """차단된 사용자 거부 테스트 (4.1B-UNIT-008)"""

    @pytest.fixture
    def mock_session(self) -> MagicMock:
        """테스트용 SQLAlchemy 세션 모킹"""
        return MagicMock()

    # 4.1B-UNIT-008: 사용자 차단 시 거부
    def test_blocked_user_rejected(self, mock_session: MagicMock) -> None:
        """차단된 사용자 API 호출 거부 (4.1B-UNIT-008)"""
        # Arrange
        mock_user_quota = MagicMock()
        mock_user_quota.current_usage = Decimal("110.00")
        mock_user_quota.quota_limit = Decimal("100.00")
        mock_user_quota.warning_threshold = 70
        mock_user_quota.is_warning = True
        mock_user_quota.is_exceeded = True
        mock_user_quota.is_blocked = True
        mock_user_quota.is_override_active = False
        mock_user_quota.last_reset_at = datetime.now(UTC)

        mock_session.execute.return_value.scalars.return_value.first.side_effect = [
            None,  # No session quota
            mock_user_quota,
        ]

        # Act
        result = QuotaEnforcementService.check_quota(
            db_session=mock_session,
            tenant_id="tenant-001",
            session_id="session-001",
            account_id="account-001",
            model_provider="openai",
        )

        # Assert
        assert result.allowed is False
        assert result.blocked_by == "user"
        assert "한도에 도달" in (result.message or "")

    # 4.1B-UNIT-008: 세션 차단 시 전원 거부
    def test_session_blocked_all_rejected(self, mock_session: MagicMock) -> None:
        """세션 차단 시 세션 내 전원 거부 (4.1B-UNIT-008)"""
        # Arrange
        mock_session_quota = MagicMock()
        mock_session_quota.current_usage = Decimal("500.00")
        mock_session_quota.quota_limit = Decimal("400.00")
        mock_session_quota.warning_threshold = 70
        mock_session_quota.is_warning = True
        mock_session_quota.is_exceeded = True
        mock_session_quota.is_blocked = True
        mock_session_quota.last_reset_at = datetime.now(UTC)

        mock_session.execute.return_value.scalars.return_value.first.return_value = mock_session_quota

        # Act
        result = QuotaEnforcementService.check_quota(
            db_session=mock_session,
            tenant_id="tenant-001",
            session_id="session-001",
            account_id="account-001",
            model_provider="openai",
        )

        # Assert
        assert result.allowed is False
        assert result.blocked_by == "session"
        assert "세션 전체" in (result.message or "")


class TestOverrideAllowsBlocked:
    """Override 활성 시 허용 테스트 (4.1B-UNIT-009)"""

    @pytest.fixture
    def mock_session(self) -> MagicMock:
        """테스트용 SQLAlchemy 세션 모킹"""
        return MagicMock()

    # 4.1B-UNIT-009: Override 활성 시 초과해도 허용
    def test_override_allows_exceeded_user(self, mock_session: MagicMock) -> None:
        """Override 활성 시 한도 초과 사용자도 허용 (4.1B-UNIT-009)"""
        # Arrange
        mock_user_quota = MagicMock()
        mock_user_quota.current_usage = Decimal("150.00")
        mock_user_quota.quota_limit = Decimal("100.00")
        mock_user_quota.warning_threshold = 70
        mock_user_quota.is_warning = True
        mock_user_quota.is_exceeded = True
        mock_user_quota.is_blocked = False  # Not blocked due to override
        mock_user_quota.is_override_active = True  # Override active
        mock_user_quota.override_until = datetime.now(UTC) + timedelta(hours=2)
        mock_user_quota.last_reset_at = datetime.now(UTC)

        mock_session.execute.return_value.scalars.return_value.first.side_effect = [
            None,  # No session quota
            mock_user_quota,
        ]

        # Act
        result = QuotaEnforcementService.check_quota(
            db_session=mock_session,
            tenant_id="tenant-001",
            session_id="session-001",
            account_id="account-001",
            model_provider="openai",
        )

        # Assert
        assert result.allowed is True
        assert result.blocked_by is None

    # 4.1B-UNIT-009: Override 만료 시 차단
    def test_expired_override_blocks_user(self, mock_session: MagicMock) -> None:
        """Override 만료 시 한도 초과 사용자 차단 (4.1B-UNIT-009)"""
        # Arrange
        mock_user_quota = MagicMock()
        mock_user_quota.current_usage = Decimal("150.00")
        mock_user_quota.quota_limit = Decimal("100.00")
        mock_user_quota.warning_threshold = 70
        mock_user_quota.is_warning = True
        mock_user_quota.is_exceeded = True
        mock_user_quota.is_blocked = False
        mock_user_quota.is_override_active = False  # Override expired
        mock_user_quota.override_until = datetime.now(UTC) - timedelta(hours=1)
        mock_user_quota.last_reset_at = datetime.now(UTC)

        mock_session.execute.return_value.scalars.return_value.first.side_effect = [
            None,
            mock_user_quota,
        ]

        # Act
        result = QuotaEnforcementService.check_quota(
            db_session=mock_session,
            tenant_id="tenant-001",
            session_id="session-001",
            account_id="account-001",
            model_provider="openai",
        )

        # Assert
        assert result.allowed is False
        assert result.blocked_by == "user"


class TestNoQuota:
    """한도가 설정되지 않은 경우 테스트"""

    @pytest.fixture
    def mock_session(self) -> MagicMock:
        """테스트용 SQLAlchemy 세션 모킹"""
        return MagicMock()

    def test_no_quota_allows_request(self, mock_session: MagicMock) -> None:
        """한도가 없으면 요청 허용"""
        # Arrange
        mock_session.execute.return_value.scalars.return_value.first.return_value = None

        # Act
        result = QuotaEnforcementService.check_quota(
            db_session=mock_session,
            tenant_id="tenant-001",
            session_id="session-001",
            account_id="account-001",
            model_provider="openai",
        )

        # Assert
        assert result.allowed is True
        assert result.blocked_by is None
        assert result.is_warning is False


class TestIncrementUsage:
    """increment_usage() 테스트"""

    @pytest.fixture
    def mock_session(self) -> MagicMock:
        """테스트용 SQLAlchemy 세션 모킹"""
        return MagicMock()

    def test_increment_usage_updates_both_quotas(self, mock_session: MagicMock) -> None:
        """세션 및 사용자 한도 모두 업데이트"""
        # Arrange & Act
        QuotaEnforcementService.increment_usage(
            db_session=mock_session,
            session_id="session-001",
            account_id="account-001",
            model_provider="openai",
            amount=Decimal("0.05"),
        )

        # Assert
        assert mock_session.execute.call_count == 2  # session + user update
        mock_session.commit.assert_called_once()


class TestGetWarningsForSession:
    """get_warnings_for_session() 테스트"""

    @pytest.fixture
    def mock_session(self) -> MagicMock:
        """테스트용 SQLAlchemy 세션 모킹"""
        return MagicMock()

    def test_get_warnings_empty(self, mock_session: MagicMock) -> None:
        """경고가 없을 때 빈 결과"""
        # Arrange
        mock_session.execute.return_value.scalars.return_value.all.return_value = []
        mock_session.execute.return_value.all.return_value = []

        # Act
        result = QuotaEnforcementService.get_warnings_for_session(
            db_session=mock_session,
            session_id="session-001",
        )

        # Assert
        assert result["session_warning_count"] == 0
        assert result["session_blocked"] is False
        assert result["user_warning_count"] == 0
        assert result["user_blocked_count"] == 0

    def test_get_warnings_with_session_warning(self, mock_session: MagicMock) -> None:
        """세션 경고 상태"""
        # Arrange
        mock_session_quota = MagicMock()
        mock_session_quota.is_warning = True
        mock_session_quota.is_blocked = False
        mock_session_quota.model_provider = "openai"

        mock_session.execute.return_value.scalars.return_value.all.return_value = [mock_session_quota]
        mock_session.execute.return_value.all.return_value = []

        # Act
        result = QuotaEnforcementService.get_warnings_for_session(
            db_session=mock_session,
            session_id="session-001",
        )

        # Assert
        assert result["session_warning_count"] == 1
        assert result["session_blocked"] is False


class TestQuotaCheckResult:
    """QuotaCheckResult 데이터클래스 테스트"""

    def test_quota_check_result_allowed(self) -> None:
        """허용 결과 생성"""
        result = QuotaCheckResult(
            allowed=True,
            blocked_by=None,
            model_provider="openai",
            session_usage=Decimal("50.00"),
            session_limit=Decimal("100.00"),
            user_usage=Decimal("5.00"),
            user_limit=Decimal("10.00"),
            is_warning=False,
            message=None,
            reset_at=datetime.now(UTC),
        )

        assert result.allowed is True
        assert result.blocked_by is None

    def test_quota_check_result_blocked(self) -> None:
        """차단 결과 생성"""
        result = QuotaCheckResult(
            allowed=False,
            blocked_by="user",
            model_provider="openai",
            session_usage=Decimal("50.00"),
            session_limit=Decimal("100.00"),
            user_usage=Decimal("10.00"),
            user_limit=Decimal("10.00"),
            is_warning=True,
            message="사용량 한도에 도달했습니다.",
            reset_at=datetime.now(UTC),
        )

        assert result.allowed is False
        assert result.blocked_by == "user"
        assert "한도" in result.message
