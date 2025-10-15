"""현재 SessionResourceTag 상태 확인"""

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
    # 1. SessionResourceTag 전체 개수
    query = text("SELECT resource_type, COUNT(*) FROM session_resource_tags GROUP BY resource_type")
    results = db.session.execute(query).fetchall()

    print("\n=== SessionResourceTag 현재 상태 ===")
    for row in results:
        print(f"{row[0]}: {row[1]}개")

    # 2. 실제 리소스 개수
    app_query = text("SELECT COUNT(*) FROM apps")
    dataset_query = text("SELECT COUNT(*) FROM datasets")

    app_count = db.session.execute(app_query).scalar()
    dataset_count = db.session.execute(dataset_query).scalar()

    print("\n=== 실제 리소스 개수 ===")
    print(f"Apps: {app_count}개")
    print(f"Datasets: {dataset_count}개")

    # 3. Dataset과 JOIN한 결과
    join_query = text("""
        SELECT COUNT(DISTINCT srt.id)
        FROM session_resource_tags srt
        JOIN datasets d ON srt.resource_id = d.id
        WHERE srt.resource_type = 'dataset'
    """)
    joined_count = db.session.execute(join_query).scalar()

    print("\n=== JOIN 후 Dataset 개수 ===")
    print(f"Dataset (JOIN 후): {joined_count}개")

    # 4. 최근 SessionResourceTag 레코드
    recent_query = text("""
        SELECT id, resource_type, resource_id, tagged_at
        FROM session_resource_tags
        ORDER BY tagged_at DESC
        LIMIT 5
    """)
    recent = db.session.execute(recent_query).fetchall()

    print("\n=== 최근 SessionResourceTag 레코드 ===")
    for row in recent:
        print(f"{row[1]}: {row[2][:8]}... (tagged: {row[3]})")
