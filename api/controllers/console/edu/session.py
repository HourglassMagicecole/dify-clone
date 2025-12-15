"""Education session management API endpoints."""

from datetime import UTC, datetime

from flask import Blueprint, jsonify, request
from pydantic import BaseModel, Field

from controllers.console.edu.auth_decorators import (
    admin_required,
    jwt_required,
    owner_or_creator_required,
)
from services.edu.session_helper import is_session_currently_active
from services.edu.session_service import EduSessionService

bp = Blueprint("edu_sessions", __name__, url_prefix="/console/api/edu/sessions")


# Helper function for owner_or_creator_required decorator
def _get_session_by_id(session_id: str):
    """세션 조회 헬퍼 함수 (owner_or_creator_required용)."""
    service = EduSessionService()
    return service.get_session(session_id)


# Pydantic 요청/응답 모델
class CreateSessionRequest(BaseModel):
    """세션 생성 요청 모델."""

    session_name: str = Field(..., min_length=1, max_length=255)
    session_tag: str = Field(..., min_length=1, max_length=100, pattern=r"^[a-z0-9-_]+$")
    start_date: str = Field(..., description="ISO 8601 format")
    end_date: str | None = Field(None, description="ISO 8601 format")
    max_students: int = Field(default=50, ge=1, le=1000)
    description: str | None = Field(None, max_length=1000)


class UpdateSessionRequest(BaseModel):
    """세션 수정 요청 모델."""

    session_name: str | None = Field(None, min_length=1, max_length=255)
    start_date: str | None = Field(None, description="ISO 8601 format")
    end_date: str | None = Field(None, description="ISO 8601 format")
    max_students: int | None = Field(None, ge=1, le=1000)
    is_active: bool | None = None
    force_status: bool | None = Field(
        default=None,
        description="Override date-based activation: null=auto, true=force active, false=force inactive",
    )
    description: str | None = Field(None, max_length=1000)


class AddMemberRequest(BaseModel):
    """세션 멤버 추가 요청 모델."""

    account_id: str = Field(..., description="Account UUID")


@bp.route("", methods=["POST"])
@jwt_required
@admin_required
def create_session():
    """
    세션 생성 (관리자만).

    Request Body:
        session_name (str): 세션 이름
        session_tag (str): 세션 태그 (unique, a-z0-9-_)
        start_date (str): 시작일 (ISO 8601)
        end_date (str, optional): 종료일 (ISO 8601)
        max_students (int, optional): 최대 학생 수 (default: 50)
        description (str, optional): 설명

    Returns:
        JSON: 생성된 세션 정보
    """
    if not request.json:
        return jsonify({"result": "error", "message": "Request body is required"}), 400

    try:
        data = CreateSessionRequest(**request.json)
    except Exception as e:
        return jsonify({"result": "error", "message": f"Invalid request data: {e!s}"}), 400

    try:
        service = EduSessionService()

        # Parse dates
        start_date = datetime.fromisoformat(data.start_date)
        end_date = None
        if data.end_date:
            end_date = datetime.fromisoformat(data.end_date)

        # Create session
        session = service.create_session(
            session_name=data.session_name,
            session_tag=data.session_tag,
            start_date=start_date,
            tenant_id=request.tenant_id,
            instructor_account_id=request.user.id,
            end_date=end_date,
            max_students=data.max_students,
            description=data.description,
        )

        return (
            jsonify(
                {
                    "result": "success",
                    "data": {
                        "id": session.id,
                        "session_name": session.session_name,
                        "session_tag": session.session_tag,
                        "instructor_account_id": session.instructor_account_id,
                        "start_date": session.start_date.replace(tzinfo=UTC).isoformat(),
                        "end_date": session.end_date.replace(tzinfo=UTC).isoformat() if session.end_date else None,
                        "max_students": session.max_students,
                        "is_active": session.is_active,
                        "force_status": session.force_status,
                        "is_currently_active": is_session_currently_active(session),
                        "description": session.description,
                        "created_at": session.created_at.replace(tzinfo=UTC).isoformat(),
                    },
                }
            ),
            201,
        )

    except ValueError as e:
        return jsonify({"result": "error", "message": str(e)}), 400
    except Exception as e:
        return jsonify({"result": "error", "message": f"Failed to create session: {e!s}"}), 500


@bp.route("", methods=["GET"])
@jwt_required
def list_sessions():
    """
    세션 목록 조회.

    Permission:
        - Owner: 모든 세션 조회
        - Admin: 자신이 생성한 세션만 조회
        - Others (Editor, Normal 등): 자신이 멤버로 등록된 세션만 조회

    Query Parameters:
        is_active (bool, optional): 활성 상태 필터 (true/false)
        page (int, optional): 페이지 번호 (default: 1)
        limit (int, optional): 페이지당 항목 수 (default: 20)

    Returns:
        JSON: 세션 목록 및 페이지네이션 정보
    """
    # Parse query parameters
    is_active = request.args.get("is_active", None)
    if is_active is not None:
        is_active = is_active.lower() == "true"

    page = request.args.get("page", 1, type=int)
    limit = request.args.get("limit", 20, type=int)

    try:
        service = EduSessionService()

        # Permission filtering is handled in service layer
        result = service.list_sessions(current_user=request.user, is_active=is_active, page=page, limit=limit)

        # Convert sessions to dict
        sessions_data = []
        for session in result["sessions"]:
            # Get instructor info from relationship
            instructor_name = session.instructor.name if session.instructor else None
            instructor_email = session.instructor.email if session.instructor else None

            sessions_data.append(
                {
                    "id": session.id,
                    "session_name": session.session_name,
                    "session_tag": session.session_tag,
                    "instructor_account_id": session.instructor_account_id,
                    "instructor_name": instructor_name,
                    "instructor_email": instructor_email,
                    "start_date": session.start_date.replace(tzinfo=UTC).isoformat(),
                    "end_date": session.end_date.replace(tzinfo=UTC).isoformat() if session.end_date else None,
                    "max_students": session.max_students,
                    "is_active": session.is_active,
                    "force_status": session.force_status,
                    "is_currently_active": is_session_currently_active(session),
                    "description": session.description,
                    "created_at": session.created_at.replace(tzinfo=UTC).isoformat(),
                }
            )

        return jsonify(
            {
                "result": "success",
                "data": {
                    "sessions": sessions_data,
                    "total": result["total"],
                    "page": result["page"],
                    "limit": result["limit"],
                },
            }
        )

    except Exception as e:
        return jsonify({"result": "error", "message": f"Failed to list sessions: {e!s}"}), 500


@bp.route("/<string:session_id>", methods=["GET"])
@jwt_required
@owner_or_creator_required(_get_session_by_id)
def get_session(session_id: str):
    """
    세션 상세 조회 (소유자 또는 생성자만).

    Permission:
        - Owner: 모든 세션 조회 가능
        - Admin: 자신이 생성한 세션만 조회 가능

    Args:
        session_id: Session UUID

    Returns:
        JSON: 세션 상세 정보
    """
    try:
        service = EduSessionService()
        session = service.get_session(session_id)

        # Permission is checked by @owner_or_creator_required decorator

        return jsonify(
            {
                "result": "success",
                "data": {
                    "id": session.id,
                    "session_name": session.session_name,
                    "session_tag": session.session_tag,
                    "tenant_id": session.tenant_id,
                    "instructor_account_id": session.instructor_account_id,
                    "start_date": session.start_date.replace(tzinfo=UTC).isoformat(),
                    "end_date": session.end_date.replace(tzinfo=UTC).isoformat() if session.end_date else None,
                    "max_students": session.max_students,
                    "is_active": session.is_active,
                    "force_status": session.force_status,
                    "is_currently_active": is_session_currently_active(session),
                    "description": session.description,
                    "created_at": session.created_at.replace(tzinfo=UTC).isoformat(),
                    "updated_at": session.updated_at.replace(tzinfo=UTC).isoformat(),
                },
            }
        )

    except ValueError as e:
        return jsonify({"result": "error", "message": str(e)}), 404
    except Exception as e:
        return jsonify({"result": "error", "message": f"Failed to get session: {e!s}"}), 500


@bp.route("/<string:session_id>", methods=["PUT"])
@jwt_required
@owner_or_creator_required(_get_session_by_id)
def update_session(session_id: str):
    """
    세션 수정 (소유자 또는 생성자만).

    Permission:
        - Owner: 모든 세션 수정 가능
        - Admin: 자신이 생성한 세션만 수정 가능

    Args:
        session_id: Session UUID

    Request Body:
        session_name (str, optional): 새 세션 이름
        start_date (str, optional): 새 시작일 (ISO 8601)
        end_date (str, optional): 새 종료일 (ISO 8601)
        max_students (int, optional): 새 최대 학생 수
        is_active (bool, optional): 새 활성 상태
        description (str, optional): 새 설명

    Returns:
        JSON: 수정된 세션 정보
    """
    if not request.json:
        return jsonify({"result": "error", "message": "Request body is required"}), 400

    try:
        data = UpdateSessionRequest(**request.json)
    except Exception as e:
        return jsonify({"result": "error", "message": f"Invalid request data: {e!s}"}), 400

    try:
        service = EduSessionService()

        # Permission is checked by @owner_or_creator_required decorator

        # Parse dates if provided
        start_date = None
        end_date = None
        if data.start_date:
            start_date = datetime.fromisoformat(data.start_date)
        if data.end_date:
            end_date = datetime.fromisoformat(data.end_date)

        # Determine if force_status was explicitly provided in request
        # Check the raw request.json to see if the key was present
        from services.edu.session_service import UNSET

        force_status_value = UNSET
        if request.json and "force_status" in request.json:
            force_status_value = data.force_status

        # Update session
        session = service.update_session(
            session_id=session_id,
            session_name=data.session_name,
            start_date=start_date,
            end_date=end_date,
            max_students=data.max_students,
            is_active=data.is_active,
            force_status=force_status_value,
            description=data.description,
        )

        return jsonify(
            {
                "result": "success",
                "data": {
                    "id": session.id,
                    "session_name": session.session_name,
                    "session_tag": session.session_tag,
                    "start_date": session.start_date.replace(tzinfo=UTC).isoformat(),
                    "end_date": session.end_date.replace(tzinfo=UTC).isoformat() if session.end_date else None,
                    "max_students": session.max_students,
                    "is_active": session.is_active,
                    "force_status": session.force_status,
                    "is_currently_active": is_session_currently_active(session),
                    "description": session.description,
                    "updated_at": session.updated_at.replace(tzinfo=UTC).isoformat(),
                },
            }
        )

    except ValueError as e:
        return jsonify({"result": "error", "message": str(e)}), 404
    except Exception as e:
        return jsonify({"result": "error", "message": f"Failed to update session: {e!s}"}), 500


@bp.route("/<string:session_id>", methods=["DELETE"])
@jwt_required
@owner_or_creator_required(_get_session_by_id)
def delete_session(session_id: str):
    """
    세션 삭제 (소유자 또는 생성자만).

    Permission:
        - Owner: 모든 세션 삭제 가능
        - Admin: 자신이 생성한 세션만 삭제 가능

    Args:
        session_id: Session UUID

    Returns:
        JSON: 삭제 성공 메시지

    Note:
        관련 세션 멤버도 CASCADE로 자동 삭제됩니다.
    """
    try:
        service = EduSessionService()

        # Permission is checked by @owner_or_creator_required decorator

        service.delete_session(session_id)

        return jsonify({"result": "success", "message": "Session deleted successfully"})

    except ValueError as e:
        return jsonify({"result": "error", "message": str(e)}), 404
    except Exception as e:
        return jsonify({"result": "error", "message": f"Failed to delete session: {e!s}"}), 500


@bp.route("/<string:session_id>/members", methods=["GET"])
@jwt_required
@owner_or_creator_required(_get_session_by_id)
def get_session_members(session_id: str):
    """
    세션 멤버 목록 조회 (소유자 또는 생성자만).

    Permission:
        - Owner: 모든 세션의 멤버 조회 가능
        - Admin: 자신이 생성한 세션의 멤버만 조회 가능

    Args:
        session_id: Session UUID

    Returns:
        JSON: 세션 멤버 목록
    """
    try:
        service = EduSessionService()

        # Permission is checked by @owner_or_creator_required decorator

        members = service.get_session_members(session_id)

        return jsonify({"result": "success", "data": members})

    except ValueError as e:
        return jsonify({"result": "error", "message": str(e)}), 404
    except Exception as e:
        return jsonify({"result": "error", "message": f"Failed to get session members: {e!s}"}), 500


@bp.route("/<string:session_id>/members", methods=["POST"])
@jwt_required
@owner_or_creator_required(_get_session_by_id)
def add_session_member(session_id: str):
    """
    세션 멤버 추가 (소유자 또는 생성자만).

    Permission:
        - Owner: 모든 세션에 멤버 추가 가능
        - Admin: 자신이 생성한 세션에만 멤버 추가 가능

    Args:
        session_id: Session UUID

    Request Body:
        account_id (str): Account UUID to add

    Returns:
        JSON: 성공 메시지
    """
    if not request.json:
        return jsonify({"result": "error", "message": "Request body is required"}), 400

    try:
        data = AddMemberRequest(**request.json)
    except Exception as e:
        return jsonify({"result": "error", "message": f"Invalid request data: {e!s}"}), 400

    try:
        service = EduSessionService()

        # Permission is checked by @owner_or_creator_required decorator

        service.add_session_member(session_id, data.account_id)

        return jsonify({"result": "success", "message": "Member added successfully"})

    except ValueError as e:
        return jsonify({"result": "error", "message": str(e)}), 400
    except Exception as e:
        return jsonify({"result": "error", "message": f"Failed to add member: {e!s}"}), 500


@bp.route("/<string:session_id>/members/<string:account_id>", methods=["DELETE"])
@jwt_required
@owner_or_creator_required(_get_session_by_id)
def remove_session_member(session_id: str, account_id: str):
    """
    세션 멤버 제거 (소유자 또는 생성자만).

    Permission:
        - Owner: 모든 세션에서 멤버 제거 가능
        - Admin: 자신이 생성한 세션에서만 멤버 제거 가능

    Args:
        session_id: Session UUID
        account_id: Account UUID to remove

    Returns:
        JSON: 성공 메시지
    """
    try:
        service = EduSessionService()

        # Permission is checked by @owner_or_creator_required decorator

        removed = service.remove_session_member(session_id, account_id)

        if not removed:
            return jsonify({"result": "error", "message": "Member not found"}), 404

        return jsonify({"result": "success", "message": "Member removed successfully"})

    except ValueError as e:
        return jsonify({"result": "error", "message": str(e)}), 404
    except Exception as e:
        return jsonify({"result": "error", "message": f"Failed to remove member: {e!s}"}), 500
