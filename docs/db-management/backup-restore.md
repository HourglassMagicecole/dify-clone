# 교육 데이터베이스 백업/복구 절차

## 개요

이 문서는 Dify 교육 플랫폼의 데이터베이스 백업, 복구, 롤백 절차를 설명합니다.

## 데이터베이스 구조

교육 플랫폼은 다음 11개의 주요 테이블을 사용합니다:

### 핵심 교육 관리 (4개)
- `education_sessions` - 교육 세션 관리
- `education_enrollments` - 세션 참가자 관리
- `resource_tags` - 리소스 태깅 (멀티테넌트 대체)
- `learning_progress` - 학습 진도 추적

### 관리 기능 (7개)
- `education_templates` - 교육 자료 템플릿
- `education_api_keys` - API Key 중앙 관리
- `education_usage_limits` - 사용량 제한 설정
- `education_usage_stats` - 사용 통계 수집
- `education_activity_logs` - 활동 로그 추적
- `user_education_roles` - 교육 역할/권한 관리
- `education_achievements` - 성취/배지 시스템

## 백업 절차

### 자동 백업 스크립트 사용

```bash
# 데이터만 백업 (기본)
./scripts/backup_education_db.sh

# 스키마만 백업
./scripts/backup_education_db.sh schema

# 스키마와 데이터 모두 백업
./scripts/backup_education_db.sh full
```

### 수동 백업

```bash
# Docker 환경
docker exec docker-db-1 pg_dump -U postgres -d dify \
  --table=education_sessions \
  --table=education_enrollments \
  --table=resource_tags \
  --table=learning_progress \
  --table=education_templates \
  --table=education_api_keys \
  --table=education_usage_limits \
  --table=education_usage_stats \
  --table=education_activity_logs \
  --table=user_education_roles \
  --table=education_achievements \
  > education_backup_$(date +%Y%m%d_%H%M%S).sql

# 압축
gzip education_backup_*.sql
```

### 백업 스케줄링

Cron을 사용한 자동 백업 설정:

```bash
# 매일 새벽 2시에 백업
0 2 * * * /path/to/dify-clone/scripts/backup_education_db.sh data

# 매주 일요일 새벽 3시에 풀 백업
0 3 * * 0 /path/to/dify-clone/scripts/backup_education_db.sh full
```

## 복구 절차

### 스크립트를 사용한 복구

```bash
# 기존 데이터 유지하며 복구
./scripts/restore_education_db.sh backup_file.sql.gz

# 기존 테이블 삭제 후 복구 (권장)
./scripts/restore_education_db.sh backup_file.sql.gz --clean

# Dry run (실제 복구 없이 명령어만 확인)
./scripts/restore_education_db.sh backup_file.sql.gz --clean --dry-run
```

### 수동 복구

```bash
# Docker 환경
gunzip -c backup_file.sql.gz | docker exec -i docker-db-1 psql -U postgres -d dify

# 직접 연결
export PGPASSWORD=difyai123456
gunzip -c backup_file.sql.gz | psql -h localhost -U postgres -d dify
```

## 롤백 절차

### 전체 교육 테이블 삭제

```bash
# 스크립트 사용 (안전)
./scripts/rollback_education_tables.sh

# 수동 실행 (주의!)
docker exec -i docker-db-1 psql -U postgres -d dify << 'EOF'
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
EOF
```

## 재설치 절차

```bash
# 1. 롤백
./scripts/rollback_education_tables.sh

# 2. 테이블 재생성
docker exec -i docker-db-1 psql -U postgres -d dify < scripts/create_education_tables.sql

# 3. (선택) 백업 복구
./scripts/restore_education_db.sh latest_backup.sql.gz
```

## 환경 변수

스크립트들은 다음 환경 변수를 사용합니다:

```bash
# 데이터베이스 설정
export DB_HOST=localhost
export DB_PORT=5432
export DB_USERNAME=postgres
export DB_PASSWORD=difyai123456
export POSTGRES_DB=dify

# Docker 설정
export USE_DOCKER=true
export CONTAINER_NAME=docker-db-1

# 백업 설정
export BACKUP_DIR=/path/to/backups
```

## 모니터링 및 검증

### 백업 상태 확인

```bash
# 최근 백업 파일 확인
ls -la backups/education_backup_*.sql.gz | tail -5

# 백업 파일 무결성 검증
gunzip -t backups/education_backup_*.sql.gz
```

### 테이블 상태 확인

```bash
# 교육 테이블 목록 확인
docker exec docker-db-1 psql -U postgres -d dify -c "\dt education*"

# 테이블별 레코드 수 확인
docker exec docker-db-1 psql -U postgres -d dify -c "
SELECT
  schemaname,
  tablename,
  n_tup_ins as inserts,
  n_tup_upd as updates,
  n_tup_del as deletes
FROM pg_stat_user_tables
WHERE tablename LIKE 'education_%'
   OR tablename IN ('learning_progress', 'resource_tags', 'user_education_roles')
ORDER BY tablename;
"
```

## 보안 고려사항

1. **API 키 보안**: `education_api_keys` 테이블의 API 키들은 암호화되어 저장되어야 합니다.

2. **백업 파일 보안**: 백업 파일은 암호화하여 저장하는 것을 권장합니다.

3. **액세스 제어**: 백업/복구 스크립트는 적절한 권한 관리가 필요합니다.

## 장애 복구 시나리오

### 시나리오 1: 데이터 손실
```bash
# 1. 서비스 중지
# 2. 최신 백업으로 복구
./scripts/restore_education_db.sh latest_backup.sql.gz --clean
# 3. 데이터 무결성 확인
# 4. 서비스 재시작
```

### 시나리오 2: 스키마 손상
```bash
# 1. 서비스 중지
# 2. 테이블 재생성
./scripts/rollback_education_tables.sh
docker exec -i docker-db-1 psql -U postgres -d dify < scripts/create_education_tables.sql
# 3. 데이터 복구
./scripts/restore_education_db.sh latest_data_backup.sql.gz
# 4. 서비스 재시작
```

## 문제 해결

### 일반적인 문제들

1. **권한 오류**: PostgreSQL 사용자 권한 확인
2. **연결 오류**: 데이터베이스 서비스 상태 확인
3. **디스크 공간**: 백업 디렉토리 용량 확인
4. **Foreign Key 오류**: 테이블 삭제 순서 확인

### 디버깅 옵션

```bash
# 상세 로그와 함께 실행
export PGDEBUG=1
./scripts/backup_education_db.sh full

# Dry run으로 명령어 확인
./scripts/restore_education_db.sh backup.sql.gz --dry-run
```

## 성능 최적화

1. **병렬 백업**: 큰 테이블의 경우 병렬 덤프 고려
2. **압축**: 백업 파일 자동 압축 활용
3. **증분 백업**: 변경된 데이터만 백업하는 전략 검토

---

**주의**: 운영 환경에서 백업/복구 작업 전에는 반드시 테스트 환경에서 검증 후 진행하세요.