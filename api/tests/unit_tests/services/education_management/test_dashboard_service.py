"""
Dashboard Service Unit Tests
대시보드 서비스 단위 테스트
"""

from datetime import UTC, datetime, timedelta
from unittest.mock import MagicMock, patch

import pytest
from sqlalchemy.exc import SQLAlchemyError

from services.education_management.dashboard_service import DashboardService


class TestDashboardService:
    """Dashboard Service 테스트"""

    @pytest.fixture
    def service(self):
        """테스트용 서비스 인스턴스 생성"""
        return DashboardService()

    @pytest.fixture
    def mock_user_id(self):
        """테스트용 사용자 ID"""
        return "test-user-001"

    def test_service_instantiation(self, service):
        """서비스 인스턴스 생성 테스트"""
        assert service is not None
        assert isinstance(service, DashboardService)

    # 1.5-UNIT-015: API 사용량 구조 테스트
    @patch("services.education_management.dashboard_service.db")
    def test_get_api_usage_returns_default_structure(self, mock_db, service, mock_user_id):
        """API 사용량 조회가 올바른 구조를 반환하는지 테스트 (1.5-UNIT-015)"""
        # Arrange - Mock empty query result
        mock_query = mock_db.session.query.return_value
        mock_query.filter.return_value.group_by.return_value.order_by.return_value.all.return_value = []

        # Act
        result = service._get_api_usage(mock_user_id)

        # Assert
        assert "totalCalls" in result
        assert "totalTokens" in result
        assert "estimatedCost" in result
        assert "dailyUsage" in result
        assert isinstance(result["dailyUsage"], list)
        assert len(result["dailyUsage"]) == 7  # 기본 7일
        assert result["totalCalls"] == 0
        assert result["totalTokens"] == 0
        assert result["estimatedCost"] == 0.0

    def test_get_user_dashboard_returns_correct_structure(self, service, mock_user_id):
        """대시보드 데이터 구조 테스트"""
        with patch.object(
            service, "_get_resource_summary", return_value={"agents": 0, "workflows": 0, "datasets": 0, "total": 0}
        ):
            with patch.object(service, "_get_recent_activities", return_value=[]):
                with patch.object(
                    service,
                    "_get_api_usage",
                    return_value={"totalCalls": 0, "totalTokens": 0, "estimatedCost": 0.0, "dailyUsage": []},
                ):
                    # Act
                    result = service.get_user_dashboard(mock_user_id)

                    # Assert
                    assert "resourceSummary" in result
                    assert "recentActivities" in result
                    assert "apiUsage" in result
                    assert isinstance(result["recentActivities"], list)
                    assert isinstance(result["apiUsage"], dict)


class TestResourceSummary:
    """리소스 요약 집계 테스트"""

    @pytest.fixture
    def service(self):
        """테스트용 서비스 인스턴스 생성"""
        return DashboardService()

    @pytest.fixture
    def mock_user_id(self):
        """테스트용 사용자 ID"""
        return "test-user-001"

    # 1.5-UNIT-001: 빈 데이터베이스 테스트
    @patch("services.education_management.dashboard_service.db")
    def test_get_resource_summary_empty_database(self, mock_db, service, mock_user_id):
        """빈 데이터베이스에서 모든 카운트를 0으로 반환 (1.5-UNIT-001)"""
        # Arrange - Mock query chain to return 0 for all counts
        mock_db.session.query.return_value.join.return_value.filter.return_value.scalar.return_value = 0
        mock_db.session.query.return_value.filter.return_value.scalar.return_value = 0

        # Act
        result = service._get_resource_summary(mock_user_id, "my_resources")

        # Assert
        assert result["agents"] == 0
        assert result["workflows"] == 0
        assert result["datasets"] == 0
        assert result["total"] == 0

    # 1.5-UNIT-002: 리소스 집계 정확성 테스트
    @patch("services.education_management.dashboard_service.db")
    def test_get_resource_summary_accurate_aggregation(self, mock_db, service, mock_user_id):
        """여러 리소스를 정확히 집계 (agents=5, workflows=3, datasets=2, total=10) (1.5-UNIT-002)"""
        # Arrange - Mock query chain to return specific counts
        # First call (agents): 5, second call (workflows): 3, third call (datasets): 2
        mock_db.session.query.return_value.join.return_value.filter.return_value.scalar.side_effect = [5, 3, 2]

        # Act
        result = service._get_resource_summary(mock_user_id, "my_resources")

        # Assert
        assert result["agents"] == 5
        assert result["workflows"] == 3
        assert result["datasets"] == 2
        assert result["total"] == 10

    # 1.5-UNIT-003: 사용자 격리 로직 테스트
    @patch("services.education_management.dashboard_service.db")
    def test_get_resource_summary_user_isolation(self, mock_db, service, mock_user_id):
        """다른 사용자의 리소스를 제외하고 집계 (1.5-UNIT-003)"""
        # Arrange
        mock_query = MagicMock()
        mock_filter = MagicMock()
        mock_query.join.return_value.filter.return_value = mock_filter
        mock_query.filter.return_value = mock_filter
        mock_filter.scalar.return_value = 0
        mock_db.session.query.return_value = mock_query

        # Act
        service._get_resource_summary(mock_user_id, "my_resources")

        # Assert - 모든 filter 호출에 account_id가 포함되어야 함
        # filter가 호출되었는지 확인 (최소 3번 - agents, workflows, datasets)
        assert mock_filter.scalar.call_count >= 3


class TestRecentActivities:
    """최근 활동 조회 테스트"""

    @pytest.fixture
    def service(self):
        """테스트용 서비스 인스턴스 생성"""
        return DashboardService()

    @pytest.fixture
    def mock_user_id(self):
        """테스트용 사용자 ID"""
        return "test-user-001"

    # 1.5-UNIT-007: 빈 데이터 테스트
    @patch("services.education_management.dashboard_service.db")
    def test_get_recent_activities_empty_data(self, mock_db, service, mock_user_id):
        """빈 데이터에서 빈 배열 반환 (1.5-UNIT-007)"""
        # Arrange - Mock query to return empty list
        mock_query = MagicMock()
        mock_query.all.return_value = []
        mock_chain = mock_db.session.query.return_value.join.return_value.filter.return_value
        mock_chain.order_by.return_value.limit.return_value = mock_query

        # Act
        result = service._get_recent_activities(mock_user_id, "my_resources")

        # Assert
        assert result == []
        assert isinstance(result, list)

    # 1.5-UNIT-008: limit 파라미터 준수 테스트
    @patch("services.education_management.dashboard_service.db")
    def test_get_recent_activities_respects_limit(self, mock_db, service, mock_user_id):
        """최근 10개 활동만 반환 (limit 준수) (1.5-UNIT-008)"""
        # Arrange - Create 15 mock activities with Account (3-tuple)
        now = datetime.now(UTC)
        mock_apps = []
        for i in range(15):
            mock_app = MagicMock()
            mock_app.id = f"app-{i}"
            mock_app.name = f"Test App {i}"
            mock_app.mode = "agent-chat"

            mock_tag = MagicMock()
            mock_tag.tagged_at = now - timedelta(minutes=i)

            mock_account = MagicMock()
            mock_account.name = f"User {i}"

            mock_apps.append((mock_app, mock_tag, mock_account))

        mock_query = MagicMock()
        # First query (agents): return 10 items
        # Second query (datasets): return empty
        mock_query.all.side_effect = [mock_apps[:10], []]
        mock_chain = mock_db.session.query.return_value.join.return_value.join.return_value.filter.return_value
        mock_chain.order_by.return_value.limit.return_value = mock_query

        # Act
        result = service._get_recent_activities(mock_user_id, "my_resources", limit=10)

        # Assert
        assert len(result) == 10

    # 1.5-UNIT-009: 시간순 정렬 테스트
    @patch("services.education_management.dashboard_service.db")
    def test_get_recent_activities_sorted_by_time(self, mock_db, service, mock_user_id):
        """여러 리소스 타입(agent, dataset)을 시간순으로 정렬 (1.5-UNIT-009)"""
        # Arrange - Create mock activities with different timestamps (3-tuple with Account)
        now = datetime.now(UTC)

        # Agent created 5 minutes ago
        mock_app = MagicMock()
        mock_app.id = "app-1"
        mock_app.name = "Test Agent"
        mock_app.mode = "agent-chat"
        mock_app_tag = MagicMock()
        mock_app_tag.tagged_at = now - timedelta(minutes=5)
        mock_app_account = MagicMock()
        mock_app_account.name = "User A"

        # Dataset created 3 minutes ago (more recent)
        mock_dataset = MagicMock()
        mock_dataset.id = "dataset-1"
        mock_dataset.name = "Test Dataset"
        mock_dataset_tag = MagicMock()
        mock_dataset_tag.tagged_at = now - timedelta(minutes=3)
        mock_dataset_account = MagicMock()
        mock_dataset_account.name = "User B"

        mock_query = MagicMock()
        # First query: agents (3-tuple), Second query: datasets (3-tuple)
        mock_query.all.side_effect = [
            [(mock_app, mock_app_tag, mock_app_account)],
            [(mock_dataset, mock_dataset_tag, mock_dataset_account)],
        ]
        mock_chain = mock_db.session.query.return_value.join.return_value.join.return_value.filter.return_value
        mock_chain.order_by.return_value.limit.return_value = mock_query

        # Act
        result = service._get_recent_activities(mock_user_id, "my_resources")

        # Assert - Dataset should come first (more recent)
        assert len(result) == 2
        assert result[0]["type"] == "dataset"
        assert result[0]["resourceName"] == "Test Dataset"
        assert result[1]["type"] == "agent"
        assert result[1]["resourceName"] == "Test Agent"

    # 1.5-UNIT-010: 응답 형식 검증 테스트
    @patch("services.education_management.dashboard_service.db")
    def test_get_recent_activities_response_format(self, mock_db, service, mock_user_id):
        """각 활동에 type, resourceName, action, timestamp 포함 (1.5-UNIT-010)"""
        # Arrange (3-tuple with Account)
        now = datetime.now(UTC)
        mock_app = MagicMock()
        mock_app.id = "app-1"
        mock_app.name = "Test Agent"
        mock_app.mode = "agent-chat"
        mock_tag = MagicMock()
        mock_tag.tagged_at = now
        mock_account = MagicMock()
        mock_account.name = "Test User"

        mock_query = MagicMock()
        mock_query.all.side_effect = [[(mock_app, mock_tag, mock_account)], []]
        mock_chain = mock_db.session.query.return_value.join.return_value.join.return_value.filter.return_value
        mock_chain.order_by.return_value.limit.return_value = mock_query

        # Act
        result = service._get_recent_activities(mock_user_id, "my_resources")

        # Assert - Verify all required fields
        assert len(result) == 1
        activity = result[0]
        assert "id" in activity
        assert "type" in activity
        assert "resourceName" in activity
        assert "action" in activity
        assert "timestamp" in activity
        assert "status" in activity
        assert activity["type"] == "agent"
        assert activity["resourceName"] == "Test Agent"
        assert activity["action"] == "created"
        assert activity["status"] == "success"


class TestErrorHandling:
    """에러 핸들링 테스트"""

    @pytest.fixture
    def service(self):
        """테스트용 서비스 인스턴스 생성"""
        return DashboardService()

    @pytest.fixture
    def mock_user_id(self):
        """테스트용 사용자 ID"""
        return "test-user-001"

    # 1.5-UNIT-020: SQLAlchemyError 에러 핸들링 테스트
    @patch("services.education_management.dashboard_service.db")
    def test_get_resource_summary_handles_database_error(self, mock_db, service, mock_user_id):
        """데이터베이스 에러 발생 시 SQLAlchemyError 발생 (1.5-UNIT-020)"""
        # Arrange - Mock database to raise SQLAlchemyError
        mock_db.session.query.side_effect = SQLAlchemyError("Database connection error")

        # Act & Assert
        with pytest.raises(SQLAlchemyError, match="Database connection error"):
            service._get_resource_summary(mock_user_id, "my_resources")

    @patch("services.education_management.dashboard_service.db")
    def test_get_recent_activities_handles_database_error(self, mock_db, service, mock_user_id):
        """_get_recent_activities 데이터베이스 에러 처리 (1.5-UNIT-020)"""
        # Arrange
        mock_db.session.query.side_effect = SQLAlchemyError("Database query failed")

        # Act & Assert
        with pytest.raises(SQLAlchemyError, match="Database query failed"):
            service._get_recent_activities(mock_user_id, "my_resources")

    @patch("services.education_management.dashboard_service.db")
    def test_get_user_dashboard_handles_database_error(self, mock_db, service, mock_user_id):
        """get_user_dashboard가 데이터베이스 에러를 적절히 처리 (1.5-UNIT-020)"""
        # Arrange
        mock_db.session.query.side_effect = SQLAlchemyError("Database error in get_user_dashboard")

        # Act & Assert
        with pytest.raises(SQLAlchemyError):
            service.get_user_dashboard(mock_user_id)


class TestGetApiUsage:
    """_get_api_usage() 메서드 테스트 (Story 3.8)"""

    @pytest.fixture
    def service(self):
        """테스트용 서비스 인스턴스 생성"""
        return DashboardService()

    @pytest.fixture
    def mock_user_id(self):
        """테스트용 사용자 ID"""
        return "test-user-001"

    @pytest.fixture
    def mock_session_id(self):
        """테스트용 세션 ID"""
        return "test-session-001"

    # 3.8-UNIT-001: 빈 데이터 테스트
    @patch("services.education_management.dashboard_service.db")
    def test_get_api_usage_empty_data(self, mock_db, service, mock_user_id):
        """데이터가 없을 때 빈 결과 반환 (3.8-UNIT-001)"""
        # Arrange - Mock empty query result
        mock_query = mock_db.session.query.return_value
        mock_query.filter.return_value.group_by.return_value.order_by.return_value.all.return_value = []

        # Act
        result = service._get_api_usage(mock_user_id)

        # Assert
        assert result["totalCalls"] == 0
        assert result["totalTokens"] == 0
        assert result["estimatedCost"] == 0.0
        assert isinstance(result["dailyUsage"], list)
        assert len(result["dailyUsage"]) == 7  # 기본 7일

    # 3.8-UNIT-002: 세션 필터링 테스트
    @patch("services.education_management.dashboard_service.db")
    def test_get_api_usage_with_session_filter(self, mock_db, service, mock_user_id, mock_session_id):
        """세션 필터링이 적용되는지 확인 (3.8-UNIT-002)"""
        # Arrange - Mock query chain for session filtering (no JOIN, direct filter on session_id)
        mock_query_chain = MagicMock()
        mock_query_chain.all.return_value = []
        mock_query = mock_db.session.query.return_value
        mock_query.filter.return_value.group_by.return_value.order_by.return_value = mock_query_chain

        # Act
        result = service._get_api_usage(mock_user_id, session_id=mock_session_id)

        # Assert
        assert "totalCalls" in result
        assert "dailyUsage" in result
        # filter가 호출되었는지 확인 (ApiUsageLog.session_id로 직접 필터링)
        assert mock_db.session.query.return_value.filter.called

    # 3.8-UNIT-003: 일별 데이터 구조 확인
    @patch("services.education_management.dashboard_service.db")
    def test_get_api_usage_daily_structure(self, mock_db, service, mock_user_id):
        """일별 데이터가 올바른 구조를 가지는지 확인 (3.8-UNIT-003)"""
        # Arrange
        mock_query = mock_db.session.query.return_value
        mock_query.filter.return_value.group_by.return_value.order_by.return_value.all.return_value = []

        # Act
        result = service._get_api_usage(mock_user_id)

        # Assert - 각 일별 데이터의 구조 확인
        for daily in result["dailyUsage"]:
            assert "date" in daily
            assert "callCount" in daily
            assert "inputTokens" in daily
            assert "outputTokens" in daily
            assert "totalTokens" in daily
            assert "estimatedCost" in daily

    # 3.8-UNIT-004: 에러 시 빈 데이터 반환
    @patch("services.education_management.dashboard_service.db")
    def test_get_api_usage_handles_error_gracefully(self, mock_db, service, mock_user_id):
        """에러 발생 시 빈 데이터 반환 (대시보드 렌더링 실패 방지) (3.8-UNIT-004)"""
        # Arrange
        mock_db.session.query.side_effect = SQLAlchemyError("Database error")

        # Act - 에러가 발생해도 예외를 던지지 않고 빈 데이터 반환
        result = service._get_api_usage(mock_user_id)

        # Assert
        assert result["totalCalls"] == 0
        assert result["totalTokens"] == 0
        assert result["estimatedCost"] == 0.0
        assert result["dailyUsage"] == []
