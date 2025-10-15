"""Dataset 생성 후 SessionResourceTag 디버깅"""

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

ACCOUNT_ID = "cc42608d-db5d-48a4-9bbb-f53475e23282"

with app.app_context():
    print("\n=== 1. 최근 생성된 Datasets ===\n")
    recent_datasets = text("""
        SELECT id, name, created_by, created_at
        FROM datasets
        ORDER BY created_at DESC
        LIMIT 5
    """)
    datasets = db.session.execute(recent_datasets).fetchall()

    if datasets:
        for row in datasets:
            print(f"Dataset: {row[1]}")
            print(f"  ID: {row[0]}")
            print(f"  Created by: {row[2]}")
            print(f"  Created at: {row[3]}")
            print()
    else:
        print("  ❌ Dataset이 없습니다")

    print("\n=== 2. 현재 SessionResourceTag 상태 ===\n")
    tag_count = text("""
        SELECT resource_type, COUNT(*)
        FROM session_resource_tags
        GROUP BY resource_type
    """)
    tags = db.session.execute(tag_count).fetchall()

    for row in tags:
        print(f"  {row[0]}: {row[1]}개")

    print("\n=== 3. 최근 SessionResourceTag 레코드 ===\n")
    recent_tags = text("""
        SELECT id, session_id, resource_type, resource_id, account_id, tagged_at
        FROM session_resource_tags
        ORDER BY tagged_at DESC
        LIMIT 5
    """)
    tags = db.session.execute(recent_tags).fetchall()

    if tags:
        for row in tags:
            print(f"{row[2]}: {str(row[3])[:8]}...")
            print(f"  Session: {str(row[1])[:8]}...")
            print(f"  Account: {str(row[4])[:8]}...")
            print(f"  Tagged at: {row[5]}")
            print()
    else:
        print("  ❌ SessionResourceTag가 비어있습니다")

    print("\n=== 4. get_user_active_session() 테스트 ===\n")
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
