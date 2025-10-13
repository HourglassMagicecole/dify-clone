"""Education role management API endpoints."""

from flask import Blueprint, jsonify, request
from flask_login import current_user, login_required

from extensions.ext_database import db
from services.edu_role_service import EduRoleService

bp = Blueprint("edu_role", __name__, url_prefix="/console/api/edu/user")


@bp.route("/role", methods=["GET"])
@login_required
def get_user_role():
    """
    현재 사용자의 역할 조회 (AC3 - 세션-사용자 연결 검증 포함).

    Query Parameters:
        session_id: 교육 세션 ID (required)

    Returns:
        200: {
          "result": "success",
          "data": {
            "role": "admin" | "normal",
            "account_id": "user-uuid",
            "session_id": "session-uuid"
          }
        }
        400: session_id 누락
        403: 세션 멤버가 아님 (Story 1.1 완료 후 활성화)
        500: 서버 오류

    Security:
        - AC11 (SEC-003 완화 - Story 1.1 의존성): 세션-사용자 연결 검증 TODO 추가
    """
    session_id = request.args.get("session_id")

    if not session_id:
        return jsonify({"result": "fail", "message": "session_id is required"}), 400

    try:
        # TODO (AC11 - SEC-003 완화): Story 1.1 완료 후 세션-사용자 연결 검증 추가
        # 현재는 세션 멤버십 검증을 하지 않아, 사용자가 다른 세션 ID로 역할 조회 가능
        # Story 1.1에서 EducationSessionMember 테이블 생성 후 아래 코드 활성화 필요
        #
        # from models.education import EducationSessionMember
        #
        # session_member = db.session.query(EducationSessionMember).filter(
        #     EducationSessionMember.session_id == session_id,
        #     EducationSessionMember.account_id == current_user.id
        # ).first()
        #
        # if not session_member:
        #     return jsonify({
        #         "result": "fail",
        #         "message": "You are not a member of this session"
        #     }), 403

        # 역할 조회
        role = EduRoleService.get_user_role(
            session_id=session_id,
            account_id=current_user.id,
            db_session=db.session,  # type: ignore[arg-type]
        )

        return (
            jsonify(
                {"result": "success", "data": {"role": role, "account_id": current_user.id, "session_id": session_id}}
            ),
            200,
        )

    except Exception as e:
        return jsonify({"result": "fail", "message": str(e)}), 500
