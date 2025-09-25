-- ================================
-- JSONB 필드에 GIN 인덱스 추가
-- Story 0.2: QA 수정사항
-- ================================

-- 성능 향상을 위한 GIN(Generalized Inverted Index) 인덱스 추가
-- GIN 인덱스는 JSONB 필드의 빠른 검색을 지원합니다

BEGIN;

-- 1. education_templates 테이블의 config 필드
CREATE INDEX IF NOT EXISTS ix_education_templates_config_gin
ON education_templates USING GIN (config);

COMMENT ON INDEX ix_education_templates_config_gin IS
'GIN index for fast JSONB queries on template configuration';

-- 2. learning_progress 테이블의 progress_data 필드
CREATE INDEX IF NOT EXISTS ix_learning_progress_data_gin
ON learning_progress USING GIN (progress_data);

COMMENT ON INDEX ix_learning_progress_data_gin IS
'GIN index for fast JSONB queries on learning progress data';

-- 3. education_activity_logs 테이블의 details 필드
CREATE INDEX IF NOT EXISTS ix_education_activity_logs_details_gin
ON education_activity_logs USING GIN (details);

COMMENT ON INDEX ix_education_activity_logs_details_gin IS
'GIN index for fast JSONB queries on activity log details';

-- 4. education_api_keys 테이블의 allowed_models 필드
CREATE INDEX IF NOT EXISTS ix_education_api_keys_allowed_models_gin
ON education_api_keys USING GIN (allowed_models);

COMMENT ON INDEX ix_education_api_keys_allowed_models_gin IS
'GIN index for fast JSONB queries on allowed models list';

-- 인덱스 생성 확인
SELECT
    schemaname,
    tablename,
    indexname,
    indexdef
FROM pg_indexes
WHERE indexname LIKE '%_gin'
    AND tablename IN (
        'education_templates',
        'learning_progress',
        'education_activity_logs',
        'education_api_keys'
    );

COMMIT;

-- 인덱스 통계 업데이트
ANALYZE education_templates;
ANALYZE learning_progress;
ANALYZE education_activity_logs;
ANALYZE education_api_keys;

-- 인덱스 사용 예시
/*
-- 템플릿 config에서 특정 필드 검색
SELECT * FROM education_templates
WHERE config @> '{"language": "python"}';

-- 진도 데이터에서 특정 모듈 완료 여부 확인
SELECT * FROM learning_progress
WHERE progress_data @> '{"modules": {"module1": {"completed": true}}}';

-- 활동 로그에서 특정 액션 검색
SELECT * FROM education_activity_logs
WHERE details @> '{"action": "quiz_completed"}';

-- API 키의 허용 모델 검색
SELECT * FROM education_api_keys
WHERE allowed_models @> '["gpt-4"]';
*/