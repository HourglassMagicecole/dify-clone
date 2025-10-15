"""
간단한 스크립트: SessionResourceTag 테이블 데이터 확인
"""

import sys
from pathlib import Path

# Add api directory to path
api_dir = Path(__file__).parent.parent
sys.path.insert(0, str(api_dir))

from app import create_flask_app_with_configs
from extensions.ext_database import db
from models.dataset import Dataset
from models.education.resource_tag import SessionResourceTag
from models.model import App

# Flask app 초기화
app = create_flask_app_with_configs()

with app.app_context():
    # SessionResourceTag 테이블의 모든 레코드 조회
    tags = db.session.query(SessionResourceTag).all()

    print("\n=== SessionResourceTag 테이블 ===")
    print(f"총 {len(tags)}개의 레코드\n")

    # resource_type별로 그룹화
    type_count = {}
    for tag in tags:
        resource_type = tag.resource_type
        type_count[resource_type] = type_count.get(resource_type, 0) + 1

    print("resource_type별 개수:")
    for resource_type, count in type_count.items():
        print(f"  - {resource_type}: {count}개")

    print("\n상세 내역 (최대 10개):")
    for tag in tags[:10]:
        print(f"  ID: {tag.id}")
        print(f"  Type: {tag.resource_type}")
        print(f"  Resource ID: {tag.resource_id}")
        print(f"  Account ID: {tag.account_id}")
        print(f"  Session ID: {tag.session_id}")
        print("  ---")

    # 실제 Dataset 개수 확인
    print("\n=== 실제 리소스 개수 ===")
    app_count = db.session.query(App).count()
    dataset_count = db.session.query(Dataset).count()
    print(f"App (전체): {app_count}개")
    print(f"Dataset (전체): {dataset_count}개")
