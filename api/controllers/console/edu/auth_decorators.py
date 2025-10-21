"""Education module authorization decorators."""

from collections.abc import Callable
from functools import wraps
from typing import ParamSpec, TypeVar

from flask import abort, request
from werkzeug.exceptions import Unauthorized

from extensions.ext_database import db
from libs.passport import PassportService
from models.account import Account, TenantAccountJoin, TenantAccountRole

P = ParamSpec("P")
R = TypeVar("R")


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

        # 현재 사용자의 Tenant 역할 조회 (Dify 기존 시스템 사용)
        tenant_join = db.session.query(TenantAccountJoin).filter_by(account_id=account.id).first()

        if not tenant_join:
            abort(403, "No tenant membership found")

        # Admin 또는 Owner 역할만 허용
        try:
            role = TenantAccountRole(tenant_join.role)
        except ValueError:
            abort(403, "Invalid role")

        if not TenantAccountRole.is_privileged_role(role):
            abort(403, "Admin permission required")

        return view(*args, **kwargs)

    return decorated
