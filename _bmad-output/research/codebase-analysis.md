# 코드베이스 심층 분석 - dify-moai-v2 (MAI Studio)

**분석 일자:** 2026-04-07
**브랜치:** moai-v2
**기반 플랫폼:** Dify v1.9.1 (langgenius/dify 포크)

---

## 1. 기술 스택 상세

### 1.1 백엔드 (api/)

| 항목 | 상세 |
|------|------|
| **Python** | >=3.11, <3.13 (pyproject.toml) |
| **Flask** | ~3.1.2 + flask-restx (REST API), flask-cors, flask-compress, flask-login, flask-orjson |
| **SQLAlchemy** | ~2.0.29 + flask-sqlalchemy ~3.1.1, flask-migrate ~4.0.7 (Alembic 내장) |
| **Celery** | ~5.5.2 (Redis 브로커, gevent 풀) |
| **Gunicorn** | ~23.0.0 (gevent 워커) |
| **Pydantic** | ~2.11.4 + pydantic-settings (요청 검증) |
| **인증** | Authlib 1.6.4 (OAuth), PyJWT ~2.10.1, PyCryptodome 3.19.1 |
| **AI/LLM** | OpenAI SDK ~1.61.0, langfuse ~2.51.3, langsmith ~0.1.77 |
| **관측성** | OpenTelemetry 1.27.0 (Flask/Celery/Redis/SQLAlchemy 계측), Sentry ~2.28.0 |
| **데이터 처리** | Pandas ~2.2.2, NumPy ~1.26.4, openpyxl, lxml |
| **패키지 매니저** | uv (pyproject.toml 기반) |

**린팅/타입 체크:**
- `ruff` (포매팅 + 린팅)
- `basedpyright` (타입 체크)
- `lint-imports` (임포트 정리)

### 1.2 프론트엔드 - web/ (Dify 메인 UI)

| 항목 | 상세 |
|------|------|
| **Next.js** | 15.5.0 (App Router, Turbopack) |
| **React** | 19.1.1 |
| **패키지 매니저** | pnpm 10.16.0 |
| **상태 관리** | SWR (데이터 페칭 중심) |
| **UI** | Headless UI 2.2.1, Tailwind CSS |
| **에디터** | Lexical ^0.30.0, Monaco Editor ^4.6.0 |
| **워크플로우** | ReactFlow ^11.11.3 |
| **차트** | ECharts ~5.5.1 |
| **데이터 쿼리** | TanStack React Query ^5.60.5 |

### 1.3 프론트엔드 - web-edu/ (MAI Studio)

| 항목 | 상세 |
|------|------|
| **Next.js** | 15.5.4 (App Router) |
| **React** | 19.1.0 |
| **패키지 매니저** | pnpm 10.16.0 |
| **상태 관리** | Zustand ^5.0.8 (의존성에 있으나 실제 store 사용은 제한적), TanStack React Query ^5.90.2, React Context API |
| **폼** | React Hook Form ^7.65.0 + Zod ^4.1.12 (유효성 검사) |
| **UI** | Headless UI ^2.2.9, Heroicons ^2.2.0, Tailwind CSS, class-variance-authority |
| **차트** | ECharts ^6.0.0, Chart.js ^4.5.0 |
| **플로우** | @xyflow/react ^12.8.6 |
| **국제화** | i18next ^25.6.0, react-i18next ^16.0.0 (한국어 우선) |
| **토스트** | Sonner ^2.0.7 |
| **포트** | 3001 (web과 분리) |

### 1.4 인프라 (docker/)

| 서비스 | 역할 |
|--------|------|
| **api** | Flask API 서버 (로컬 빌드, Dify 이미지 사용 안 함) |
| **worker** | Celery 워커 (같은 api 이미지) |
| **worker_beat** | Celery beat (주기적 작업 스케줄링) |
| **web-edu** | MAI Studio 프론트엔드 (로컬 빌드) |
| **db** | PostgreSQL + pgvector (벡터 검색) |
| **redis** | 캐시 + Celery 브로커 |
| **nginx** | 리버스 프록시 (포트 80/443) |
| **plugin_daemon** | Dify 플러그인 데몬 |
| **elasticsearch** | 검색엔진 (한국어 nori 분석기) |
| **ssrf_proxy** | SSRF 방지 프록시 |
| **certbot** | SSL 인증서 관리 (Let's Encrypt) |

**Nginx 라우팅 구조 (`docker/nginx/conf.d/default.conf.template`):**
```
/console/api  → api:5001      (백엔드 API)
/api/         → api:5001      (서비스 API)
/v1           → api:5001      (공개 API)
/files        → api:5001      (파일 서빙)
/e/           → plugin_daemon  (플러그인)
/mcp          → api:5001      (MCP 프로토콜)
/             → web-edu:3001   (MAI Studio 메인 프론트엔드)
```

> **주목:** 기본 `/` 경로가 `web-edu`로 향하며, Dify 원본 `web`은 프로덕션 Nginx에서 제외됨.

### 1.5 빌드/배포 도구

**Makefile 주요 타겟:**
- `make dev-setup` - 전체 개발 환경 셋업 (docker + web + api + web-edu)
- `make prepare-api` - API 환경 준비 (uv sync, flask db upgrade, init-tenant)
- `make docker-up` - 프로덕션 Docker 환경 시작
- `make docker-rebuild` - 캐시 없이 재빌드
- `make format` / `make lint` / `make type-check` - 코드 품질

### 1.6 테스트 프레임워크

- **프레임워크:** pytest (api/tests/)
- **테스트 파일 수:** 334개 (Dify 원본 + 교육 도메인)
- **교육 도메인 테스트:**
  - 단위 테스트: `api/tests/unit_tests/services/edu/` (2개), `api/tests/unit_tests/services/education_management/` (13개)
  - 통합 테스트: `api/tests/integration_tests/controllers/console/edu/` (1개)
  - 서비스 레벨: `api/tests/unit_tests/services/test_edu_role_service.py`, `test_edu_session_member_service.py`
- **web-edu:** Jest 설정 있음 (`"test": "jest"` in package.json), 실제 테스트 파일은 확인 필요

---

## 2. 아키텍처 패턴 심층 분석

### 2.1 백엔드 3-레이어 아키텍처

```
Controllers (API 엔드포인트)
    ↓
Services (비즈니스 로직)
    ↓
Models (SQLAlchemy ORM)
```

#### 2.1.1 Flask Blueprint 구조

Dify 원본은 **두 가지 패턴**을 혼용한다:

**패턴 A - flask-restx Resource 클래스** (Dify 원본 스타일):
```python
# api/controllers/console/edu/tools.py
from flask_restx import Resource
from controllers.console import console_ns

@console_ns.route("/education/tools")
class ToolListAPI(Resource):
    @login_required
    @account_initialization_required
    def get(self):
        ...
```
- `controllers/console/__init__.py`에서 `ExternalApi` + `Namespace` 생성
- `console_ns`에 라우트 데코레이터로 등록
- Dify의 기존 인증 데코레이터 (`@login_required`, `@account_initialization_required`) 사용

**패턴 B - Flask Blueprint 함수 뷰** (교육 도메인 스타일):
```python
# api/controllers/console/edu/session.py
from flask import Blueprint, jsonify, request

bp = Blueprint("edu_sessions", __name__, url_prefix="/console/api/edu/sessions")

@bp.route("", methods=["POST"])
@jwt_required
@admin_required
def create_session():
    ...
```
- 교육 도메인은 별도 Blueprint를 사용
- URL 접두사: `/console/api/edu/...`
- `api/extensions/ext_blueprints.py`에서 Flask 앱에 등록

**Blueprint 등록 흐름 (`api/extensions/ext_blueprints.py`):**
```python
# Dify 원본 블루프린트
app.register_blueprint(console_app_bp)     # /console/api
app.register_blueprint(service_api_bp)     # /api 또는 /v1
app.register_blueprint(web_bp)             # 웹 API

# 교육 도메인 블루프린트 (10개)
app.register_blueprint(session_bp)         # /console/api/edu/sessions
app.register_blueprint(session_member_bp)  # /console/api/edu/session-members
app.register_blueprint(role_bp)            # /console/api/edu/roles
app.register_blueprint(users_bp)           # /console/api/edu/users
app.register_blueprint(api_key_bp)         # /console/api/edu/api-keys
app.register_blueprint(dashboard_bp)       # /console/api/edu/dashboard
app.register_blueprint(resource_tags_bp)   # /console/api/edu/resource-tags
app.register_blueprint(price_config_bp)    # /console/api/edu/price-configs
app.register_blueprint(usage_analytics_bp) # /console/api/edu/usage-analytics
```

#### 2.1.2 SQLAlchemy 모델 패턴

**Base 클래스** (`api/models/base.py`):
```python
from sqlalchemy.orm import DeclarativeBase, MappedAsDataclass

class Base(DeclarativeBase):
    metadata = metadata

class TypeBase(MappedAsDataclass, DeclarativeBase):
    """Type-annotated base (마이그레이션 중)"""
    metadata = metadata
```

**모델 정의 패턴 (교육 도메인 예시):**
```python
# api/models/education/session.py
class EducationSession(Base):
    __tablename__ = "education_sessions"
    __table_args__ = (
        sa.PrimaryKeyConstraint("id", name="education_session_pkey"),
        Index("idx_session_tag_unique", "session_tag", unique=True),
    )
    id: Mapped[str] = mapped_column(StringUUID, server_default=sa.text("uuid_generate_v4()"))
    session_name: Mapped[str] = mapped_column(String(255), nullable=False)
    tenant_id: Mapped[str] = mapped_column(StringUUID, ForeignKey("tenants.id", ondelete="CASCADE"))
    # ...
    members = relationship("EducationSessionMember", back_populates="session", cascade="all, delete-orphan")
```

공통 특징:
- `StringUUID` 타입으로 UUID 기본키 (PostgreSQL `uuid_generate_v4()` 서버 디폴트)
- `Mapped[T]` + `mapped_column()` 사용 (SQLAlchemy 2.0 스타일)
- `created_at`, `updated_at` 타임스탬프 컬럼 패턴
- ForeignKey의 `ondelete="CASCADE"` 일관 사용
- `__table_args__` 튜플로 인덱스/제약조건 정의

#### 2.1.3 Celery Task 구조

교육 도메인 비동기 작업 (`api/tasks/education/`):

| 파일 | 역할 |
|------|------|
| `bulk_user_task.py` | CSV 일괄 사용자 생성 |
| `delete_session_task.py` | 세션 삭제 (리소스 정리 포함) |
| `remove_member_task.py` | 멤버 제거 (리소스 정리 포함) |
| `session_resource_cleanup_task.py` | 세션 리소스 정리 |

**Task 정의 패턴:**
```python
# api/tasks/education/bulk_user_task.py
@shared_task(bind=True, queue="generation", ignore_result=False)
def bulk_create_users_task(self, csv_content: str, session_id: str | None, created_by: str) -> dict:
    # self.update_state() 로 진행 상태 보고
    ...
```

- `@shared_task(bind=True)` 사용 (Celery 앱 인스턴스 독립)
- `queue="generation"` 큐 지정
- `ignore_result=False` (결과 추적 필요)
- 컨트롤러에서 `AsyncResult(task_id)`로 상태 폴링

#### 2.1.4 인증/권한 체계

**이중 인증 체계:**

1. **Dify 기본 인증** (`libs/login.py`, `flask-login`):
   - `@login_required` - flask-login 세션 기반
   - `@account_initialization_required` - 계정 초기화 확인
   - 기존 Dify 콘솔 API에서 사용

2. **교육 도메인 JWT 인증** (`controllers/console/edu/auth_decorators.py`):
   - `@jwt_required` - Bearer 토큰 기반 JWT 인증, `request.user`에 계정 저장
   - `@admin_required` - Dify의 `TenantAccountRole`에서 owner/admin 확인
   - `@owner_required` - owner 역할만 허용
   - `@admin_or_owner_required` - admin 또는 owner 허용
   - `@owner_or_creator_required(resource_getter)` - owner이거나 리소스 생성자

3. **교육 세션 내 역할** (`models/education/user_role.py`):
   - `EduUserRole` 모델: session_id + account_id별 'admin' 또는 'normal' 역할
   - Dify의 tenant 역할과 별개로, 세션 내 교육 역할 관리

4. **LMS SSO 통합** (`controllers/console/auth/sso.py`):
   - 쿠키 기반 SSO: `MOAI_LOGIN_EMAIL`, `MOAI_LOGIN_NAME` 쿠키 읽기
   - 계정 자동 생성 (없으면 create), JWT 토큰 쌍 발급

### 2.2 프론트엔드 (web-edu/) 아키텍처

#### 2.2.1 컴포넌트 구조

```
web-edu/
├── app/                    # Next.js App Router (페이지)
│   ├── (auth)/             # 인증 페이지 (로그인)
│   ├── (student)/          # 학생 뷰
│   ├── admin/              # 관리자 뷰
│   │   ├── sessions/       # 세션 관리
│   │   ├── users/          # 사용자 관리
│   │   ├── api-keys/       # API 키 관리
│   │   ├── dashboard/      # 관리자 대시보드
│   │   └── usage-analytics/# 사용량 분석
│   ├── agents/             # 에이전트 관리/실행
│   ├── owner/              # 소유자 전용 뷰
│   │   ├── monitoring/     # 시스템 모니터링
│   │   ├── price-configs/  # 가격 설정
│   │   ├── usage-analytics/# 사용량 분석 (소유자)
│   │   └── dashboard/      # 소유자 대시보드
│   ├── datasets/           # RAG 데이터셋 관리
│   ├── dashboard/          # 공통 대시보드
│   └── api-test/           # API 테스트
│
├── components/             # 재사용 컴포넌트
│   ├── admin/              # 관리자 UI (UserTable, BulkCreateModal 등)
│   ├── agent/              # 에이전트 UI (AgentCard, DynamicFormRenderer 등)
│   ├── analytics/          # 분석 차트 (UsageTrendChart, TopUsersTable 등)
│   ├── api-keys/           # API 키 관리 UI
│   ├── auth/               # 인증 (ProtectedRoute, RoleGuard, SignInForm)
│   ├── chat/               # 채팅 UI (MessageInput, ConversationHistory)
│   ├── common/             # 공통 UI (Button, Modal, Select, Toast 등)
│   ├── dashboard/          # 대시보드 (ApiUsageChart, ResourceSummaryCard 등)
│   ├── layout/             # 레이아웃 (NavigationHeader, AdminDropdown)
│   ├── model/              # 모델 관리 (ModelManagementModal, ModelToggle)
│   ├── rag/                # RAG UI (DatasetCard, RetrievalTest 등)
│   └── session/            # 세션 관리 (SessionSelector, SessionDetailView 등)
│
├── context/                # React Context
│   ├── AuthContext.tsx      # 인증 상태 (로그인, 사용자 정보, 역할)
│   ├── SessionContext.tsx   # 현재 세션 상태 (세션 선택, 목록)
│   ├── ToastContext.tsx     # 토스트 알림
│   └── Providers.tsx        # 모든 Provider 래핑
│
├── hooks/                  # 커스텀 훅
│   ├── useAuth.ts          # 인증 훅
│   ├── use-api-keys.ts     # API 키 관리 훅
│   ├── useModelManagement.ts# 모델 관리 훅
│   └── useSessionTimer.ts  # 세션 타이머 훅
│
├── service/                # API 통신 계층
│   ├── base-api.ts         # ApiClient 기반 클래스 (fetch 래퍼)
│   ├── auth.ts             # 인증 API
│   ├── session-api.ts      # 세션 API
│   ├── agent-api.ts        # 에이전트 API
│   ├── education-api.ts    # 교육 API
│   └── ...                 # 기타 도메인별 API
│
├── schemas/                # Zod 스키마 (폼 유효성 검사)
│   ├── agent-schema.ts
│   └── dataset-schema.ts
│
├── types/                  # TypeScript 타입 정의
│   ├── session.ts          # 세션 관련 타입
│   ├── auth.ts             # 인증 타입
│   ├── agent.ts            # 에이전트 타입
│   └── ...                 # 기타 도메인 타입
│
└── i18n/                   # 국제화 (한국어 우선)
```

#### 2.2.2 상태 관리 패턴

**주요 상태 관리 전략:**

1. **React Context API** (전역 상태):
   - `AuthContext` - 인증 상태, 사용자 정보, JWT 토큰 관리
   - `SessionContext` - 현재 선택된 세션, 세션 목록, 세션 필터링
   - `ToastContext` - 알림 메시지

2. **TanStack React Query** (서버 상태):
   - 서버 데이터 캐싱과 자동 갱신
   - `staleTime: 60 * 1000` (1분 기본값)
   - `refetchOnWindowFocus: false`

3. **Zustand** (로컬 상태):
   - 의존성에 포함되어 있으나, 현재 직접적인 Zustand store 파일은 미발견
   - 추후 확장을 위해 준비된 것으로 보임

4. **IndexedDB** (영속 로컬 상태):
   - `utils/pending-message-store.ts` - 스트리밍 중 메시지 복구용 IndexedDB 저장소

**Provider 계층 구조 (`context/Providers.tsx`):**
```
I18nextProvider
  └── QueryClientProvider (TanStack React Query)
       └── AuthProvider
            └── ToastProvider
                 └── SessionProvider
                      └── SessionManager + children
```

#### 2.2.3 라우팅

Next.js App Router 사용. 레이아웃 그룹으로 역할별 UI 분리:
- `(auth)/` - 로그인, SSO 콜백 (인증되지 않은 사용자)
- `(student)/` - 학생 전용 페이지
- `admin/` - 관리자 전용 (세션, 사용자, API 키 관리)
- `owner/` - 소유자 전용 (모니터링, 가격 설정)
- `agents/` - 에이전트 관리/실행 (모든 역할)

**권한 보호:**
- `components/auth/ProtectedRoute.tsx` - 인증된 사용자만 접근
- `components/auth/RoleGuard.tsx` - 역할별 접근 제어

---

## 3. 교육 도메인 구체적 구조

### 3.1 데이터 모델 (15개 엔티티)

```
EducationSession (교육 세션)
├── EducationSessionMember (세션 멤버 - N:M 관계)
│   └── Account (Dify 기존 계정 모델)
├── EduUserRole (세션 내 역할 - admin/normal)
├── SessionQuota (세션 전체 사용량 한도)
├── SessionDefaultUserQuota (세션 기본 사용자 쿼터)
├── UserUsageQuota (개인 사용량 한도)
├── SessionResourceTag (세션-리소스 매핑)
├── SessionMonitoring (세션 모니터링)
├── AdminAPIKeyConfig (API 키 설정)
├── AdminPriceConfig (가격 설정)
├── ApiUsageLog (API 사용 로그 - 독립, FK 없음)
├── ApiUsageSummary (API 사용 요약)
├── UserToolConfig (사용자 도구 설정)
└── ToolExecutionLog (도구 실행 로그)
```

### 3.2 모델-서비스-컨트롤러 매핑

| 도메인 기능 | Model | Service | Controller |
|-------------|-------|---------|------------|
| 세션 관리 | `education/session.py` | `edu/session_service.py` | `edu/session.py` |
| 세션 멤버 | `education/session_member.py` | (EduSessionMemberService) | `edu/session_member.py` |
| 역할 관리 | `education/user_role.py` | (EduRoleService) | `edu/role.py` |
| 사용자 관리 | (Account 재사용) | `education_management/user_management_service.py` | `edu/users.py` |
| API 키 | `education/api_key_config.py` | `education_management/api_key_service.py` | `edu/api_key.py` |
| 사용량 추적 | `education/api_usage_log.py` | `education_management/usage_analytics_service.py` | `edu/usage_analytics.py` |
| 쿼터 관리 | `education/session_quota.py`, `education/user_usage_quota.py` | `education_management/quota_service.py`, `quota_enforcement_service.py` | (세션/사용자 API 내) |
| 리소스 태그 | `education/resource_tag.py` | `edu/resource_tagging_service.py`, `education_management/session_resource_service.py` | `edu/resource_tags.py` |
| 대시보드 | (집계 쿼리) | `education_management/dashboard_service.py` | `edu/dashboard.py` |
| 가격 설정 | `education/admin_price_config.py` | `education_management/price_config_service.py` | `edu/price_config.py` |
| 도구 관리 | `education/user_tool_config.py` | `education_management/tool_registry_service.py`, `tool_logging_service.py`, `user_tool_config_service.py` | `edu/tools.py`, `edu/user_tool_configs.py` |
| 모델 동기화 | - | `education_management/provider_sync_service.py` | - |
| 암호화 | - | `education_management/encryption_service.py` | - |

### 3.3 서비스 레이어 이원화

교육 관련 서비스가 두 디렉토리에 분리되어 있다:

- **`services/edu/`** (5개 파일): 핵심 세션/리소스 서비스
  - `session_service.py` - 세션 CRUD
  - `session_helper.py` - 세션 활성 상태 판정 헬퍼
  - `resource_tagging_service.py` - 리소스 태깅
  - `exceptions.py` - 교육 도메인 예외 클래스

- **`services/education_management/`** (14개 파일): 관리 기능 서비스
  - API 키, 대시보드, 암호화, 가격 설정, 프로바이더 동기화, 쿼터 관리, 세션 리소스, 도구 관리, 사용량 분석, 사용자 관리

---

## 4. 코드 컨벤션 분석

### 4.1 네이밍 규칙

| 항목 | 패턴 | 예시 |
|------|------|------|
| **Python 파일명** | snake_case | `session_service.py`, `api_usage_log.py` |
| **Python 클래스** | PascalCase | `EducationSession`, `EduSessionService` |
| **Python 함수** | snake_case | `create_session`, `get_user_role` |
| **Python 상수** | UPPER_SNAKE_CASE | `UNSET`, `DB_NAME` |
| **DB 테이블명** | snake_case 복수형 | `education_sessions`, `edu_user_roles` |
| **TypeScript 파일명** | kebab-case | `session-api.ts`, `base-api.ts` |
| **React 컴포넌트 파일** | PascalCase | `SessionSelector.tsx`, `AgentCard.tsx` |
| **TypeScript 타입** | PascalCase | `Session`, `AuthContextType` |
| **API URL 경로** | kebab-case | `/console/api/edu/api-keys`, `/console/api/edu/sessions` |

### 4.2 디렉토리 구조 패턴 (새 기능 추가 시)

새로운 교육 도메인 기능을 추가할 때 만들어야 하는 파일들:

```
1. api/models/education/new_feature.py          # SQLAlchemy 모델
2. api/models/education/__init__.py             # __all__에 추가
3. api/migrations/versions/YYYY_MM_DD_...py     # Alembic 마이그레이션
4. api/services/education_management/new_feature_service.py  # 서비스 로직
5. api/controllers/console/edu/new_feature.py   # Blueprint 컨트롤러
6. api/extensions/ext_blueprints.py             # Blueprint 등록
7. api/tests/unit_tests/services/education_management/test_new_feature_service.py

8. web-edu/types/new-feature.ts                 # TypeScript 타입
9. web-edu/service/new-feature-api.ts           # API 클라이언트
10. web-edu/components/new-feature/Component.tsx # UI 컴포넌트
11. web-edu/app/admin/new-feature/page.tsx       # 페이지 (관리자)
```

### 4.3 에러 핸들링 패턴

**백엔드:**
```python
# 컨트롤러 레벨 - try/except + HTTP 상태 코드
@bp.route("", methods=["POST"])
@jwt_required
@admin_required
def create_session():
    try:
        # Pydantic 모델로 요청 검증
        body = CreateSessionRequest(**request.get_json())
        session = service.create_session(...)
        return jsonify({"result": "success", "data": {...}}), 201
    except ValueError as e:
        return jsonify({"result": "fail", "message": str(e)}), 400
    except Exception as e:
        logger.error("Error creating session: %s", e)
        return jsonify({"result": "fail", "message": "Internal server error"}), 500

# 서비스 레벨 - ValueError, 도메인 예외
class EducationError(Exception): ...
class ResourceAlreadyTaggedError(EducationError): ...
class ResourceTagNotFoundError(EducationError): ...
```

**프론트엔드:**
```typescript
// service/base-api.ts - 중앙 에러 처리
class ApiClient {
  private async extractErrorMessage(response: Response): Promise<string> { ... }
  // 각 메서드에서 response.ok 체크 후 throw
}

// 컴포넌트 레벨 - try/catch + sonner 토스트
try {
  await api.createSession(data)
  toast.success('세션이 생성되었습니다')
} catch (error) {
  toast.error(error.message || '세션 생성에 실패했습니다')
}
```

### 4.4 API 응답 형식

일관된 JSON 응답 형식:
```json
// 성공
{ "result": "success", "data": { ... } }

// 실패
{ "result": "fail", "message": "Error description" }

// 목록 (페이지네이션)
{ "result": "success", "data": [...], "total": 100, "page": 1, "limit": 20 }
```

### 4.5 프론트엔드 컴포넌트 패턴

```typescript
// web-edu/components/session/SessionSelector.tsx 스타일
'use client'

import { useState } from 'react'
import { useTranslation } from 'react-i18next'

interface SessionSelectorProps {
  sessions: Session[]
  onSelect: (sessionId: string) => void
}

export function SessionSelector({ sessions, onSelect }: SessionSelectorProps) {
  const { t } = useTranslation()
  // ... 컴포넌트 로직
  return (...)
}
```

특징:
- `'use client'` 지시문 (서버 컴포넌트와 분리)
- 함수 컴포넌트 + named export
- Props 인터페이스 별도 정의
- `useTranslation` 훅으로 i18n
- Tailwind CSS 클래스 인라인 사용

---

## 5. 데이터 모델

### 5.1 주요 엔티티 관계

```
Tenant (Dify)
  └──┬── Account (Dify)
     │     └── TenantAccountJoin (role: owner/admin/editor/normal/dataset_operator)
     │
     └── EducationSession
           ├── EducationSessionMember ──→ Account
           ├── EduUserRole (session_id, account_id, role: admin/normal)
           ├── SessionQuota (session 전체 사용량 한도)
           ├── SessionDefaultUserQuota (기본 사용자 쿼터)
           ├── UserUsageQuota (개인별 사용량 한도)
           ├── SessionResourceTag ──→ App/Dataset (resource_type, resource_id)
           ├── SessionMonitoring
           ├── AdminAPIKeyConfig
           └── AdminPriceConfig

ApiUsageLog (독립 - FK 없음, session_id/account_id 직접 저장)
ApiUsageSummary
ToolExecutionLog
UserToolConfig
```

### 5.2 마이그레이션 관리

- **도구:** Alembic (flask-migrate 래퍼)
- **마이그레이션 수:** 167개 (Dify 원본 ~160개 + 교육 도메인 6개)
- **교육 도메인 마이그레이션:**
  - `2025_10_12` - 교육 관리 테이블 일괄 생성
  - `2025_10_13` - `edu_user_roles` 테이블, `edu_session_members` 테이블
  - `2025_12_15` - `force_status` 컬럼, `is_default` 컬럼 추가
  - `2025_12_29` - `is_active` 컬럼 제거
- **명명 패턴:** `YYYY_MM_DD_HHMM-revision_id_description.py`
- **생성 명령:** `flask db migrate -m "description"`, `flask db upgrade`

### 5.3 DB 스키마 패턴

- UUID 기본키 (서버 생성: `uuid_generate_v4()`)
- `tenant_id` FK로 멀티 테넌시 지원
- `created_at`, `updated_at` 타임스탬프 기본
- `ondelete="CASCADE"` FK 정책
- 복합 유니크 제약 (예: `unique_session_account_role` on session_id + account_id)
- 전략적 인덱스 (조회 패턴 기반)
- `ApiUsageLog`는 의도적으로 FK 없음 (삭제 후에도 로그 보존)

---

## 6. Dify 원본 대비 변경 사항

### 6.1 추가된 모듈/기능

| 추가 항목 | 위치 | 설명 |
|-----------|------|------|
| **교육 모델 15개** | `api/models/education/` | 세션, 멤버, 역할, 쿼터, 사용량, 리소스 태그 등 |
| **교육 컨트롤러 13개** | `api/controllers/console/edu/` | 세션, 사용자, API 키, 대시보드, 사용량 분석 등 |
| **교육 서비스 19개** | `api/services/edu/`, `api/services/education_management/` | 비즈니스 로직 레이어 |
| **교육 Celery 태스크 4개** | `api/tasks/education/` | 일괄 생성, 세션/멤버/리소스 삭제 |
| **교육 마이그레이션 6개** | `api/migrations/versions/` | DB 스키마 변경 |
| **교육 테스트 17+개** | `api/tests/unit_tests/`, `api/tests/integration_tests/` | 서비스/컨트롤러 테스트 |
| **web-edu 전체** | `web-edu/` | 별도 Next.js 프론트엔드 (포트 3001) |
| **SSO 로그인** | `api/controllers/console/auth/sso.py` | LMS 쿠키 기반 SSO |

### 6.2 수정된 핵심 로직

| 수정 항목 | 위치 | 설명 |
|-----------|------|------|
| **Blueprint 등록** | `api/extensions/ext_blueprints.py` | 교육 도메인 블루프린트 10개 등록 추가 |
| **Console 컨트롤러** | `api/controllers/console/__init__.py` | edu 모듈 import 추가 |
| **Docker Compose** | `docker/docker-compose-template.yaml` | web-edu 서비스, 로컬 빌드 설정 추가 |
| **Nginx** | `docker/nginx/conf.d/default.conf.template` | `/` → web-edu, Dify web 제거 |
| **Makefile** | `Makefile` | dev-setup에 web-edu 준비 단계 추가 |
| **에이전트 모델 설정** | (최근 커밋) | `agent_mode`를 모델 config payload에 항상 포함 |

### 6.3 커스터마이징 포인트

- **Dify 원본 코드는 최소한으로 수정**: 교육 기능은 별도 모듈(`edu/`, `education/`)로 분리하여 오버레이
- **업스트림 머지 용이성**: 원본 파일 수정을 최소화하고, ext_blueprints.py와 __init__.py 같은 등록 지점만 수정
- **프론트엔드 분리**: web-edu는 완전히 별도 앱으로, Dify web/과 코드 공유 없음

---

## 7. 현재 개발 상태와 기술 부채

### 7.1 진행 중인 작업 (최근 커밋 기반)

최근 30개 커밋 분석 결과:
- **LMS SSO 통합** 완료 (`cda35a450`)
- **에이전트 채팅 안정화** - 스트리밍, 페이지 새로고침 복구, 중복 메시지 방지
- **실행 결과 다운로드** 기능 추가
- **국제화(i18n)** 한국어 번역 확대
- **Docker 인프라** - 환경 변수, 빌드 프로세스 안정화
- **브랜딩** - EduAI → MAI 리네이밍 완료

### 7.2 식별된 기술 부채 및 개선 필요 사항

| 항목 | 심각도 | 설명 |
|------|--------|------|
| **서비스 디렉토리 이원화** | 중간 | `services/edu/`와 `services/education_management/`가 분리된 이유 불명확. 통합 검토 필요 |
| **인증 이원화** | 중간 | Dify 기본 인증(flask-login)과 교육 JWT 인증이 공존. 세션/토큰 관리 일원화 검토 |
| **Zustand 미활용** | 낮음 | 의존성에 포함되어 있으나 실제 store 파일 부재. Context API 중심으로 갈 것인지 결정 필요 |
| **통합 테스트 부족** | 높음 | 교육 도메인 통합 테스트가 1개뿐 (test_dashboard_api.py). 주요 API 흐름 테스트 필요 |
| **web-edu 테스트 부재** | 높음 | Jest 설정은 있으나 실제 테스트 파일 확인 필요 |
| **에러 핸들링 일관성** | 중간 | 일부 컨트롤러는 generic Exception catch, 일부는 도메인 예외. 통일 필요 |
| **API 문서 부재** | 높음 | swagger/OpenAPI 스펙 자동 생성이 있으나 (flask-restx), 교육 Blueprint API는 별도 |
| **Blueprint CORS 중복** | 낮음 | ext_blueprints.py에서 각 블루프린트마다 CORS 설정 반복. 공통화 가능 |
| **docs/ 디렉토리 비어 있음** | 중간 | 프로젝트 규모 대비 문서 부족 |
| **Dify 업스트림 동기화 전략 부재** | 높음 | 포크 후 업스트림 변경 머지 방법/주기 미정 |

---

*이 분석 문서는 Phase 0 코드베이스 심층 분석의 산출물이며, PRD, 아키텍처 설계, 구현 규칙 생성의 기반 자료로 활용됩니다.*
