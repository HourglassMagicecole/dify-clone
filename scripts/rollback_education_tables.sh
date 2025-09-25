#!/bin/bash
# ================================
# 교육 테이블 롤백 스크립트
# Story 0.2: 데이터베이스 마이그레이션 및 스키마 구축
# ================================

set -e  # 에러 발생 시 스크립트 중단

# 색상 코드
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 로그 함수
log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# 설정
DB_HOST=${DB_HOST:-localhost}
DB_PORT=${DB_PORT:-5432}
DB_USER=${DB_USERNAME:-postgres}
DB_PASSWORD=${DB_PASSWORD:-difyai123456}
DB_NAME=${POSTGRES_DB:-dify}

# Docker 컨테이너 사용 여부 확인
USE_DOCKER=${USE_DOCKER:-true}
CONTAINER_NAME=${CONTAINER_NAME:-docker-db-1}

log_info "교육 테이블 롤백을 시작합니다..."

# 롤백 확인
read -p "정말로 모든 교육 테이블을 삭제하시겠습니까? (y/N): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    log_warn "롤백이 취소되었습니다."
    exit 0
fi

# SQL 롤백 스크립트 생성
ROLLBACK_SQL="
-- ================================
-- 교육 테이블 롤백 스크립트
-- ================================

-- Foreign Key 제약조건이 있는 순서를 고려하여 역순으로 삭제

-- 1. 의존성이 있는 테이블들 먼저 삭제
DROP TABLE IF EXISTS education_usage_stats CASCADE;
DROP TABLE IF EXISTS education_achievements CASCADE;
DROP TABLE IF EXISTS learning_progress CASCADE;
DROP TABLE IF EXISTS education_enrollments CASCADE;

-- 2. 독립적인 테이블들 삭제
DROP TABLE IF EXISTS user_education_roles CASCADE;
DROP TABLE IF EXISTS education_activity_logs CASCADE;
DROP TABLE IF EXISTS education_api_keys CASCADE;
DROP TABLE IF EXISTS education_usage_limits CASCADE;
DROP TABLE IF EXISTS education_templates CASCADE;
DROP TABLE IF EXISTS resource_tags CASCADE;

-- 3. 기본 테이블 삭제
DROP TABLE IF EXISTS education_sessions CASCADE;

-- 완료 메시지
SELECT 'Education tables rolled back successfully!' as result;
"

# 롤백 실행
if [ "$USE_DOCKER" = "true" ]; then
    log_info "Docker 컨테이너를 통해 롤백을 실행합니다..."
    echo "$ROLLBACK_SQL" | docker exec -i $CONTAINER_NAME psql -U $DB_USER -d $DB_NAME
else
    log_info "직접 데이터베이스에 연결하여 롤백을 실행합니다..."
    export PGPASSWORD=$DB_PASSWORD
    echo "$ROLLBACK_SQL" | psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME
fi

if [ $? -eq 0 ]; then
    log_info "교육 테이블 롤백이 성공적으로 완료되었습니다."
else
    log_error "교육 테이블 롤백 중 오류가 발생했습니다."
    exit 1
fi

log_info "롤백 완료!"