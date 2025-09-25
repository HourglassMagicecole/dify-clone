-- ================================
-- Dify 교육 플랫폼 테이블 생성 스크립트
-- Story 0.2: 데이터베이스 마이그레이션 및 스키마 구축
-- ================================

-- 1. education_sessions 테이블
CREATE TABLE IF NOT EXISTS education_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_code VARCHAR(20) UNIQUE NOT NULL,
    title VARCHAR(200) NOT NULL,
    description TEXT,
    config JSONB,
    status VARCHAR(20) DEFAULT 'draft' NOT NULL,
    max_participants INTEGER,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    start_date TIMESTAMPTZ,
    end_date TIMESTAMPTZ,
    created_by UUID
);

-- 2. education_enrollments 테이블
CREATE TABLE IF NOT EXISTS education_enrollments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    session_id UUID NOT NULL REFERENCES education_sessions(id) ON DELETE CASCADE,
    enrollment_status VARCHAR(20) DEFAULT 'enrolled' NOT NULL,
    role VARCHAR(20) DEFAULT 'participant' NOT NULL,
    enrolled_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    completed_at TIMESTAMPTZ,
    last_activity_at TIMESTAMPTZ,
    notes VARCHAR(500),
    UNIQUE(user_id, session_id)
);

-- 3. resource_tags 테이블
CREATE TABLE IF NOT EXISTS resource_tags (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    resource_type VARCHAR(50) NOT NULL,
    resource_id UUID NOT NULL,
    tag_name VARCHAR(100) NOT NULL,
    tag_value VARCHAR(200),
    category VARCHAR(50),
    description VARCHAR(500),
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    created_by UUID
);

-- 4. learning_progress 테이블
CREATE TABLE IF NOT EXISTS learning_progress (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    session_id UUID NOT NULL REFERENCES education_sessions(id) ON DELETE CASCADE,
    module_type VARCHAR(50) NOT NULL,
    module_id VARCHAR(100) NOT NULL,
    module_name VARCHAR(200),
    progress_percentage NUMERIC(5,2) DEFAULT 0.0 NOT NULL,
    status VARCHAR(20) DEFAULT 'not_started' NOT NULL,
    time_spent_minutes INTEGER DEFAULT 0,
    attempts INTEGER DEFAULT 0 NOT NULL,
    current_score NUMERIC(5,2),
    best_score NUMERIC(5,2),
    progress_data JSONB,
    started_at TIMESTAMPTZ,
    last_activity_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    UNIQUE(user_id, session_id, module_type, module_id)
);

-- 5. education_templates 테이블
CREATE TABLE IF NOT EXISTS education_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    template_type VARCHAR(50) NOT NULL,
    name VARCHAR(200) NOT NULL,
    description TEXT,
    content TEXT,
    config JSONB,
    category VARCHAR(100),
    tags JSONB,
    difficulty_level VARCHAR(20),
    estimated_duration_minutes INTEGER,
    status VARCHAR(20) DEFAULT 'draft' NOT NULL,
    version VARCHAR(20) DEFAULT '1.0' NOT NULL,
    usage_count INTEGER DEFAULT 0 NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    published_at TIMESTAMPTZ,
    created_by UUID,
    updated_by UUID
);

-- 6. education_api_keys 테이블
CREATE TABLE IF NOT EXISTS education_api_keys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    key_name VARCHAR(100) NOT NULL,
    key_type VARCHAR(50) NOT NULL,
    api_key TEXT NOT NULL, -- 암호화 저장 필요
    endpoint_url VARCHAR(500),
    additional_headers TEXT, -- 암호화 저장
    scope VARCHAR(50) DEFAULT 'education' NOT NULL,
    allowed_models JSON,
    usage_count BIGINT DEFAULT 0 NOT NULL,
    last_used_at TIMESTAMPTZ,
    rate_limit_per_minute INTEGER,
    rate_limit_per_day INTEGER,
    status VARCHAR(20) DEFAULT 'active' NOT NULL,
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    created_by UUID,
    session_id UUID,
    last_rotation_at TIMESTAMPTZ
);

-- 7. education_usage_limits 테이블
CREATE TABLE IF NOT EXISTS education_usage_limits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    limit_type VARCHAR(50) NOT NULL,
    resource_type VARCHAR(50) NOT NULL,
    target_id UUID,
    target_name VARCHAR(200),
    daily_limit BIGINT,
    monthly_limit BIGINT,
    soft_daily_limit BIGINT,
    soft_monthly_limit BIGINT,
    daily_cost_limit NUMERIC(10,4),
    monthly_cost_limit NUMERIC(10,4),
    config JSONB,
    status VARCHAR(20) DEFAULT 'active' NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    effective_from TIMESTAMPTZ,
    effective_until TIMESTAMPTZ,
    created_by UUID
);

-- 8. education_usage_stats 테이블
CREATE TABLE IF NOT EXISTS education_usage_stats (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    usage_limit_id UUID REFERENCES education_usage_limits(id) ON DELETE SET NULL,
    stat_type VARCHAR(50) NOT NULL,
    resource_type VARCHAR(50) NOT NULL,
    target_id UUID,
    period_type VARCHAR(20) NOT NULL,
    period_start TIMESTAMPTZ NOT NULL,
    period_end TIMESTAMPTZ NOT NULL,
    usage_count BIGINT DEFAULT 0 NOT NULL,
    estimated_cost NUMERIC(10,4),
    actual_cost NUMERIC(10,4),
    metrics JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    UNIQUE(stat_type, resource_type, target_id, period_type, period_start)
);

-- 9. education_activity_logs 테이블
CREATE TABLE IF NOT EXISTS education_activity_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID,
    session_id UUID,
    activity_type VARCHAR(50) NOT NULL,
    activity_category VARCHAR(50) DEFAULT 'general' NOT NULL,
    action VARCHAR(100) NOT NULL,
    description TEXT,
    resource_type VARCHAR(50),
    resource_id VARCHAR(100),
    details JSONB,
    request_data JSONB,
    response_data JSONB,
    status VARCHAR(20) DEFAULT 'success' NOT NULL,
    error_message TEXT,
    duration_ms INTEGER,
    ip_address VARCHAR(45),
    user_agent VARCHAR(500),
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    extra_metadata JSONB
);

-- 10. user_education_roles 테이블
CREATE TABLE IF NOT EXISTS user_education_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    role VARCHAR(50) NOT NULL,
    scope_type VARCHAR(20) DEFAULT 'global' NOT NULL,
    scope_id UUID,
    permissions JSONB,
    restrictions JSONB,
    status VARCHAR(20) DEFAULT 'active' NOT NULL,
    valid_from TIMESTAMPTZ,
    valid_until TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    assigned_by UUID,
    assignment_reason VARCHAR(500),
    UNIQUE(user_id, role, scope_type, scope_id)
);

-- 11. education_achievements 테이블
CREATE TABLE IF NOT EXISTS education_achievements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    session_id UUID REFERENCES education_sessions(id) ON DELETE SET NULL,
    achievement_type VARCHAR(50) NOT NULL,
    achievement_name VARCHAR(100) NOT NULL,
    description TEXT,
    badge_icon VARCHAR(100),
    badge_color VARCHAR(20),
    criteria JSONB,
    details JSONB,
    level VARCHAR(20) DEFAULT 'bronze' NOT NULL,
    rarity VARCHAR(20) DEFAULT 'common' NOT NULL,
    points INTEGER DEFAULT 0 NOT NULL,
    rewards JSONB,
    progress_current INTEGER DEFAULT 0 NOT NULL,
    progress_total INTEGER,
    status VARCHAR(20) DEFAULT 'in_progress' NOT NULL,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    expires_at TIMESTAMPTZ,
    verified_by UUID,
    verification_data JSONB
);

-- ================================
-- 인덱스 생성
-- ================================

-- education_sessions 인덱스
CREATE INDEX IF NOT EXISTS ix_education_sessions_session_code ON education_sessions(session_code);
CREATE INDEX IF NOT EXISTS ix_education_sessions_status ON education_sessions(status);
CREATE INDEX IF NOT EXISTS ix_education_sessions_created_by ON education_sessions(created_by);

-- education_enrollments 인덱스
CREATE INDEX IF NOT EXISTS ix_education_enrollments_user_id ON education_enrollments(user_id);
CREATE INDEX IF NOT EXISTS ix_education_enrollments_session_id ON education_enrollments(session_id);
CREATE INDEX IF NOT EXISTS ix_education_enrollments_status ON education_enrollments(enrollment_status);

-- resource_tags 인덱스
CREATE INDEX IF NOT EXISTS ix_resource_tags_resource_type_id ON resource_tags(resource_type, resource_id);
CREATE INDEX IF NOT EXISTS ix_resource_tags_tag_name ON resource_tags(tag_name);
CREATE INDEX IF NOT EXISTS ix_resource_tags_category ON resource_tags(category);
CREATE INDEX IF NOT EXISTS ix_resource_tags_composite ON resource_tags(resource_type, tag_name, tag_value);

-- learning_progress 인덱스
CREATE INDEX IF NOT EXISTS ix_learning_progress_user_id ON learning_progress(user_id);
CREATE INDEX IF NOT EXISTS ix_learning_progress_session_id ON learning_progress(session_id);
CREATE INDEX IF NOT EXISTS ix_learning_progress_module ON learning_progress(module_type, module_id);
CREATE INDEX IF NOT EXISTS ix_learning_progress_status ON learning_progress(status);

-- education_templates 인덱스
CREATE INDEX IF NOT EXISTS ix_education_templates_type ON education_templates(template_type);
CREATE INDEX IF NOT EXISTS ix_education_templates_category ON education_templates(category);
CREATE INDEX IF NOT EXISTS ix_education_templates_status ON education_templates(status);
CREATE INDEX IF NOT EXISTS ix_education_templates_difficulty ON education_templates(difficulty_level);
CREATE INDEX IF NOT EXISTS ix_education_templates_name ON education_templates(name);

-- education_api_keys 인덱스
CREATE INDEX IF NOT EXISTS ix_education_api_keys_type ON education_api_keys(key_type);
CREATE INDEX IF NOT EXISTS ix_education_api_keys_status ON education_api_keys(status);
CREATE INDEX IF NOT EXISTS ix_education_api_keys_scope ON education_api_keys(scope);
CREATE INDEX IF NOT EXISTS ix_education_api_keys_session ON education_api_keys(session_id);
CREATE INDEX IF NOT EXISTS ix_education_api_keys_name ON education_api_keys(key_name);

-- education_usage_limits 인덱스
CREATE INDEX IF NOT EXISTS ix_education_usage_limits_type_resource ON education_usage_limits(limit_type, resource_type);
CREATE INDEX IF NOT EXISTS ix_education_usage_limits_target ON education_usage_limits(target_id);
CREATE INDEX IF NOT EXISTS ix_education_usage_limits_status ON education_usage_limits(status);

-- education_usage_stats 인덱스
CREATE INDEX IF NOT EXISTS ix_education_usage_stats_type_resource ON education_usage_stats(stat_type, resource_type);
CREATE INDEX IF NOT EXISTS ix_education_usage_stats_target ON education_usage_stats(target_id);
CREATE INDEX IF NOT EXISTS ix_education_usage_stats_period ON education_usage_stats(period_start, period_end);
CREATE INDEX IF NOT EXISTS ix_education_usage_stats_limit ON education_usage_stats(usage_limit_id);

-- education_activity_logs 인덱스
CREATE INDEX IF NOT EXISTS ix_education_activity_logs_user_id ON education_activity_logs(user_id);
CREATE INDEX IF NOT EXISTS ix_education_activity_logs_session_id ON education_activity_logs(session_id);
CREATE INDEX IF NOT EXISTS ix_education_activity_logs_type ON education_activity_logs(activity_type);
CREATE INDEX IF NOT EXISTS ix_education_activity_logs_category ON education_activity_logs(activity_category);
CREATE INDEX IF NOT EXISTS ix_education_activity_logs_status ON education_activity_logs(status);
CREATE INDEX IF NOT EXISTS ix_education_activity_logs_created_at ON education_activity_logs(created_at);
CREATE INDEX IF NOT EXISTS ix_education_activity_logs_resource ON education_activity_logs(resource_type, resource_id);

-- user_education_roles 인덱스
CREATE INDEX IF NOT EXISTS ix_user_education_roles_user_id ON user_education_roles(user_id);
CREATE INDEX IF NOT EXISTS ix_user_education_roles_role ON user_education_roles(role);
CREATE INDEX IF NOT EXISTS ix_user_education_roles_scope ON user_education_roles(scope_type, scope_id);
CREATE INDEX IF NOT EXISTS ix_user_education_roles_status ON user_education_roles(status);

-- education_achievements 인덱스
CREATE INDEX IF NOT EXISTS ix_education_achievements_user_id ON education_achievements(user_id);
CREATE INDEX IF NOT EXISTS ix_education_achievements_session_id ON education_achievements(session_id);
CREATE INDEX IF NOT EXISTS ix_education_achievements_type ON education_achievements(achievement_type);
CREATE INDEX IF NOT EXISTS ix_education_achievements_status ON education_achievements(status);
CREATE INDEX IF NOT EXISTS ix_education_achievements_level ON education_achievements(level);
CREATE INDEX IF NOT EXISTS ix_education_achievements_rarity ON education_achievements(rarity);

-- ================================
-- 코멘트 추가
-- ================================

COMMENT ON TABLE education_sessions IS '교육 세션 관리 테이블';
COMMENT ON TABLE education_enrollments IS '세션 참가자 관리 테이블';
COMMENT ON TABLE resource_tags IS '리소스 태깅 테이블 (멀티테넌트 대안)';
COMMENT ON TABLE learning_progress IS '학습 진도 추적 테이블';
COMMENT ON TABLE education_templates IS '교육 자료 템플릿 테이블';
COMMENT ON TABLE education_api_keys IS 'API 키 중앙 관리 테이블';
COMMENT ON TABLE education_usage_limits IS '사용량 제한 설정 테이블';
COMMENT ON TABLE education_usage_stats IS '사용 통계 수집 테이블';
COMMENT ON TABLE education_activity_logs IS '활동 로그 추적 테이블';
COMMENT ON TABLE user_education_roles IS '교육 역할/권한 관리 테이블';
COMMENT ON TABLE education_achievements IS '성취/배지 시스템 테이블';

-- ================================
-- 완료 메시지
-- ================================

SELECT 'Education tables created successfully!' as result;