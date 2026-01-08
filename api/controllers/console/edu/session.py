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
from services.education_management.session_resource_service import SessionResourceService

bp = Blueprint("edu_sessions", __name__, url_prefix="/console/api/edu/sessions")


# Helper function for owner_or_creator_required decorator
def _get_session_by_id(session_id: str):
    """세션 조회 헬퍼 함수 (owner_or_creator_required용)."""
    service = EduSessionService()
    return service.get_session(session_id)


def _get_celery_task_status(task_id: str) -> tuple[dict, int]:
    """
    Celery 태스크 상태를 조회하는 공통 헬퍼 함수.

    Args:
        task_id: Celery task ID

    Returns:
        tuple: (response_dict, status_code)
            - response_dict: JSON 응답 딕셔너리
            - status_code: HTTP 상태 코드
    """
    from celery.result import AsyncResult
    from flask import current_app

    celery_app = current_app.extensions.get("celery")
    if not celery_app:
        return {"result": "error", "message": "Celery not configured"}, 500

    result = AsyncResult(task_id, app=celery_app)

    if result.state == "PENDING":
        response = {
            "status": "pending",
            "progress": None,
            "result": None,
            "error": None,
        }
    elif result.state == "PROGRESS":
        response = {
            "status": "progress",
            "progress": result.info,
            "result": None,
            "error": None,
        }
    elif result.state == "SUCCESS":
        response = {
            "status": "completed",
            "progress": None,
            "result": result.result,
            "error": None,
        }
    elif result.state == "FAILURE":
        response = {
            "status": "failed",
            "progress": None,
            "result": None,
            "error": str(result.info) if result.info else "Task failed",
        }
    else:
        # Handle other states (RETRY, REVOKED, etc.)
        response = {
            "status": result.state.lower(),
            "progress": None,
            "result": None,
            "error": None,
        }

    return {"result": "success", "data": response}, 200


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
                        "force_status": session.force_status,
                        "is_currently_active": is_session_currently_active(session),
                        "is_default": session.is_default,
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
                    "member_count": sum(1 for m in session.members if m.status == "active") if session.members else 0,
                    "force_status": session.force_status,
                    "is_currently_active": is_session_currently_active(session),
                    "is_default": session.is_default,
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
                    "force_status": session.force_status,
                    "is_currently_active": is_session_currently_active(session),
                    "is_default": session.is_default,
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

    세션의 모든 리소스(Agent, Dataset)도 함께 삭제됩니다.
    비동기 Celery 태스크로 처리됩니다.

    Permission:
        - Owner: 모든 세션 삭제 가능
        - Admin: 자신이 생성한 세션만 삭제 가능

    Args:
        session_id: Session UUID

    Returns:
        JSON: task_id와 메시지 (202 Accepted)

    Note:
        - 세션의 모든 리소스(Agent, Dataset)가 삭제됩니다.
        - 세션 멤버는 CASCADE로 자동 삭제됩니다.
        - LLM 사용 기록은 보존됩니다.
    """
    from tasks.education.delete_session_task import delete_session_with_resources_task

    try:
        # Verify session exists and is not default/active
        service = EduSessionService()
        session = service.get_session(session_id)

        if session.is_default:
            return jsonify({"result": "error", "message": "Default session cannot be deleted"}), 400

        if is_session_currently_active(session):
            return jsonify(
                {"result": "error", "message": "Active session cannot be deleted. Deactivate it first."}
            ), 400

        # Start async deletion task
        task = delete_session_with_resources_task.delay(
            session_id=session_id,
            tenant_id=request.tenant_id,
            user_id=request.user.id,
        )

        return jsonify(
            {
                "result": "success",
                "data": {
                    "task_id": task.id,
                    "message": "세션 삭제 작업이 시작되었습니다.",
                },
            }
        ), 202  # Accepted

    except ValueError as e:
        return jsonify({"result": "error", "message": str(e)}), 404
    except Exception as e:
        return jsonify({"result": "error", "message": f"Failed to start session deletion: {e!s}"}), 500


@bp.route("/<string:session_id>/delete-status/<string:task_id>", methods=["GET"])
@jwt_required
@owner_or_creator_required(_get_session_by_id)
def get_session_delete_status(session_id: str, task_id: str):
    """
    세션 삭제 태스크 상태 조회.

    Args:
        session_id: Session UUID
        task_id: Celery task ID

    Returns:
        JSON: 태스크 상태 정보
            - status: "pending" | "progress" | "completed" | "failed"
            - progress: (진행 중일 때) 진행 상황
            - result: (완료 시) 삭제 결과
            - error: (실패 시) 에러 메시지
    """
    try:
        response, status_code = _get_celery_task_status(task_id)
        return jsonify(response), status_code
    except Exception as e:
        return jsonify({"result": "error", "message": f"Failed to get task status: {e!s}"}), 500


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

        service.add_session_member(
            session_id,
            data.account_id,
            tenant_id=request.tenant_id,
            created_by=request.user.id,
        )

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

    멤버의 리소스(Agent, Dataset)도 함께 삭제됩니다.
    비동기 Celery 태스크로 처리됩니다.

    Permission:
        - Owner: 모든 세션에서 멤버 제거 가능
        - Admin: 자신이 생성한 세션에서만 멤버 제거 가능

    Args:
        session_id: Session UUID
        account_id: Account UUID to remove

    Returns:
        JSON: task_id와 메시지 (202 Accepted)
    """
    from tasks.education.remove_member_task import remove_session_member_with_resources_task

    try:
        # Verify member exists
        service = EduSessionService()
        members = service.get_session_members(session_id)
        member_exists = any(m["account_id"] == account_id for m in members)

        if not member_exists:
            return jsonify({"result": "error", "message": "Member not found"}), 404

        # Start async removal task
        task = remove_session_member_with_resources_task.delay(
            session_id=session_id,
            member_account_id=account_id,
            tenant_id=request.tenant_id,
            user_id=request.user.id,
        )

        return jsonify(
            {
                "result": "success",
                "data": {
                    "task_id": task.id,
                    "message": "멤버 제거 작업이 시작되었습니다.",
                },
            }
        ), 202  # Accepted

    except ValueError as e:
        return jsonify({"result": "error", "message": str(e)}), 404
    except Exception as e:
        return jsonify({"result": "error", "message": f"Failed to start member removal: {e!s}"}), 500


@bp.route("/<string:session_id>/members/<string:account_id>/remove-status/<string:task_id>", methods=["GET"])
@jwt_required
@owner_or_creator_required(_get_session_by_id)
def get_member_remove_status(session_id: str, account_id: str, task_id: str):
    """
    멤버 제거 태스크 상태 조회.

    Args:
        session_id: Session UUID
        account_id: Account UUID being removed
        task_id: Celery task ID

    Returns:
        JSON: 태스크 상태 정보
            - status: "pending" | "progress" | "completed" | "failed"
            - progress: (진행 중일 때) 진행 상황
            - result: (완료 시) 제거 결과
            - error: (실패 시) 에러 메시지
    """
    try:
        response, status_code = _get_celery_task_status(task_id)
        return jsonify(response), status_code
    except Exception as e:
        return jsonify({"result": "error", "message": f"Failed to get task status: {e!s}"}), 500


# ============================================================================
# Session Resource Management Endpoints
# ============================================================================


@bp.route("/<string:session_id>/resources", methods=["GET"])
@jwt_required
@owner_or_creator_required(_get_session_by_id)
def get_session_resources(session_id: str):
    """
    세션 리소스 조회 (소유자 또는 생성자만).

    Permission:
        - Owner: 모든 세션의 리소스 조회 가능
        - Admin: 자신이 생성한 세션의 리소스만 조회 가능

    Args:
        session_id: Session UUID

    Query Parameters:
        resource_type (str, optional): Filter by type ("app" or "dataset")
        account_id (str, optional): Filter by account UUID

    Returns:
        JSON: 리소스 목록 및 요약
            - apps: App 리소스 목록
            - datasets: Dataset 리소스 목록
            - summary: {total_apps, total_datasets}
    """
    # Parse query parameters
    resource_type = request.args.get("resource_type")
    account_id = request.args.get("account_id")

    # Validate resource_type if provided
    if resource_type and resource_type not in ("app", "dataset"):
        return jsonify({"result": "error", "message": "Invalid resource_type. Must be 'app' or 'dataset'."}), 400

    try:
        service = SessionResourceService()
        resources = service.get_session_resources(
            session_id=session_id,
            resource_type=resource_type,
            account_id=account_id,
        )

        return jsonify(
            {
                "result": "success",
                "data": resources,
            }
        )

    except Exception as e:
        return jsonify({"result": "error", "message": f"Failed to get session resources: {e!s}"}), 500


@bp.route("/<string:session_id>/resources/accounts", methods=["GET"])
@jwt_required
@owner_or_creator_required(_get_session_by_id)
def get_session_resource_accounts(session_id: str):
    """
    세션에서 리소스를 생성한 사용자 목록 조회.

    Permission:
        - Owner: 모든 세션 조회 가능
        - Admin: 자신이 생성한 세션만 조회 가능

    Args:
        session_id: Session UUID

    Returns:
        JSON: 사용자 목록 (account_id, name, email)
    """
    try:
        service = SessionResourceService()
        accounts = service.get_unique_accounts(session_id)

        return jsonify(
            {
                "result": "success",
                "data": accounts,
            }
        )

    except Exception as e:
        return jsonify({"result": "error", "message": f"Failed to get resource accounts: {e!s}"}), 500


class DeleteResourcesRequest(BaseModel):
    """리소스 삭제 요청 모델."""

    account_id: str | None = Field(None, description="특정 사용자 리소스만 삭제 (선택)")


@bp.route("/<string:session_id>/resources", methods=["DELETE"])
@jwt_required
@owner_or_creator_required(_get_session_by_id)
def delete_session_resources(session_id: str):
    """
    세션 리소스 일괄 삭제 (소유자 또는 생성자만).

    비동기 Celery 태스크로 처리됩니다.

    Permission:
        - Owner: 모든 세션의 리소스 삭제 가능
        - Admin: 자신이 생성한 세션의 리소스만 삭제 가능

    Args:
        session_id: Session UUID

    Request Body (optional):
        account_id (str, optional): 특정 사용자의 리소스만 삭제

    Returns:
        JSON: task_id와 메시지 (202 Accepted)
    """
    from tasks.education.session_resource_cleanup_task import delete_session_resources_task

    # Parse account_id from query parameter or request body
    account_id = request.args.get("account_id")
    if not account_id:
        # Use silent=True to avoid error when body is empty
        json_data = request.get_json(silent=True)
        if json_data:
            try:
                data = DeleteResourcesRequest(**json_data)
                account_id = data.account_id
            except Exception as e:
                return jsonify({"result": "error", "message": f"Invalid request data: {e!s}"}), 400

    try:
        # Start async deletion task
        task = delete_session_resources_task.delay(
            session_id=session_id,
            account_id=account_id,
            tenant_id=request.tenant_id,
            user_id=request.user.id,
        )

        return jsonify(
            {
                "result": "success",
                "data": {
                    "task_id": task.id,
                    "message": "리소스 삭제 작업이 시작되었습니다.",
                },
            }
        ), 202  # Accepted

    except Exception as e:
        return jsonify({"result": "error", "message": f"Failed to start resource deletion: {e!s}"}), 500


@bp.route("/<string:session_id>/resources/delete-status/<string:task_id>", methods=["GET"])
@jwt_required
@owner_or_creator_required(_get_session_by_id)
def get_delete_status(session_id: str, task_id: str):
    """
    리소스 삭제 태스크 상태 조회.

    Permission:
        - Owner: 모든 세션의 태스크 상태 조회 가능
        - Admin: 자신이 생성한 세션의 태스크 상태만 조회 가능

    Args:
        session_id: Session UUID
        task_id: Celery Task ID

    Returns:
        JSON: 태스크 상태 정보
            - status: "pending" | "progress" | "completed" | "failed"
            - progress: (진행 중일 때) 진행 상황
            - result: (완료 시) 삭제 결과
            - error: (실패 시) 에러 메시지
    """
    try:
        response, status_code = _get_celery_task_status(task_id)
        return jsonify(response), status_code
    except Exception as e:
        return jsonify({"result": "error", "message": f"Failed to get task status: {e!s}"}), 500


# ============================================================================
# Session Quota Management Endpoints (Story 4.1B)
# ============================================================================


class SetSessionQuotaRequest(BaseModel):
    """세션 한도 설정 요청 모델."""

    model_provider: str = Field(..., min_length=1, max_length=50, description="Provider name or 'all'")
    quota_limit: str = Field(..., description="Quota limit in USD (e.g., '10.00')")
    period: str = Field(default="monthly", description="Reset period: daily, session, monthly")
    warning_threshold: int = Field(default=70, ge=1, le=100, description="Warning threshold percentage")


class SetUserQuotaRequest(BaseModel):
    """사용자 한도 설정 요청 모델 (개별 사용자)."""

    account_id: str = Field(..., description="User account UUID")
    model_provider: str = Field(..., min_length=1, max_length=50, description="Provider name or 'all'")
    quota_limit: str = Field(..., description="Quota limit in USD (e.g., '10.00')")
    period: str = Field(default="monthly", description="Reset period: daily, session, monthly")
    warning_threshold: int = Field(default=70, ge=1, le=100, description="Warning threshold percentage")


class SetDefaultUserQuotaRequest(BaseModel):
    """사용자별 기본 한도 설정 요청 모델 (전체 멤버 일괄 적용)."""

    model_provider: str = Field(..., min_length=1, max_length=50, description="Provider name or 'all'")
    quota_limit: str = Field(..., description="Quota limit in USD per user (e.g., '10.00')")
    period: str = Field(default="monthly", description="Reset period: daily, session, monthly")
    warning_threshold: int = Field(default=70, ge=1, le=100, description="Warning threshold percentage")


@bp.route("/<string:session_id>/quotas", methods=["GET"])
@jwt_required
@owner_or_creator_required(_get_session_by_id)
def get_session_quotas(session_id: str):
    """
    세션 한도 조회 (세션 전체 + 사용자별).

    Permission:
        - Owner: 모든 세션의 한도 조회 가능
        - Admin: 자신이 생성한 세션의 한도만 조회 가능

    Args:
        session_id: Session UUID

    Returns:
        JSON: 세션 한도 및 사용자별 한도 목록
    """

    from services.education_management.quota_service import QuotaService

    try:
        from extensions.ext_database import db

        session_quotas = QuotaService.get_session_quotas(db.session, session_id)  # type: ignore[arg-type]
        user_quotas = QuotaService.get_user_quotas(db.session, session_id)  # type: ignore[arg-type]

        return jsonify(
            {
                "result": "success",
                "data": {
                    "session_quotas": [
                        {
                            "id": q.id,
                            "model_provider": q.model_provider,
                            "quota_limit": str(q.quota_limit),
                            "period": q.period,
                            "current_usage": str(q.current_usage),
                            "usage_percentage": round(q.usage_percentage, 2),
                            "warning_threshold": q.warning_threshold,
                            "is_warning": q.is_warning,
                            "is_exceeded": q.is_exceeded,
                            "is_blocked": q.is_blocked,
                            "last_reset_at": q.last_reset_at.isoformat() if q.last_reset_at else None,
                        }
                        for q in session_quotas
                    ],
                    "user_quotas": [
                        {
                            "id": q.id,
                            "account_id": q.account_id,
                            "account_name": q.account_name,
                            "model_provider": q.model_provider,
                            "quota_limit": str(q.quota_limit),
                            "period": q.period,
                            "current_usage": str(q.current_usage),
                            "usage_percentage": round(q.usage_percentage, 2),
                            "warning_threshold": q.warning_threshold,
                            "is_warning": q.is_warning,
                            "is_exceeded": q.is_exceeded,
                            "is_blocked": q.is_blocked,
                            "override_until": q.override_until.isoformat() if q.override_until else None,
                            "last_reset_at": q.last_reset_at.isoformat() if q.last_reset_at else None,
                        }
                        for q in user_quotas
                    ],
                },
            }
        )

    except Exception as e:
        return jsonify({"result": "error", "message": f"Failed to get quotas: {e!s}"}), 500


@bp.route("/<string:session_id>/quotas/session", methods=["PUT"])
@jwt_required
@owner_or_creator_required(_get_session_by_id)
def set_session_quota(session_id: str):
    """
    세션 전체 한도 설정.

    Permission:
        - Owner: 모든 세션의 한도 설정 가능
        - Admin: 자신이 생성한 세션의 한도만 설정 가능

    Args:
        session_id: Session UUID

    Request Body:
        model_provider (str): Provider name or "all"
        quota_limit (str): Quota limit in USD
        period (str): Reset period (daily, session, monthly)
        warning_threshold (int): Warning threshold percentage

    Returns:
        JSON: 설정된 한도 정보
    """
    from decimal import Decimal, InvalidOperation

    from services.education_management.quota_service import QuotaService

    if not request.json:
        return jsonify({"result": "error", "message": "Request body is required"}), 400

    try:
        data = SetSessionQuotaRequest(**request.json)
    except Exception as e:
        return jsonify({"result": "error", "message": f"Invalid request data: {e!s}"}), 400

    # Validate period
    if data.period not in ("daily", "session", "monthly"):
        return jsonify({"result": "error", "message": "Invalid period. Must be 'daily', 'session', or 'monthly'."}), 400

    try:
        quota_limit = Decimal(data.quota_limit)
        if quota_limit <= 0:
            return jsonify({"result": "error", "message": "quota_limit must be positive"}), 400
    except InvalidOperation:
        return jsonify({"result": "error", "message": "Invalid quota_limit format"}), 400

    try:
        from extensions.ext_database import db

        quota = QuotaService.set_session_quota(
            db_session=db.session,  # type: ignore[arg-type]
            tenant_id=request.tenant_id,
            session_id=session_id,
            model_provider=data.model_provider,
            quota_limit=quota_limit,
            period=data.period,
            warning_threshold=data.warning_threshold,
        )

        return jsonify(
            {
                "result": "success",
                "data": {
                    "id": quota.id,
                    "model_provider": quota.model_provider,
                    "quota_limit": str(quota.quota_limit),
                    "period": quota.period,
                    "current_usage": str(quota.current_usage),
                    "usage_percentage": round(quota.usage_percentage, 2),
                    "warning_threshold": quota.warning_threshold,
                    "is_warning": quota.is_warning,
                    "is_blocked": quota.is_blocked,
                },
            }
        )

    except Exception as e:
        return jsonify({"result": "error", "message": f"Failed to set session quota: {e!s}"}), 500


@bp.route("/<string:session_id>/quotas/session/<string:provider>", methods=["DELETE"])
@jwt_required
@owner_or_creator_required(_get_session_by_id)
def delete_session_quota(session_id: str, provider: str):
    """
    세션 전체 한도 삭제.

    Permission:
        - Owner: 모든 세션의 한도 삭제 가능
        - Admin: 자신이 생성한 세션의 한도만 삭제 가능

    Args:
        session_id: Session UUID
        provider: Provider name or "all"

    Returns:
        JSON: 성공 메시지
    """
    from services.education_management.quota_service import QuotaService

    try:
        from extensions.ext_database import db

        deleted = QuotaService.delete_session_quota(db.session, session_id, provider)  # type: ignore[arg-type]

        if not deleted:
            return jsonify({"result": "error", "message": "Quota not found"}), 404

        return jsonify({"result": "success", "message": "Quota deleted successfully"})

    except Exception as e:
        return jsonify({"result": "error", "message": f"Failed to delete quota: {e!s}"}), 500


@bp.route("/<string:session_id>/quotas/session/<string:provider>/unblock", methods=["POST"])
@jwt_required
@owner_or_creator_required(_get_session_by_id)
def unblock_session_quota(session_id: str, provider: str):
    """
    세션 전체 한도 차단 해제.

    Permission:
        - Owner: 모든 세션의 차단 해제 가능
        - Admin: 자신이 생성한 세션의 차단만 해제 가능

    Args:
        session_id: Session UUID
        provider: Provider name or "all"

    Returns:
        JSON: 성공 메시지
    """
    from services.education_management.quota_service import QuotaService

    try:
        from extensions.ext_database import db

        unblocked = QuotaService.unblock_session_quota(db.session, session_id, provider)  # type: ignore[arg-type]

        if not unblocked:
            return jsonify({"result": "error", "message": "Quota not found"}), 404

        return jsonify({"result": "success", "message": "Session quota unblocked successfully"})

    except Exception as e:
        return jsonify({"result": "error", "message": f"Failed to unblock quota: {e!s}"}), 500


@bp.route("/<string:session_id>/quotas/user-default", methods=["PUT"])
@jwt_required
@owner_or_creator_required(_get_session_by_id)
def set_default_user_quota(session_id: str):
    """
    사용자별 기본 한도 설정 (전체 멤버 일괄 적용).

    세션의 모든 활성 멤버에게 동일한 한도를 일괄 적용합니다.
    공평한 리소스 분배를 위한 기능입니다.

    Permission:
        - Owner: 모든 세션의 기본 한도 설정 가능
        - Admin: 자신이 생성한 세션의 기본 한도만 설정 가능

    Args:
        session_id: Session UUID

    Request Body:
        model_provider (str): Provider name or "all"
        quota_limit (str): Quota limit in USD per user
        period (str): Reset period (daily, session, monthly)
        warning_threshold (int): Warning threshold percentage

    Returns:
        JSON: 적용된 사용자 수 및 한도 정보
    """
    from decimal import Decimal, InvalidOperation

    from services.education_management.quota_service import QuotaService

    if not request.json:
        return jsonify({"result": "error", "message": "Request body is required"}), 400

    try:
        data = SetDefaultUserQuotaRequest(**request.json)
    except Exception as e:
        return jsonify({"result": "error", "message": f"Invalid request data: {e!s}"}), 400

    # Validate period
    if data.period not in ("daily", "session", "monthly"):
        return jsonify({"result": "error", "message": "Invalid period. Must be 'daily', 'session', or 'monthly'."}), 400

    try:
        quota_limit = Decimal(data.quota_limit)
        if quota_limit <= 0:
            return jsonify({"result": "error", "message": "quota_limit must be positive"}), 400
    except InvalidOperation:
        return jsonify({"result": "error", "message": "Invalid quota_limit format"}), 400

    try:
        from extensions.ext_database import db

        quotas = QuotaService.set_default_user_quota(
            db_session=db.session,  # type: ignore[arg-type]
            tenant_id=request.tenant_id,
            session_id=session_id,
            model_provider=data.model_provider,
            quota_limit=quota_limit,
            period=data.period,
            created_by=request.user.id,
            warning_threshold=data.warning_threshold,
        )

        return jsonify(
            {
                "result": "success",
                "data": {
                    "applied_count": len(quotas),
                    "model_provider": data.model_provider,
                    "quota_limit": data.quota_limit,
                    "period": data.period,
                    "warning_threshold": data.warning_threshold,
                    "quotas": [
                        {
                            "id": q.id,
                            "account_id": q.account_id,
                            "account_name": q.account_name,
                            "model_provider": q.model_provider,
                            "quota_limit": str(q.quota_limit),
                            "period": q.period,
                            "current_usage": str(q.current_usage),
                            "usage_percentage": round(q.usage_percentage, 2),
                        }
                        for q in quotas
                    ],
                },
            }
        )

    except Exception as e:
        return jsonify({"result": "error", "message": f"Failed to set default user quota: {e!s}"}), 500


# === Default User Quota Config APIs (for auto-apply to new members) ===


class SetDefaultQuotaConfigRequest(BaseModel):
    """Request body for setting default quota config."""

    model_provider: str = Field(..., min_length=1)
    quota_limit: str = Field(..., min_length=1)
    warning_threshold: int = Field(default=70, ge=1, le=100)
    apply_to_existing: bool = Field(default=True)


@bp.route("/<string:session_id>/quotas/default-config", methods=["GET"])
@jwt_required
@owner_or_creator_required(_get_session_by_id)
def get_default_quota_configs(session_id: str):
    """
    기본 사용자 한도 설정 목록 조회.

    새 멤버 추가 시 자동 적용되는 기본 한도 설정을 조회합니다.

    Permission:
        - Owner: 모든 세션 조회 가능
        - Admin: 자신이 생성한 세션만 조회 가능

    Args:
        session_id: Session UUID

    Returns:
        JSON: 기본 한도 설정 목록
    """
    from services.education_management.quota_service import QuotaService

    try:
        from extensions.ext_database import db

        configs = QuotaService.get_default_quota_configs(
            db_session=db.session,  # type: ignore[arg-type]
            session_id=session_id,
        )

        return jsonify({"result": "success", "data": {"configs": configs}})

    except Exception as e:
        return jsonify({"result": "error", "message": f"Failed to get default configs: {e!s}"}), 500


@bp.route("/<string:session_id>/quotas/default-config", methods=["PUT"])
@jwt_required
@owner_or_creator_required(_get_session_by_id)
def set_default_quota_config(session_id: str):
    """
    기본 사용자 한도 설정 저장.

    새 멤버가 추가될 때 자동으로 적용되는 기본 한도를 설정합니다.
    apply_to_existing=true인 경우 기존 멤버에게도 즉시 적용됩니다.

    Permission:
        - Owner: 모든 세션 설정 가능
        - Admin: 자신이 생성한 세션만 설정 가능

    Args:
        session_id: Session UUID

    Request Body:
        model_provider (str): Provider name
        quota_limit (str): Default quota limit in USD
        warning_threshold (int): Warning threshold percentage
        apply_to_existing (bool): Whether to apply to existing members

    Returns:
        JSON: 저장된 설정 및 적용된 멤버 수
    """
    from decimal import Decimal, InvalidOperation

    from services.education_management.quota_service import QuotaService

    if not request.json:
        return jsonify({"result": "error", "message": "Request body is required"}), 400

    try:
        data = SetDefaultQuotaConfigRequest(**request.json)
    except Exception as e:
        return jsonify({"result": "error", "message": f"Invalid request data: {e!s}"}), 400

    try:
        quota_limit = Decimal(data.quota_limit)
        if quota_limit <= 0:
            return jsonify({"result": "error", "message": "quota_limit must be positive"}), 400
    except InvalidOperation:
        return jsonify({"result": "error", "message": "Invalid quota_limit format"}), 400

    try:
        from extensions.ext_database import db

        result = QuotaService.set_default_quota_config(
            db_session=db.session,  # type: ignore[arg-type]
            tenant_id=request.tenant_id,
            session_id=session_id,
            model_provider=data.model_provider,
            quota_limit=quota_limit,
            warning_threshold=data.warning_threshold,
            apply_to_existing=data.apply_to_existing,
            created_by=request.user.id,
        )

        return jsonify({"result": "success", "data": result})

    except Exception as e:
        return jsonify({"result": "error", "message": f"Failed to save default config: {e!s}"}), 500


@bp.route("/<string:session_id>/quotas/default-config/<string:provider>", methods=["DELETE"])
@jwt_required
@owner_or_creator_required(_get_session_by_id)
def delete_default_quota_config(session_id: str, provider: str):
    """
    기본 사용자 한도 설정 삭제.

    특정 provider의 기본 한도 설정을 삭제합니다.
    삭제 후 새 멤버에게는 해당 provider의 한도가 자동 적용되지 않습니다.

    Permission:
        - Owner: 모든 세션 삭제 가능
        - Admin: 자신이 생성한 세션만 삭제 가능

    Args:
        session_id: Session UUID
        provider: Provider name

    Returns:
        JSON: 삭제 결과
    """
    from services.education_management.quota_service import QuotaService

    try:
        from extensions.ext_database import db

        deleted = QuotaService.delete_default_quota_config(
            db_session=db.session,  # type: ignore[arg-type]
            session_id=session_id,
            model_provider=provider,
        )

        if not deleted:
            return jsonify({"result": "error", "message": "Default config not found"}), 404

        return jsonify({"result": "success", "message": "Default config deleted successfully"})

    except Exception as e:
        return jsonify({"result": "error", "message": f"Failed to delete default config: {e!s}"}), 500


@bp.route("/<string:session_id>/quotas/user-default/<string:provider>", methods=["DELETE"])
@jwt_required
@owner_or_creator_required(_get_session_by_id)
def delete_user_quotas_by_provider(session_id: str, provider: str):
    """
    프로바이더 단위로 모든 사용자 한도 삭제.

    해당 프로바이더의 기본 한도 설정과 모든 사용자 한도를 삭제합니다.

    Permission:
        - Owner: 모든 세션 삭제 가능
        - Admin: 자신이 생성한 세션만 삭제 가능

    Args:
        session_id: Session UUID
        provider: Provider name

    Returns:
        JSON: 삭제 결과 (삭제된 사용자 한도 수)
    """
    from services.education_management.quota_service import QuotaService

    try:
        from extensions.ext_database import db

        result = QuotaService.delete_user_quotas_by_provider(
            db_session=db.session,  # type: ignore[arg-type]
            session_id=session_id,
            model_provider=provider,
        )

        return jsonify(
            {
                "result": "success",
                "data": {
                    "deleted_user_quotas": result["deleted_user_quotas"],
                    "deleted_default_config": result["deleted_default_config"],
                },
                "message": f"Deleted {result['deleted_user_quotas']} user quotas for provider '{provider}'",
            }
        )

    except Exception as e:
        return jsonify({"result": "error", "message": f"Failed to delete user quotas: {e!s}"}), 500


@bp.route("/<string:session_id>/quotas/user", methods=["PUT"])
@jwt_required
@owner_or_creator_required(_get_session_by_id)
def set_user_quota(session_id: str):
    """
    개별 사용자 한도 설정 (한도 증감 조정).

    특정 사용자의 한도를 개별적으로 조정합니다.
    기본 한도에서 예외적으로 한도를 변경할 때 사용합니다.

    Permission:
        - Owner: 모든 세션의 사용자 한도 설정 가능
        - Admin: 자신이 생성한 세션의 사용자 한도만 설정 가능

    Args:
        session_id: Session UUID

    Request Body:
        account_id (str): User account UUID
        model_provider (str): Provider name or "all"
        quota_limit (str): Quota limit in USD
        period (str): Reset period (daily, session, monthly)
        warning_threshold (int): Warning threshold percentage

    Returns:
        JSON: 설정된 한도 정보
    """
    from decimal import Decimal, InvalidOperation

    from services.education_management.quota_service import QuotaService

    if not request.json:
        return jsonify({"result": "error", "message": "Request body is required"}), 400

    try:
        data = SetUserQuotaRequest(**request.json)
    except Exception as e:
        return jsonify({"result": "error", "message": f"Invalid request data: {e!s}"}), 400

    # Validate period
    if data.period not in ("daily", "session", "monthly"):
        return jsonify({"result": "error", "message": "Invalid period. Must be 'daily', 'session', or 'monthly'."}), 400

    try:
        quota_limit = Decimal(data.quota_limit)
        if quota_limit <= 0:
            return jsonify({"result": "error", "message": "quota_limit must be positive"}), 400
    except InvalidOperation:
        return jsonify({"result": "error", "message": "Invalid quota_limit format"}), 400

    try:
        from extensions.ext_database import db

        quota = QuotaService.set_user_quota(
            db_session=db.session,  # type: ignore[arg-type]
            tenant_id=request.tenant_id,
            session_id=session_id,
            account_id=data.account_id,
            model_provider=data.model_provider,
            quota_limit=quota_limit,
            period=data.period,
            created_by=request.user.id,
            warning_threshold=data.warning_threshold,
        )

        return jsonify(
            {
                "result": "success",
                "data": {
                    "id": quota.id,
                    "account_id": quota.account_id,
                    "account_name": quota.account_name,
                    "model_provider": quota.model_provider,
                    "quota_limit": str(quota.quota_limit),
                    "period": quota.period,
                    "current_usage": str(quota.current_usage),
                    "usage_percentage": round(quota.usage_percentage, 2),
                    "warning_threshold": quota.warning_threshold,
                    "is_warning": quota.is_warning,
                    "is_blocked": quota.is_blocked,
                },
            }
        )

    except Exception as e:
        return jsonify({"result": "error", "message": f"Failed to set user quota: {e!s}"}), 500


@bp.route("/<string:session_id>/quotas/user/<string:quota_id>/unblock", methods=["POST"])
@jwt_required
@owner_or_creator_required(_get_session_by_id)
def unblock_user_quota(session_id: str, quota_id: str):
    """
    사용자 한도 차단 해제.

    Permission:
        - Owner: 모든 세션의 차단 해제 가능
        - Admin: 자신이 생성한 세션의 차단만 해제 가능

    Args:
        session_id: Session UUID
        quota_id: Quota UUID

    Returns:
        JSON: 성공 메시지
    """
    from services.education_management.quota_service import QuotaService

    try:
        from extensions.ext_database import db

        success = QuotaService.unblock_user(db.session, quota_id)  # type: ignore[arg-type]

        if not success:
            return jsonify({"result": "error", "message": "Quota not found"}), 404

        return jsonify({"result": "success", "message": "User quota unblocked successfully"})

    except Exception as e:
        return jsonify({"result": "error", "message": f"Failed to unblock quota: {e!s}"}), 500


@bp.route("/<string:session_id>/quotas/user/<string:quota_id>", methods=["DELETE"])
@jwt_required
@owner_or_creator_required(_get_session_by_id)
def delete_user_quota(session_id: str, quota_id: str):
    """
    사용자 한도 삭제.

    Permission:
        - Owner: 모든 세션의 사용자 한도 삭제 가능
        - Admin: 자신이 생성한 세션의 사용자 한도만 삭제 가능

    Args:
        session_id: Session UUID
        quota_id: Quota UUID

    Returns:
        JSON: 성공 메시지
    """
    from services.education_management.quota_service import QuotaService

    try:
        from extensions.ext_database import db

        deleted = QuotaService.delete_user_quota(db.session, quota_id)  # type: ignore[arg-type]

        if not deleted:
            return jsonify({"result": "error", "message": "Quota not found"}), 404

        return jsonify({"result": "success", "message": "User quota deleted successfully"})

    except Exception as e:
        return jsonify({"result": "error", "message": f"Failed to delete quota: {e!s}"}), 500


@bp.route("/<string:session_id>/quotas/warnings", methods=["GET"])
@jwt_required
@owner_or_creator_required(_get_session_by_id)
def get_session_quota_warnings(session_id: str):
    """
    세션 한도 경고 현황 조회 (대시보드 배너용).

    Permission:
        - Owner: 모든 세션의 경고 현황 조회 가능
        - Admin: 자신이 생성한 세션의 경고 현황만 조회 가능

    Args:
        session_id: Session UUID

    Returns:
        JSON: 경고 현황 요약
    """
    from services.education_management.quota_enforcement_service import QuotaEnforcementService

    try:
        from extensions.ext_database import db

        warnings = QuotaEnforcementService.get_warnings_for_session(db.session, session_id)  # type: ignore[arg-type]

        return jsonify({"result": "success", "data": warnings})

    except Exception as e:
        return jsonify({"result": "error", "message": f"Failed to get warnings: {e!s}"}), 500
