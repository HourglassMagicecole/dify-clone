#!/bin/bash
# ================================
# 교육 데이터베이스 백업 스크립트
# Story 0.2: 데이터베이스 마이그레이션 및 스키마 구축
# ================================

set -e  # 에러 발생 시 스크립트 중단

# 색상 코드
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
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

log_debug() {
    echo -e "${BLUE}[DEBUG]${NC} $1"
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

# 백업 디렉토리 설정
BACKUP_DIR=${BACKUP_DIR:-"/Users/bhahn/MyProject/dify-clone/backups"}
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="education_backup_${TIMESTAMP}.sql"
BACKUP_PATH="$BACKUP_DIR/$BACKUP_FILE"

# 백업 디렉토리 생성
mkdir -p "$BACKUP_DIR"

log_info "교육 데이터베이스 백업을 시작합니다..."
log_debug "백업 파일: $BACKUP_PATH"

# 교육 테이블 목록
EDUCATION_TABLES=(
    "education_sessions"
    "education_enrollments"
    "resource_tags"
    "learning_progress"
    "education_templates"
    "education_api_keys"
    "education_usage_limits"
    "education_usage_stats"
    "education_activity_logs"
    "user_education_roles"
    "education_achievements"
)

# 백업 유형 선택
BACKUP_TYPE=${1:-"data"}  # schema, data, full

case $BACKUP_TYPE in
    "schema")
        log_info "스키마만 백업합니다..."
        DUMP_OPTIONS="--schema-only"
        ;;
    "data")
        log_info "데이터만 백업합니다..."
        DUMP_OPTIONS="--data-only"
        ;;
    "full")
        log_info "스키마와 데이터를 모두 백업합니다..."
        DUMP_OPTIONS=""
        ;;
    *)
        log_error "잘못된 백업 유형입니다. (schema|data|full)"
        exit 1
        ;;
esac

# 테이블 목록을 옵션으로 변환
TABLE_OPTIONS=""
for table in "${EDUCATION_TABLES[@]}"; do
    TABLE_OPTIONS="$TABLE_OPTIONS --table=$table"
done

# 백업 실행
if [ "$USE_DOCKER" = "true" ]; then
    log_info "Docker 컨테이너를 통해 백업을 실행합니다..."
    docker exec $CONTAINER_NAME pg_dump -U $DB_USER -d $DB_NAME $DUMP_OPTIONS $TABLE_OPTIONS > "$BACKUP_PATH"
else
    log_info "직접 데이터베이스에 연결하여 백업을 실행합니다..."
    export PGPASSWORD=$DB_PASSWORD
    pg_dump -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME $DUMP_OPTIONS $TABLE_OPTIONS > "$BACKUP_PATH"
fi

if [ $? -eq 0 ]; then
    BACKUP_SIZE=$(du -h "$BACKUP_PATH" | cut -f1)
    log_info "교육 데이터베이스 백업이 성공적으로 완료되었습니다."
    log_info "백업 파일: $BACKUP_PATH"
    log_info "백업 크기: $BACKUP_SIZE"

    # 백업 파일 압축
    log_info "백업 파일을 압축합니다..."
    gzip "$BACKUP_PATH"
    COMPRESSED_PATH="${BACKUP_PATH}.gz"
    COMPRESSED_SIZE=$(du -h "$COMPRESSED_PATH" | cut -f1)
    log_info "압축 완료: $COMPRESSED_PATH"
    log_info "압축 크기: $COMPRESSED_SIZE"

    # 백업 검증
    log_info "백업 파일을 검증합니다..."

    # 1. 압축 무결성 검증
    if gunzip -t "$COMPRESSED_PATH" 2>/dev/null; then
        log_info "✓ 압축 무결성 검증 성공"
    else
        log_error "압축 무결성 검증 실패"
        exit 1
    fi

    # 2. 백업 파일 크기 검증 (최소 크기 확인)
    MIN_SIZE=1024  # 최소 1KB
    ACTUAL_SIZE=$(stat -f%z "$COMPRESSED_PATH" 2>/dev/null || stat -c%s "$COMPRESSED_PATH" 2>/dev/null)
    if [ "$ACTUAL_SIZE" -lt "$MIN_SIZE" ]; then
        log_error "백업 파일이 너무 작습니다 (크기: ${ACTUAL_SIZE} bytes)"
        exit 1
    fi
    log_info "✓ 파일 크기 검증 성공 (크기: ${ACTUAL_SIZE} bytes)"

    # 3. SQL 구문 검증 (압축 해제 후 첫 부분 확인)
    gunzip -c "$COMPRESSED_PATH" | head -n 20 | grep -q "PostgreSQL database dump" || {
        log_error "백업 파일이 올바른 PostgreSQL 덤프 형식이 아닙니다"
        exit 1
    }
    log_info "✓ SQL 형식 검증 성공"

    # 4. 테이블 검증 (백업된 테이블 목록 확인)
    BACKED_UP_TABLES=$(gunzip -c "$COMPRESSED_PATH" | grep -E "^(CREATE TABLE|COPY)" | wc -l)
    if [ "$BACKED_UP_TABLES" -eq 0 ] && [ "$BACKUP_TYPE" != "data" ]; then
        log_error "백업 파일에 테이블 정의가 없습니다"
        exit 1
    fi
    log_info "✓ 백업된 객체 수: $BACKED_UP_TABLES"

    # 5. 체크섬 생성 및 저장
    CHECKSUM=$(gunzip -c "$COMPRESSED_PATH" | shasum -a 256 | awk '{print $1}')
    echo "$CHECKSUM  $COMPRESSED_PATH" > "${COMPRESSED_PATH}.sha256"
    log_info "✓ 체크섬 생성: ${CHECKSUM:0:16}..."

    # 6. 메타데이터 저장
    cat > "${COMPRESSED_PATH}.meta" <<EOF
backup_date: $TIMESTAMP
backup_type: $BACKUP_TYPE
database: $DB_NAME
tables_count: ${#EDUCATION_TABLES[@]}
file_size: $ACTUAL_SIZE
checksum: $CHECKSUM
verified: $(date +"%Y-%m-%d %H:%M:%S")
EOF
    log_info "✓ 백업 메타데이터 저장 완료"

    log_info "백업 검증 완료 - 모든 검사 통과"

else
    log_error "교육 데이터베이스 백업 중 오류가 발생했습니다."
    exit 1
fi

# 오래된 백업 정리 (7일 이상된 백업 삭제)
log_info "오래된 백업 파일을 정리합니다..."
find "$BACKUP_DIR" -name "education_backup_*.sql.gz" -mtime +7 -delete
REMAINING_BACKUPS=$(find "$BACKUP_DIR" -name "education_backup_*.sql.gz" | wc -l)
log_info "남은 백업 파일 수: $REMAINING_BACKUPS"

log_info "백업 완료!"
echo
log_info "백업 복원 방법:"
log_info "  gunzip -c $COMPRESSED_PATH | docker exec -i $CONTAINER_NAME psql -U $DB_USER -d $DB_NAME"