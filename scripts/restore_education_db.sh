#!/bin/bash
# ================================
# 교육 데이터베이스 복원 스크립트
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

# 사용법 표시
show_usage() {
    echo "사용법: $0 <backup_file> [options]"
    echo
    echo "옵션:"
    echo "  --clean        복원 전에 기존 교육 테이블 삭제"
    echo "  --docker       Docker 컨테이너 사용 (기본값)"
    echo "  --direct       직접 데이터베이스 연결"
    echo "  --dry-run      실제 복원 없이 명령어만 표시"
    echo
    echo "예제:"
    echo "  $0 /path/to/backup.sql.gz --clean"
    echo "  $0 education_backup_20231225_120000.sql.gz"
    exit 1
}

# 파라미터 확인
if [ $# -eq 0 ]; then
    show_usage
fi

BACKUP_FILE=$1
shift

# 옵션 파싱
CLEAN_TABLES=false
USE_DOCKER=true
DRY_RUN=false

while [[ $# -gt 0 ]]; do
    case $1 in
        --clean)
            CLEAN_TABLES=true
            shift
            ;;
        --docker)
            USE_DOCKER=true
            shift
            ;;
        --direct)
            USE_DOCKER=false
            shift
            ;;
        --dry-run)
            DRY_RUN=true
            shift
            ;;
        *)
            log_error "알 수 없는 옵션: $1"
            show_usage
            ;;
    esac
done

# 설정
DB_HOST=${DB_HOST:-localhost}
DB_PORT=${DB_PORT:-5432}
DB_USER=${DB_USERNAME:-postgres}
DB_PASSWORD=${DB_PASSWORD:-difyai123456}
DB_NAME=${POSTGRES_DB:-dify}
CONTAINER_NAME=${CONTAINER_NAME:-docker-db-1}

# 백업 파일 경로 처리
if [[ ! "$BACKUP_FILE" = /* ]]; then
    # 상대 경로인 경우 backups 디렉토리에서 찾기
    BACKUP_DIR="/Users/bhahn/MyProject/dify-clone/backups"
    BACKUP_FILE="$BACKUP_DIR/$BACKUP_FILE"
fi

# 백업 파일 존재 확인
if [ ! -f "$BACKUP_FILE" ]; then
    log_error "백업 파일을 찾을 수 없습니다: $BACKUP_FILE"
    exit 1
fi

log_info "교육 데이터베이스 복원을 시작합니다..."
log_debug "백업 파일: $BACKUP_FILE"
log_debug "Docker 사용: $USE_DOCKER"
log_debug "테이블 정리: $CLEAN_TABLES"
log_debug "Dry Run: $DRY_RUN"

# 백업 파일 검증
if [[ "$BACKUP_FILE" == *.gz ]]; then
    log_info "압축된 백업 파일을 검증합니다..."
    if ! gunzip -t "$BACKUP_FILE" 2>/dev/null; then
        log_error "백업 파일이 손상되었습니다."
        exit 1
    fi
    DECOMPRESS_CMD="gunzip -c"
else
    DECOMPRESS_CMD="cat"
fi

# 복원 확인
if [ "$DRY_RUN" = false ]; then
    echo
    log_warn "다음 작업을 수행합니다:"
    [ "$CLEAN_TABLES" = true ] && echo "  - 기존 교육 테이블 삭제"
    echo "  - 백업 파일 복원: $(basename $BACKUP_FILE)"
    echo
    read -p "계속하시겠습니까? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        log_warn "복원이 취소되었습니다."
        exit 0
    fi
fi

# 기존 테이블 정리 (옵션)
if [ "$CLEAN_TABLES" = true ]; then
    log_info "기존 교육 테이블을 삭제합니다..."

    CLEAN_SQL="
    DROP TABLE IF EXISTS education_usage_stats CASCADE;
    DROP TABLE IF EXISTS education_achievements CASCADE;
    DROP TABLE IF EXISTS learning_progress CASCADE;
    DROP TABLE IF EXISTS education_enrollments CASCADE;
    DROP TABLE IF EXISTS user_education_roles CASCADE;
    DROP TABLE IF EXISTS education_activity_logs CASCADE;
    DROP TABLE IF EXISTS education_api_keys CASCADE;
    DROP TABLE IF EXISTS education_usage_limits CASCADE;
    DROP TABLE IF EXISTS education_templates CASCADE;
    DROP TABLE IF EXISTS resource_tags CASCADE;
    DROP TABLE IF EXISTS education_sessions CASCADE;
    "

    if [ "$DRY_RUN" = true ]; then
        log_debug "Dry Run - 테이블 정리 명령어:"
        echo "$CLEAN_SQL"
    else
        if [ "$USE_DOCKER" = true ]; then
            echo "$CLEAN_SQL" | docker exec -i $CONTAINER_NAME psql -U $DB_USER -d $DB_NAME
        else
            export PGPASSWORD=$DB_PASSWORD
            echo "$CLEAN_SQL" | psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME
        fi
    fi
fi

# 백업 복원
log_info "백업 파일을 복원합니다..."

if [ "$DRY_RUN" = true ]; then
    log_debug "Dry Run - 복원 명령어:"
    if [ "$USE_DOCKER" = true ]; then
        echo "$DECOMPRESS_CMD \"$BACKUP_FILE\" | docker exec -i $CONTAINER_NAME psql -U $DB_USER -d $DB_NAME"
    else
        echo "export PGPASSWORD=$DB_PASSWORD && $DECOMPRESS_CMD \"$BACKUP_FILE\" | psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME"
    fi
else
    if [ "$USE_DOCKER" = true ]; then
        $DECOMPRESS_CMD "$BACKUP_FILE" | docker exec -i $CONTAINER_NAME psql -U $DB_USER -d $DB_NAME
    else
        export PGPASSWORD=$DB_PASSWORD
        $DECOMPRESS_CMD "$BACKUP_FILE" | psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME
    fi

    if [ $? -eq 0 ]; then
        log_info "교육 데이터베이스 복원이 성공적으로 완료되었습니다."

        # 복원 결과 확인
        log_info "복원된 테이블을 확인합니다..."
        if [ "$USE_DOCKER" = true ]; then
            TABLE_COUNT=$(docker exec $CONTAINER_NAME psql -U $DB_USER -d $DB_NAME -t -c "SELECT count(*) FROM information_schema.tables WHERE table_name LIKE 'education_%' OR table_name IN ('learning_progress', 'resource_tags', 'user_education_roles');" | tr -d ' ')
        else
            export PGPASSWORD=$DB_PASSWORD
            TABLE_COUNT=$(psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -t -c "SELECT count(*) FROM information_schema.tables WHERE table_name LIKE 'education_%' OR table_name IN ('learning_progress', 'resource_tags', 'user_education_roles');" | tr -d ' ')
        fi

        log_info "복원된 교육 테이블 수: $TABLE_COUNT"

    else
        log_error "교육 데이터베이스 복원 중 오류가 발생했습니다."
        exit 1
    fi
fi

log_info "복원 완료!"