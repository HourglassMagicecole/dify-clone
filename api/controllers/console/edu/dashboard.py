"""
Dashboard API Controller
대시보드 데이터를 제공하는 API 컨트롤러
"""

from flask import Blueprint, jsonify
from flask_login import current_user, login_required

from services.education_management.dashboard_service import DashboardService

bp = Blueprint("edu_dashboard", __name__, url_prefix="/console/api/edu/dashboard")


@bp.route("", methods=["GET"])
@login_required
def get_dashboard_data():
    """
    사용자 대시보드 데이터 조회

    Returns:
        JSON 응답: {
            'result': 'success',
            'data': {
                'resourceSummary': {...},
                'recentActivities': [...],
                'apiUsage': {...}
            }
        }
    """
    service = DashboardService()
    data = service.get_user_dashboard(current_user.id)
    return jsonify({"result": "success", "data": data})
