"""Education module authorization decorators."""

from collections.abc import Callable
from functools import wraps
from typing import Any, ParamSpec, TypeVar

from flask import abort, request
from werkzeug.exceptions import Unauthorized

from extensions.ext_database import db
from libs.passport import PassportService
from models.account import Account, TenantAccountJoin, TenantAccountRole

P = ParamSpec("P")
R = TypeVar("R")


def _get_tenant_join(account: Account) -> TenantAccountJoin:
    """
    사용자의 TenantAccountJoin을 조회하고 request context에 캐싱합니다.

    이 함수는 성능 최적화를 위해 request 당 한 번만 DB 조회를 수행하고,
    결과를 request._tenant_join_cache에 저장합니다 (PERF-001 완화).

    Args:
        account: Account 객체

    Returns:
        TenantAccountJoin 객체

    Raises:
        403: Tenant 멤버십을 찾을 수 없는 경우
    """
    # 캐시 확인 (request context에서)
    cache_key = f"_tenant_join_cache_{account.id}"
    cached_join = getattr(request, cache_key, None)
    if cached_join is not None:
        return cached_join

    # current=True로 현재 활성 tenant만 확인
    tenant_join = db.session.query(TenantAccountJoin).filter_by(account_id=account.id, current=True).first()

    # Fallback: current=True가 없으면 첫 번째 tenant 사용
    if not tenant_join:
        all_joins = db.session.query(TenantAccountJoin).filter_by(account_id=account.id).all()
        if all_joins:
            tenant_join = all_joins[0]
        else:
            abort(403, "No tenant membership found")

    # 캐시 저장
    setattr(request, cache_key, tenant_join)
    return tenant_join


def jwt_required(view: Callable[P, R]) -> Callable[P, R]:
    """
    JWT 토큰 인증 데코레이터.

    Authorization 헤더에서 Bearer 토큰을 추출하고 검증합니다.
    검증된 사용자 정보를 request.user에 저장합니다.

    Args:
        view: 데코레이트할 뷰 함수

    Returns:
        데코레이트된 함수

    Raises:
        401: JWT 토큰이 없거나 유효하지 않은 경우
    """

    @wraps(view)
    def decorated(*args: P.args, **kwargs: P.kwargs) -> R:
        # Authorization 헤더에서 토큰 추출
        auth_header = request.headers.get("Authorization")
        if not auth_header:
            raise Unauthorized("Missing authorization header")

        # Bearer 토큰 형식 확인
        parts = auth_header.split()
        if len(parts) != 2 or parts[0].lower() != "bearer":
            raise Unauthorized("Invalid authorization header format")

        token = parts[1]

        # JWT 토큰 검증
        try:
            payload = PassportService().verify(token)
        except Unauthorized:
            raise

        # 사용자 ID로 Account 조회
        user_id = payload.get("user_id")
        if not user_id:
            raise Unauthorized("Invalid token payload")

        account = db.session.query(Account).filter_by(id=user_id).first()
        if not account:
            raise Unauthorized("User not found")

        # request에 사용자 정보 저장 (뷰 함수에서 사용 가능)
        request.user = account

        return view(*args, **kwargs)

    return decorated


def admin_required(view: Callable[P, R]) -> Callable[P, R]:
    """
    관리자 권한 검증 데코레이터.

    jwt_required 데코레이터와 함께 사용하여,
    현재 사용자가 Dify의 기존 역할 시스템(TenantAccountRole)에서
    관리자 역할(owner, admin)을 가지고 있는지 확인합니다.

    Args:
        view: 데코레이트할 뷰 함수

    Returns:
        데코레이트된 함수

    Raises:
        403: 관리자 권한이 없는 사용자

    Note:
        이 데코레이터는 반드시 @jwt_required와 함께 사용해야 합니다.
    """

    @wraps(view)
    def decorated(*args: P.args, **kwargs: P.kwargs) -> R:
        # jwt_required에서 설정한 request.user 사용
        account = getattr(request, "user", None)
        if not account:
            abort(401, "Authentication required")

        # 캐시된 TenantAccountJoin 조회 (PERF-001 완화)
        tenant_join = _get_tenant_join(account)

        # Admin 또는 Owner 역할만 허용
        try:
            role = TenantAccountRole(tenant_join.role)
        except ValueError:
            abort(403, "Invalid role")

        if not TenantAccountRole.is_privileged_role(role):
            abort(403, "Admin permission required")

        # Store tenant_id in request for use in view functions
        request.tenant_id = tenant_join.tenant_id

        return view(*args, **kwargs)

    return decorated


def owner_required(view: Callable[P, R]) -> Callable[P, R]:
    """
    소유자 권한 검증 데코레이터.

    jwt_required와 함께 사용하여, 현재 사용자가
    TenantAccountRole.OWNER 역할을 가지고 있는지 확인합니다.

    Args:
        view: 데코레이트할 뷰 함수

    Returns:
        데코레이트된 함수

    Raises:
        403: 소유자 권한이 없는 사용자

    Note:
        이 데코레이터는 반드시 @jwt_required와 함께 사용해야 합니다.

    Example:
        @bp.route('/admin-only', methods=['GET'])
        @jwt_required
        @owner_required
        def admin_only_endpoint():
            return jsonify({"message": "Owner only"})
    """

    @wraps(view)
    def decorated(*args: P.args, **kwargs: P.kwargs) -> R:
        # jwt_required에서 설정한 request.user 사용
        account = getattr(request, "user", None)
        if not account:
            abort(401, "Authentication required")

        # 캐시된 TenantAccountJoin 조회 (PERF-001 완화)
        tenant_join = _get_tenant_join(account)

        # Owner 역할만 허용
        try:
            role = TenantAccountRole(tenant_join.role)
        except ValueError:
            abort(403, "Invalid role")

        if role != TenantAccountRole.OWNER:
            abort(403, "Owner permission required")

        # Store tenant_id in request for use in view functions
        request.tenant_id = tenant_join.tenant_id

        return view(*args, **kwargs)

    return decorated


def admin_or_owner_required(view: Callable[P, R]) -> Callable[P, R]:
    """
    관리자 또는 소유자 권한 검증 데코레이터.

    jwt_required와 함께 사용하여, 현재 사용자가
    TenantAccountRole.ADMIN 또는 TenantAccountRole.OWNER 역할을
    가지고 있는지 확인합니다.

    Args:
        view: 데코레이트할 뷰 함수

    Returns:
        데코레이트된 함수

    Raises:
        403: 관리자 또는 소유자 권한이 없는 사용자

    Note:
        이 데코레이터는 반드시 @jwt_required와 함께 사용해야 합니다.
        기존 @admin_required와 동일한 로직입니다 (호환성 유지).

    Example:
        @bp.route('/sessions', methods=['GET'])
        @jwt_required
        @admin_or_owner_required
        def list_sessions():
            # 관리자와 소유자 모두 접근 가능
            return jsonify({"sessions": []})
    """
    # 기존 admin_required와 동일한 로직 (OWNER, ADMIN 모두 허용)
    # 코드는 admin_required와 동일하므로 재사용
    return admin_required(view)


def owner_or_creator_required(resource_getter: Callable[[str], Any]) -> Callable[[Callable[P, R]], Callable[P, R]]:
    """
    소유자 또는 리소스 생성자 권한 검증 데코레이터 팩토리.

    jwt_required와 함께 사용하여, 현재 사용자가:
    1. TenantAccountRole.OWNER 역할을 가지고 있거나
    2. 해당 리소스의 생성자(creator)인지 확인합니다.

    Args:
        resource_getter: 리소스 ID로 리소스 객체를 조회하는 함수
            - 함수 시그니처: (resource_id: str) -> Resource
            - Resource는 instructor_account_id 또는 created_by 속성을 가져야 함

    Returns:
        데코레이터 함수

    Raises:
        403: 소유자도 아니고 생성자도 아닌 경우
        404: 리소스를 찾을 수 없는 경우

    Note:
        이 데코레이터는 반드시 @jwt_required와 함께 사용해야 합니다.
        URL 파라미터에서 리소스 ID를 추출합니다 (예: session_id, user_id).

    Example:
        # 세션 수정 엔드포인트
        def get_session_by_id(session_id: str):
            return db.session.get(EducationSession, session_id)

        @bp.route('/sessions/<session_id>', methods=['PUT'])
        @jwt_required
        @owner_or_creator_required(get_session_by_id)
        def update_session(session_id: str):
            # 소유자 또는 세션 생성자만 접근 가능
            return jsonify({"message": "Updated"})
    """

    def decorator(view: Callable[P, R]) -> Callable[P, R]:
        @wraps(view)
        def decorated(*args: P.args, **kwargs: P.kwargs) -> R:
            # jwt_required에서 설정한 request.user 사용
            account = getattr(request, "user", None)
            if not account:
                abort(401, "Authentication required")

            # 캐시된 TenantAccountJoin 조회 (PERF-001 완화)
            tenant_join = _get_tenant_join(account)

            try:
                role = TenantAccountRole(tenant_join.role)
            except ValueError:
                abort(403, "Invalid role")

            # 소유자는 항상 허용
            if role == TenantAccountRole.OWNER:
                request.tenant_id = tenant_join.tenant_id
                return view(*args, **kwargs)

            # 관리자는 생성자 확인
            # URL 파라미터에서 리소스 ID 추출 (첫 번째 파라미터 또는 kwargs)
            resource_id: str | None = None
            if args:
                resource_id = str(args[0])
            elif kwargs:
                # session_id, user_id 등 가능한 파라미터 이름들
                for key in ["session_id", "user_id", "id"]:
                    if key in kwargs:
                        resource_id = str(kwargs[key])
                        break

            if not resource_id:
                abort(400, "Resource ID not provided")

            # 리소스 조회
            try:
                resource = resource_getter(resource_id)
            except ValueError as e:
                abort(404, str(e))

            if not resource:
                abort(404, "Resource not found")

            # 생성자 확인 (instructor_account_id 또는 created_by)
            creator_id = None
            if hasattr(resource, "instructor_account_id"):
                creator_id = resource.instructor_account_id
            elif hasattr(resource, "created_by"):
                creator_id = resource.created_by
            else:
                abort(500, "Resource does not have creator information")

            if creator_id != account.id:
                abort(403, "You can only access resources you created")

            request.tenant_id = tenant_join.tenant_id
            return view(*args, **kwargs)

        return decorated

    return decorator


__all__ = [
    "admin_or_owner_required",
    "admin_required",
    "jwt_required",
    "owner_or_creator_required",
    "owner_required",
]
