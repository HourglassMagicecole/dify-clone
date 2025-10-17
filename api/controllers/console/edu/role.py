"""Education role management API endpoints."""

import logging

from flask import Blueprint, jsonify, request
from flask_login import current_user, login_required
from sqlalchemy import select

from extensions.ext_database import db
from models.education.session import EducationSession
from services.edu.session_helper import get_user_active_session
from services.edu_role_service import EduRoleService
from services.edu_session_member_service import EduSessionMemberService

logger = logging.getLogger(__name__)

bp = Blueprint("edu_role", __name__, url_prefix="/console/api/edu/user")


@bp.route("/role", methods=["GET"])
@login_required
def get_user_role():
    """
    현재 사용자의 역할 조회 (AC3 - 세션-사용자 연결 검증 포함).

    Query Parameters:
        session_id: 교육 세션 ID 또는 session_tag (optional, 없으면 사용자의 활성 세션 자동 조회)

    Returns:
        200: {
          "result": "success",
          "data": {
            "role": "admin" | "normal",
            "account_id": "user-uuid",
            "session_id": "session-uuid"
          }
        }
        403: 세션 멤버가 아님 (Story 1.1 완료 후 활성화)
        404: 활성 세션을 찾을 수 없음
        500: 서버 오류

    Security:
        - AC11 (SEC-003 완화 - Story 1.1 의존성): 세션-사용자 연결 검증 TODO 추가
    """
    session_id_param = request.args.get("session_id")

    try:
        # 세션 ID 결정: 파라미터로 제공되거나, session_tag로 조회하거나, 사용자의 활성 세션 찾기
        actual_session_id = None
        session = None

        if session_id_param:
            # 1. UUID로 직접 조회 시도
            session = db.session.scalar(select(EducationSession).where(EducationSession.id == session_id_param))

            # 2. session_tag로 조회 시도
            if not session:
                session = db.session.scalar(
                    select(EducationSession).where(EducationSession.session_tag == session_id_param)
                )

        # 3. 파라미터가 없거나 세션을 찾지 못한 경우 → 사용자의 활성 세션 자동 조회
        if not session:
            session = get_user_active_session(current_user.id)

        if session:
            actual_session_id = session.id

        # 세션을 찾지 못한 경우
        if not actual_session_id:
            logger.warning(
                "No active session found for user - account_id: %s, provided_session_id: %s",
                current_user.id,
                session_id_param,
            )
            return jsonify({"result": "fail", "message": "No active session found for this user"}), 404

        # 세션 멤버십 검증 (SEC-003 완화)
        if not EduSessionMemberService.is_session_member(
            session_id=actual_session_id,
            account_id=current_user.id,
            db_session=db.session,  # type: ignore[arg-type]
        ):
            logger.warning(
                "SEC-003: Non-member access attempt - session_id: %s, account_id: %s",
                actual_session_id,
                current_user.id,
            )
            return jsonify({"result": "fail", "message": "You are not a member of this session"}), 403

        # 역할 조회
        role = EduRoleService.get_user_role(
            session_id=actual_session_id,
            account_id=current_user.id,
            db_session=db.session,  # type: ignore[arg-type]
        )

        return (
            jsonify(
                {
                    "result": "success",
                    "data": {"role": role, "account_id": current_user.id, "session_id": actual_session_id},
                }
            ),
            200,
        )

    except Exception as e:
        logger.exception("Failed to fetch user role for account_id: %s", current_user.id)
        return jsonify({"result": "fail", "message": str(e)}), 500
