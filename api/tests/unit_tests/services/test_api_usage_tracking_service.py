"""
ApiUsageTrackingService Unit Tests
API 사용량 추적 서비스 단위 테스트
"""

from decimal import Decimal
from unittest.mock import MagicMock, patch

import pytest

from services.api_usage_tracking_service import ApiUsageTrackingService


class TestApiUsageTrackingService:
    """ApiUsageTrackingService 테스트"""

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
        """테스트용 account ID (UUID 형식)"""
        return "12345678-1234-1234-1234-123456789012"

    @pytest.fixture
    def sample_app_id(self):
        """테스트용 app ID"""
        return "test-app-001"


class TestResolveAccountId:
    """_resolve_account_id() 메서드 테스트"""

    @pytest.fixture
    def mock_session(self):
        """테스트용 SQLAlchemy 세션 모킹"""
        return MagicMock()

    # 4.1-UNIT-001: None 입력 시 None 반환
    def test_resolve_account_id_none_input(self, mock_session):
        """account_id가 None일 때 None 반환 (4.1-UNIT-001)"""
        # Act
        result = ApiUsageTrackingService._resolve_account_id(mock_session, None)

        # Assert
        assert result is None

    # 4.1-UNIT-002: 유효하지 않은 UUID 형식
    def test_resolve_account_id_invalid_uuid_format(self, mock_session):
        """UUID 형식이 아닌 문자열일 때 None 반환 (4.1-UNIT-002)"""
        # Act
        result = ApiUsageTrackingService._resolve_account_id(mock_session, "invalid-id")

        # Assert
        assert result is None

    # 4.1-UNIT-003: 실제 Account ID인 경우
    def test_resolve_account_id_valid_account(self, mock_session):
        """유효한 Account ID일 때 그대로 반환 (4.1-UNIT-003)"""
        # Arrange
        account_id = "12345678-1234-1234-1234-123456789012"
        mock_account = MagicMock()
        mock_session.get.return_value = mock_account

        # Act
        result = ApiUsageTrackingService._resolve_account_id(mock_session, account_id)

        # Assert
        assert result == account_id

    # 4.1-UNIT-004: End User ID에서 Account ID 추출
    def test_resolve_account_id_from_end_user(self, mock_session):
        """End User의 session_id에서 Account ID 추출 (4.1-UNIT-004)"""
        # Arrange
        end_user_id = "12345678-1234-1234-1234-123456789012"
        actual_account_id = "87654321-4321-4321-4321-210987654321"

        # First call (Account) returns None, second call (EndUser) returns mock
        mock_end_user = MagicMock()
        mock_end_user.session_id = actual_account_id

        mock_resolved_account = MagicMock()

        def get_side_effect(model_class, id_value):
            from models.model import Account, EndUser

            if model_class == Account:
                if id_value == end_user_id:
                    return None
                elif id_value == actual_account_id:
                    return mock_resolved_account
            elif model_class == EndUser:
                if id_value == end_user_id:
                    return mock_end_user
            return None

        mock_session.get.side_effect = get_side_effect

        # Act
        result = ApiUsageTrackingService._resolve_account_id(mock_session, end_user_id)

        # Assert
        assert result == actual_account_id


class TestRecordUsage:
    """record_usage() 메서드 테스트"""

    @pytest.fixture
    def mock_session(self):
        """테스트용 SQLAlchemy 세션 모킹"""
        return MagicMock()

    @pytest.fixture
    def sample_tenant_id(self):
        """테스트용 tenant ID"""
        return "test-tenant-001"

    # 4.1-UNIT-010: 기본 LLM 사용량 기록
    @patch("extensions.ext_database.db")
    @patch.object(ApiUsageTrackingService, "_resolve_account_id", return_value=None)
    @patch.object(ApiUsageTrackingService, "get_session_id_for_app", return_value=None)
    @patch.object(ApiUsageTrackingService, "_calculate_total_price", return_value=Decimal("0.01"))
    def test_record_usage_llm_basic(
        self, mock_calc_price, mock_get_session, mock_resolve, mock_db, mock_session, sample_tenant_id
    ):
        """LLM 사용량 기록 테스트 (4.1-UNIT-010)"""
        # Arrange
        mock_new_session = MagicMock()
        mock_db.engine = MagicMock()

        # Act
        with patch("sqlalchemy.orm.Session") as mock_sa_session:
            mock_context = MagicMock()
            mock_context.__enter__ = MagicMock(return_value=mock_new_session)
            mock_context.__exit__ = MagicMock(return_value=False)
            mock_sa_session.return_value = mock_context

            result = ApiUsageTrackingService.record_usage(
                session=mock_session,
                tenant_id=sample_tenant_id,
                usage_type="llm",
                model_provider="openai",
                model_id="gpt-4",
                input_tokens=100,
                output_tokens=50,
            )

        # Assert
        assert result is not None
        mock_new_session.add.assert_called_once()
        mock_new_session.commit.assert_called_once()

    # 4.1-UNIT-011: session_id 자동 조회
    @patch("extensions.ext_database.db")
    @patch.object(ApiUsageTrackingService, "_resolve_account_id", return_value=None)
    @patch.object(ApiUsageTrackingService, "get_session_id_for_app", return_value="edu-session-001")
    @patch.object(ApiUsageTrackingService, "_calculate_total_price", return_value=Decimal("0.01"))
    def test_record_usage_auto_session_lookup(
        self, mock_calc_price, mock_get_session, mock_resolve, mock_db, mock_session, sample_tenant_id
    ):
        """app_id로 session_id 자동 조회 (4.1-UNIT-011)"""
        # Arrange
        mock_new_session = MagicMock()
        mock_db.engine = MagicMock()

        # Act
        with patch("sqlalchemy.orm.Session") as mock_sa_session:
            mock_context = MagicMock()
            mock_context.__enter__ = MagicMock(return_value=mock_new_session)
            mock_context.__exit__ = MagicMock(return_value=False)
            mock_sa_session.return_value = mock_context

            result = ApiUsageTrackingService.record_usage(
                session=mock_session,
                tenant_id=sample_tenant_id,
                usage_type="llm",
                app_id="test-app-001",
                model_provider="openai",
                model_id="gpt-4",
                input_tokens=100,
                output_tokens=50,
            )

        # Assert
        mock_get_session.assert_called_once_with(mock_session, "test-app-001")
        # Verify the created log has session_id set
        add_call = mock_new_session.add.call_args
        usage_log = add_call[0][0]
        assert usage_log.session_id == "edu-session-001"


class TestRecordEmbeddingUsage:
    """record_embedding_usage() 메서드 테스트"""

    @pytest.fixture
    def mock_session(self):
        """테스트용 SQLAlchemy 세션 모킹"""
        return MagicMock()

    # 4.1-UNIT-020: Embedding 사용량 기록
    @patch.object(ApiUsageTrackingService, "record_usage")
    def test_record_embedding_usage(self, mock_record_usage, mock_session):
        """Embedding 사용량 기록 테스트 (4.1-UNIT-020)"""
        # Arrange
        mock_record_usage.return_value = MagicMock()

        # Act
        ApiUsageTrackingService.record_embedding_usage(
            session=mock_session,
            tenant_id="test-tenant",
            model_provider="openai",
            model_id="text-embedding-3-small",
            input_tokens=500,
        )

        # Assert
        mock_record_usage.assert_called_once()
        call_kwargs = mock_record_usage.call_args[1]
        assert call_kwargs["usage_type"] == "embedding"
        assert call_kwargs["input_tokens"] == 500
        assert call_kwargs["output_tokens"] == 0


class TestRecordRerankUsage:
    """record_rerank_usage() 메서드 테스트"""

    @pytest.fixture
    def mock_session(self):
        """테스트용 SQLAlchemy 세션 모킹"""
        return MagicMock()

    # 4.1-UNIT-021: Rerank 사용량 기록
    @patch.object(ApiUsageTrackingService, "record_usage")
    def test_record_rerank_usage(self, mock_record_usage, mock_session):
        """Rerank 사용량 기록 테스트 (4.1-UNIT-021)"""
        # Arrange
        mock_record_usage.return_value = MagicMock()

        # Act
        ApiUsageTrackingService.record_rerank_usage(
            session=mock_session,
            tenant_id="test-tenant",
            model_provider="cohere",
            model_id="rerank-english-v2.0",
            doc_count=10,
            app_id="test-app",
        )

        # Assert
        mock_record_usage.assert_called_once()
        call_kwargs = mock_record_usage.call_args[1]
        assert call_kwargs["usage_type"] == "rerank"
        assert call_kwargs["input_unit_count"] == Decimal(10)

    # 4.1-UNIT-022: app_id와 invoke_source 둘 다 없으면 기록 안함
    @patch.object(ApiUsageTrackingService, "record_usage")
    def test_record_rerank_usage_no_context(self, mock_record_usage, mock_session):
        """app_id와 invoke_source 없으면 None 반환 (4.1-UNIT-022)"""
        # Act
        result = ApiUsageTrackingService.record_rerank_usage(
            session=mock_session,
            tenant_id="test-tenant",
            model_provider="cohere",
            model_id="rerank-english-v2.0",
            doc_count=10,
        )

        # Assert
        assert result is None
        mock_record_usage.assert_not_called()


class TestRecordTtsUsage:
    """record_tts_usage() 메서드 테스트"""

    @pytest.fixture
    def mock_session(self):
        """테스트용 SQLAlchemy 세션 모킹"""
        return MagicMock()

    # 4.1-UNIT-023: TTS 사용량 기록
    @patch.object(ApiUsageTrackingService, "record_usage")
    def test_record_tts_usage(self, mock_record_usage, mock_session):
        """TTS 사용량 기록 테스트 (4.1-UNIT-023)"""
        # Arrange
        mock_record_usage.return_value = MagicMock()

        # Act
        ApiUsageTrackingService.record_tts_usage(
            session=mock_session,
            tenant_id="test-tenant",
            model_provider="openai",
            model_id="tts-1",
            char_count=1000,
            app_id="test-app",
        )

        # Assert
        mock_record_usage.assert_called_once()
        call_kwargs = mock_record_usage.call_args[1]
        assert call_kwargs["usage_type"] == "tts"
        assert call_kwargs["input_modality"] == "text"
        assert call_kwargs["output_modality"] == "audio"
        assert call_kwargs["input_unit_count"] == Decimal(1000)


class TestRecordSttUsage:
    """record_stt_usage() 메서드 테스트"""

    @pytest.fixture
    def mock_session(self):
        """테스트용 SQLAlchemy 세션 모킹"""
        return MagicMock()

    # 4.1-UNIT-024: STT 사용량 기록
    @patch.object(ApiUsageTrackingService, "record_usage")
    def test_record_stt_usage(self, mock_record_usage, mock_session):
        """STT 사용량 기록 테스트 (4.1-UNIT-024)"""
        # Arrange
        mock_record_usage.return_value = MagicMock()

        # Act
        ApiUsageTrackingService.record_stt_usage(
            session=mock_session,
            tenant_id="test-tenant",
            model_provider="openai",
            model_id="whisper-1",
            estimated_minutes=Decimal("2.5"),
            app_id="test-app",
        )

        # Assert
        mock_record_usage.assert_called_once()
        call_kwargs = mock_record_usage.call_args[1]
        assert call_kwargs["usage_type"] == "stt"
        assert call_kwargs["input_modality"] == "audio"
        assert call_kwargs["output_modality"] == "text"
        assert call_kwargs["input_unit_count"] == Decimal("2.5")


class TestRecordImageGenUsage:
    """record_image_gen_usage() 메서드 테스트"""

    @pytest.fixture
    def mock_session(self):
        """테스트용 SQLAlchemy 세션 모킹"""
        return MagicMock()

    # 4.1-UNIT-025: Image Gen 사용량 기록
    @patch.object(ApiUsageTrackingService, "record_usage")
    def test_record_image_gen_usage(self, mock_record_usage, mock_session):
        """Image Generation 사용량 기록 테스트 (4.1-UNIT-025)"""
        # Arrange
        mock_record_usage.return_value = MagicMock()

        # Act
        ApiUsageTrackingService.record_image_gen_usage(
            session=mock_session,
            tenant_id="test-tenant",
            model_provider="openai",
            model_id="dall-e-3",
            image_count=2,
            quality="hd",
            resolution="1024x1024",
            app_id="test-app",
        )

        # Assert
        mock_record_usage.assert_called_once()
        call_kwargs = mock_record_usage.call_args[1]
        assert call_kwargs["usage_type"] == "image_gen"
        assert call_kwargs["input_modality"] == "text"
        assert call_kwargs["output_modality"] == "image"
        assert call_kwargs["quality"] == "hd"
        assert call_kwargs["resolution"] == "1024x1024"
        assert call_kwargs["output_unit_count"] == Decimal(2)


class TestGetSessionIdForApp:
    """get_session_id_for_app() 메서드 테스트"""

    @pytest.fixture
    def mock_session(self):
        """테스트용 SQLAlchemy 세션 모킹"""
        return MagicMock()

    # 4.1-UNIT-030: session_id 조회 성공
    def test_get_session_id_for_app_found(self, mock_session):
        """app_id로 session_id 조회 성공 (4.1-UNIT-030)"""
        # Arrange
        mock_session.execute.return_value.scalar_one_or_none.return_value = "edu-session-001"

        # Act
        result = ApiUsageTrackingService.get_session_id_for_app(mock_session, "test-app-001")

        # Assert
        assert result == "edu-session-001"

    # 4.1-UNIT-031: session_id 없음
    def test_get_session_id_for_app_not_found(self, mock_session):
        """app_id에 해당하는 session_id 없음 (4.1-UNIT-031)"""
        # Arrange
        mock_session.execute.return_value.scalar_one_or_none.return_value = None

        # Act
        result = ApiUsageTrackingService.get_session_id_for_app(mock_session, "unknown-app")

        # Assert
        assert result is None


class TestCalculateTotalPrice:
    """_calculate_total_price() 메서드 테스트"""

    @pytest.fixture
    def mock_session(self):
        """테스트용 SQLAlchemy 세션 모킹"""
        return MagicMock()

    # 4.1-UNIT-040: AdminPriceConfig 우선 사용
    @patch.object(ApiUsageTrackingService, "_get_admin_price_config")
    @patch.object(ApiUsageTrackingService, "_calculate_price_from_config")
    @patch.object(ApiUsageTrackingService, "_get_dify_price")
    def test_calculate_total_price_admin_config_priority(
        self, mock_dify_price, mock_calc_from_config, mock_get_admin, mock_session
    ):
        """AdminPriceConfig가 있으면 우선 사용 (4.1-UNIT-040)"""
        # Arrange
        mock_admin_config = MagicMock()
        mock_admin_config.input_price = Decimal("0.001")
        mock_admin_config.output_price = Decimal("0.002")
        mock_admin_config.unit_scale = 1000
        mock_get_admin.return_value = mock_admin_config
        mock_calc_from_config.return_value = Decimal("0.15")

        # Act
        result = ApiUsageTrackingService._calculate_total_price(
            session=mock_session,
            tenant_id="test-tenant",
            provider="openai",
            model_id="gpt-4",
            usage_type="llm",
            input_tokens=100,
            output_tokens=50,
        )

        # Assert
        assert result == Decimal("0.15")
        mock_dify_price.assert_not_called()

    # 4.1-UNIT-041: Dify PriceConfig fallback
    @patch.object(ApiUsageTrackingService, "_get_admin_price_config")
    @patch.object(ApiUsageTrackingService, "_get_dify_price")
    def test_calculate_total_price_dify_fallback(self, mock_dify_price, mock_get_admin, mock_session):
        """AdminPriceConfig 없으면 Dify 가격 사용 (4.1-UNIT-041)"""
        # Arrange
        mock_get_admin.return_value = None
        mock_dify_price.return_value = Decimal("0.08")

        # Act
        result = ApiUsageTrackingService._calculate_total_price(
            session=mock_session,
            tenant_id="test-tenant",
            provider="openai",
            model_id="gpt-4",
            usage_type="llm",
            input_tokens=100,
            output_tokens=50,
        )

        # Assert
        assert result == Decimal("0.08")

    # 4.1-UNIT-042: 가격 정보 없음
    @patch.object(ApiUsageTrackingService, "_get_admin_price_config")
    @patch.object(ApiUsageTrackingService, "_get_dify_price")
    def test_calculate_total_price_no_pricing(self, mock_dify_price, mock_get_admin, mock_session):
        """가격 정보 없으면 None 반환 (4.1-UNIT-042)"""
        # Arrange
        mock_get_admin.return_value = None
        mock_dify_price.return_value = None

        # Act
        result = ApiUsageTrackingService._calculate_total_price(
            session=mock_session,
            tenant_id="test-tenant",
            provider="unknown-provider",
            model_id="unknown-model",
            usage_type="llm",
            input_tokens=100,
            output_tokens=50,
        )

        # Assert
        assert result is None


class TestCalculatePriceFromConfig:
    """_calculate_price_from_config() 메서드 테스트"""

    # 4.1-UNIT-050: 토큰 기반 가격 계산
    def test_calculate_price_from_config_tokens(self):
        """토큰 기반 가격 계산 (4.1-UNIT-050)"""
        # Arrange
        input_price = Decimal("0.01")  # $0.01 per 1000 tokens
        output_price = Decimal("0.03")  # $0.03 per 1000 tokens
        unit_scale = 1000

        # Act
        result = ApiUsageTrackingService._calculate_price_from_config(
            input_price=input_price,
            output_price=output_price,
            unit_scale=unit_scale,
            input_tokens=2000,
            output_tokens=1000,
        )

        # Assert
        # (0.01 * 2000 / 1000) + (0.03 * 1000 / 1000) = 0.02 + 0.03 = 0.05
        assert result == Decimal("0.05")

    # 4.1-UNIT-051: 유닛 기반 가격 계산
    def test_calculate_price_from_config_units(self):
        """유닛(이미지 등) 기반 가격 계산 (4.1-UNIT-051)"""
        # Arrange
        output_price = Decimal("0.04")  # $0.04 per image
        unit_scale = 1

        # Act
        result = ApiUsageTrackingService._calculate_price_from_config(
            input_price=None,
            output_price=output_price,
            unit_scale=unit_scale,
            output_unit_count=Decimal(2),
        )

        # Assert
        # 0.04 * 2 / 1 = 0.08
        assert result == Decimal("0.08")

    # 4.1-UNIT-052: 가격이 모두 None인 경우
    def test_calculate_price_from_config_no_prices(self):
        """가격이 모두 None이면 0 반환 (4.1-UNIT-052)"""
        # Act
        result = ApiUsageTrackingService._calculate_price_from_config(
            input_price=None,
            output_price=None,
            unit_scale=1000,
            input_tokens=1000,
            output_tokens=500,
        )

        # Assert
        assert result == Decimal(0)
