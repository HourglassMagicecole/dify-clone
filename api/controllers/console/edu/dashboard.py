"""
Dashboard API Controller
대시보드 데이터를 제공하는 API 컨트롤러
"""

from flask import Blueprint, abort, jsonify, request

from controllers.console.edu.auth_decorators import jwt_required
from extensions.ext_database import db
from models.account import TenantAccountJoin, TenantAccountRole
from services.education_management.dashboard_service import DashboardService

bp = Blueprint("edu_dashboard", __name__, url_prefix="/console/api/edu/dashboard")


@bp.route("", methods=["GET"])
@jwt_required
def get_dashboard_data():
    """
    사용자 대시보드 데이터 조회 (역할별 필터링 지원)

    모든 역할(Owner, Admin, Student)이 접근 가능하지만,
    역할에 따라 반환되는 데이터가 다름:
    - Owner: 전체 시스템 리소스 (scope: "system"), admin_id로 특정 관리자의 리소스 필터링 가능
    - Admin/Student: 본인 리소스만 (scope: "my_resources"), 세션별 필터링

    Query Parameters:
        session_id (optional): 세션 ID (Admin/Student용)
        admin_id (optional): 관리자 ID (Owner 전용, 특정 관리자의 리소스만 필터링)

    Returns:
        JSON 응답: {
            'result': 'success',
            'data': {
                'scope': 'system' | 'my_resources',
                'resourceSummary': {...},
                'recentActivities': [...],
                'apiUsage': {...}
            }
        }
    """
    # jwt_required에서 설정한 request.user 사용
    account = request.user

    # 쿼리 파라미터 추출
    session_id = request.args.get("session_id")
    admin_id = request.args.get("admin_id")

    # 사용자의 역할 확인
    tenant_join = db.session.query(TenantAccountJoin).filter_by(account_id=account.id, current=True).first()

    if not tenant_join:
        # Fallback: current=True가 없으면 첫 번째 tenant 사용
        tenant_join = db.session.query(TenantAccountJoin).filter_by(account_id=account.id).first()

    if not tenant_join:
        abort(403, "No tenant membership found")

    role = TenantAccountRole(tenant_join.role)

    # Validate that only Owner can use admin_id parameter (Security: Defense-in-Depth)
    if admin_id and role != TenantAccountRole.OWNER:
        abort(403, "Only owners can filter by admin_id")

    # DashboardService 호출 (역할, 세션 ID, 관리자 ID 전달)
    service = DashboardService()
    data = service.get_user_dashboard(account.id, role, session_id=session_id, admin_id=admin_id)

    return jsonify({"result": "success", "data": data})
