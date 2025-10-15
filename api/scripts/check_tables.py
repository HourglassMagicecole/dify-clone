"""데이터베이스 테이블 확인"""

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

with app.app_context():
    # education 관련 테이블 확인
    query = text("""
        SELECT table_name
        FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name LIKE '%education%' OR table_name LIKE '%session%'
        ORDER BY table_name
    """)
    tables = db.session.execute(query).fetchall()

    print("\n=== Education/Session 관련 테이블 ===\n")
    if not tables:
        print("❌ education 관련 테이블이 하나도 없습니다!")
    else:
        for row in tables:
            print(f"  - {row[0]}")

    # session_resource_tags 테이블 확인
    print("\n=== session_resource_tags 테이블 구조 ===\n")
    columns_query = text("""
        SELECT column_name, data_type
        FROM information_schema.columns
        WHERE table_name = 'session_resource_tags'
        ORDER BY ordinal_position
    """)
    columns = db.session.execute(columns_query).fetchall()

    if columns:
        for row in columns:
            print(f"  - {row[0]}: {row[1]}")
    else:
        print("  ❌ session_resource_tags 테이블이 없습니다!")
