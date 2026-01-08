"""User management API endpoints."""

import io

from flask import Blueprint, jsonify, request, send_file
from pydantic import BaseModel, EmailStr, Field

from controllers.console.edu.auth_decorators import (
    admin_or_owner_required,
    admin_required,
    jwt_required,
)
from extensions.ext_rate_limit import rate_limit
from services.education_management.user_management_service import UserManagementService

bp = Blueprint("edu_users", __name__, url_prefix="/console/api/edu/users")


def _get_error_code(message: str) -> str:
    """에러 메시지에서 에러 코드 추출.

    Args:
        message: 에러 메시지

    Returns:
        에러 코드 문자열
    """
    error_patterns = {
        "Email already exists": "EMAIL_ALREADY_EXISTS",
        "Cannot create user with 'owner' role": "CANNOT_CREATE_OWNER",
        "Admin users can only create 'student' role": "ADMIN_CANNOT_CREATE_ADMIN",
        "creator_account is required": "CREATOR_REQUIRED",
        "Owner account can only be edited by the owner": "OWNER_EDIT_RESTRICTED",
        "Owner account cannot be deleted": "OWNER_DELETE_RESTRICTED",
        "Cannot delete yourself": "CANNOT_DELETE_SELF",
        "Only owner can change": "OWNER_ONLY_CHANGE",
    }

    for pattern, code in error_patterns.items():
        if pattern in message:
            return code

    return "VALIDATION_ERROR"


# File upload constraints
MAX_CSV_FILE_SIZE = 10 * 1024 * 1024  # 10MB
MAX_CSV_ROWS = 1000


# Pydantic 모델 정의 (요청 검증)
class CreateUserRequest(BaseModel):
    """사용자 생성 요청 모델."""

    email: EmailStr
    name: str = Field(..., min_length=1, max_length=100)
    password: str = Field(..., min_length=8)
    role: str | None = Field(default="student", pattern="^(admin|student)$")
    session_id: str | None = Field(default=None, description="Optional session ID to add user to")


class UpdateUserRequest(BaseModel):
    """사용자 수정 요청 모델."""

    name: str | None = Field(None, min_length=1, max_length=100)
    status: str | None = Field(None, pattern="^(active|banned)$")
    role: str | None = Field(None, pattern="^(owner|admin|student)$")
    password: str | None = Field(None, min_length=8)


class AssignRoleRequest(BaseModel):
    """역할 할당 요청 모델."""

    account_id: str
    session_id: str
    role: str = Field(..., pattern="^(admin|student)$")


@bp.route("", methods=["GET"])
@jwt_required
@admin_or_owner_required
def list_users():
    """
    사용자 목록 조회 (관리자 또는 소유자).

    Permission:
        - Owner: 모든 사용자 조회
        - Admin: 자신이 등록한 사용자만 조회

    Query Parameters:
        page (int): 페이지 번호 (기본값: 1)
        limit (int): 페이지당 사용자 수 (기본값: 20)

    Returns:
        JSON: 사용자 목록 및 페이지네이션 정보
    """
    page = request.args.get("page", 1, type=int)
    limit = request.args.get("limit", 20, type=int)

    service = UserManagementService()
    result = service.list_users(
        current_user=request.user,  # 추가
        page=page,
        limit=limit,
    )

    return jsonify({"result": "success", "data": result})


@bp.route("", methods=["POST"])
@jwt_required
@admin_required
def create_user():
    """
    사용자 생성 (관리자만).

    Request Body:
        email (str): 이메일 주소
        name (str): 사용자 이름
        password (str): 비밀번호 (최소 8자)
        role (str, optional): 역할 ('admin' 또는 'student', 기본값: 'student')

    Returns:
        JSON: 생성된 사용자 정보
    """
    if not request.json:
        return jsonify({"result": "error", "message": "Request body is required"}), 400

    try:
        data = CreateUserRequest(**request.json)
    except Exception as e:
        return jsonify({"result": "error", "message": f"Invalid request data: {e!s}"}), 400

    try:
        service = UserManagementService()
        user = service.create_user(
            email=data.email,
            name=data.name,
            password=data.password,
            role=data.role,
            session_id=data.session_id,
            creator_account=request.user,
        )

        return jsonify({"result": "success", "data": user}), 201
    except ValueError as e:
        error_msg = str(e)
        return jsonify({"result": "error", "code": _get_error_code(error_msg), "message": error_msg}), 400
    except Exception as e:
        return jsonify({"result": "error", "code": "INTERNAL_ERROR", "message": f"Failed to create user: {e!s}"}), 500


@bp.route("/<user_id>", methods=["GET"])
@jwt_required
def get_user(user_id: str):
    """
    특정 사용자 조회.

    Path Parameters:
        user_id (str): 사용자 ID

    Returns:
        JSON: 사용자 정보
    """
    service = UserManagementService()
    user = service.get_user(user_id)

    if not user:
        return jsonify({"result": "error", "message": "User not found"}), 404

    return jsonify({"result": "success", "data": user})


@bp.route("/<user_id>", methods=["PUT"])
@jwt_required
@admin_or_owner_required
def update_user(user_id: str):
    """
    사용자 정보 수정 (관리자 또는 소유자).

    Permission:
        - Owner: 모든 사용자 수정 가능
        - Admin: 자신이 등록한 사용자만 수정 가능

    Path Parameters:
        user_id (str): 사용자 ID

    Request Body:
        name (str, optional): 사용자 이름
        status (str, optional): 상태 ('active', 'banned')
        role (str, optional): 시스템 역할 ('admin', 'student')
        password (str, optional): 새 비밀번호 (최소 8자)

    Returns:
        JSON: 수정된 사용자 정보
    """
    if not request.json:
        return jsonify({"result": "error", "message": "Request body is required"}), 400

    try:
        data = UpdateUserRequest(**request.json)
    except Exception as e:
        return jsonify({"result": "error", "message": f"Invalid request data: {e!s}"}), 400

    try:
        service = UserManagementService()
        user = service.update_user(user_id, data.model_dump(exclude_unset=True), updater_account=request.user)

        return jsonify({"result": "success", "data": user})
    except ValueError as e:
        error_msg = str(e)
        return jsonify({"result": "error", "code": _get_error_code(error_msg), "message": error_msg}), 403
    except Exception as e:
        return jsonify({"result": "error", "code": "INTERNAL_ERROR", "message": f"Failed to update user: {e!s}"}), 500


@bp.route("/<user_id>", methods=["DELETE"])
@jwt_required
@admin_or_owner_required
def delete_user(user_id: str):
    """
    사용자 삭제 (관리자 또는 소유자).

    Permission:
        - Owner: 모든 사용자 삭제 가능
        - Admin: 자신이 등록한 사용자만 삭제 가능

    Path Parameters:
        user_id (str): 사용자 ID

    Query Parameters:
        delete_resources (bool): 관련 리소스 삭제 여부 (기본값: true)

    Returns:
        JSON: 삭제 결과
    """
    delete_resources = request.args.get("delete_resources", "true").lower() == "true"

    try:
        service = UserManagementService()
        service.delete_user(user_id, delete_resources=delete_resources, deleter_account=request.user)

        return jsonify({"result": "success", "message": "User deleted successfully"})
    except ValueError as e:
        error_msg = str(e)
        return jsonify({"result": "error", "code": _get_error_code(error_msg), "message": error_msg}), 403
    except Exception as e:
        return jsonify({"result": "error", "code": "INTERNAL_ERROR", "message": f"Failed to delete user: {e!s}"}), 500


@bp.route("/bulk", methods=["POST"])
@jwt_required
@admin_required
@rate_limit("10 per minute")  # Rate limiting: 10 requests per minute
def bulk_create_users():
    """
    CSV 파일로 사용자 일괄 생성 (비동기).

    Request:
        - file: CSV 파일 (multipart/form-data, max 10MB)
        - session_id: 세션 ID (optional, form field)

    Returns:
        JSON: 작업 ID 및 메시지

    Rate Limiting:
        - 10 requests per minute per IP address
    """
    # 파일 검증
    if "file" not in request.files:
        return jsonify({"result": "error", "message": "No file provided"}), 400

    file = request.files["file"]
    if file.filename == "":
        return jsonify({"result": "error", "message": "Empty filename"}), 400

    if not file.filename or not file.filename.endswith(".csv"):
        return jsonify({"result": "error", "message": "Only CSV files are allowed"}), 400

    # MIME type 검증
    if file.content_type and file.content_type not in ["text/csv", "application/vnd.ms-excel", "text/plain"]:
        return jsonify({"result": "error", "message": "Invalid file type. Only CSV files are allowed."}), 400

    # 세션 ID (선택적)
    session_id = request.form.get("session_id", None)

    try:
        # CSV 파일 읽기 (여러 인코딩 시도)
        file_content = file.read()

        # Debug logging
        import logging

        logger = logging.getLogger(__name__)
        logger.info("CSV file uploaded: filename=%s, size=%d bytes", file.filename, len(file_content))

        # 파일 크기 검증 (10MB)
        if len(file_content) > MAX_CSV_FILE_SIZE:
            return (
                jsonify(
                    {"result": "error", "message": f"File size exceeds {MAX_CSV_FILE_SIZE // (1024 * 1024)}MB limit"}
                ),
                400,
            )

        csv_content = None
        used_encoding = None

        # UTF-8, UTF-8-SIG(BOM), EUC-KR, CP949 순서로 시도
        for encoding in ["utf-8", "utf-8-sig", "euc-kr", "cp949"]:
            try:
                csv_content = file_content.decode(encoding)
                used_encoding = encoding
                break
            except (UnicodeDecodeError, LookupError):
                continue

        if csv_content is None:
            return jsonify({"result": "error", "message": "Unable to decode CSV file. Please use UTF-8 encoding."}), 400

        logger.info("CSV decoded with %s. Content preview (first 200 chars): %s", used_encoding, csv_content[:200])

        # CSV 행 개수 검증 (1000 rows max)
        row_count = csv_content.count("\n")
        if row_count > MAX_CSV_ROWS + 1:  # +1 for header row
            error_message = f"CSV file contains too many rows. Maximum {MAX_CSV_ROWS} rows allowed (excluding header)."
            return (
                jsonify({"result": "error", "message": error_message}),
                400,
            )

        # Celery 태스크 시작
        from tasks.education.bulk_user_task import bulk_create_users_task

        task = bulk_create_users_task.delay(csv_content, session_id, request.user.id)

        return (
            jsonify(
                {
                    "result": "success",
                    "data": {"task_id": task.id, "message": "사용자 일괄 생성 작업이 시작되었습니다."},
                }
            ),
            202,
        )
    except Exception as e:
        return jsonify({"result": "error", "message": f"Failed to start bulk create task: {e!s}"}), 500


@bp.route("/bulk/<task_id>", methods=["GET"])
@jwt_required
def get_bulk_create_status(task_id: str):
    """
    일괄 생성 작업 상태 조회.

    Path Parameters:
        task_id (str): Celery Task ID

    Returns:
        JSON: 작업 상태 및 진행 상황
    """
    try:
        from celery.result import AsyncResult
        from flask import current_app

        # Get Celery app from Flask extensions
        celery_app = current_app.extensions.get("celery")
        if not celery_app:
            return jsonify({"result": "error", "message": "Celery not configured"}), 500

        # Get task result
        task = AsyncResult(task_id, app=celery_app)

        # Debug logging
        import logging

        logger = logging.getLogger(__name__)
        logger.info("Checking task %s: state=%s", task_id, task.state)
        logger.info("Task result type: %s, result: %s", type(task.result), task.result)
        logger.info("Task info type: %s, info: %s", type(task.info), task.info)

        if task.state == "PENDING":
            response = {"task_id": task_id, "status": "PENDING", "progress": None}
        elif task.state == "PROGRESS":
            response = {"task_id": task_id, "status": "PROGRESS", "progress": task.info}  # {current, total, ...}
        elif task.state == "SUCCESS":
            response = {"task_id": task_id, "status": "SUCCESS", "progress": task.result}
        else:  # FAILURE
            response = {"task_id": task_id, "status": "FAILURE", "error": str(task.info)}

        logger.info("Returning response: %s", response)
        return jsonify({"result": "success", "data": response})
    except Exception as e:
        import logging

        logger = logging.getLogger(__name__)
        logger.exception("Error checking task status")
        return jsonify({"result": "error", "message": f"Failed to get task status: {e!s}"}), 500


@bp.route("/bulk/template", methods=["GET"])
@jwt_required
def download_csv_template():
    """
    CSV 템플릿 다운로드.

    Returns:
        CSV 파일: 사용자 일괄 생성용 템플릿
    """
    # CSV 템플릿 생성
    template_content = "email,name,password,role\n"
    template_content += "student1@example.com,Student One,password123,student\n"
    template_content += "admin@example.com,Admin User,admin123,admin\n"

    # UTF-8 BOM 추가 (Excel/Numbers에서 UTF-8 인식)
    template_bytes = b"\xef\xbb\xbf" + template_content.encode("utf-8")
    template_file = io.BytesIO(template_bytes)

    return send_file(
        template_file, mimetype="text/csv", as_attachment=True, download_name="user_bulk_create_template.csv"
    )


@bp.route("/role/assign", methods=["POST"])
@jwt_required
@admin_required
def assign_role():
    """
    사용자에게 역할 할당 (관리자만).

    Request Body:
        account_id (str): 사용자 ID
        session_id (str): 세션 ID
        role (str): 역할 ('admin' 또는 'student')

    Returns:
        JSON: 역할 할당 결과
    """
    if not request.json:
        return jsonify({"result": "error", "message": "Request body is required"}), 400

    try:
        data = AssignRoleRequest(**request.json)
    except Exception as e:
        return jsonify({"result": "error", "message": f"Invalid request data: {e!s}"}), 400

    try:
        service = UserManagementService()
        result = service.assign_role(account_id=data.account_id, session_id=data.session_id, role=data.role)

        return jsonify({"result": "success", "data": result})
    except ValueError as e:
        return jsonify({"result": "error", "message": str(e)}), 404
    except Exception as e:
        return jsonify({"result": "error", "message": f"Failed to assign role: {e!s}"}), 500
