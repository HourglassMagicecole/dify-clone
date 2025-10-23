"""Celery task for bulk user creation from CSV."""

import csv
import io

from celery import shared_task

from extensions.ext_database import db
from models.account import Account
from services.education_management.user_management_service import UserManagementService


def sanitize_csv_field(value: str) -> str:
    """
    CSV injection 방어를 위한 필드 값 검증 및 정리.

    =, +, -, @ 문자로 시작하는 값은 Excel 등에서 수식으로 해석될 수 있으므로
    앞에 작은따옴표(')를 추가하여 이스케이프 처리합니다.

    Args:
        value: CSV 필드 값

    Returns:
        정리된 필드 값
    """
    if not value:
        return value

    # Strip whitespace first
    value = value.strip()

    # CSV injection 방어: =, +, -, @ 로 시작하는 값 이스케이프
    if value and value[0] in ["=", "+", "-", "@"]:
        return "'" + value

    return value


@shared_task(bind=True, queue="generation", ignore_result=False)
def bulk_create_users_task(self, csv_content: str, session_id: str | None, created_by: str) -> dict:
    """
    CSV 파일로 사용자 일괄 생성 (Celery 태스크).

    Args:
        self: Celery task instance (bind=True로 인해 자동 전달)
        csv_content: CSV 파일 내용
        session_id: 세션 ID (선택적)
        created_by: 생성자 ID

    Returns:
        일괄 생성 결과

    Example CSV format:
        email,name,password,role
        student1@example.com,Student One,password123,student
        admin@example.com,Admin User,admin123,admin
    """
    service = UserManagementService()

    # 생성자 계정 조회
    creator_account = db.session.query(Account).filter_by(id=created_by).first()
    if not creator_account:
        raise ValueError(f"Creator account not found: {created_by}")

    # CSV 파싱
    import logging

    logger = logging.getLogger(__name__)
    logger.info("Starting bulk user creation. CSV content length: %d", len(csv_content))

    csv_file = io.StringIO(csv_content)
    reader = csv.DictReader(csv_file)
    users = list(reader)

    logger.info("Parsed CSV. Total users: %d", len(users))
    if users:
        logger.info("First user sample: %s", users[0])

    total = len(users)
    created = 0
    failed = 0
    errors: list[dict[str, str]] = []

    for idx, user_row in enumerate(users):
        try:
            # CSV injection 방어를 위한 필드 정리
            email = sanitize_csv_field(user_row.get("email", ""))
            name = sanitize_csv_field(user_row.get("name", ""))
            password = sanitize_csv_field(user_row.get("password", ""))
            role = sanitize_csv_field(user_row.get("role", "student"))

            if not email or not name or not password:
                raise ValueError("Email, name, and password are required")

            # 사용자 생성
            user = service.create_user(
                email=email, name=name, password=password, role=role, creator_account=creator_account
            )
            created += 1

            # 세션이 지정된 경우, 세션 멤버로 추가 (AC 9)
            if session_id:
                from services.edu_session_member_service import EduSessionMemberService

                try:
                    EduSessionMemberService.add_member(session_id, user["id"], db.session)  # type: ignore[arg-type]
                    logger.info("User %s added to session %s", user["id"], session_id)
                except Exception as e:
                    logger.warning("Failed to add user %s to session %s: %s", user["id"], session_id, e)
                    # 멤버 추가 실패해도 사용자 생성은 성공으로 처리

        except Exception as e:
            failed += 1
            errors.append({"email": user_row.get("email", "unknown"), "error": str(e)})

        # 진행 상황 업데이트
        self.update_state(
            state="PROGRESS",
            meta={
                "current": idx + 1,
                "total": total,
                "created": created,
                "failed": failed,
                "errors": errors[-10:],
            },  # 최근 10개 오류만 반환
        )

    # 최종 결과
    return {"current": total, "total": total, "created": created, "failed": failed, "errors": errors}
