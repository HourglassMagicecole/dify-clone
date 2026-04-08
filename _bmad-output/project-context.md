# MAI Studio — Project Context

> Dify v1.9.1 포크 기반 교육용 AI 플랫폼

---

## 1. Technology Stack

### 1.1 백엔드 (api/)

| 카테고리 | 기술 | 버전 |
|----------|------|------|
| 언어 | Python | >=3.11, <3.13 |
| 웹 프레임워크 | Flask + flask-restx | ~3.1.2 |
| ORM | SQLAlchemy + flask-sqlalchemy | ~2.0.29 |
| DB 마이그레이션 | Alembic (flask-migrate) | ~4.0.7 |
| 데이터베이스 | PostgreSQL + pgvector | Docker 기반 |
| 캐시/큐 브로커 | Redis (hiredis) | ~6.1.0 |
| 작업 큐 | Celery (gevent 풀) | ~5.5.2 |
| WSGI 서버 | Gunicorn (gevent 워커) | ~23.0.0 |
| 데이터 검증 | Pydantic + pydantic-settings | ~2.11.4 |
| 인증 | Authlib 1.6.4, PyJWT ~2.10.1, flask-login ~0.6.3 |
| AI/LLM | OpenAI SDK ~1.61.0 |
| 관측성 | OpenTelemetry 1.27.0, Sentry ~2.28.0 |
| 패키지 매니저 | uv (pyproject.toml) |
| 린팅 | ruff (포매팅 + 린팅) |
| 타입 체크 | basedpyright |

### 1.2 프론트엔드 - web/ (Dify 메인 UI)

| 카테고리 | 기술 | 버전 |
|----------|------|------|
| 프레임워크 | Next.js (App Router, Turbopack) | 15.5.0 |
| UI 라이브러리 | React | 19.1.1 |
| 언어 | TypeScript | - |
| 상태 관리 | SWR, TanStack React Query | - |
| UI 컴포넌트 | Headless UI, Tailwind CSS | 2.2.1 |
| 패키지 매니저 | pnpm | 10.16.0 |

### 1.3 프론트엔드 - web-edu/ (MAI Studio 교육용 UI)

| 카테고리 | 기술 | 버전 |
|----------|------|------|
| 프레임워크 | Next.js (App Router) | 15.5.4 |
| UI 라이브러리 | React | 19.1.0 |
| 언어 | TypeScript | - |
| 상태 관리 | Zustand, TanStack React Query, React Context API | ^5.0.8 / ^5.90.2 |
| 폼 | React Hook Form + Zod | ^7.65.0 / ^4.1.12 |
| UI 컴포넌트 | Headless UI, Heroicons, Tailwind CSS, CVA | - |
| 차트 | ECharts ^6.0.0, Chart.js ^4.5.0 | - |
| 국제화 | i18next ^25.6.0 (한국어 우선) | - |
| 포트 | 3001 (web과 분리) | - |
| 패키지 매니저 | pnpm | 10.16.0 |

### 1.4 인프라

| 서비스 | 역할 |
|--------|------|
| Docker Compose | 멀티 서비스 컨테이너 오케스트레이션 |
| Nginx | 리버스 프록시 (포트 80/443) |
| PostgreSQL + pgvector | 벡터 검색 지원 DB |
| Redis | 캐시 + Celery 브로커 |
| Elasticsearch | 검색엔진 (한국어 nori 분석기) |
| Certbot | SSL 인증서 (Let's Encrypt) |
| SSRF Proxy | 외부 요청 보안 |

**Nginx 라우팅:**
```
/console/api  -> api:5001      (백엔드 API)
/api/         -> api:5001      (서비스 API)
/v1           -> api:5001      (공개 API)
/files        -> api:5001      (파일 서빙)
/e/           -> plugin_daemon (플러그인)
/mcp          -> api:5001      (MCP 프로토콜)
/             -> web-edu:3001  (MAI Studio 메인)
```

> 기본 `/` 경로가 `web-edu`로 향하며, Dify 원본 `web`은 프로덕션 Nginx에서 제외됨.

---

## 2. Critical Implementation Rules

### 2.1 3-레이어 아키텍처 준수

```
Controllers (API 엔드포인트)
    |
Services (비즈니스 로직)
    |
Models (SQLAlchemy ORM)
```

- 컨트롤러는 요청 파싱, 검증, 서비스 호출, 응답 포매팅만 담당한다
- 비즈니스 로직은 반드시 서비스 레이어에 작성한다
- 모델은 데이터 접근과 관계 정의만 담당한다

### 2.2 Flask Blueprint 패턴 (이중 구조)

**패턴 A - flask-restx Resource 클래스** (Dify 원본 스타일):
```python
from flask_restx import Resource
from controllers.console import console_ns

@console_ns.route("/education/tools")
class ToolListAPI(Resource):
    @login_required
    @account_initialization_required
    def get(self):
        ...
```

**패턴 B - Flask Blueprint 함수 뷰** (교육 도메인 스타일):
```python
from flask import Blueprint, jsonify, request

bp = Blueprint("edu_sessions", __name__, url_prefix="/console/api/edu/sessions")

@bp.route("", methods=["POST"])
@jwt_required
@admin_required
def create_session():
    ...
```

- 교육 도메인 신규 기능은 **패턴 B** 사용
- Blueprint는 `api/extensions/ext_blueprints.py`에서 등록

### 2.3 SQLAlchemy 2.0 Mapped 패턴

```python
class EducationSession(Base):
    __tablename__ = "education_sessions"
    __table_args__ = (
        sa.PrimaryKeyConstraint("id", name="education_session_pkey"),
        Index("idx_session_tag_unique", "session_tag", unique=True),
    )
    id: Mapped[str] = mapped_column(StringUUID, server_default=sa.text("uuid_generate_v4()"))
    session_name: Mapped[str] = mapped_column(String(255), nullable=False)
    tenant_id: Mapped[str] = mapped_column(StringUUID, ForeignKey("tenants.id", ondelete="CASCADE"))
```

공통 규칙:
- `StringUUID` 타입 UUID 기본키 (서버 디폴트 `uuid_generate_v4()`)
- `Mapped[T]` + `mapped_column()` 사용 (SQLAlchemy 2.0 스타일)
- `created_at`, `updated_at` 타임스탬프 컬럼 필수
- `ForeignKey`에 `ondelete="CASCADE"` 일관 사용
- `__table_args__` 튜플로 인덱스/제약조건 정의

### 2.4 인증 체계 (이중)

1. **Dify 기본 인증** (flask-login 세션 기반):
   - `@login_required` + `@account_initialization_required`
   - Dify 원본 콘솔 API에서 사용

2. **교육 도메인 JWT 인증** (`controllers/console/edu/auth_decorators.py`):
   - `@jwt_required` - Bearer 토큰 기반, `request.user`에 계정 저장
   - `@admin_required` - Dify TenantAccountRole에서 owner/admin 확인
   - `@owner_required` - owner 역할만 허용
   - `@admin_or_owner_required`, `@owner_or_creator_required(resource_getter)`

3. **교육 세션 내 역할** (`models/education/user_role.py`):
   - `EduUserRole`: session_id + account_id별 'admin' 또는 'normal'

4. **LMS SSO** (`controllers/console/auth/sso.py`):
   - 쿠키 기반 (`MOAI_LOGIN_EMAIL`, `MOAI_LOGIN_NAME`)

### 2.5 금지사항

| 금지 | 이유 |
|------|------|
| 컨트롤러에서 직접 DB 접근 (SQLAlchemy 쿼리) | 3-레이어 위반. 서비스를 통해야 함 |
| 서비스에서 Flask request/response 직접 참조 | 레이어 결합. 파라미터로 전달받아야 함 |
| 교육 도메인에서 flask-restx Resource 패턴 사용 | 교육 도메인은 Blueprint 함수 뷰(패턴 B) 사용 |
| Dify 원본 파일 직접 수정 (최소화) | 업스트림 머지 충돌 방지. ext_blueprints.py 등 등록 지점만 수정 |
| FK 없는 테이블 간 JOIN 쿼리 | ApiUsageLog처럼 의도적 FK 미사용 테이블 존재. 설계 의도 확인 필수 |

---

## 3. Code Patterns

### 3.1 네이밍 규칙

| 항목 | 패턴 | 예시 |
|------|------|------|
| Python 파일명 | snake_case | `session_service.py`, `api_usage_log.py` |
| Python 클래스 | PascalCase | `EducationSession`, `EduSessionService` |
| Python 함수 | snake_case | `create_session`, `get_user_role` |
| Python 상수 | UPPER_SNAKE_CASE | `UNSET`, `DB_NAME` |
| DB 테이블명 | snake_case 복수형 | `education_sessions`, `edu_user_roles` |
| TypeScript 파일명 | kebab-case | `session-api.ts`, `base-api.ts` |
| React 컴포넌트 파일 | PascalCase | `SessionSelector.tsx`, `AgentCard.tsx` |
| TypeScript 타입 | PascalCase | `Session`, `AuthContextType` |
| API URL 경로 | kebab-case | `/console/api/edu/api-keys` |

### 3.2 API 엔드포인트 정의 패턴

```python
@bp.route("", methods=["POST"])
@jwt_required
@admin_required
def create_session():
    try:
        body = CreateSessionRequest(**request.get_json())
        session = service.create_session(...)
        return jsonify({"result": "success", "data": {...}}), 201
    except ValueError as e:
        return jsonify({"result": "fail", "message": str(e)}), 400
    except Exception as e:
        logger.error("Error creating session: %s", e)
        return jsonify({"result": "fail", "message": "Internal server error"}), 500
```

**API 응답 형식:**
```json
{ "result": "success", "data": { ... } }
{ "result": "fail", "message": "Error description" }
{ "result": "success", "data": [...], "total": 100, "page": 1, "limit": 20 }
```

### 3.3 프론트엔드 컴포넌트 패턴

```typescript
'use client'

import { useState } from 'react'
import { useTranslation } from 'react-i18next'

interface SessionSelectorProps {
  sessions: Session[]
  onSelect: (sessionId: string) => void
}

export function SessionSelector({ sessions, onSelect }: SessionSelectorProps) {
  const { t } = useTranslation()
  // ...
  return (...)
}
```

규칙:
- `'use client'` 지시문으로 클라이언트 컴포넌트 명시
- 함수 컴포넌트 + named export
- Props 인터페이스 별도 정의
- `useTranslation` 훅으로 i18n
- Tailwind CSS 인라인 클래스

### 3.4 에러 핸들링 패턴

**백엔드:**
- 컨트롤러: try/except + HTTP 상태 코드 반환
- 서비스: `ValueError`, 도메인 예외 (`EducationError`, `ResourceAlreadyTaggedError` 등)
- 로깅: `logger.error("Error ...: %s", e)` 형식

**프론트엔드:**
- `service/base-api.ts`의 `ApiClient`에서 중앙 에러 처리
- 컴포넌트: try/catch + sonner 토스트 (`toast.success()`, `toast.error()`)

### 3.5 Celery Task 패턴

```python
@shared_task(bind=True, queue="generation", ignore_result=False)
def bulk_create_users_task(self, csv_content: str, session_id: str | None, created_by: str) -> dict:
    self.update_state(...)  # 진행 상태 보고
    ...
```

- `@shared_task(bind=True)` 사용
- `queue="generation"` 큐 지정
- 컨트롤러에서 `AsyncResult(task_id)`로 상태 폴링

### 3.6 커밋 컨벤션

Conventional Commits: `feat(scope)`, `fix(scope)`, `refactor(scope)`, `chore(scope)`, `test(scope)`
스코프: `agent`, `agent-chat`, `docker`, `education`, `workflow`, `i18n`, `security` 등

---

## 4. Testing Rules

### 4.1 프레임워크

- **백엔드:** pytest (`api/tests/`)
- **프론트엔드 (web-edu):** Jest + Testing Library (`web-edu/package.json`)

### 4.2 테스트 디렉토리 구조

```
api/tests/
├── unit_tests/
│   ├── services/edu/                           # 교육 핵심 서비스 (2개)
│   ├── services/education_management/          # 교육 관리 서비스 (13개)
│   └── ...                                     # Dify 원본 테스트
├── integration_tests/
│   ├── controllers/console/edu/                # 교육 API 통합 테스트 (1개)
│   └── ...                                     # Dify 원본 테스트
└── ... (총 334개 테스트 파일)
```

### 4.3 현재 테스트 커버리지 상태

| 영역 | 상태 | 비고 |
|------|------|------|
| 교육 서비스 단위 테스트 | 15개 | 양호 |
| 교육 API 통합 테스트 | 1개 | **부족** - 주요 API 흐름 테스트 필요 |
| web-edu 프론트엔드 테스트 | Jest 설정만 존재 | **부족** - 실제 테스트 파일 필요 |
| Dify 원본 테스트 | ~300+개 | Dify에서 상속 |

---

## 5. Security Rules

### 5.0 프로젝트 특성 판별 결과

| # | 카테고리 | 적용 | 근거 |
|---|---------|------|------|
| 1 | 입력 검증 | Y | Flask-RESTx REST API, Pydantic 요청 검증, 쿼리 파라미터 처리 |
| 2 | 웹 UI 보안 | Y | Next.js/React 프론트엔드 2개 (web, web-edu), 쿠키 기반 SSO |
| 3 | 인증/인가 | Y | Dify flask-login 세션 + 교육 JWT 이중 체계, RBAC (owner/admin/normal) |
| 4 | 파일 처리 | Y | Dify 기본 파일 업로드/다운로드 기능, CSV 일괄 사용자 생성 |
| 5 | 프로세스 실행 | N | 교육 도메인에서 subprocess 미사용. Dify 원본 md_exporter에만 존재하며 교육 도메인 범위 밖 |
| 6 | 민감 데이터 | Y | LLM API 키, DB 자격증명, JWT 시크릿, 사용자 개인정보(이메일, 이름) |
| 7 | LLM 보안 | Y | OpenAI SDK 사용, 에이전트 채팅, 프롬프트 처리, 사용량 쿼터 관리 |
| 8 | DB 보안 | Y | PostgreSQL + SQLAlchemy ORM, Alembic 마이그레이션, Raw SQL 가능성 |
| 9 | 외부 API 연동 | Y | LLM 공급자 API (OpenAI, Anthropic 등), LMS SSO 연동 |
| 10 | 공통 보안 | Y | 모든 프로젝트에 적용 |

### 5.1 입력 검증

**규칙:**
- 모든 외부 입력(API 요청, 쿼리 파라미터, 헤더)은 수신 즉시 스키마로 검증한다
- 허용 목록(allowlist) 기반 검증을 기본으로 한다 — 거부 목록(denylist)은 보조 수단으로만 사용
- 문자열 입력에는 최대 길이를 반드시 설정한다
- 숫자 입력에는 최솟값/최댓값 범위를 설정한다
- 검증 실패 시 구체적인 내부 정보를 노출하지 않는다

**백엔드 패턴 (Flask + Pydantic):**
```python
from pydantic import BaseModel, Field, field_validator
import re

class CreateSessionRequest(BaseModel):
    session_name: str = Field(..., min_length=1, max_length=255)
    session_tag: str = Field(..., min_length=1, max_length=100)
    max_members: int = Field(default=50, ge=1, le=1000)

    @field_validator("session_tag")
    @classmethod
    def validate_tag(cls, v: str) -> str:
        if not re.match(r"^[a-zA-Z0-9_-]+$", v):
            raise ValueError("태그는 영문, 숫자, -, _ 만 허용됩니다")
        return v

# Blueprint 컨트롤러에서 사용
@bp.route("", methods=["POST"])
@jwt_required
@admin_required
def create_session():
    try:
        body = CreateSessionRequest(**request.get_json())
    except ValidationError:
        return jsonify({"result": "fail", "message": "Invalid input"}), 400
    session = service.create_session(body)
    return jsonify({"result": "success", "data": {...}}), 201
```

**프론트엔드 패턴 (Zod — web-edu):**
```typescript
import { z } from "zod";

const CreateSessionSchema = z.object({
  sessionName: z.string().min(1).max(255),
  sessionTag: z.string().min(1).max(100).regex(/^[a-zA-Z0-9_-]+$/),
  maxMembers: z.number().int().min(1).max(1000).default(50),
});

type CreateSessionInput = z.infer<typeof CreateSessionSchema>;

// React Hook Form과 함께 사용
const parsed = CreateSessionSchema.safeParse(formData);
if (!parsed.success) {
  // 에러 처리
}
```

**안티패턴:**
```python
# 금지: 검증 없이 직접 사용
data = request.get_json()
name = data["name"]  # 타입, 길이 검증 없음
db.session.execute(text(f"INSERT INTO sessions (name) VALUES ('{name}')"))
```

### 5.2 웹 UI 보안

**규칙:**
- 사용자 입력을 HTML에 렌더링할 때 반드시 이스케이프 처리한다 (React의 기본 동작 활용)
- `dangerouslySetInnerHTML` 사용 금지 — 불가피할 경우 DOMPurify로 sanitize 후 사용
- 쿠키에 HttpOnly, Secure, SameSite 속성을 설정한다
- CSRF 보호를 상태 변경 요청(POST/PUT/DELETE)에 적용한다
- Content-Security-Policy(CSP) 헤더를 설정한다

**백엔드 패턴 (Flask):**
```python
# 보안 헤더 설정 (Flask after_request)
@app.after_request
def add_security_headers(response):
    response.headers["Content-Security-Policy"] = "default-src 'self'; script-src 'self'"
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
    return response

# 쿠키 설정 (SSO 등)
response.set_cookie(
    key="session_id",
    value=token,
    httponly=True,
    secure=True,
    samesite="Lax",
    max_age=3600,
)
```

**프론트엔드 패턴 (React/Next.js):**
```typescript
// 올바른 방법: 텍스트로 렌더링 (자동 이스케이프)
const SafeDisplay = ({ content }: { content: string }) => {
  return <div>{content}</div>;
};

// 금지: dangerouslySetInnerHTML
// <div dangerouslySetInnerHTML={{ __html: userInput }} />

// 불가피한 경우 DOMPurify 사용
import DOMPurify from "dompurify";
const sanitized = DOMPurify.sanitize(userHtml);
```

### 5.3 인증/인가

**규칙:**
- JWT 시크릿은 최소 256비트, 환경 변수로 관리한다 — 코드에 하드코딩 금지
- 토큰 만료 시간을 반드시 설정한다 (access token <= 1시간, refresh token <= 7일 권장)
- 권한 검증은 모든 보호 엔드포인트에서 수행한다 — 프론트엔드 숨김은 보안이 아니다
- 인증 실패 시 통합 메시지를 반환한다 — ID/비밀번호 중 어느 것이 틀렸는지 노출하지 않는다
- 비밀번호는 bcrypt/scrypt/argon2 등 단방향 해시로 저장한다

**백엔드 패턴 (교육 도메인 JWT — Flask):**
```python
import jwt
from functools import wraps

# 토큰 생성 (환경 변수에서 시크릿 로드)
def create_access_token(account_id: str) -> str:
    payload = {
        "sub": account_id,
        "exp": datetime.utcnow() + timedelta(minutes=30),
    }
    return jwt.encode(payload, os.environ["JWT_SECRET"], algorithm="HS256")

# 데코레이터로 권한 검증 (auth_decorators.py 패턴)
def jwt_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        token = request.headers.get("Authorization", "").replace("Bearer ", "")
        if not token:
            return jsonify({"result": "fail", "message": "Invalid credentials"}), 401
        try:
            payload = jwt.decode(token, os.environ["JWT_SECRET"], algorithms=["HS256"])
            request.user = get_account(payload["sub"])
        except jwt.PyJWTError:
            return jsonify({"result": "fail", "message": "Invalid credentials"}), 401
        return f(*args, **kwargs)
    return decorated
```

**프론트엔드 패턴 (Next.js — web-edu):**
```typescript
// ProtectedRoute로 인증 필수 페이지 보호
<ProtectedRoute>
  <AdminLayout>{children}</AdminLayout>
</ProtectedRoute>

// RoleGuard로 역할별 접근 제어
<RoleGuard allowedRoles={["owner", "admin"]}>
  <AdminDashboard />
</RoleGuard>

// 중요: 프론트엔드 보호는 UX 편의일 뿐, 백엔드 권한 검증이 필수
```

**안티패턴:**
```python
# 금지: JWT 시크릿 하드코딩
token = jwt.encode(payload, "my-secret-key", algorithm="HS256")

# 금지: ID 존재 여부 노출
if not user:
    raise ValueError("사용자를 찾을 수 없습니다")  # ID 존재 여부 노출

# 올바른 방법: 통합 메시지
if not user or not verify_password(password, user.password_hash):
    return jsonify({"result": "fail", "message": "인증 정보가 올바르지 않습니다"}), 401
```

### 5.4 파일 처리

**규칙:**
- 업로드된 파일명을 그대로 사용하지 않는다 — UUID 등으로 재생성한다
- 파일 확장자뿐 아니라 MIME 타입(매직 바이트)도 검증한다
- 파일 크기 제한을 반드시 설정한다 (서버 측 강제)
- 저장 경로를 사용자 입력으로 구성하지 않는다 — Path Traversal 방지
- 업로드 디렉토리는 웹 서버의 document root 밖에 위치시킨다

**백엔드 패턴 (Python/Flask):**
```python
import uuid
from pathlib import Path

ALLOWED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".pdf", ".csv"}
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10MB

def safe_save_file(upload_file, upload_dir: Path) -> Path:
    ext = Path(upload_file.filename).suffix.lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise ValueError(f"허용되지 않는 파일 형식: {ext}")

    content = upload_file.read()
    if len(content) > MAX_FILE_SIZE:
        raise ValueError("파일 크기 초과")

    safe_name = f"{uuid.uuid4()}{ext}"
    dest = upload_dir / safe_name

    # Path Traversal 방지
    if not dest.resolve().is_relative_to(upload_dir.resolve()):
        raise ValueError("잘못된 파일 경로")

    dest.write_bytes(content)
    return dest
```

**안티패턴:**
```python
# 금지: 사용자 파일명 그대로 사용
dest = upload_dir / upload_file.filename  # "../../../etc/passwd" 가능
```

### 5.5 민감 데이터

**규칙:**
- API 키, DB 비밀번호 등 시크릿은 환경 변수 또는 시크릿 매니저로 관리한다 — 코드에 하드코딩 금지
- 로그에 민감 정보(비밀번호, 토큰, 개인정보)를 출력하지 않는다
- `.env` 파일을 `.gitignore`에 반드시 포함한다
- API 응답에 시크릿, 내부 경로, 스택 트레이스를 포함하지 않는다

**백엔드 패턴 (pydantic-settings):**
```python
from pydantic import SecretStr
from pydantic_settings import BaseSettings

class AppSettings(BaseSettings):
    database_url: SecretStr
    openai_api_key: SecretStr
    jwt_secret: SecretStr

    model_config = {"env_file": ".env"}

# 사용 시 .get_secret_value()로 접근
settings = AppSettings()
db_url = settings.database_url.get_secret_value()

# 로그에 출력하면 자동 마스킹
logger.info(f"DB 설정: {settings.database_url}")  # 출력: **********
```

**프론트엔드 패턴 (TypeScript — 환경 변수):**
```typescript
// Next.js: NEXT_PUBLIC_ 접두사가 없는 환경 변수는 서버 측에서만 접근 가능
// API 키를 클라이언트에 노출하지 않는다
const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL;  // 공개 가능
// process.env.OPENAI_API_KEY  // 서버 측에서만 접근 (클라이언트 노출 금지)
```

**안티패턴:**
```python
# 금지: 하드코딩
OPENAI_API_KEY = "sk-abc123..."

# 금지: 로그에 시크릿 출력
logger.info(f"API 키로 호출: {api_key}")

# 금지: 에러 응답에 내부 정보 노출
return jsonify({"error": str(e), "traceback": traceback.format_exc()})
```

### 5.6 LLM 보안

**규칙:**
- 사용자 입력을 프롬프트에 삽입할 때 시스템 프롬프트와 명확히 분리한다 — 별도 메시지 객체 사용
- LLM 응답을 신뢰하지 않는다 — 코드 실행, DB 쿼리 등에 사용하기 전 검증 필수
- API 호출 비용 상한을 설정하고 초과 시 중단한다 (SessionQuota, UserUsageQuota 활용)
- API 키를 클라이언트(프론트엔드)에 노출하지 않는다 — 백엔드 프록시를 통해 호출

**백엔드 패턴 (Python):**
```python
def build_prompt(system_instruction: str, user_input: str) -> list[dict]:
    """시스템 프롬프트와 사용자 입력을 명확히 분리한다."""
    return [
        {"role": "system", "content": system_instruction},
        {"role": "user", "content": user_input},  # 별도 메시지로 분리
    ]

# 금지: 문자열 결합으로 프롬프트 구성
# prompt = f"You are a helper. User says: {user_input}"

# 비용 상한 검증 (SessionQuota / UserUsageQuota 모델 활용)
async def call_llm_with_budget(prompt, budget_usd: float, tracker):
    if tracker.total_cost >= budget_usd:
        raise CostLimitExceededError(f"비용 상한 초과: ${tracker.total_cost:.2f}")
    response = await llm_client.chat(prompt)
    tracker.record(response.usage)
    return response
```

**프론트엔드 패턴 (TypeScript):**
```typescript
// LLM API 호출은 반드시 백엔드를 경유한다
// 프론트엔드에서 직접 OpenAI API를 호출하지 않는다
const response = await apiClient.post("/console/api/edu/chat", { message: userInput });
```

**안티패턴:**
```python
# 금지: LLM 응답을 검증 없이 실행
code = llm_response.content
exec(code)  # 임의 코드 실행

# 금지: 비용 제한 없이 반복 호출
while not satisfactory:
    response = await llm.chat(prompt)  # 무한 비용 발생 가능
```

### 5.7 DB 보안

**규칙:**
- SQLAlchemy ORM 사용을 기본으로 한다 — Raw SQL이 불가피한 경우 반드시 파라미터 바인딩(`text()` + `:param`) 사용
- 문자열 포맷팅/결합으로 SQL을 구성하지 않는다
- DB 사용자에게 최소 권한만 부여한다
- DB 연결 문자열은 환경 변수로 관리한다

**백엔드 패턴 (SQLAlchemy 2.0):**
```python
from sqlalchemy import select, text

# ORM 방식 (권장)
stmt = select(EducationSession).where(EducationSession.tenant_id == tenant_id)
result = db.session.execute(stmt)

# Raw SQL이 불가피한 경우 — 반드시 파라미터 바인딩
stmt = text("SELECT * FROM education_sessions WHERE tenant_id = :tenant_id")
result = db.session.execute(stmt, {"tenant_id": tenant_id})
```

**안티패턴:**
```python
# 금지: 문자열 포맷팅으로 SQL 구성
query = f"SELECT * FROM education_sessions WHERE tenant_id = '{tenant_id}'"  # SQL Injection
db.session.execute(text(query))

# 금지: 사용자 입력을 테이블/컬럼명에 사용
query = f"SELECT * FROM {table_name}"  # 파라미터 바인딩 불가 영역
```

### 5.8 외부 API 연동

**규칙:**
- 외부 API 호출에 반드시 타임아웃을 설정한다 (connect + read 각각)
- HTTPS만 사용한다 — HTTP 호출 금지 (개발 환경 예외는 설정으로 제어)
- SSRF 방지: 사용자 입력으로 URL을 구성하지 않는다 — 허용 도메인 목록 또는 ssrf_proxy 사용
- 외부 API 응답을 신뢰하지 않는다 — 스키마로 검증 후 사용
- 재시도 로직에 지수 백오프를 적용한다

**백엔드 패턴 (Python — httpx):**
```python
import httpx

ALLOWED_HOSTS = {"api.openai.com", "api.anthropic.com"}

async def safe_api_call(url: str, payload: dict, timeout: int = 30) -> dict:
    parsed = httpx.URL(url)
    if parsed.host not in ALLOWED_HOSTS:
        raise ValueError(f"허용되지 않는 호스트: {parsed.host}")
    if parsed.scheme != "https":
        raise ValueError("HTTPS만 허용됩니다")

    async with httpx.AsyncClient(timeout=timeout) as client:
        response = await client.post(url, json=payload)
        response.raise_for_status()
        return response.json()
```

> 참고: 이 프로젝트는 Docker 인프라에 `ssrf_proxy` 서비스가 포함되어 있어, 외부 요청 시 SSRF 프록시를 경유하는 것이 권장됨

**안티패턴:**
```python
# 금지: 사용자 입력으로 URL 구성
url = f"https://{user_provided_host}/api/data"  # SSRF

# 금지: 타임아웃 미설정
response = requests.get(url)  # 응답 없으면 무한 대기
```

### 5.9 공통 보안

**규칙:**
- 의존성에 알려진 취약점이 없는지 정기적으로 검사한다 (`pip audit`, `pnpm audit`)
- 에러 응답에 스택 트레이스, 내부 경로, DB 스키마 등을 노출하지 않는다
- 프로덕션 환경에서 디버그 모드를 비활성화한다
- `.env`, 자격 증명 파일, 프라이빗 키를 `.gitignore`에 포함한다
- HTTP 보안 헤더를 설정한다 (X-Content-Type-Options, X-Frame-Options, Strict-Transport-Security)

**백엔드 패턴 (Flask — 에러 핸들러):**
```python
# 프로덕션 에러 핸들러: 내부 정보를 숨긴다
@app.errorhandler(Exception)
def global_exception_handler(exc):
    logger.error("Unhandled exception: %s", exc, exc_info=True)  # 로그에는 상세 기록
    return jsonify({
        "result": "fail",
        "message": "내부 서버 오류가 발생했습니다",
    }), 500

# 프로덕션에서 Flask debug=False 강제
if os.environ.get("FLASK_ENV") == "production":
    app.debug = False
```

**.gitignore 필수 항목:**
```gitignore
# 시크릿
.env
.env.local
.env.production
*.pem
*.key
credentials.json
service-account.json

# IDE/OS
.idea/
.vscode/settings.json
.DS_Store
```

**의존성 검사:**
```bash
# Python
pip audit

# Node.js (web-edu)
pnpm audit
```

---

## 6. Directory Structure

### 6.1 주요 디렉토리와 역할

```
dify-moai-v2/
├── api/                        # 백엔드 API 서버 (Python/Flask)
│   ├── configs/                # 애플리케이션 설정
│   ├── controllers/console/edu/# 교육 도메인 API 엔드포인트 (13개)
│   ├── core/                   # 핵심 비즈니스 로직 (Dify 원본)
│   ├── models/education/       # 교육 도메인 데이터 모델 (15개)
│   ├── services/edu/           # 교육 핵심 서비스 (5개)
│   ├── services/education_management/ # 교육 관리 서비스 (14개)
│   ├── tasks/education/        # 교육 Celery 비동기 작업 (4개)
│   ├── migrations/             # Alembic DB 마이그레이션 (167개)
│   ├── extensions/             # Flask 확장 등록 (ext_blueprints.py)
│   └── tests/                  # 테스트 코드 (334개)
│
├── web/                        # Dify 메인 프론트엔드 (포트 3000, 프로덕션 미사용)
├── web-edu/                    # MAI Studio 교육 프론트엔드 (포트 3001)
│   ├── app/                    # Next.js App Router
│   │   ├── (auth)/             # 인증 페이지
│   │   ├── (student)/          # 학생 전용
│   │   ├── admin/              # 관리자 (세션, 사용자, API키, 대시보드)
│   │   ├── agents/             # 에이전트 관리/실행
│   │   └── owner/              # 소유자 전용 (모니터링, 가격설정)
│   ├── components/             # 재사용 컴포넌트 (도메인별 분류)
│   ├── context/                # React Context (Auth, Session, Toast)
│   ├── hooks/                  # 커스텀 훅
│   ├── service/                # API 통신 계층
│   ├── schemas/                # Zod 유효성 검사 스키마
│   ├── types/                  # TypeScript 타입 정의
│   └── i18n/                   # 국제화 (한국어 우선)
│
├── docker/                     # Docker 인프라 구성
│   ├── nginx/                  # Nginx 리버스 프록시
│   ├── pgvector/               # PostgreSQL + pgvector
│   └── elasticsearch/          # Elasticsearch (nori)
│
├── .github/workflows/          # CI/CD (16개 워크플로우)
├── Makefile                    # 빌드/개발 자동화
└── _bmad-output/               # BMAD 프레임워크 산출물
```

### 6.2 새 기능 추가 시 파일 생성 위치

```
1.  api/models/education/new_feature.py                              # SQLAlchemy 모델
2.  api/models/education/__init__.py                                  # __all__에 추가
3.  api/migrations/versions/YYYY_MM_DD_...py                         # Alembic 마이그레이션
4.  api/services/education_management/new_feature_service.py         # 서비스 로직
5.  api/controllers/console/edu/new_feature.py                       # Blueprint 컨트롤러
6.  api/extensions/ext_blueprints.py                                 # Blueprint 등록 추가
7.  api/tests/unit_tests/services/education_management/test_new_feature_service.py

8.  web-edu/types/new-feature.ts                                     # TypeScript 타입
9.  web-edu/service/new-feature-api.ts                               # API 클라이언트
10. web-edu/components/new-feature/Component.tsx                     # UI 컴포넌트
11. web-edu/app/admin/new-feature/page.tsx                           # 페이지 (관리자)
```

---

## 7. Known Technical Debt

| 항목 | 심각도 | 설명 |
|------|--------|------|
| 서비스 디렉토리 이원화 | 중간 | `services/edu/`와 `services/education_management/`가 분리된 이유 불명확. 통합 검토 필요 |
| 인증 이원화 | 중간 | Dify flask-login과 교육 JWT가 공존. 세션/토큰 관리 일원화 검토 |
| Zustand 미활용 | 낮음 | 의존성에 포함되어 있으나 실제 store 파일 부재. Context API 중심으로 갈 것인지 결정 필요 |
| 통합 테스트 부족 | 높음 | 교육 도메인 통합 테스트가 1개. 주요 API 흐름 테스트 필요 |
| web-edu 테스트 부재 | 높음 | Jest 설정만 있고 실제 테스트 파일 미확인 |
| 에러 핸들링 일관성 | 중간 | 일부 generic Exception catch, 일부 도메인 예외. 통일 필요 |
| API 문서 부재 | 높음 | flask-restx 자동 생성은 있으나, 교육 Blueprint API는 별도 문서 없음 |
| Blueprint CORS 중복 | 낮음 | ext_blueprints.py에서 각 블루프린트마다 CORS 설정 반복 |
| docs/ 디렉토리 비어 있음 | 중간 | 프로젝트 규모 대비 문서 부족 |
| Dify 업스트림 동기화 전략 부재 | 높음 | 포크 후 업스트림 변경 머지 방법/주기 미정 |
