#!/usr/bin/env python3
"""
교육 시스템 테스트 세션 생성 스크립트

테스트 계정을 위한 교육 세션을 생성하고 멤버십을 설정합니다.

사용법:
    uv run --project api python scripts/create_test_session.py
"""

import os
import sys
from datetime import UTC, datetime

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from flask import Flask

from extensions.ext_database import db
from models.account import Account, Tenant
from models.education.session import EducationSession
from models.education.session_member import EducationSessionMember
from models.education.user_role import EduUserRole


def create_test_session():
    """테스트 세션 생성 및 멤버십 설정"""
    app = Flask(__name__)

    # Database configuration
    db_uri = os.getenv("SQLALCHEMY_DATABASE_URI", "postgresql://postgres:difyai123456@localhost:5432/dify")
    app.config["SQLALCHEMY_DATABASE_URI"] = db_uri
    app.config["SQLALCHEMY_ENGINE_OPTIONS"] = {"pool_size": 30, "max_overflow": 10, "pool_recycle": 3600}

    db.init_app(app)

    with app.app_context():
        # 1. Tenant 확인
        tenant = db.session.query(Tenant).first()
        if not tenant:
            print("❌ Tenant가 없습니다. 먼저 Dify 초기화를 완료해주세요.")
            return

        print(f"✓ Tenant 발견: {tenant.name} (ID: {tenant.id})")

        # 2. 테스트 계정 확인
        instructor = db.session.query(Account).filter_by(email="instructor@test.com").first()
        student = db.session.query(Account).filter_by(email="student@test.com").first()

        if not instructor or not student:
            print("❌ 테스트 계정이 없습니다. 먼저 create_test_accounts.py를 실행해주세요.")
            return

        print("✓ 테스트 계정 발견:")
        print(f"  - Instructor: {instructor.email} (ID: {instructor.id})")
        print(f"  - Student: {student.email} (ID: {student.id})")

        # 3. 테스트 세션 확인/생성
        session_id = "00000000-0000-0000-0000-000000000001"
        existing_session = db.session.query(EducationSession).filter_by(id=session_id).first()

        if existing_session:
            print(f"\n⚠️  이미 존재하는 세션: {existing_session.session_name}")
            session = existing_session
        else:
            session = EducationSession(
                id=session_id,
                session_name="Test Session",
                session_tag="test-session",
                tenant_id=tenant.id,
                instructor_account_id=instructor.id,
                start_date=datetime.now(UTC),
                end_date=None,  # 무제한
                max_students=50,
                is_active=True,
                description="테스트용 교육 세션",
            )
            db.session.add(session)
            print(f"\n✅ 테스트 세션 생성: {session.session_name} (ID: {session.id})")

        # 4. 세션 멤버십 확인/생성
        members_to_add = [
            {"account": instructor, "role": "admin", "description": "교육자 (세션 관리자)"},
            {"account": student, "role": "normal", "description": "학생 (일반 멤버)"},
        ]

        for member_info in members_to_add:
            account = member_info["account"]
            role = member_info["role"]
            description = member_info["description"]

            # 멤버십 확인
            existing_member = (
                db.session.query(EducationSessionMember).filter_by(session_id=session.id, account_id=account.id).first()
            )

            if existing_member:
                print(f"\n⚠️  이미 멤버로 등록됨: {account.email}")
                if existing_member.status != "active":
                    print(f"   ⚠️  상태 업데이트: {existing_member.status} → active")
                    existing_member.status = "active"
            else:
                # 멤버십 생성
                member = EducationSessionMember(
                    session_id=session.id,
                    account_id=account.id,
                    status="active",
                )
                db.session.add(member)
                print(f"\n✅ 멤버십 생성: {account.email}")

            # 역할 확인/생성
            existing_role = (
                db.session.query(EduUserRole).filter_by(session_id=session.id, account_id=account.id).first()
            )

            if existing_role:
                if existing_role.role != role:
                    print(f"   ⚠️  역할 업데이트: {existing_role.role} → {role}")
                    existing_role.role = role
                else:
                    print(f"   ✓ 역할 이미 설정됨: {role}")
            else:
                user_role = EduUserRole(
                    session_id=session.id,
                    account_id=account.id,
                    role=role,
                    assigned_by=instructor.id,
                )
                db.session.add(user_role)
                print(f"   ✅ 역할 설정: {role}")

            print(f"   설명: {description}")

        try:
            db.session.commit()
            print("\n" + "=" * 70)
            print("🎉 테스트 세션 생성 완료!")
            print("=" * 70)

            print("\n📋 세션 정보:")
            print("-" * 70)
            print(f"세션 ID: {session.id}")
            print(f"세션 이름: {session.session_name}")
            print(f"설명: {session.description}")
            print(f"세션 태그: {session.session_tag}")
            print(f"Tenant ID: {session.tenant_id}")

            print("\n👥 멤버 목록:")
            print("-" * 70)
            for member_info in members_to_add:
                account = member_info["account"]
                role = member_info["role"]
                description = member_info["description"]
                print(f"\n{account.email}")
                print(f"  역할: {role}")
                print(f"  설명: {description}")

            print("\n" + "=" * 70)
            print("✅ 이제 로그인하면 정상 작동합니다!")
            print("=" * 70)

            print("\n💡 다음 단계:")
            print("  1. Backend 서버가 실행 중인지 확인")
            print("  2. Frontend 서버 재시작: cd web-edu && pnpm dev")
            print("  3. http://localhost:3001/signin 에서 로그인")
            print("  4. instructor@test.com 또는 student@test.com으로 테스트")

        except Exception as e:
            print(f"\n❌ 에러 발생: {e}")
            db.session.rollback()
            raise


if __name__ == "__main__":
    print("=" * 70)
    print("교육 시스템 테스트 세션 생성 스크립트")
    print("=" * 70)
    create_test_session()
