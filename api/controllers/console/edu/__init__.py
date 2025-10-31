"""Education management controllers."""

from functools import wraps

from flask import jsonify, request
from flask_login import current_user

from extensions.ext_database import db
from services.edu_role_service import EduRoleService


def require_admin(f):
    """
    관리자 권한 검증 데코레이터 (AC10 - SEC-001 완화).

    이 데코레이터가 적용된 API 엔드포인트는 admin 역할만 접근 가능합니다.
    Frontend의 ProtectedRoute만으로는 보안이 불충분하므로,
    Backend API에서도 권한을 검증하여 curl/Postman 등의 직접 호출을 차단합니다.

    Raises:
        400: session_id가 누락된 경우
        403: 사용자가 admin 역할이 아닌 경우

    Usage:
        @bp.route('/admin-only', methods=['POST'])
        @login_required
        @require_admin
        def admin_only_endpoint():
            # ...

    Security:
        - SEC-001 완화: Backend API 보호로 Frontend 우회 공격 방지
    """

    @wraps(f)
    def decorated_function(*args, **kwargs):
        # session_id 추출 (URL path parameter, query parameter, 또는 JSON body)
        session_id = (
            kwargs.get("session_id")  # URL path parameter (e.g., /<session_id>/members)
            or request.args.get("session_id")  # Query parameter
            or (request.json.get("session_id") if request.is_json and request.json else None)  # JSON body
        )

        if not session_id:
            return jsonify({"result": "fail", "message": "session_id is required"}), 400

        # 사용자 역할 조회
        user_role = EduRoleService.get_user_role(
            session_id=session_id,
            account_id=current_user.id,
            db_session=db.session,  # type: ignore[arg-type]
        )

        # admin 권한 검증
        if user_role != "admin":
            return jsonify({"result": "fail", "message": "Admin permission required"}), 403

        return f(*args, **kwargs)

    return decorated_function


# Import blueprints
# Import Resource-based APIs (auto-registers via api.add_resource)
from . import tools  # pyright: ignore[reportUnusedImport]
from .api_key import bp as api_key_bp
from .resource_tags import bp as resource_tags_bp
from .role import bp as role_bp
from .session import bp as session_bp
from .users import bp as users_bp

__all__ = ["api_key_bp", "require_admin", "resource_tags_bp", "role_bp", "session_bp", "users_bp"]
