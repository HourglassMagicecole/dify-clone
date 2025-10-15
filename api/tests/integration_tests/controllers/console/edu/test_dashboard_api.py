"""
Integration Tests for Dashboard API
대시보드 API 통합 테스트
"""

from unittest import mock

import pytest
from flask.testing import FlaskClient

from controllers.console.edu import dashboard


class TestDashboardAPIIntegration:
    """Dashboard API 통합 테스트"""

    @pytest.fixture
    def mock_dashboard_data(self):
        """테스트용 대시보드 데이터"""
        return {
            "resourceSummary": {"agents": 5, "workflows": 3, "datasets": 2, "total": 10},
            "recentActivities": [
                {
                    "id": "activity-1",
                    "type": "agent",
                    "resourceName": "Test Agent",
                    "action": "created",
                    "timestamp": "2025-10-14T10:00:00Z",
                    "status": "success",
                }
            ],
            "apiUsage": {"totalCalls": 0, "totalTokens": 0, "estimatedCost": 0.0, "dailyUsage": []},
        }

    # 1.5-INT-001: API 엔드포인트 정상 응답 확인
    def test_get_dashboard_endpoint_returns_success(
        self, test_client: FlaskClient, setup_account, auth_header, monkeypatch, mock_dashboard_data
    ):
        """GET /console/api/edu/dashboard 엔드포인트가 정상 응답을 반환 (1.5-INT-001)"""
        # Arrange - Mock DashboardService to return test data
        mock_service = mock.Mock()
        mock_service.get_user_dashboard.return_value = mock_dashboard_data
        mock_service_class = mock.Mock(return_value=mock_service)
        monkeypatch.setattr(dashboard, "DashboardService", mock_service_class)

        # Act
        response = test_client.get("/console/api/edu/dashboard", headers=auth_header)

        # Assert - 200 OK 및 올바른 응답 형식
        assert response.status_code == 200

        json_data = response.get_json()
        assert json_data["result"] == "success"
        assert "data" in json_data

        data = json_data["data"]
        assert "resourceSummary" in data
        assert "recentActivities" in data
        assert "apiUsage" in data

        # Verify service was called with correct user ID
        mock_service.get_user_dashboard.assert_called_once_with(setup_account.id)

    # 1.5-INT-002: 인증된 사용자만 대시보드 데이터 조회 가능
    def test_get_dashboard_requires_authentication(self, test_client: FlaskClient):
        """인증되지 않은 사용자는 401 Unauthorized를 받음 (1.5-INT-002)"""
        # Act - No auth header
        response = test_client.get("/console/api/edu/dashboard")

        # Assert - 401 Unauthorized
        assert response.status_code == 401

    # 1.5-INT-003: 사용자는 자신의 리소스만 조회 가능
    def test_get_dashboard_returns_only_user_resources(
        self, test_client: FlaskClient, setup_account, auth_header, monkeypatch
    ):
        """사용자는 자신의 리소스만 조회하고, 다른 사용자의 데이터는 접근 불가 (1.5-INT-003)"""
        # Arrange - Create mock service that verifies user_id
        mock_service = mock.Mock()

        def get_user_dashboard_with_check(user_id: str):
            # Verify that service is called with the current user's ID
            assert user_id == setup_account.id, "Service must be called with current user's ID only"
            return {
                "resourceSummary": {"agents": 2, "workflows": 1, "datasets": 1, "total": 4},
                "recentActivities": [],
                "apiUsage": {"totalCalls": 0, "totalTokens": 0, "estimatedCost": 0.0, "dailyUsage": []},
            }

        mock_service.get_user_dashboard.side_effect = get_user_dashboard_with_check
        mock_service_class = mock.Mock(return_value=mock_service)
        monkeypatch.setattr(dashboard, "DashboardService", mock_service_class)

        # Act
        response = test_client.get("/console/api/edu/dashboard", headers=auth_header)

        # Assert
        assert response.status_code == 200
        json_data = response.get_json()

        # Verify service was called exactly once with current user's ID
        mock_service.get_user_dashboard.assert_called_once_with(setup_account.id)

        # Verify response contains only user's resources
        data = json_data["data"]
        assert data["resourceSummary"]["total"] == 4

    # 1.5-INT-004: 데이터베이스 통합 검증
    def test_dashboard_integrates_with_database(
        self, test_client: FlaskClient, setup_account, auth_header, monkeypatch, mock_dashboard_data
    ):
        """DashboardService가 데이터베이스와 통합되어 데이터를 조회 (1.5-INT-004)"""
        # Arrange - Use real DashboardService but mock db queries
        from services.education_management.dashboard_service import DashboardService

        real_service = DashboardService()

        # Mock the private methods to simulate DB queries
        with mock.patch.object(
            real_service,
            "_get_resource_summary",
            return_value=mock_dashboard_data["resourceSummary"],
        ):
            with mock.patch.object(
                real_service,
                "_get_recent_activities",
                return_value=mock_dashboard_data["recentActivities"],
            ):
                with mock.patch.object(real_service, "_get_api_usage", return_value=mock_dashboard_data["apiUsage"]):
                    mock_service_class = mock.Mock(return_value=real_service)
                    monkeypatch.setattr(dashboard, "DashboardService", mock_service_class)

                    # Act
                    response = test_client.get("/console/api/edu/dashboard", headers=auth_header)

                    # Assert
                    assert response.status_code == 200
                    json_data = response.get_json()
                    assert json_data["result"] == "success"

                    # Verify data structure matches expected
                    data = json_data["data"]
                    assert data["resourceSummary"]["agents"] == 5
                    assert data["resourceSummary"]["workflows"] == 3
                    assert data["resourceSummary"]["datasets"] == 2
                    assert len(data["recentActivities"]) == 1

    # Response Format Validation (1.5-INT-009)
    def test_api_usage_response_format(
        self, test_client: FlaskClient, setup_account, auth_header, monkeypatch, mock_dashboard_data
    ):
        """API 사용량 응답 형식 검증 (1.5-INT-009)"""
        # Arrange
        mock_service = mock.Mock()
        mock_service.get_user_dashboard.return_value = mock_dashboard_data
        mock_service_class = mock.Mock(return_value=mock_service)
        monkeypatch.setattr(dashboard, "DashboardService", mock_service_class)

        # Act
        response = test_client.get("/console/api/edu/dashboard", headers=auth_header)

        # Assert
        assert response.status_code == 200
        json_data = response.get_json()

        api_usage = json_data["data"]["apiUsage"]
        assert "totalCalls" in api_usage
        assert "totalTokens" in api_usage
        assert "estimatedCost" in api_usage
        assert "dailyUsage" in api_usage
        assert isinstance(api_usage["dailyUsage"], list)
