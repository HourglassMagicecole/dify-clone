"""
PriceConfigService Unit Tests
가격 설정 서비스 단위 테스트
"""

from decimal import Decimal
from unittest.mock import MagicMock, patch

import pytest

from services.education_management.price_config_service import PriceConfigService


class TestPriceConfigService:
    """PriceConfigService 테스트"""

    @pytest.fixture
    def mock_session(self):
        """테스트용 SQLAlchemy 세션 모킹"""
        return MagicMock()

    @pytest.fixture
    def sample_tenant_id(self):
        """테스트용 tenant ID"""
        return "test-tenant-001"


class TestListPriceConfigs:
    """list_price_configs() 메서드 테스트"""

    @pytest.fixture
    def mock_session(self):
        """테스트용 SQLAlchemy 세션 모킹"""
        return MagicMock()

    @pytest.fixture
    def sample_tenant_id(self):
        """테스트용 tenant ID"""
        return "test-tenant-001"

    # 4.1-UNIT-100: 빈 목록 조회
    def test_list_price_configs_empty(self, mock_session, sample_tenant_id):
        """가격 설정이 없을 때 빈 목록 반환 (4.1-UNIT-100)"""
        # Arrange
        mock_session.execute.return_value.all.return_value = []
        mock_session.execute.return_value.scalars.return_value.all.return_value = []

        # Act
        configs, total = PriceConfigService.list_price_configs(mock_session, sample_tenant_id)

        # Assert
        assert configs == []
        assert total == 0

    # 4.1-UNIT-101: 필터링된 목록 조회
    def test_list_price_configs_with_filter(self, mock_session, sample_tenant_id):
        """usage_type 필터 적용 조회 (4.1-UNIT-101)"""
        # Arrange
        mock_config = MagicMock()
        mock_config.usage_type = "llm"
        mock_session.execute.return_value.all.return_value = [mock_config]
        mock_session.execute.return_value.scalars.return_value.all.return_value = [mock_config]

        # Act
        configs, total = PriceConfigService.list_price_configs(mock_session, sample_tenant_id, usage_type="llm")

        # Assert
        assert len(configs) == 1
        assert total == 1

    # 4.1-UNIT-102: 페이지네이션 테스트
    def test_list_price_configs_pagination(self, mock_session, sample_tenant_id):
        """페이지네이션 적용 테스트 (4.1-UNIT-102)"""
        # Arrange
        mock_configs = [MagicMock() for _ in range(5)]
        mock_session.execute.return_value.all.return_value = mock_configs[:5]
        mock_session.execute.return_value.scalars.return_value.all.return_value = mock_configs[:2]

        # Act
        configs, total = PriceConfigService.list_price_configs(mock_session, sample_tenant_id, page=1, page_size=2)

        # Assert
        assert len(configs) == 2
        assert total == 5


class TestGetPriceConfig:
    """get_price_config() 메서드 테스트"""

    @pytest.fixture
    def mock_session(self):
        """테스트용 SQLAlchemy 세션 모킹"""
        return MagicMock()

    @pytest.fixture
    def sample_tenant_id(self):
        """테스트용 tenant ID"""
        return "test-tenant-001"

    # 4.1-UNIT-110: 존재하는 설정 조회
    def test_get_price_config_found(self, mock_session, sample_tenant_id):
        """존재하는 가격 설정 조회 (4.1-UNIT-110)"""
        # Arrange
        mock_config = MagicMock()
        mock_config.id = "config-001"
        mock_session.execute.return_value.scalar_one_or_none.return_value = mock_config

        # Act
        result = PriceConfigService.get_price_config(mock_session, sample_tenant_id, "config-001")

        # Assert
        assert result is not None
        assert result.id == "config-001"

    # 4.1-UNIT-111: 존재하지 않는 설정 조회
    def test_get_price_config_not_found(self, mock_session, sample_tenant_id):
        """존재하지 않는 가격 설정 조회 시 None 반환 (4.1-UNIT-111)"""
        # Arrange
        mock_session.execute.return_value.scalar_one_or_none.return_value = None

        # Act
        result = PriceConfigService.get_price_config(mock_session, sample_tenant_id, "unknown-id")

        # Assert
        assert result is None


class TestCreatePriceConfig:
    """create_price_config() 메서드 테스트"""

    @pytest.fixture
    def mock_session(self):
        """테스트용 SQLAlchemy 세션 모킹"""
        return MagicMock()

    @pytest.fixture
    def sample_tenant_id(self):
        """테스트용 tenant ID"""
        return "test-tenant-001"

    # 4.1-UNIT-120: 정상 생성
    @patch("services.education_management.price_config_service.AdminPriceConfig")
    def test_create_price_config_success(self, mock_model, mock_session, sample_tenant_id):
        """가격 설정 정상 생성 (4.1-UNIT-120)"""
        # Arrange
        mock_instance = MagicMock()
        mock_model.return_value = mock_instance

        # Act
        result = PriceConfigService.create_price_config(
            session=mock_session,
            tenant_id=sample_tenant_id,
            provider="openai",
            model_id="gpt-4",
            usage_type="llm",
            price_unit="token",
            unit_scale=1000000,
            input_price=Decimal("0.03"),
            output_price=Decimal("0.06"),
        )

        # Assert
        mock_session.add.assert_called_once()
        mock_session.flush.assert_called_once()
        assert result is not None

    # 4.1-UNIT-121: 잘못된 usage_type
    def test_create_price_config_invalid_usage_type(self, mock_session, sample_tenant_id):
        """잘못된 usage_type이면 ValueError 발생 (4.1-UNIT-121)"""
        # Act & Assert
        with pytest.raises(ValueError, match="Invalid usage_type"):
            PriceConfigService.create_price_config(
                session=mock_session,
                tenant_id=sample_tenant_id,
                provider="openai",
                model_id="gpt-4",
                usage_type="invalid_type",
                price_unit="token",
            )

    # 4.1-UNIT-122: 잘못된 price_unit
    def test_create_price_config_invalid_price_unit(self, mock_session, sample_tenant_id):
        """잘못된 price_unit이면 ValueError 발생 (4.1-UNIT-122)"""
        # Act & Assert
        with pytest.raises(ValueError, match="Invalid price_unit"):
            PriceConfigService.create_price_config(
                session=mock_session,
                tenant_id=sample_tenant_id,
                provider="openai",
                model_id="gpt-4",
                usage_type="llm",
                price_unit="invalid_unit",
            )


class TestUpdatePriceConfig:
    """update_price_config() 메서드 테스트"""

    @pytest.fixture
    def mock_session(self):
        """테스트용 SQLAlchemy 세션 모킹"""
        return MagicMock()

    @pytest.fixture
    def sample_tenant_id(self):
        """테스트용 tenant ID"""
        return "test-tenant-001"

    # 4.1-UNIT-130: 정상 업데이트
    @patch.object(PriceConfigService, "get_price_config")
    def test_update_price_config_success(self, mock_get, mock_session, sample_tenant_id):
        """가격 설정 정상 업데이트 (4.1-UNIT-130)"""
        # Arrange
        mock_config = MagicMock()
        mock_config.input_price = Decimal("0.03")
        mock_get.return_value = mock_config

        # Act
        result = PriceConfigService.update_price_config(
            session=mock_session,
            tenant_id=sample_tenant_id,
            config_id="config-001",
            input_price=Decimal("0.05"),
        )

        # Assert
        assert result is not None
        assert mock_config.input_price == Decimal("0.05")
        mock_session.flush.assert_called_once()

    # 4.1-UNIT-131: 존재하지 않는 설정 업데이트
    @patch.object(PriceConfigService, "get_price_config")
    def test_update_price_config_not_found(self, mock_get, mock_session, sample_tenant_id):
        """존재하지 않는 설정 업데이트 시 None 반환 (4.1-UNIT-131)"""
        # Arrange
        mock_get.return_value = None

        # Act
        result = PriceConfigService.update_price_config(
            session=mock_session,
            tenant_id=sample_tenant_id,
            config_id="unknown-id",
            input_price=Decimal("0.05"),
        )

        # Assert
        assert result is None

    # 4.1-UNIT-132: is_active 업데이트
    @patch.object(PriceConfigService, "get_price_config")
    def test_update_price_config_toggle_active(self, mock_get, mock_session, sample_tenant_id):
        """is_active 상태 토글 (4.1-UNIT-132)"""
        # Arrange
        mock_config = MagicMock()
        mock_config.is_active = True
        mock_get.return_value = mock_config

        # Act
        result = PriceConfigService.update_price_config(
            session=mock_session,
            tenant_id=sample_tenant_id,
            config_id="config-001",
            is_active=False,
        )

        # Assert
        assert result is not None
        assert mock_config.is_active is False


class TestDeletePriceConfig:
    """delete_price_config() 메서드 테스트"""

    @pytest.fixture
    def mock_session(self):
        """테스트용 SQLAlchemy 세션 모킹"""
        return MagicMock()

    @pytest.fixture
    def sample_tenant_id(self):
        """테스트용 tenant ID"""
        return "test-tenant-001"

    # 4.1-UNIT-140: 정상 삭제
    @patch.object(PriceConfigService, "get_price_config")
    def test_delete_price_config_success(self, mock_get, mock_session, sample_tenant_id):
        """가격 설정 정상 삭제 (4.1-UNIT-140)"""
        # Arrange
        mock_config = MagicMock()
        mock_get.return_value = mock_config

        # Act
        result = PriceConfigService.delete_price_config(
            session=mock_session,
            tenant_id=sample_tenant_id,
            config_id="config-001",
        )

        # Assert
        assert result is True
        mock_session.delete.assert_called_once_with(mock_config)
        mock_session.flush.assert_called_once()

    # 4.1-UNIT-141: 존재하지 않는 설정 삭제
    @patch.object(PriceConfigService, "get_price_config")
    def test_delete_price_config_not_found(self, mock_get, mock_session, sample_tenant_id):
        """존재하지 않는 설정 삭제 시 False 반환 (4.1-UNIT-141)"""
        # Arrange
        mock_get.return_value = None

        # Act
        result = PriceConfigService.delete_price_config(
            session=mock_session,
            tenant_id=sample_tenant_id,
            config_id="unknown-id",
        )

        # Assert
        assert result is False
        mock_session.delete.assert_not_called()


class TestGetPriceForModel:
    """get_price_for_model() 메서드 테스트"""

    @pytest.fixture
    def mock_session(self):
        """테스트용 SQLAlchemy 세션 모킹"""
        return MagicMock()

    @pytest.fixture
    def sample_tenant_id(self):
        """테스트용 tenant ID"""
        return "test-tenant-001"

    # 4.1-UNIT-150: 모델별 가격 조회 성공
    def test_get_price_for_model_found(self, mock_session, sample_tenant_id):
        """모델별 활성 가격 설정 조회 (4.1-UNIT-150)"""
        # Arrange
        mock_config = MagicMock()
        mock_config.input_price = Decimal("0.03")
        mock_config.output_price = Decimal("0.06")
        mock_session.execute.return_value.scalar_one_or_none.return_value = mock_config

        # Act
        result = PriceConfigService.get_price_for_model(
            session=mock_session,
            tenant_id=sample_tenant_id,
            provider="openai",
            model_id="gpt-4",
            usage_type="llm",
        )

        # Assert
        assert result is not None
        assert result.input_price == Decimal("0.03")

    # 4.1-UNIT-151: 모델별 가격 없음
    def test_get_price_for_model_not_found(self, mock_session, sample_tenant_id):
        """모델별 가격 설정 없으면 None 반환 (4.1-UNIT-151)"""
        # Arrange
        mock_session.execute.return_value.scalar_one_or_none.return_value = None

        # Act
        result = PriceConfigService.get_price_for_model(
            session=mock_session,
            tenant_id=sample_tenant_id,
            provider="unknown",
            model_id="unknown-model",
            usage_type="llm",
        )

        # Assert
        assert result is None

    # 4.1-UNIT-152: 이미지 품질/해상도 필터
    def test_get_price_for_model_with_quality_resolution(self, mock_session, sample_tenant_id):
        """이미지 품질/해상도로 필터링된 가격 조회 (4.1-UNIT-152)"""
        # Arrange
        mock_config = MagicMock()
        mock_config.quality = "hd"
        mock_config.resolution = "1024x1024"
        mock_session.execute.return_value.scalar_one_or_none.return_value = mock_config

        # Act
        result = PriceConfigService.get_price_for_model(
            session=mock_session,
            tenant_id=sample_tenant_id,
            provider="openai",
            model_id="dall-e-3",
            usage_type="image_gen",
            quality="hd",
            resolution="1024x1024",
        )

        # Assert
        assert result is not None
        assert result.quality == "hd"
        assert result.resolution == "1024x1024"
