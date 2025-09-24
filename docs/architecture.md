# EduAI Studio - AI 교육 플랫폼 브라운필드 개선 아키텍처 명세서

## 목차

1. [소개](#1-소개)
2. [기존 프로젝트 분석](#2-기존-프로젝트-분석)
3. [개선 범위 및 통합 전략](#3-개선-범위-및-통합-전략)
4. [기술 스택](#4-기술-스택)
5. [데이터 모델 및 스키마 변경](#5-데이터-모델-및-스키마-변경)
6. [컴포넌트 아키텍처](#6-컴포넌트-아키텍처)
7. [API 설계 및 통합](#7-api-설계-및-통합)
8. [소스 트리](#8-소스-트리)
9. [인프라 및 배포 통합](#9-인프라-및-배포-통합)
10. [코딩 표준](#10-코딩-표준)
11. [테스팅 전략](#11-테스팅-전략)
12. [보안 통합](#12-보안-통합)
13. [Next Steps](#13-next-steps)

---

## 1. 소개

### 프로젝트 개요
이 문서는 **EduAI Studio** - Dify Clone을 비IT 전공자를 위한 AI 교육 플랫폼으로 개선하는 아키텍처 접근 방식을 개요합니다.

### 프로젝트 핵심 목표
Dify의 강력한 백엔드 기능을 그대로 활용하면서, 비IT 전공자들이 생성형 AI의 핵심 개념인 Agent와 Workflow를 직관적으로 이해하고 실습할 수 있는 완전히 새로운 교육용 프론트엔드를 구축합니다.

### 라이센스 준수 설계
- **단일 테넌트 아키텍처**: Dify 라이센스 준수를 위해 멀티테넌트 제거
- **API-Only 통합**: Dify 프론트엔드를 사용하지 않고 백엔드 API만 활용
- **독립 프론트엔드**: 완전히 새로운 교육용 UI 개발로 LOGO 제약 회피

### 기존 아키텍처와의 관계
- 새로운 교육용 컴포넌트가 현재 Dify 백엔드와 어떻게 통합되는지
- 기존 시스템의 안정성을 유지하면서 교육 기능을 추가하는 방법
- 새로운 패턴과 기존 패턴 간의 충돌 해결 지침

### 개선 범위 요약
- ✅ **새로운 기능 추가**: 교육 특화 UI/UX (5단계 Agent 빌더, 비주얼 Workflow 편집기)
- ✅ **주요 기능 수정**: 사용자 경험 전면 재설계 (기술 용어 최소화, 단계별 가이드)
- ✅ **UI/UX 개편**: 비IT 전공자를 위한 완전히 새로운 인터페이스

### 검증된 입력 자료
- ✅ 브라운필드 PRD (docs/prd.md) - EduAI Studio 요구사항 정의
- ✅ 기존 아키텍처 문서 (docs/brownfield-architecture.md) - Dify Clone 현재 상태
- ✅ 프로젝트 구조 (IDE 접근) - 실제 코드베이스 분석 완료

### 변경 로그
| 변경 | 날짜 | 버전 | 설명 | 작성자 |
|------|------|------|------|--------|
| 초기 작성 | 2025-09-23 | 1.0 | EduAI Studio 아키텍처 초안 | Winston |
| 라이센스 준수 | 2025-09-24 | 2.0 | 단일 테넌트 + API-only 아키텍처 | Winston |

---

## 2. 기존 프로젝트 분석

### 현재 프로젝트 상태
- **주요 목적**: LLM 애플리케이션 개발 플랫폼 - 에이전틱 AI, RAG, 워크플로우 통합 제공
- **현재 기술 스택**: Python 3.11-3.13 + Flask 3.1.2, Next.js 15 + React 19
- **아키텍처 스타일**: 모노레포, 도메인 주도 설계(DDD), Blueprint 기반 모듈화
- **배포 방법**: Docker Compose 오케스트레이션, Gunicorn + gevent workers

### 사용 가능한 문서
- 브라운필드 아키텍처 문서 (docs/brownfield-architecture.md) - 현재 시스템 상태
- 브라운필드 PRD (docs/prd.md) - EduAI Studio 요구사항
- API 구조 문서 - Blueprint 기반 모듈화된 API
- 환경 설정 템플릿 (docker/.env.example) - 100개 이상 설정 변수
- 개발 명령어 스크립트 (./dev/ 디렉토리)

### 식별된 제약사항
- **UV 패키지 관리자 필수**: 모든 Python 명령에 `uv run --project api` 프리픽스 필요
- **Flask 3.1.2 호환성**: Flask-SQLAlchemy 3.1.1, Flask-Migrate 4.0.7 사용
- **Celery 5.5.2 의존성**: Redis를 브로커로 사용하는 비동기 작업 시스템
- **i18n 강제**: 모든 사용자 대면 텍스트는 하드코딩 금지, `web/i18n/en-US/` 기준
- **코드 품질 도구**: 백엔드는 `./dev/reformat` 필수, 프론트엔드는 `pnpm lint`

### 실제 디렉토리 구조 확인 결과

#### 프로젝트 루트 구조
```
dify-clone/
├── api/        # Flask 백엔드 애플리케이션
└── web/        # Next.js 프론트엔드 애플리케이션
```

#### 백엔드 API Blueprint 구조 (api/controllers/)
```
api/controllers/
├── console/        # 관리 콘솔 API (URL: /console/api)
├── service_api/    # 외부 서비스 통합 API (URL: /v1)
├── web/           # 웹 애플리케이션 API (URL: /api)
├── files/         # 파일 업로드/다운로드 API (URL: /files)
├── inner_api/     # 내부 시스템 간 통신 API
├── mcp/           # Model Context Protocol API
└── common/        # 공통 유틸리티 및 헬퍼
```

#### 핵심 비즈니스 로직 (api/core/)
```
api/core/
├── agent/         # Agent 실행 엔진
├── rag/           # RAG 파이프라인 구현
├── workflow/      # 워크플로우 실행 엔진
└── model_runtime/ # LLM 제공자 추상화 레이어
```

---

## 3. 개선 범위 및 통합 전략

### 개선 개요
- **개선 유형**: 새로운 교육용 UI/UX 개발
- **범위**: 완전히 새로운 프론트엔드 애플리케이션 구축 + 백엔드 교육 API 확장
- **통합 영향 수준**: 중간 - 기존 백엔드 재사용하되 새로운 Blueprint 추가

### 통합 접근 방식
- **코드 통합 전략**: 기존 Dify 백엔드를 그대로 활용, 교육용 API Blueprint (/edu/api/*) 추가
- **데이터베이스 통합**: 기존 스키마 유지, PRD에 명시된 교육 관리용 확장 테이블 추가
- **API 통합**: 기존 Dify API 100% 재사용 + 교육 전용 엔드포인트 추가
- **UI 통합**: 독립된 새 프론트엔드 (web-edu/) 구축, 기존 웹 앱과 완전 분리

### 호환성 요구사항
- **기존 API 호환성**: 모든 Dify core API 엔드포인트 유지, 교육 기능은 추가만
- **데이터베이스 스키마 호환성**: 기존 테이블 수정 없음, FK 관계만 추가
- **UI/UX 일관성**: 독립된 교육용 디자인 시스템, 기존 UI와 분리 운영
- **성능 영향**: 50명 동시 접속 시에도 기존 시스템 성능 유지

### 핵심 통합 결정사항

1. **독립된 프론트엔드 전략**
   - web-edu/ 디렉토리에 새로운 Next.js 앱 생성
   - 교육 특화 UI 컴포넌트 라이브러리 구축
   - 기존 web/ 앱과 완전 분리하여 독립 배포 가능
   - 이유: 교육용 요구사항이 기존 UI와 근본적으로 다름

2. **백엔드 Blueprint 확장**
   - api/controllers/edu/ 새 Blueprint 추가
   - 기존 api/core/ 모듈 재사용 (agent, rag, workflow)
   - 교육 서비스 추가 (api/services/education_service.py)
   - 이유: 코드 재사용 최대화, 검증된 백엔드 로직 활용

---

## 4. 기술 스택

### 기존 기술 스택 (그대로 사용)

| 카테고리 | 현재 기술 | 버전 | 비고 |
|---------|----------|------|------|
| 런타임 | Python | 3.11-3.13 | UV 패키지 관리자 필수 |
| 런타임 | Node.js | >=22.11.0 | pnpm 패키지 매니저 |
| 백엔드 프레임워크 | Flask | 3.1.2 | Flask-SQLAlchemy, Flask-Migrate 포함 |
| 프론트엔드 프레임워크 | Next.js | 15 | React 19 포함 |
| 데이터베이스 | PostgreSQL | 최신 | Docker Compose로 관리 |
| 캐시/브로커 | Redis | 최신 | Celery 브로커 |
| 작업 큐 | Celery | 5.5.2 | 비동기 작업 처리 |
| 웹 서버 | Gunicorn | 23.0.0 | gevent worker 사용 |
| 컨테이너화 | Docker | - | Docker Compose 오케스트레이션 |
| LLM SDK | OpenAI SDK | 1.61.0 | 다양한 LLM 제공자 지원 |

### 새로운 기술 추가 (web-edu 전용)

| 기술 | 버전 | 목적 | PRD Story |
|-----|------|-----|------|
| React Flow | 최신 | Workflow 비주얼 편집기 | Story 1.5 |
| Framer Motion | 최신 | 교육용 애니메이션 | UXR3 요구사항 |
| Chart.js | 최신 | 사용량 통계 시각화 | Story 1.4, 1.9 |
| D3.js | 최신 | RAG 파이프라인 시각화 | Story 1.6 |
| React Joyride | 최신 | 인터랙티브 튜토리얼 | Story 1.10 |
| Tailwind CSS | 3.x | 교육용 디자인 시스템 | Story 1.1 |
| Material UI | 5.x | UI 컴포넌트 라이브러리 | 전체 Story |
| React Query | 5.x | API 상태 관리 및 캐싱 | Story 1.11 |
| k6 | 최신 | 부하 테스트 도구 | Story 0.5, 1.11 |

---

## 5. 데이터 모델 및 스키마 변경

### 전체 시스템 통합 스키마 (11개 테이블)

**중요**: 모든 테이블은 첫 배포 시 생성되며, PRD 요구사항(FR1-FR14)을 완전히 충족합니다.
단계적 추가는 없으며, 이것이 전체 시스템의 완전한 스키마입니다.

### 5.1 핵심 교육 관리 테이블 (4개)

#### 1. education_sessions
**목적**: 교육 세션 관리 (PRD FR12)
```sql
CREATE TABLE education_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    session_code VARCHAR(20) UNIQUE NOT NULL,
    instructor_id UUID NOT NULL REFERENCES accounts(id),
    session_type VARCHAR(20) CHECK (session_type IN ('ONLINE', 'OFFLINE', 'HYBRID')),
    scheduled_start TIMESTAMP NOT NULL,
    scheduled_end TIMESTAMP NOT NULL,
    max_participants INTEGER DEFAULT 50,
    is_active BOOLEAN DEFAULT true,
    metadata JSONB,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    INDEX idx_session_code (session_code),
    INDEX idx_session_active (is_active, scheduled_start)
);
```

#### 2. education_enrollments
**목적**: 세션 참가자 관리
```sql
CREATE TABLE education_enrollments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES accounts(id),
    session_id UUID NOT NULL REFERENCES education_sessions(id),
    role VARCHAR(20) DEFAULT 'STUDENT',
    enrolled_at TIMESTAMP DEFAULT NOW(),
    completed_at TIMESTAMP,
    UNIQUE(user_id, session_id),
    INDEX idx_session_enrollments (session_id, user_id)
);
```

#### 3. resource_tags
**목적**: 리소스 태깅 (멀티테넌트 대체)
```sql
CREATE TABLE resource_tags (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    resource_type VARCHAR(50) NOT NULL,
    resource_id UUID NOT NULL,
    tag_key VARCHAR(50) NOT NULL,
    tag_value VARCHAR(255) NOT NULL,
    created_by UUID NOT NULL REFERENCES accounts(id),
    created_at TIMESTAMP DEFAULT NOW(),
    INDEX idx_resource_lookup (resource_type, resource_id),
    INDEX idx_tag_search (tag_key, tag_value)
);
```

#### 4. learning_progress
**목적**: 학습 진도 추적 (PRD FR11)
```sql
CREATE TABLE learning_progress (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES accounts(id),
    session_id UUID REFERENCES education_sessions(id),
    module_code VARCHAR(50) NOT NULL,
    module_name VARCHAR(255) NOT NULL,
    status VARCHAR(20) DEFAULT 'NOT_STARTED',
    progress_percentage INTEGER DEFAULT 0,
    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    time_spent_seconds INTEGER DEFAULT 0,
    metadata JSONB,
    UNIQUE(user_id, session_id, module_code),
    INDEX idx_user_progress (user_id, status)
);
```

### 5.2 관리 기능 테이블 (7개)

#### 5. education_templates
**목적**: 교육 자료 템플릿 관리 (PRD FR13)
```sql
CREATE TABLE education_templates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    type VARCHAR(50) NOT NULL,
    category VARCHAR(50),
    config JSONB NOT NULL,
    description TEXT,
    is_public BOOLEAN DEFAULT false,
    created_by UUID NOT NULL REFERENCES accounts(id),
    created_at TIMESTAMP DEFAULT NOW(),
    INDEX idx_template_type (type, category)
);
```

#### 6. education_api_keys
**목적**: API Key 중앙 관리 (PRD FR14)
```sql
CREATE TABLE education_api_keys (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    provider VARCHAR(50) NOT NULL,
    api_key TEXT NOT NULL, -- 암호화 저장
    session_id UUID REFERENCES education_sessions(id),
    quota JSONB,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW(),
    INDEX idx_api_keys (provider, is_active)
);
```

#### 7. education_usage_limits
**목적**: 사용량 제한 설정 (PRD FR14)
```sql
CREATE TABLE education_usage_limits (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    target_type VARCHAR(20) NOT NULL,
    target_id UUID NOT NULL,
    resource_type VARCHAR(50) NOT NULL,
    daily_limit INTEGER,
    monthly_limit INTEGER,
    current_usage INTEGER DEFAULT 0,
    updated_at TIMESTAMP DEFAULT NOW(),
    INDEX idx_usage_limits (target_type, target_id)
);
```

#### 8. education_usage_stats
**목적**: 사용 통계 수집 (PRD FR14)
```sql
CREATE TABLE education_usage_stats (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    timestamp TIMESTAMP DEFAULT NOW(),
    session_id UUID REFERENCES education_sessions(id),
    user_id UUID REFERENCES accounts(id),
    api_calls JSONB,
    token_usage INTEGER DEFAULT 0,
    storage_usage INTEGER DEFAULT 0,
    cost_estimate DECIMAL(10,2) DEFAULT 0.00,
    INDEX idx_usage_stats (session_id, timestamp)
);
```

#### 9. education_activity_logs
**목적**: 활동 로그 추적 (PRD FR12)
```sql
CREATE TABLE education_activity_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES accounts(id),
    session_id UUID REFERENCES education_sessions(id),
    action VARCHAR(100) NOT NULL,
    resource_type VARCHAR(50),
    resource_id UUID,
    timestamp TIMESTAMP DEFAULT NOW(),
    details JSONB,
    INDEX idx_activity_log (user_id, timestamp),
    INDEX idx_activity_session (session_id, timestamp)
);
```

#### 10. user_education_roles
**목적**: 교육 역할/권한 관리
```sql
CREATE TABLE user_education_roles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES accounts(id),
    role_type VARCHAR(20) CHECK (role_type IN ('INSTRUCTOR', 'STUDENT', 'ADMIN')),
    permissions JSONB,
    valid_from TIMESTAMP,
    valid_until TIMESTAMP,
    INDEX idx_user_roles (user_id, role_type)
);
```

#### 11. education_achievements
**목적**: 성취/배지 시스템
```sql
CREATE TABLE education_achievements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES accounts(id),
    achievement_type VARCHAR(50) NOT NULL,
    achievement_name VARCHAR(255) NOT NULL,
    earned_at TIMESTAMP DEFAULT NOW(),
    session_id UUID REFERENCES education_sessions(id),
    metadata JSONB,
    INDEX idx_user_achievements (user_id, achievement_type)
);
```

### 마이그레이션 전략 (Story 0.2에서 구현)

```bash
# Flask-Migrate를 사용한 마이그레이션
uv run --project api flask db migrate -m "Add education tables"
uv run --project api flask db upgrade

# 검증
uv run --project api flask db show
uv run --project api flask db history

# 롤백 스크립트 준비 (Story 0.2)
cat > rollback_education_tables.sh <<'EOF'
#!/bin/bash
echo "Rolling back education tables..."
uv run --project api flask db downgrade -1
echo "Rollback completed"
EOF
chmod +x rollback_education_tables.sh
```

---

## 6. 컴포넌트 아키텍처

### 주요 컴포넌트 (10개)

| 컴포넌트 | 책임 | PRD Story | API 통합 |
|---------|------|------------|----------|
| EduAuthManager | 인증 및 사용자 관리 | Story 1.2 | /edu/api/auth/* |
| EduAgentBuilder | 5단계 Agent 생성 마법사 | Story 1.3 | /edu/api/agents, /console/api/apps |
| EduUserDashboard | 개인 학습 현황 및 리소스 관리 | Story 1.4 | /edu/api/progress, Multiple APIs |
| EduWorkflowEditor | 비주얼 Workflow 편집기 | Story 1.5 | /edu/api/workflows, /console/api/workflows |
| EduRAGVisualizer | RAG 파이프라인 시각화 | Story 1.6 | /edu/api/datasets, /console/api/datasets |
| EduAgentRunner | 대화형/작업형 실행 | Story 1.7 | /v1/chat, /v1/completion |
| EduWorkflowRunner | Workflow 실행 모니터링 | Story 1.8 | /v1/workflows/run |
| EduAdminDashboard | 관리자 통합 관리 | Story 1.9 | /edu/api/admin, /edu/api/sessions |
| EduTutorialSystem | 인터랙티브 튜토리얼 및 학습 지원 | Story 1.10 | /edu/api/tutorials, /edu/api/achievements |
| EduPerformanceOptimizer | 성능 최적화 및 모니터링 | Story 1.11 | /edu/api/metrics |


### 기술 스택
- **프론트엔드**: Next.js 15, React 19, TypeScript, Tailwind CSS, Material UI
- **시각화**: React Flow (워크플로), Chart.js (통계), D3.js (RAG 시각화)
- **상태관리**: Zustand, React Query
- **실시간**: Server-Sent Events (SSE), WebSocket
- **테스트**: Jest (Unit), Playwright (E2E), k6 (부하 테스트)
- **최적화**: PWA, Code Splitting, Lazy Loading

---

## 7. API 설계 및 통합

### Blueprint URL 충돌 완전 해결

**문제**: Flask Blueprint 등록 순서만으로는 URL 우선순위를 보장하지 않습니다.

**해결책 1: URL Rule 명시적 정의**

```python
# api/app_factory.py 수정
from werkzeug.routing import Rule

# 방법 1: Werkzeug Rule 사용 (예시)
app.url_map.add(Rule('/edu/api/<path:subpath>', endpoint='edu'))
app.url_map.add(Rule('/v1/<path:subpath>', endpoint='service_api'))
app.url_map.add(Rule('/console/api/<path:subpath>', endpoint='console'))
app.url_map.add(Rule('/api/<path:subpath>', endpoint='web'))  # 나머지

# 방법 2: URL prefix 완전 분리 (권장)
app.register_blueprint(edu_bp, url_prefix='/edu/api')  # /edu/api/* (충돌 없음)
app.register_blueprint(service_api_bp, url_prefix='/v1')  # /v1/*
app.register_blueprint(console_api_bp, url_prefix='/console/api')  # /console/api/*
app.register_blueprint(files_bp, url_prefix='/files')  # /files/*
app.register_blueprint(web_bp, url_prefix='/api')      # /api/* (나머지)

# 방법 3: before_request 핸들러로 라우팅 (예시)
@app.before_request
def route_education_api():
    if request.path.startswith('/edu/api/'):
        return edu_bp.handle_request()
```

**권장 해결책**: 방법 2 (URL prefix 완전 분리)를 사용하여 `/edu/api/*` 경로로 교육 API를 완전히 분리합니다.

### 새로운 API 엔드포인트

#### 교육 전용 API 요약

| 연동 | 기본 경로 | PRD Story | 주요 기능 |
|------|----------|--------------|------------|
| 인증 관리 | `/edu/api/auth/*` | Story 1.2 | 로그인, JWT, 세션 관리 |
| Agent 관리 | `/edu/api/agents/*` | Story 1.3 | Agent CRUD, 템플릿 관리 |
| 사용자 관리 | `/edu/api/users/*` | Story 1.9 | 계정 CRUD, CSV 일괄, 권한 |
| 세션 관리 | `/edu/api/sessions/*` | Story 1.9 | 세션 생성, 참가자 관리 |
| 학습 진도 | `/edu/api/progress/*` | Story 1.4 | 진도 추적, 통계, 배지 |
| Workflow 관리 | `/edu/api/workflows/*` | Story 1.5 | Workflow CRUD, 실행 상태 |
| RAG 관리 | `/edu/api/datasets/*` | Story 1.6 | 데이터셋 CRUD, 벡터 검색 |
| 교육 자료 | `/edu/api/templates/*` | Story 1.10 | 템플릿 Agent/Workflow |
| 튜토리얼 | `/edu/api/tutorials/*` | Story 1.10 | 튜토리얼 콘텐츠, 퀴즈 |
| 성취 시스템 | `/edu/api/achievements/*` | Story 1.10 | 배지, 진행률 추적 |
| API Key | `/edu/api/keys/*` | Story 1.9 | 중앙 Key 관리 |
| 사용량 관리 | `/edu/api/usage/*` | Story 1.9 | 제한 설정, 통계 |
| 모니터링 | `/edu/api/monitoring/*` | Story 1.9 | 실시간 모니터링, SSE |
| 성능 메트릭 | `/edu/api/metrics/*` | Story 1.11 | 성능 측정, 로그 집계 |


### 기존 Dify API 활용

기존 Dify API를 100% 재사용하여 검증된 기능을 활용합니다:
- Agent 관리: `/console/api/apps`
- Workflow: `/v1/workflows/run`
- RAG: `/console/api/datasets`
- Chat: `/v1/chat/completions`
- Files: `/files/upload`

---

## 8. 소스 트리

### 새로운 파일 구성

```text
dify-clone/
├── api/                      # 백엔드 (기존 + 확장)
│   ├── controllers/
│   │   └── edu/            # 새로 추가 - 교육 API
│   │       ├── __init__.py # Blueprint 설정
│   │       ├── users.py    # 사용자 관리 (FR12)
│   │       ├── groups.py   # 그룹 관리 (FR12)
│   │       ├── sessions.py # 교육 세션
│   │       ├── progress.py # 학습 진도
│   │       ├── templates.py # 교육 자료 (FR13)
│   │       ├── api_keys.py # API Key 관리 (FR14)
│   │       ├── usage.py    # 사용량 관리 (FR14)
│   │       ├── monitoring.py # 모니터링 (FR14)
│   │       └── logs.py     # 활동 로그 (FR12)
│   ├── services/            # 기존 + 교육 서비스
│   │   ├── education_service.py  # 교육 관리 서비스
│   │   ├── group_service.py      # 그룹 관리 서비스
│   │   ├── progress_service.py   # 진도 추적 서비스
│   │   └── template_service.py   # 템플릿 관리 서비스
│   ├── models/              # 기존 + 교육 모델
│   │   └── education/      # 교육 전용 모델
│   │       ├── __init__.py
│   │       ├── user_group.py
│   │       ├── education_session.py
│   │       ├── learning_progress.py
│   │       ├── education_template.py
│   │       └── education_usage.py
│   └── migrations/          # 데이터베이스 마이그레이션
│       └── versions/        # 교육 테이블 마이그레이션 추가
│
└── web-edu/                 # 새로운 교육용 프론트엔드
    ├── app/                 # Next.js 15 App Router
    │   ├── (education)/    # 교육 참가자 라우트
    │   │   ├── dashboard/  # 학습자 대시보드
    │   │   ├── agent/     # Agent 빌더
    │   │   ├── workflow/  # Workflow 편집기
    │   │   ├── rag/       # RAG 시각화
    │   │   └── progress/  # 진도 확인
    │   ├── (admin)/        # 관리자 라우트
    │   │   ├── dashboard/ # 관리자 대시보드
    │   │   ├── users/     # 사용자 관리
    │   │   ├── groups/    # 그룹 관리
    │   │   ├── sessions/  # 세션 관리
    │   │   ├── templates/ # 템플릿 관리
    │   │   └── monitoring/# 모니터링
    │   ├── components/     # 공유 컴포넌트
    │   │   ├── agent/     # Agent 관련 컴포넌트
    │   │   ├── workflow/  # Workflow 관련 컴포넌트
    │   │   ├── rag/       # RAG 관련 컴포넌트
    │   │   └── common/    # 공통 UI 컴포넌트
    │   ├── api/           # API 라우트 (BFF 패턴)
    │   └── layout.tsx     # 루트 레이아웃
    ├── features/           # 기능별 모듈
    │   ├── agent-builder/  # 5단계 Agent 빌더
    │   │   ├── components/
    │   │   ├── hooks/
    │   │   └── utils/
    │   ├── workflow-editor/# 비주얼 편집기
    │   │   ├── components/
    │   │   ├── nodes/     # 11가지 노드 타입
    │   │   └── store/     # Zustand 상태 관리
    │   └── rag-visualizer/ # RAG 시각화
    │       ├── components/
    │       └── visualizations/
    ├── lib/                # 라이브러리 및 유틸리티
    │   ├── api-client/     # Dify API 클라이언트
    │   ├── hooks/          # 커스텀 React Hooks
    │   └── utils/          # 유틸리티 함수
    ├── i18n/               # 국제화
    │   ├── ko/            # 한국어
    │   └── en/            # 영어
    ├── styles/            # 글로벌 스타일
    └── public/            # 정적 자산
```

### 통합 가이드라인

- **파일 네이밍**: Python은 snake_case, TypeScript는 kebab-case
- **폴더 구성**: 기능별 모듈화, 관심사 분리
- **Import/Export 패턴**: 인덱스 파일로 공개 API 정의

---

## 9. 인프라 및 배포 통합

### Docker Compose 통합

```yaml
# docker/docker-compose.yaml 수정
version: '3.8'
services:
  # 기존 서비스들 유지
  api:
    image: dify-api:latest
    # ... 기존 설정 ...

  web:
    image: dify-web:latest
    # ... 기존 설정 ...

  # 새로 추가되는 교육용 프론트엔드
  web-edu:
    build:
      context: ../web-edu
      dockerfile: Dockerfile
    image: dify-web-edu:latest
    ports:
      - "3001:3000"  # 다른 포트 사용
    environment:
      - NEXT_PUBLIC_API_URL=http://api:5001
      - NEXT_PUBLIC_EDU_API_URL=http://api:5001/edu/api
    volumes:
      - ../web-edu:/app
    depends_on:
      - api
    networks:
      - dify-network

  # 교육 전용 Redis (선택적 - 세션 관리용)
  redis-edu:
    image: redis:7-alpine
    ports:
      - "6380:6379"  # 다른 포트
    volumes:
      - redis-edu-data:/data
    networks:
      - dify-network

volumes:
  redis-edu-data:

networks:
  dify-network:
    # 기존 네트워크 사용
```

### Dockerfile for web-edu

```dockerfile
# web-edu/Dockerfile
FROM node:22-alpine AS base

# Dependencies stage
FROM base AS deps
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN corepack enable pnpm && pnpm install --frozen-lockfile

# Build stage
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED 1
RUN corepack enable pnpm && pnpm build

# Runner stage
FROM base AS runner
WORKDIR /app
ENV NODE_ENV production
ENV NEXT_TELEMETRY_DISABLED 1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs
EXPOSE 3000
ENV PORT 3000

CMD ["node", "server.js"]
```

### 환경 변수 관리

```bash
# docker/.env.edu 추가
# 교육 플랫폼 전용 환경 변수
EDU_SESSION_SECRET=your-secret-key
EDU_MAX_USERS=50
EDU_MAX_CONCURRENT_REQUESTS=50
EDU_API_RATE_LIMIT=1000
EDU_CORS_ORIGINS=http://localhost:3001,https://edu.yourdomain.com

# LLM API Keys (교육용 중앙 관리)
EDU_OPENAI_API_KEY=sk-...
EDU_ANTHROPIC_API_KEY=sk-ant-...

# 모니터링
EDU_MONITORING_ENABLED=true
EDU_LOG_LEVEL=info
```

### Nginx 설정 (프로덕션)

```nginx
# nginx/sites-available/edu-dify
server {
    listen 80;
    server_name edu.yourdomain.com;

    # 교육용 프론트엔드
    location / {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    # 교육 API
    location /edu/api/ {
        proxy_pass http://localhost:5001;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;

        # 50명 동시 접속 처리
        proxy_connect_timeout 30s;
        proxy_send_timeout 30s;
        proxy_read_timeout 30s;
    }

    # WebSocket for 실시간 모니터링
    location /edu/api/monitoring/ws {
        proxy_pass http://localhost:5001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
```

### 배포 스크립트

```bash
#!/bin/bash
# deploy-edu.sh

# 1. 빌드
echo "Building education platform..."
cd web-edu && pnpm build
docker build -t dify-web-edu:latest .

# 2. 백업 (롤백용)
docker tag dify-web-edu:latest dify-web-edu:backup-$(date +%Y%m%d-%H%M%S)

# 3. 배포
echo "Deploying education platform..."
docker-compose -f docker/docker-compose.yaml up -d web-edu

# 4. 헬스체크
sleep 10
curl -f http://localhost:3001/health || exit 1

echo "Deployment successful!"
```

### 롤백 전략 (rollback-procedures.md 기반)

#### Feature 플래그 시스템
```typescript
// web-edu/config/features.ts
export const FEATURES = {
  AGENT_WIZARD: process.env.NEXT_PUBLIC_FEATURE_AGENT_WIZARD === 'true',
  WORKFLOW_EDITOR: process.env.NEXT_PUBLIC_FEATURE_WORKFLOW_EDITOR === 'true',
  RAG_VISUALIZER: process.env.NEXT_PUBLIC_FEATURE_RAG_VISUALIZER === 'true',
  ADMIN_DASHBOARD: process.env.NEXT_PUBLIC_FEATURE_ADMIN_DASHBOARD === 'true',
}
```

#### 자동 롤백 시스템
```yaml
# docker-compose.yaml
services:
  web-edu:
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/api/health"]
      interval: 30s
      timeout: 10s
      retries: 3
    deploy:
      restart_policy:
        condition: on-failure
        max_attempts: 3
```

#### 메트릭 기반 롤백
```javascript
const THRESHOLDS = {
  errorRate: 0.05,      // 5% 이상 오류율
  responseTime: 3000,   // 3초 이상 응답시간
  availability: 0.95    // 95% 이하 가용성
};

async function checkMetrics() {
  const metrics = await getMetrics();
  if (metrics.errorRate > THRESHOLDS.errorRate ||
      metrics.p95ResponseTime > THRESHOLDS.responseTime ||
      metrics.availability < THRESHOLDS.availability) {
    await triggerRollback();
  }
}
```

### 개발 및 코드 품질 도구 (brownfield-architecture.md 기반)

#### 로컬 개발 설정
```bash
# 백엔드 개발
./dev/start-api           # API 서버 시작
./dev/start-worker        # Celery worker 시작

# 프론트엔드 개발
cd web-edu
pnpm dev                  # Next.js 개발 서버

# Docker 환경
cd docker
cp .env.example .env
docker compose up -d
```

#### 코드 품질 도구
```bash
# 백엔드
./dev/reformat                              # 모든 포매터 및 린터 실행
uv run --project api ruff check --fix ./   # 린팅 이슈 수정
uv run --project api ruff format ./        # 코드 포매팅
uv run --directory api basedpyright        # 타입 체크

# 프론트엔드
pnpm lint                                   # ESLint 실행
pnpm eslint-fix                            # ESLint 이슈 수정
```

---

## 10. 코딩 표준

### 핵심 규칙
- **Python**: 타입 힌트 필수, `uv run --project api` 사용, Ruff 포매팅
- **TypeScript**: strict 모드, ESLint + Prettier, `any` 타입 금지
- **네이밍**: Python snake_case, TypeScript kebab-case, React PascalCase
- **문서화**: JSDoc/docstring 필수, 의미있는 주석만 작성

---

## 11. 테스팅 전략

### 테스트 커버리지 목표
- **단위 테스트**: 80% 커버리지 (백엔드 pytest, 프론트엔드 Jest)
- **통합 테스트**: 각 Story별 IV (통합 검증) 항목 100% 구현
- **E2E 테스트**: 주요 사용자 여정 5개 (Playwright)
  - Agent 생성 여정
  - Workflow 구성 및 실행 여정
  - RAG 파이프라인 구축 여정
  - 관리자 세션 관리 여정
  - 교육 참가자 학습 여정
- **부하 테스트**: 50명 동시 접속 (k6)
  - Story 0.5에서 수립된 벤치마크 기준 충족
  - 점진적 부하 증가 테스트 (10, 20, 30, 40, 50명)

### 성능 벤치마크 (Story 0.5 기반)
```javascript
// k6 부하 테스트 기준
const benchmarks = {
  apiResponse: {
    p90: 3000,  // 3초 미만
    p95: 5000   // 5초 미만
  },
  llmResponse: {
    p90: 30000  // 30초 미만
  },
  concurrentUsers: {
    target: 50,
    stages: [10, 20, 30, 40, 50]
  },
  errorRate: {
    normal: 0.01,   // 1% 미만
    critical: 0.05  // 5% 이상 위험
  },
  resources: {
    cpu: { normal: 70, critical: 85 },    // %
    memory: { normal: 2048, critical: 3072 } // MB
  }
};
```

### 테스트 실행 명령
```bash
# 백엔드
uv run --project api pytest tests/unit_tests/education/
uv run --project api pytest tests/integration_tests/education/

# 프론트엔드
cd web-edu && pnpm test
cd web-edu && pnpm test:e2e
```

---

## 12. 의존성 충돌 해결 프로세스

### 예방 전략

#### 버전 고정 정책
**백엔드 (Python)**
```toml
# api/pyproject.toml
[project]
requires-python = ">=3.11,<3.14"

[tool.uv]
resolution = "highest"  # 항상 호환 가능한 최신 버전 사용

[project.dependencies]
flask = "==3.1.2"  # 정확한 버전 고정
flask-sqlalchemy = "~=3.1.1"  # 마이너 버전 허용
celery = "^5.5.2"  # 호환 가능한 업데이트 허용
```

**프론트엔드 (Node.js)**
```json
// web-edu/package.json
{
  "engines": {
    "node": ">=22.11.0",
    "pnpm": ">=8.0.0"
  },
  "resolutions": {
    "react": "19.0.0",
    "react-dom": "19.0.0",
    "@types/react": "19.0.0"
  },
  "overrides": {
    "react-flow-renderer": {
      "react": "$react",
      "react-dom": "$react-dom"
    }
  }
}
```

### 충돌 감지 및 해결

#### 자동 감지 스크립트
```bash
#!/bin/bash
# scripts/check_dependencies.sh

# Python 의존성 체크
cd api && uv pip compile pyproject.toml --resolution highest
if [ $? -ne 0 ]; then
  echo "Python 의존성 충돌 발견!"
  uv pip compile pyproject.toml --resolution highest --verbose
  exit 1
fi

# Node.js 의존성 체크
cd ../web-edu && pnpm install --frozen-lockfile --dry-run
if [ $? -ne 0 ]; then
  echo "Node.js 의존성 충돌 발견!"
  pnpm why <conflicting-package>
  exit 1
fi
```

#### 충돌 해결 절차

**Python 충돌 해결**:
1. 충돌 파악: `uv pip tree | grep -A5 -B5 <package>`
2. 해결 옵션: `uv pip compile --resolution [lowest|highest]`
3. 명시적 버전 지정: pyproject.toml 수정
4. 격리 테스트: `uv venv test-env && uv pip sync`

**Node.js 충돌 해결**:
1. 충돌 진단: `pnpm why <package>`
2. Resolution 추가: package.json에 resolutions 필드 추가
3. 클린 설치: `rm -rf node_modules && pnpm install`
4. 검증: `pnpm test && pnpm build`

### 문제 해결 우선순위

| 우선순위 | 충돌 유형 | 해결 방법 | 예상 시간 |
|---------|---------|----------|----------|
| P0 | 보안 취약점 | 즉시 패치 버전 업데이트 | 30분 |
| P1 | 빌드 실패 | Resolution/Override 사용 | 1시간 |
| P2 | 타입 불일치 | @types 패키지 업데이트 | 30분 |
| P3 | 경고 | 다음 스프린트에서 처리 | - |

---

## 13. 보안 통합

### 핵심 보안 전략
- **API Key 암호화**: Fernet 대칭키 암호화 (cryptography 라이브러리)
- **세션 기반 권한**: JWT + Redis 세션 스토어
- **입력 검증**: Zod 스키마 + DOMPurify 살균
- **보안 헤더**: OWASP 권고사항 준수
- **Rate Limiting**: 50명 동시 접속 제한
- **비용 통제**: 사용량 제한 및 알림

---

## 14. Next Steps

### 첫 번째 Story (Story 0.1) 시작 - 필수 선행 작업
**개발 환경 설정 및 검증**
- 개발 환경 요구사항 문서 작성
- Python, Node.js, UV, pnpm 설치 가이드
- Docker Desktop 설치 및 설정
- 환경 검증 스크립트 작성

### 구현 우선순위 (순차적 실행 필수)
1. **Story 0**: 인프라 및 환경 구축 (5개 하위 Story)
   - 0.1: 개발 환경 설정
   - 0.2: 데이터베이스 마이그레이션 (11개 테이블)
   - 0.3: 백엔드 API Blueprint (`/edu/api/*` 생성)
   - 0.4: CI/CD 파이프라인 구축
   - 0.5: Dify API 통합 검증
2. **Story 1**: 핵심 기능 구현 (11개 Story)
   - 1.1: 프론트엔드 초기 설정
   - 1.2: 인증 시스템
   - 1.3: Agent 생성 마법사
   - 1.4: 대시보드
   - 1.5: Workflow 편집기
   - 1.6: RAG 시각화
   - 1.7: Agent 실행
   - 1.8: Workflow 실행
   - 1.9: 관리자 대시보드
   - 1.10: 교육 지원
   - 1.11: 성능 최적화

### 검증 체크리스트
- [ ] 개발 환경 설정 가이드 완성 (Story 0.1)
- [ ] PRD 요구사항 FR1-14 완전 충족
- [ ] 데이터베이스 스키마 통합 (11개 테이블)
- [ ] Blueprint URL 충돌 해결 (/edu/api/* 분리)
- [ ] 기존 Dify API 100% 재사용
- [ ] 보안 전략 구현 (API Key 암호화, Rate Limiting)
- [ ] 50명 동시 접속 부하 테스트 통과
- [ ] CI/CD 파이프라인 정상 작동
- [ ] Dify API 통합 테스트 통과

---

*이 아키텍처 명세서는 EduAI Studio 프로젝트의 기술적 청사진입니다.*
*최종 업데이트: 의존성 관리 및 부하 테스트 전략 추가*