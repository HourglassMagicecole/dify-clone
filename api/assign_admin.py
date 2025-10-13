"""Script to assign admin role to a user for testing."""

from datetime import UTC, datetime, timedelta

from app_factory import create_app
from extensions.ext_database import db
from models.account import TenantAccountJoin
from models.education import EduUserRole
from models.education.session import EducationSession


def create_test_session(instructor_id: str) -> str:
    """
    Create a test education session.

    Args:
        instructor_id: Instructor account ID

    Returns:
        Created session ID
    """
    # 강사의 tenant_id 조회
    tenant_join = (
        db.session.query(TenantAccountJoin)
        .filter(TenantAccountJoin.account_id == instructor_id, TenantAccountJoin.current == True)
        .first()
    )

    if not tenant_join:
        raise ValueError(f"Instructor {instructor_id}의 tenant를 찾을 수 없습니다.")

    tenant_id = tenant_join.tenant_id

    # 테스트 세션 ID 사용
    test_session_id = "00000000-0000-0000-0000-000000000001"

    # 이미 존재하는지 확인
    existing_session = db.session.query(EducationSession).filter(EducationSession.id == test_session_id).first()

    if existing_session:
        print(f"✅ 테스트 세션이 이미 존재합니다: {existing_session.session_name}")
        return test_session_id

    # 새 테스트 세션 생성
    session = EducationSession(
        id=test_session_id,
        session_name="Test Session for Role Management",
        session_tag="test-session-001",
        tenant_id=tenant_id,
        instructor_account_id=instructor_id,
        start_date=datetime.now(UTC),
        end_date=datetime.now(UTC) + timedelta(days=30),
        max_students=50,
        is_active=True,
        description="테스트용 교육 세션 (Story 1.4B admin 역할 테스트)",
    )

    db.session.add(session)
    db.session.commit()

    print("✅ 테스트 세션 생성 완료!")
    print(f"   Session ID: {session.id}")
    print(f"   Session Name: {session.session_name}")
    print(f"   Tenant ID: {tenant_id}")

    return test_session_id


def assign_admin_role(account_id: str, session_id: str) -> None:
    """
    Assign admin role to a user for testing purposes.

    Args:
        account_id: User account ID
        session_id: Education session ID

    Note:
        Must be called within app context.
    """
    # 기존 역할이 있는지 확인
    existing_role = (
        db.session.query(EduUserRole)
        .filter(EduUserRole.session_id == session_id, EduUserRole.account_id == account_id)
        .first()
    )

    if existing_role:
        if existing_role.role == "admin":
            print(f"✅ 사용자 {account_id}는 이미 admin 역할을 가지고 있습니다.")
            return
        else:
            # 기존 역할 업데이트
            existing_role.role = "admin"
            existing_role.assigned_at = datetime.now(UTC)
            db.session.commit()
            print(f"✅ 사용자 {account_id}의 역할을 admin으로 업데이트했습니다!")
            return

    # 새로운 admin 역할 생성
    role = EduUserRole(
        session_id=session_id,
        account_id=account_id,
        role="admin",
        assigned_by=None,  # 시스템 할당
        assigned_at=datetime.now(UTC),
    )

    db.session.add(role)
    db.session.commit()

    print(f"✅ 사용자 {account_id}에게 admin 역할을 할당했습니다!")
    print(f"   Session ID: {session_id}")
    print("   Role: admin")


if __name__ == "__main__":
    app = create_app()

    with app.app_context():
        # bhahn 사용자에게 admin 역할 할당
        BHAHN_ID = "df2d9ed8-ab01-4ecf-baa5-eee441d1a656"
        TEST_USER_ID = "3ecdf286-1550-45c8-9ece-aa870a52e31c"

        print("\n" + "=" * 60)
        print("=== Story 1.4B: Admin 역할 할당 스크립트 ===")
        print("=" * 60 + "\n")

        # Step 1: 테스트 세션 생성
        print("Step 1: 테스트 교육 세션 생성\n")
        session_id = create_test_session(BHAHN_ID)

        print("\n" + "-" * 60 + "\n")

        # Step 2: Admin 역할 할당
        print("Step 2: Admin 역할 할당\n")
        print("bhahn (hourglass@magice.co)에게 admin 역할 할당")
        assign_admin_role(BHAHN_ID, session_id)

        print("\n" + "-" * 60 + "\n")
        print("테스트를 위해 test@example.com은 normal 사용자로 남겨둡니다.")

        print("\n⚠️  IMPORTANT: Frontend .env.local 파일도 업데이트해야 합니다!")
        print(f"   NEXT_PUBLIC_DEFAULT_SESSION_ID={session_id}")

        print("\n📋 수동 테스트 가이드:")
        print("   1. Frontend 서버 실행: cd web-edu && pnpm dev")
        print("   2. 브라우저에서 http://localhost:3001 접속")
        print("\n   3. Normal 사용자 테스트:")
        print("      - test@example.com으로 로그인")
        print("      - /admin 접근 시도")
        print("      - 예상: /403 페이지로 리다이렉트 ✅")
        print("\n   4. Admin 사용자 테스트:")
        print("      - hourglass@magice.co로 로그인")
        print("      - /admin 접근")
        print("      - 예상: '관리자 페이지' 표시 ✅")

        print("\n" + "=" * 60)
