#!/usr/bin/env python3
"""
교육 시스템 테스트 계정 생성 스크립트

기존 Tenant에 교육자와 학생 계정을 추가합니다.

사용법:
    uv run --project api python scripts/create_test_accounts.py
"""

import base64
import os
import sys
import uuid

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from flask import Flask

from extensions.ext_database import db
from libs.password import hash_password
from models.account import Account, AccountStatus, Tenant, TenantAccountJoin


def create_test_accounts():
    """교육 시스템 테스트 계정 생성"""
    app = Flask(__name__)

    # Database configuration
    db_uri = os.getenv("SQLALCHEMY_DATABASE_URI", "postgresql://postgres:difyai123456@localhost:5432/dify")
    app.config["SQLALCHEMY_DATABASE_URI"] = db_uri
    app.config["SQLALCHEMY_ENGINE_OPTIONS"] = {"pool_size": 30, "max_overflow": 10, "pool_recycle": 3600}

    db.init_app(app)

    with app.app_context():
        # 1. 기존 Tenant 확인
        tenant = db.session.query(Tenant).first()
        if not tenant:
            print("❌ Tenant가 없습니다. 먼저 Dify 초기화를 완료해주세요.")
            return

        print(f"✓ 기존 Tenant 발견: {tenant.name} (ID: {tenant.id})")

        # 2. 생성할 계정 정보
        test_accounts = [
            {
                "email": "instructor@test.com",
                "password": "Test1234!",
                "name": "Test Instructor",
                "role": "admin",  # Dify role
                "description": "교육자 (사용자 초대 및 세션 관리 권한)",
            },
            {
                "email": "student@test.com",
                "password": "Test1234!",
                "name": "Test Student",
                "role": "editor",  # Dify role
                "description": "학생 (리소스 생성 및 편집 권한)",
            },
        ]

        created_accounts = []

        for account_info in test_accounts:
            email = account_info["email"]
            password = account_info["password"]
            name = account_info["name"]
            role = account_info["role"]
            description = account_info["description"]

            # 3. 기존 계정 확인
            existing = db.session.query(Account).filter_by(email=email).first()
            if existing:
                print(f"\n⚠️  이미 존재하는 계정: {email}")
                print(f"   계정 ID: {existing.id}")
                print(f"   이름: {existing.name}")

                # 기존 계정의 Tenant 연결 확인
                existing_join = (
                    db.session.query(TenantAccountJoin).filter_by(tenant_id=tenant.id, account_id=existing.id).first()
                )

                if existing_join:
                    print(f"   이미 Tenant에 연결됨 (역할: {existing_join.role})")
                else:
                    print(f"   → Tenant에 연결 중... (역할: {role})")
                    join = TenantAccountJoin(tenant_id=tenant.id, account_id=existing.id, role=role, current=True)
                    db.session.add(join)

                created_accounts.append(
                    {"email": email, "password": password, "role": role, "description": description, "new": False}
                )
                continue

            # 4. Salt 생성 및 패스워드 해시
            salt = os.urandom(16)
            base64_salt = base64.b64encode(salt).decode()
            password_hashed = hash_password(password, salt)
            password_hashed_base64 = base64.b64encode(password_hashed).decode()

            # 5. Account 생성
            account_id = str(uuid.uuid4())
            account = Account(
                id=account_id,
                name=name,
                email=email,
                password=password_hashed_base64,
                password_salt=base64_salt,
                status=AccountStatus.ACTIVE,
                timezone="Asia/Seoul",
                interface_language="ko-KR",
            )

            # 6. TenantAccountJoin 생성
            join = TenantAccountJoin(
                tenant_id=tenant.id,
                account_id=account_id,
                role=role,
                current=True,  # 현재 선택된 tenant로 설정
            )

            db.session.add(account)
            db.session.add(join)

            created_accounts.append(
                {"email": email, "password": password, "role": role, "description": description, "new": True}
            )

            print(f"\n✅ 계정 생성 완료: {email}")
            print(f"   이름: {name}")
            print(f"   Dify 역할: {role}")
            print(f"   설명: {description}")

        try:
            db.session.commit()
            print("\n" + "=" * 70)
            print("🎉 테스트 계정 생성 완료!")
            print("=" * 70)

            print("\n📋 계정 정보 요약:")
            print("-" * 70)
            for acc in created_accounts:
                status = "신규 생성" if acc["new"] else "기존 계정"
                print(f"\n{status}: {acc['email']}")
                print(f"  비밀번호: {acc['password']}")
                print(f"  Dify 역할: {acc['role']}")
                print(f"  설명: {acc['description']}")

            print("\n" + "=" * 70)
            print("🌐 로그인 페이지: http://localhost:3001/signin")
            print("=" * 70)

            print("\n💡 다음 단계:")
            print("  1. Frontend 서버 시작: cd web-edu && pnpm dev")
            print("  2. Backend 서버 시작: cd api && uv run --project api python app.py")
            print("  3. 브라우저에서 http://localhost:3001/signin 접속")
            print("  4. 위 계정 정보로 로그인")

        except Exception as e:
            print(f"\n❌ 에러 발생: {e}")
            db.session.rollback()
            raise


if __name__ == "__main__":
    print("=" * 70)
    print("교육 시스템 테스트 계정 생성 스크립트")
    print("=" * 70)
    create_test_accounts()
