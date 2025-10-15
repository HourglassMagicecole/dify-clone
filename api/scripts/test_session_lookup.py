"""현재 사용자의 활성 세션 조회 테스트"""

import os
import sys

os.environ["STORAGE_TYPE"] = "local"
os.environ["STORAGE_LOCAL_PATH"] = "storage"

sys.path.insert(0, "/Users/bhahn/MyProject/dify-clone2/api")

from flask import Flask
from sqlalchemy import text

from extensions.ext_database import db

app = Flask(__name__)
app.config["SQLALCHEMY_DATABASE_URI"] = "postgresql://postgres:difyai123456@localhost:5432/dify"
app.config["SQLALCHEMY_ENGINE_OPTIONS"] = {
    "pool_size": 30,
    "max_overflow": 10,
    "pool_recycle": -1,
    "pool_pre_ping": False,
}
db.init_app(app)

# 테스트할 account_id (Agent가 있는 계정)
ACCOUNT_ID = "cc42608d-db5d-48a4-9bbb-f53475e23282"

with app.app_context():
    print(f"\n=== 계정 {ACCOUNT_ID}의 활성 세션 조회 ===\n")

    # 1. 이 계정의 세션 멤버십 확인
    membership_query = text("""
        SELECT sm.session_id, sm.status, es.session_name, es.is_active
        FROM education_session_members sm
        JOIN education_sessions es ON sm.session_id = es.id
        WHERE sm.account_id = :account_id
        ORDER BY es.created_at DESC
    """)
    memberships = db.session.execute(membership_query, {"account_id": ACCOUNT_ID}).fetchall()

    print("세션 멤버십:")
    if not memberships:
        print("  ❌ 이 계정은 어떤 세션에도 속해있지 않습니다!")
    else:
        for row in memberships:
            print(f"  - Session: {row[2]}")
            print(f"    ID: {row[0]}")
            print(f"    멤버 상태: {row[1]}")
            print(f"    세션 활성: {row[3]}")
            print()

    # 2. get_user_active_session 함수 테스트
    print("\n=== get_user_active_session() 함수 테스트 ===\n")

    from services.edu.session_helper import get_user_active_session

    try:
        session = get_user_active_session(ACCOUNT_ID)
        if session:
            print("✅ 활성 세션 찾음:")
            print(f"   Session ID: {session.id}")
            print(f"   Session Name: {session.session_name}")
            print(f"   Is Active: {session.is_active}")
        else:
            print("❌ 활성 세션을 찾지 못했습니다")
    except Exception as e:
        print(f"❌ 에러 발생: {e}")
        import traceback

        traceback.print_exc()

    # 3. 현재 Datasets 확인
    print("\n=== 현재 Datasets ===\n")
    dataset_query = text("""
        SELECT id, name, created_by
        FROM datasets
        ORDER BY created_at DESC
        LIMIT 5
    """)
    datasets = db.session.execute(dataset_query).fetchall()

    for row in datasets:
        print(f"  - {row[1]}")
        print(f"    ID: {row[0]}")
        print(f"    Created by: {row[2]}")
        print()
