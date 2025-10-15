"""
Dataset을 SessionResourceTag에 추가하는 스크립트
Agent의 session_id를 찾아서 같은 세션에 Dataset 추가
"""

import os
import sys

# 환경 변수 설정 (storage 에러 방지)
os.environ["STORAGE_TYPE"] = "local"
os.environ["STORAGE_LOCAL_PATH"] = "storage"

# API 디렉토리를 Python path에 추가
sys.path.insert(0, "/Users/bhahn/MyProject/dify-clone2/api")

from flask import Flask
from sqlalchemy import text

from extensions.ext_database import db

# 간단한 Flask app 생성 (storage 초기화 없이)
app = Flask(__name__)
app.config["SQLALCHEMY_DATABASE_URI"] = "postgresql://postgres:difyai123456@localhost:5432/dify"
app.config["SQLALCHEMY_ENGINE_OPTIONS"] = {
    "pool_size": 30,
    "max_overflow": 10,
    "pool_recycle": -1,
    "pool_pre_ping": False,
}
db.init_app(app)

AGENT_ID = "322bd6e7-18fb-4d40-9d8b-121ca3b7d371"
DATASET_ID = "a21164b1-fb00-4dbb-bd8b-af36242fc6ba"

with app.app_context():
    # 1. Agent의 session_id와 account_id 조회
    query = text("""
        SELECT session_id, account_id
        FROM session_resource_tags
        WHERE resource_id = :agent_id
        LIMIT 1
    """)
    result = db.session.execute(query, {"agent_id": AGENT_ID}).fetchone()

    if not result:
        print(f"❌ Agent ID {AGENT_ID}를 SessionResourceTag에서 찾을 수 없습니다.")
        sys.exit(1)

    session_id = result[0]
    account_id = result[1]

    print("✅ Agent 정보 찾음:")
    print(f"   Session ID: {session_id}")
    print(f"   Account ID: {account_id}")

    # 2. Dataset이 이미 태그되어 있는지 확인
    check_query = text("""
        SELECT id
        FROM session_resource_tags
        WHERE resource_id = :dataset_id
    """)
    existing = db.session.execute(check_query, {"dataset_id": DATASET_ID}).fetchone()

    if existing:
        print(f"\n⚠️  Dataset이 이미 SessionResourceTag에 있습니다 (tag_id: {existing[0]})")
    else:
        # 3. Dataset을 SessionResourceTag에 추가
        insert_query = text("""
            INSERT INTO session_resource_tags
            (id, session_id, resource_type, resource_id, account_id, tagged_at, created_at)
            VALUES (gen_random_uuid(), :session_id, 'dataset', :dataset_id, :account_id, NOW(), NOW())
            RETURNING id
        """)
        new_tag = db.session.execute(
            insert_query, {"session_id": session_id, "dataset_id": DATASET_ID, "account_id": account_id}
        ).fetchone()
        db.session.commit()

        if new_tag:
            print("\n✅ Dataset을 SessionResourceTag에 추가했습니다!")
            print(f"   Tag ID: {new_tag[0]}")
            print(f"   Dataset ID: {DATASET_ID}")

    # 4. 현재 SessionResourceTag 상태 확인
    count_query = text("""
        SELECT resource_type, COUNT(*) as count
        FROM session_resource_tags
        WHERE session_id = :session_id
        GROUP BY resource_type
    """)
    counts = db.session.execute(count_query, {"session_id": session_id}).fetchall()

    print(f"\n📊 Session {session_id}의 리소스:")
    for row in counts:
        print(f"   - {row[0]}: {row[1]}개")

    print("\n🎉 완료! 이제 대시보드를 새로고침하세요.")
