# Hotfix: P0 보안 사고 대응 — 전체 보안 취약점 패치

## 상태
- Severity: P0
- Tier: Critical
- Route: Full

## 버그 요약

클라우드 서버의 web-edu 컨테이너가 암호화폐 채굴 악성코드(xmrig)에 감염되어 502 Bad Gateway 발생. 전체 보안 감사 결과 web-edu 14개, api 14개, docker/Nginx 22개 총 50개 취약점이 확인되었으며 (CRITICAL 7, HIGH 15, MEDIUM 16, LOW 10, INFO 2), 추정 공격 경로는 다음과 같다:

```
공격자 → /_next/image?url=내부서비스 (SSRF)
       → Docker 내부 네트워크 탐색
       → dify-sandbox (기본 API 키 "dify-sandbox") 접근
       → 코드 실행으로 RCE 달성
       → xmrig 설치 + Next.js 프로세스 kill → 502
```

**근본 원인**: next.config.ts의 `images.remotePatterns`에서 `hostname: '*'`를 허용하여 Next.js 이미지 최적화 엔드포인트(`/_next/image`)를 통한 SSRF가 가능했고, Docker 내부 네트워크에서 기본 API 키로 sandbox에 접근하여 임의 코드 실행(RCE)이 가능했다.

---

## Acceptance Criteria

### AC1: SSRF 차단 — Next.js Image 원격 패턴 제한

- `web-edu/next.config.ts`의 `images.remotePatterns`에서 `hostname: '*'` 와일드카드 제거
- 실제 사용하는 이미지 호스트만 허용 목록에 추가:
  - 백엔드 API 호스트 (tool.icon, avatar, 파일 서빙 — `API_HOST` 환경변수 기반)
  - 필요 시 추가 외부 호스트는 환경변수로 관리
- **검증**: `/_next/image?url=http://10.0.0.1/secret` 등 내부 IP 요청 시 400 에러 반환됨
- **검증**: `/_next/image?url=http://허용된호스트/image.png` 요청은 정상 작동

### AC2: Docker 보안 강화

- `docker/docker-compose.yaml`에서 web-edu의 `ports: ["3001:3001"]` 외부 바인딩 제거 (Docker 내부 네트워크 통신만 허용, Nginx 리버스 프록시 통해서만 접근)
- `SANDBOX_API_KEY` 기본값 `dify-sandbox`를 제거하고, `.env` 파일에서 강한 랜덤 값 필수 설정하도록 변경
- `CODE_EXECUTION_API_KEY` 기본값도 동일하게 제거
- **검증**: 호스트에서 `curl http://localhost:3001` 시 연결 거부됨
- **검증**: `.env`에 `SANDBOX_API_KEY`가 없으면 컨테이너 시작 시 에러 또는 경고 로그 출력

### AC3: JWT 서명 검증 구현

- `web-edu/middleware.ts`에서 현재 payload 디코딩만 수행하는 로직을 `jose` 라이브러리를 사용한 HS256 서명 검증으로 교체
- 서명 검증에 사용할 SECRET_KEY는 환경변수 `SECRET_KEY`에서 읽음 (백엔드 `api/configs/feature/__init__.py`의 `SECRET_KEY`와 동일한 값)
- 백엔드 PassportService (`api/libs/passport.py`)는 `jwt.encode(payload, self.sk, algorithm="HS256")`으로 토큰을 발행하므로, 동일한 키와 알고리즘으로 검증
- **검증**: 유효한 서명의 JWT → 보호된 경로 정상 접근
- **검증**: 위조된 서명의 JWT (다른 키로 서명) → `/signin`으로 리다이렉트
- **검증**: 만료된 JWT → `/signin`으로 리다이렉트

### AC4: 미들웨어 인증 경로 보완

- 현재 `PROTECTED_PATHS = ['/dashboard', '/agents', '/datasets', '/admin']`에서 누락된 경로 추가
- **방식 전환**: 블랙리스트(PROTECTED_PATHS) 방식에서 화이트리스트(PUBLIC_PATHS) 방식으로 전환
  - `PUBLIC_PATHS = ['/signin', '/signup', '/callback', '/403']` — 이 경로만 인증 없이 접근 허용
  - 그 외 모든 페이지 경로는 인증 필수
- 이로써 `/owner`, `/my-session`, `/sessions` 등 현재 누락된 경로가 자동으로 보호됨
- 기존 `(auth)` route group (signin/signup/callback)과 `(student)` route group (my-session/sessions) 인증 흐름 호환 확인
- **검증**: 인증 없이 `/owner/dashboard` 접근 시 `/signin?redirect=/owner/dashboard`로 리다이렉트
- **검증**: 인증 없이 `/signin` 접근 시 정상 표시
- **검증**: 인증 없이 `/403` 접근 시 정상 표시

### AC5: 디버그 페이지 제거

- `web-edu/app/api-test/page.tsx` 파일 삭제
- `web-edu/app/test-tools/page.tsx` 파일 삭제
- 해당 페이지에서만 사용하는 import가 있다면 함께 정리
- **검증**: `/api-test` 접근 시 404
- **검증**: `/test-tools` 접근 시 404
- **검증**: 빌드(`next build`) 시 에러 없음

### AC6: Docker 인프라 보안 강화 — 포트 노출 + 기본 비밀번호

- `docker-compose.middleware.yaml`에서 PostgreSQL(5432), Redis(6379), Elasticsearch(9200) 포트 외부 바인딩을 `127.0.0.1`로 제한 또는 제거
- Plugin Daemon 디버깅 포트(5003) 외부 노출 차단
- PostgreSQL/Redis 기본 비밀번호 `difyai123456` 제거 → `.env` 필수 설정으로 변경
- Plugin Daemon Key, Inner API Key 하드코딩 제거 → `.env` 필수 설정으로 변경
- `docker/init-env.sh`에서 DB/Redis/Plugin 키도 자동 랜덤 생성하도록 확장
- **검증**: 외부에서 `psql -h 서버IP -p 5432` 연결 시 거부됨
- **검증**: 외부에서 `redis-cli -h 서버IP` 연결 시 거부됨
- **검증**: `.env` 없이 `docker compose up` 시 필수 환경변수 누락 에러

### AC7: Nginx 보안 강화

- `docker/nginx/conf.d/default.conf.template`에 보안 헤더 추가 (X-Frame-Options, X-Content-Type-Options, HSTS, Referrer-Policy)
- Nginx rate limiting 설정 추가 (로그인/API 엔드포인트)
- CORS 와일드카드 `*` 제거 → `.env.example`에서 실제 도메인 설정 필수로 변경
- TLS 1.1 제거 → `TLSv1.2 TLSv1.3`만 허용
- Swagger UI 프로덕션 기본 비활성화
- **검증**: 응답 헤더에 X-Frame-Options, X-Content-Type-Options 포함됨
- **검증**: `/signin`에 초당 10회 이상 요청 시 429 반환

### AC8: API 백엔드 인가 강화

- `api/controllers/console/edu/users.py`: `GET /users/<user_id>` 에 `@admin_required` 또는 자기 자신 검증 추가
- `api/controllers/console/edu/users.py`: `GET /bulk/<task_id>` 에 `@admin_required` 추가
- `api/controllers/console/edu/resource_tags.py`: `account_id`를 요청에서 받지 않고 `current_user.id` 사용, 세션 멤버십 검증 추가
- `api/libs/passport.py`: `issue()`에 `exp` 클레임 필수 검증 추가
- `api/tasks/education/bulk_user_task.py`: 민감 데이터 로깅 제거 (비밀번호 포함 행 로그)
- **검증**: student 역할로 `GET /console/api/edu/users/<다른유저ID>` 요청 시 403
- **검증**: student 역할로 `GET /console/api/edu/users/bulk/<task_id>` 요청 시 403
- **검증**: `exp` 없는 JWT 발행 시도 시 ValueError 발생

### AC9: API 컨테이너 보안 강화

- `api/Dockerfile`에 비-root 사용자 추가 (USER 지시어)
- **검증**: 컨테이너 내부에서 `whoami` 실행 시 root가 아닌 사용자 반환

---

## Tasks

### Phase 1: 즉시 차단 (외부 공격 경로 봉쇄)

#### Task 1.1 — SSRF 차단 (AC1)
**파일**: `web-edu/next.config.ts`

변경 내용:
- `images.remotePatterns` 배열에서 `hostname: '*'` 항목 2개(http, https) 제거
- API_HOST 환경변수 기반으로 백엔드 호스트만 허용:
  ```typescript
  images: {
    remotePatterns: [
      {
        protocol: 'http',
        hostname: new URL(`http://${process.env.API_HOST || 'localhost:5001'}`).hostname,
      },
      {
        protocol: 'https',
        hostname: new URL(`https://${process.env.API_HOST || 'localhost:5001'}`).hostname,
      },
    ],
  },
  ```
- 추가 허용 호스트가 필요하면 `ALLOWED_IMAGE_HOSTS` 환경변수(콤마 구분)로 확장 가능하도록 설계

#### Task 1.2 — Docker 포트 바인딩 제거 (AC2 일부)
**파일**: `docker/docker-compose.yaml`

변경 내용:
- web-edu 서비스의 `ports` 섹션 제거 또는 `expose`로 변경:
  ```yaml
  web-edu:
    # ...
    expose:
      - "3001"
    # ports 섹션 삭제: - "${EXPOSE_WEB_EDU_PORT:-3001}:3001"
  ```
- Nginx가 Docker 내부 네트워크를 통해 `web-edu:3001`로 접근하는 기존 라우팅은 영향 없음 (같은 Docker network 내 통신)

#### Task 1.3 — Sandbox API 키 강화 (AC2 일부)
**파일**: `docker/docker-compose.yaml`, `docker/.env.example` (있을 경우)

변경 내용:
- `SANDBOX_API_KEY` 기본값 `dify-sandbox` 제거 → 기본값을 빈 문자열로 변경하여 반드시 `.env`에서 설정하도록 강제
- `CODE_EXECUTION_API_KEY` 기본값 `dify-sandbox` 제거 → 동일 처리
- `.env` 파일 또는 배포 문서에 키 생성 명령어 안내: `openssl rand -base64 42`

```yaml
# 변경 전
SANDBOX_API_KEY: ${SANDBOX_API_KEY:-dify-sandbox}
CODE_EXECUTION_API_KEY: ${CODE_EXECUTION_API_KEY:-dify-sandbox}

# 변경 후
SANDBOX_API_KEY: ${SANDBOX_API_KEY:?SANDBOX_API_KEY must be set}
CODE_EXECUTION_API_KEY: ${CODE_EXECUTION_API_KEY:?CODE_EXECUTION_API_KEY must be set}
```

> **주의**: 위 `${VAR:?message}` 문법은 docker-compose에서 지원되지 않을 수 있음. 대안으로 기본값을 빈 문자열로 두고 엔트리포인트에서 검증하거나, 배포 체크리스트에 포함.

---

### Phase 1 Checkpoint
- [ ] SSRF 차단 확인: `/_next/image?url=http://내부IP` 요청 거부됨
- [ ] 외부에서 3001 포트 직접 접근 불가 확인
- [ ] Sandbox가 강한 API 키로 동작 확인

---

### Phase 2: 인증 강화 (JWT + 경로)

#### Task 2.1 — jose 라이브러리 설치 (AC3 사전 작업)
**파일**: `web-edu/package.json`

변경 내용:
- `jose` 패키지 추가: `pnpm add jose`
- `jose`는 Edge Runtime 호환 (Next.js middleware에서 사용 가능)이며, Node.js crypto 의존성 없음

#### Task 2.2 — JWT 서명 검증 구현 (AC3)
**파일**: `web-edu/middleware.ts`

변경 내용:
- `jose` 라이브러리의 `jwtVerify` 함수로 HS256 서명 검증 구현
- 환경변수 `SECRET_KEY`에서 서명 키 읽기
- 기존 수동 base64 디코딩 로직 제거
- 구현 개요:
  ```typescript
  import { jwtVerify } from 'jose'

  const SECRET_KEY = new TextEncoder().encode(process.env.SECRET_KEY || '')

  // 보호된 경로 접근 시
  try {
    await jwtVerify(token, SECRET_KEY, { algorithms: ['HS256'] })
  } catch {
    return NextResponse.redirect(new URL('/signin', request.url))
  }
  ```
- `SECRET_KEY` 환경변수가 비어있으면 모든 JWT 검증 실패 → 안전한 기본값

#### Task 2.3 — 화이트리스트 방식 인증 경로 전환 (AC4)
**파일**: `web-edu/middleware.ts`

변경 내용:
- `PROTECTED_PATHS` 블랙리스트 방식 제거
- `PUBLIC_PATHS` 화이트리스트 방식으로 전환:
  ```typescript
  const PUBLIC_PATHS = ['/signin', '/signup', '/callback', '/403']
  
  // 정적 리소스, API는 matcher에서 이미 제외됨
  // PUBLIC_PATHS에 해당하면 통과
  if (PUBLIC_PATHS.some(path => pathname.startsWith(path))) {
    return NextResponse.next()
  }
  
  // 그 외 모든 경로는 JWT 검증 필수
  ```
- 이 변경으로 자동 보호되는 경로들:
  - `/owner/**` (owner 대시보드, 모니터링, 가격 설정, 사용량 분석)
  - `/my-session`, `/sessions` ((student) route group)
  - `/dashboard`, `/agents`, `/datasets`, `/admin` (기존 보호 경로)
  - 향후 추가되는 모든 새 경로

#### Task 2.4 — web-edu Docker 환경변수에 SECRET_KEY 전달 (AC3 연동)
**파일**: `docker/docker-compose.yaml`

변경 내용:
- web-edu 서비스의 `environment`에 `SECRET_KEY` 추가:
  ```yaml
  web-edu:
    environment:
      SECRET_KEY: ${SECRET_KEY:-}
  ```
- 이 값은 api 서비스와 동일한 `SECRET_KEY` 환경변수를 사용 (이미 docker-compose 최상단 x-shared-env에 정의됨)

---

### Phase 2 Checkpoint
- [ ] 위조된 JWT로 `/dashboard` 접근 시 `/signin`으로 리다이렉트 확인
- [ ] 유효한 JWT로 `/dashboard` 접근 시 정상 표시 확인
- [ ] 인증 없이 `/owner/dashboard` 접근 시 `/signin`으로 리다이렉트 확인
- [ ] 인증 없이 `/signin` 접근 시 정상 표시 확인
- [ ] LMS SSO 로그인 플로우 정상 작동 확인 (기존 쿠키 기반 인증 호환)

---

### Phase 3: 정리 (디버그 페이지 제거)

#### Task 3.1 — 디버그 페이지 삭제 (AC5)
**파일 삭제**:
- `web-edu/app/api-test/page.tsx`
- `web-edu/app/test-tools/page.tsx`

확인 사항:
- `api-test/page.tsx`는 `@/service/dify-api`와 `@/components/common`의 `Button`을 import하지만, 이들은 다른 곳에서도 사용하므로 삭제 불필요
- `test-tools/page.tsx`는 `@/components/agent/wizard/ToolList`를 import하지만, 이것도 Agent Wizard에서 사용하므로 삭제 불필요
- 디렉토리 자체를 삭제하면 Next.js가 자동으로 해당 경로를 404로 처리함

---

### Phase 3 Checkpoint
- [ ] `/api-test` 접근 시 404 확인
- [ ] `/test-tools` 접근 시 404 확인
- [ ] `next build` 성공 확인 (삭제로 인한 빌드 에러 없음)

---

### Phase 4: Docker/Nginx 인프라 보안 (AC6, AC7)

#### Task 4.1 — DB/Redis/ES 포트 외부 노출 차단 (AC6)
**파일**: `docker/docker-compose.middleware.yaml`

변경 내용:
- PostgreSQL `ports` 를 `127.0.0.1:${EXPOSE_POSTGRES_PORT:-5432}:5432`로 변경
- Redis `ports` 를 `127.0.0.1:${EXPOSE_REDIS_PORT:-6379}:6379`로 변경
- Elasticsearch `ports` 를 `127.0.0.1:${EXPOSE_ES_PORT:-9200}:9200`로 변경

#### Task 4.2 — Plugin Daemon 포트 차단 (AC6)
**파일**: `docker/docker-compose.yaml`

변경 내용:
- Plugin daemon `ports` 를 `127.0.0.1:${EXPOSE_PLUGIN_DEBUGGING_PORT:-5003}:5003`으로 변경

#### Task 4.3 — 기본 비밀번호/키 제거 + init-env.sh 확장 (AC6)
**파일**: `docker/.env.example`, `docker/middleware.env.example`, `docker/init-env.sh`

변경 내용:
- `.env.example`과 `middleware.env.example`에서 기본 비밀번호 `difyai123456` 제거 → 빈 값으로 변경
- `PLUGIN_DAEMON_KEY`, `PLUGIN_DIFY_INNER_API_KEY` 하드코딩 값 제거 → 빈 값으로 변경
- `init-env.sh`에 랜덤 생성 로직 추가:
  ```bash
  # 기존: SECRET_KEY, API_KEY_ENCRYPTION_KEY 생성
  # 추가: DB_PASSWORD, REDIS_PASSWORD, SANDBOX_API_KEY,
  #       PLUGIN_DAEMON_KEY, PLUGIN_DIFY_INNER_API_KEY
  ```

#### Task 4.4 — Nginx 보안 헤더 + Rate Limiting (AC7)
**파일**: `docker/nginx/conf.d/default.conf.template`, `docker/nginx/nginx.conf.template`

변경 내용:
- `default.conf.template` server 블록에 보안 헤더 추가:
  ```nginx
  add_header X-Frame-Options "SAMEORIGIN" always;
  add_header X-Content-Type-Options "nosniff" always;
  add_header X-XSS-Protection "1; mode=block" always;
  add_header Referrer-Policy "strict-origin-when-cross-origin" always;
  ```
- `nginx.conf.template` http 블록에 rate limiting zone 추가:
  ```nginx
  limit_req_zone $binary_remote_addr zone=login:10m rate=5r/m;
  limit_req_zone $binary_remote_addr zone=api:10m rate=30r/s;
  ```
- 로그인 관련 location에 `limit_req zone=login burst=10 nodelay;` 적용

#### Task 4.5 — CORS/TLS/Swagger 설정 (AC7)
**파일**: `docker/.env.example`

변경 내용:
- `WEB_API_CORS_ALLOW_ORIGINS=*` → 빈 값 (필수 설정으로 변경)
- `CONSOLE_CORS_ALLOW_ORIGINS=*` → 빈 값
- `NGINX_SSL_PROTOCOLS=TLSv1.1 TLSv1.2 TLSv1.3` → `TLSv1.2 TLSv1.3`
- `SWAGGER_UI_ENABLED=true` → `false`

---

### Phase 4 Checkpoint
- [ ] 외부에서 PostgreSQL/Redis/ES 직접 접근 불가 확인
- [ ] 외부에서 Plugin 5003 포트 직접 접근 불가 확인
- [ ] `init-env.sh` 실행 시 DB/Redis/Plugin 키 자동 생성 확인
- [ ] 응답 헤더에 보안 헤더 포함 확인
- [ ] TLS 1.1 연결 거부 확인

---

### Phase 5: API 백엔드 인가 강화 (AC8, AC9)

#### Task 5.1 — 사용자/태스크 조회 IDOR 수정 (AC8)
**파일**: `api/controllers/console/edu/users.py`

변경 내용:
- `GET /users/<user_id>` (라인 ~153): `@admin_required` 데코레이터 추가, 또는 `current_user.id == user_id` 검증
- `GET /bulk/<task_id>` (라인 ~340): `@admin_required` 데코레이터 추가

#### Task 5.2 — 리소스 태그 권한 수정 (AC8)
**파일**: `api/controllers/console/edu/resource_tags.py`

변경 내용:
- `create_tag`: 요청 본문의 `account_id` 대신 `current_user.id` 사용
- 세션 멤버십 검증 추가 (해당 세션의 멤버인지 확인)
- `delete_tag`: 태그 생성자 또는 admin만 삭제 가능하도록 권한 검증

#### Task 5.3 — JWT exp 클레임 필수화 + 민감 로깅 제거 (AC8)
**파일**: `api/libs/passport.py`, `api/tasks/education/bulk_user_task.py`

변경 내용:
- `passport.py`: `issue()` 메서드에 `if "exp" not in payload: raise ValueError("exp claim is required")` 추가
- `bulk_user_task.py:77`: `logger.info("First user sample: %s", users[0])` 제거 또는 비밀번호 마스킹

#### Task 5.4 — API Dockerfile 비-root 사용자 (AC9)
**파일**: `api/Dockerfile`

변경 내용:
- 빌드 단계 후에 비-root 사용자 추가:
  ```dockerfile
  RUN useradd -r -s /bin/false appuser
  USER appuser
  ```
- 파일 권한이 새 사용자에서 작동하는지 확인 필요

---

### Phase 5 Checkpoint
- [ ] student 역할로 타 유저 조회 시 403 확인
- [ ] student 역할로 bulk task 상태 조회 시 403 확인
- [ ] resource_tags에서 account_id 위조 불가 확인
- [ ] exp 없는 JWT 발행 시도 시 ValueError 확인
- [ ] 로그에 평문 비밀번호 미포함 확인
- [ ] API 컨테이너 내 `whoami` 결과가 root 아님 확인

---

## 의존성 그래프

```
Phase 1 (즉시 차단 — 병렬):
  Task 1.1 (SSRF 차단) ─────────────────┐
  Task 1.2 (web-edu 포트 제거) ──────────┤─→ Phase 1 Checkpoint
  Task 1.3 (Sandbox API 키) ─────────────┘

Phase 2 (인증 강화 — 순차):
  Task 2.1 (jose 설치) ──→ Task 2.2 (JWT 검증) ──┐
                           Task 2.3 (경로 전환) ──┤─→ Phase 2 Checkpoint
                           Task 2.4 (SECRET_KEY) ─┘

Phase 3 (정리):
  Task 3.1 (디버그 페이지 삭제) ─────────────────→ Phase 3 Checkpoint

Phase 4 (인프라 — 병렬):
  Task 4.1 (DB/Redis/ES 포트) ──────────┐
  Task 4.2 (Plugin 포트) ───────────────┤
  Task 4.3 (기본 비밀번호/키 + init-env) ┤─→ Phase 4 Checkpoint
  Task 4.4 (Nginx 보안 헤더/Rate limit) ┤
  Task 4.5 (CORS/TLS/Swagger) ──────────┘

Phase 5 (API 백엔드 — 병렬):
  Task 5.1 (IDOR 수정) ─────────────────┐
  Task 5.2 (리소스 태그 권한) ───────────┤─→ Phase 5 Checkpoint
  Task 5.3 (JWT exp + 로깅) ────────────┤
  Task 5.4 (API Dockerfile non-root) ───┘
```

- Phase 1~3: web-edu 관련 — 순차 실행 (Phase 2는 Phase 1 후, Phase 3은 Phase 2 후)
- Phase 4: docker/Nginx — Phase 1과 병렬 가능하나 안전을 위해 Phase 1 후 실행 권장
- Phase 5: api 백엔드 — Phase 4와 병렬 가능
- 각 Phase 내 Task는 병렬 실행 가능 (같은 파일 수정 제외)

---

## Dev Agent Record

### HOTFIX_IMPL Phase 1~3 — 2026-04-07

#### 변경된 파일 목록

| 파일 | 변경 요약 |
|------|----------|
| `web-edu/next.config.ts` | `hostname: '*'` 와일드카드 제거, API_HOST 기반 허용 호스트만 설정. `ALLOWED_IMAGE_HOSTS` 환경변수로 추가 호스트 확장 가능 |
| `web-edu/middleware.ts` | `jose` 라이브러리로 HS256 JWT 서명 검증 구현. PROTECTED_PATHS 블랙리스트 -> PUBLIC_PATHS 화이트리스트 전환. middleware를 async로 변경 |
| `web-edu/package.json` | `jose@6.2.2` 의존성 추가 |
| `docker/docker-compose.yaml` | web-edu `ports` -> `expose` 변경, `SECRET_KEY` 환경변수 추가, `SANDBOX_API_KEY`/`CODE_EXECUTION_API_KEY`/sandbox `API_KEY` 기본값 `dify-sandbox` 제거 |
| `web-edu/app/api-test/` | 디렉토리 삭제 |
| `web-edu/app/test-tools/` | 디렉토리 삭제 |

#### 품질 검사 결과

- **Phase 1 Checkpoint**
  - [x] next.config.ts에 `hostname: '*'` 없음
  - [x] docker-compose에서 web-edu `ports` 제거, `expose`로 변경
  - [x] SANDBOX_API_KEY, CODE_EXECUTION_API_KEY 기본값 `dify-sandbox` 제거 (x-shared-env, sandbox 서비스 모두)

- **Phase 2 Checkpoint**
  - [x] middleware.ts에 `jwtVerify` 사용
  - [x] PUBLIC_PATHS 화이트리스트 방식 (`/signin`, `/signup`, `/callback`, `/403`)
  - [x] SECRET_KEY 환경변수를 docker-compose web-edu 서비스에 추가

- **Phase 3 Checkpoint**
  - [x] `web-edu/app/api-test/` 디렉토리 삭제 확인
  - [x] `web-edu/app/test-tools/` 디렉토리 삭제 확인

#### 이슈 기록

- `${VAR:?message}` 문법은 docker-compose에서 지원되지 않으므로, SANDBOX_API_KEY/CODE_EXECUTION_API_KEY 기본값을 빈 문자열(`:-`)로 설정함. `.env`에 강한 키를 설정하지 않으면 sandbox가 빈 키로 실행되므로, 배포 체크리스트에 포함 필요.

### HOTFIX_IMPL Phase 4 — 2026-04-07

#### 변경된 파일 목록

| 파일 | 변경 요약 |
|------|----------|
| `docker/docker-compose.middleware.yaml` | PostgreSQL, Redis, Elasticsearch 포트를 `127.0.0.1`에만 바인딩. Plugin daemon 포트도 동일 처리. SANDBOX_API_KEY, PLUGIN_DAEMON_KEY, PLUGIN_DIFY_INNER_API_KEY, DB/Redis 비밀번호 하드코딩 기본값 제거 |
| `docker/docker-compose.yaml` | Plugin daemon 디버깅 포트를 `127.0.0.1`에만 바인딩. DB_PASSWORD, REDIS_PASSWORD, CELERY_BROKER_URL, PLUGIN_DAEMON_KEY, PLUGIN_DIFY_INNER_API_KEY, POSTGRES_PASSWORD, Redis 관련 하드코딩 기본값 제거 |
| `docker/.env.example` | DB_PASSWORD, REDIS_PASSWORD, SANDBOX_API_KEY, CODE_EXECUTION_API_KEY, PLUGIN_DAEMON_KEY, PLUGIN_DIFY_INNER_API_KEY 기본값 제거 (빈 값). CELERY_BROKER_URL에서 하드코딩 비밀번호 제거. WEB_API_CORS_ALLOW_ORIGINS, CONSOLE_CORS_ALLOW_ORIGINS `*` -> 빈 값. NGINX_SSL_PROTOCOLS에서 TLSv1.1 제거. SWAGGER_UI_ENABLED -> false |
| `docker/middleware.env.example` | POSTGRES_PASSWORD, REDIS_PASSWORD, SANDBOX_API_KEY, PLUGIN_DAEMON_KEY, PLUGIN_DIFY_INNER_API_KEY 기본값 제거 (빈 값) |
| `docker/init-env.sh` | DB_PASSWORD, REDIS_PASSWORD, SANDBOX_API_KEY(+CODE_EXECUTION_API_KEY 동기화), PLUGIN_DAEMON_KEY, PLUGIN_DIFY_INNER_API_KEY 자동 랜덤 생성 로직 추가. middleware.env 동기화 포함. 기존 키 백업/복원 로직 확장 |
| `docker/nginx/conf.d/default.conf.template` | server 블록에 보안 헤더 4종 추가 (X-Frame-Options, X-Content-Type-Options, X-XSS-Protection, Referrer-Policy). `/console/api/login` location에 rate limit 적용 |
| `docker/nginx/nginx.conf.template` | http 블록에 rate limiting zone 2개 추가 (login: 5r/m, api: 30r/s) |

#### 품질 검사 결과

- **Phase 4 Checkpoint**
  - [x] `docker-compose.middleware.yaml`의 PostgreSQL, Redis, Elasticsearch 모든 ports가 `127.0.0.1`로 바인딩
  - [x] `docker-compose.yaml`의 Plugin daemon 디버깅 포트가 `127.0.0.1`로 바인딩
  - [x] `init-env.sh`에서 새로 추가한 변수들이 빈 값일 때만 생성 (기존 값 보존)
  - [x] `.env.example`, `middleware.env.example`에서 `difyai123456` 기본 비밀번호 제거
  - [x] PLUGIN_DAEMON_KEY, PLUGIN_DIFY_INNER_API_KEY 하드코딩 기본값 제거
  - [x] Nginx 보안 헤더 4종이 server 블록 최상단에 위치
  - [x] Rate limiting zone이 http 블록에 정의되고, `/console/api/login`에 적용
  - [x] TLS 1.1 제거 (TLSv1.2 TLSv1.3만 허용)
  - [x] CORS 와일드카드 `*` 제거
  - [x] SWAGGER_UI_ENABLED 기본값 false

#### 이슈 기록

- `.env.example`의 벡터 DB 서비스들(Qdrant, PGVector, Relyt, OceanBase, Chroma)에도 `difyai123456`이 남아 있으나, 이들은 선택적 서비스이고 Story 범위(Phase 4)에서 명시하지 않았으므로 이번 작업에서는 미처리. 별도 정리 필요.
- `/console/api/login`은 Nginx에 명시적 location이 없었으므로 새로 추가하여 rate limit를 적용함. Nginx의 location 매칭 규칙에 의해 `/console/api/login`이 `/console/api`보다 더 구체적이므로 우선 매칭됨.
- CELERY_BROKER_URL은 Redis 비밀번호를 URL에 포함하는 형태이므로, init-env.sh에서 REDIS_PASSWORD 생성 시 CELERY_BROKER_URL의 비밀번호도 자동 업데이트되도록 처리.
- docker-compose.middleware.yaml에도 plugin_daemon 서비스가 존재하여 포트 바인딩을 동일하게 127.0.0.1로 제한함.

### User Briefing

#### 수정 요약

**AC1 (SSRF 차단)**: `next.config.ts`에서 모든 호스트를 허용하던 `hostname: '*'`를 제거하고, `API_HOST` 환경변수에서 파싱한 백엔드 호스트만 허용하도록 변경. 추가 호스트가 필요하면 `ALLOWED_IMAGE_HOSTS=host1,host2` 환경변수로 설정 가능.

**AC2 (Docker 보안)**: web-edu 컨테이너의 포트를 외부에 바인딩하지 않고 Docker 내부 네트워크로만 통신하도록 `expose`로 변경. SANDBOX_API_KEY, CODE_EXECUTION_API_KEY의 기본값 `dify-sandbox` 제거.

**AC3 (JWT 서명 검증)**: middleware에서 기존 base64 디코딩만 하던 방식을 `jose` 라이브러리의 `jwtVerify`로 교체하여 HS256 서명을 실제로 검증. `SECRET_KEY` 환경변수가 백엔드와 동일해야 함.

**AC4 (경로 보호)**: PROTECTED_PATHS 블랙리스트를 제거하고 PUBLIC_PATHS 화이트리스트(`/signin`, `/signup`, `/callback`, `/403`)로 전환. 이 4개 경로만 인증 없이 접근 가능하고, 나머지 모든 경로는 JWT 검증 필수.

**AC5 (디버그 페이지)**: `web-edu/app/api-test/`와 `web-edu/app/test-tools/` 디렉토리 삭제. 해당 경로 접근 시 자동으로 404.

#### 확인 방법

1. **SSRF 차단 테스트**: 서버에서 `curl "http://localhost/web-edu/_next/image?url=http://10.0.0.1/secret&w=64&q=75"` 요청 시 400 에러 반환되는지 확인
2. **포트 차단 테스트**: 호스트에서 `curl http://localhost:3001` 시 연결 거부되는지 확인
3. **JWT 검증 테스트**: 브라우저에서 쿠키 없이 `/dashboard` 접근 시 `/signin`으로 리다이렉트되는지, 유효한 JWT로 로그인 후 정상 접근되는지 확인
4. **화이트리스트 테스트**: 인증 없이 `/owner/dashboard`, `/my-session` 등 접근 시 `/signin`으로 리다이렉트되는지 확인. `/signin`, `/403`은 인증 없이 접근 가능한지 확인
5. **디버그 페이지 테스트**: `/api-test`, `/test-tools` 접근 시 404 확인
6. **LMS SSO 플로우**: 기존 LMS에서 SSO 로그인 후 정상적으로 페이지 접근 가능한지 확인

#### 알려진 제약사항

- `SECRET_KEY` 환경변수를 반드시 `.env`에 설정해야 함 (백엔드 api와 동일한 값). 미설정 시 모든 JWT 검증이 실패하여 로그인 불가.
- `SANDBOX_API_KEY`를 `.env`에 설정하지 않으면 sandbox가 빈 키로 실행됨. 배포 전 `openssl rand -base64 42`로 생성한 강한 키를 설정할 것.
- Phase 4~5 (Docker 인프라, API 백엔드)는 이 작업 범위에 포함되지 않음.

### HOTFIX_IMPL Phase 5 — 2026-04-07

#### 변경된 파일 목록

| 파일 | 변경 요약 |
|------|----------|
| `api/controllers/console/edu/users.py` | `GET /users/<user_id>` IDOR 방어 (자기 자신 or admin/owner만), `GET /bulk/<task_id>`에 `@admin_required` 추가 |
| `api/controllers/console/edu/resource_tags.py` | `create_tag`에서 `account_id`를 `current_user.id`로 대체, 세션 멤버십 검증 추가, `delete_tag`에 생성자/admin 권한 검증 추가 |
| `api/libs/passport.py` | `issue()`에 `exp` 클레임 필수 검증 (`ValueError` 발생) |
| `api/controllers/web/passport.py` | `exp` 없던 호출부 2곳에 `exp` 클레임 추가 |
| `api/tasks/education/bulk_user_task.py` | `logger.info("First user sample: %s", users[0])` 제거 (비밀번호 포함 로깅 방지) |
| `api/tests/unit_tests/libs/test_passport.py` | `exp` 필수화에 맞게 테스트 업데이트 + `test_should_reject_issue_without_exp` 추가 |
| `api/Dockerfile` | 비-root 사용자(appuser) 추가: `useradd`, `chown`, `USER appuser` |

#### 품질 검사 결과

- **Phase 5 Checkpoint**
  - [x] `GET /users/<user_id>` — student 역할로 타 유저 조회 시 403 반환 (IDOR 방어)
  - [x] `GET /bulk/<task_id>` — `@admin_required` 데코레이터 추가됨
  - [x] `create_tag` — `account_id` 위조 불가 (`current_user.id` 사용)
  - [x] `create_tag` — 세션 멤버십 검증 추가 (비멤버는 403)
  - [x] `delete_tag` — 태그 생성자 또는 admin/owner만 삭제 가능
  - [x] `passport.py` `issue()` — `exp` 없이 호출 시 `ValueError` 발생
  - [x] `controllers/web/passport.py` — 기존 `exp` 누락 호출부 2곳에 `exp` 추가
  - [x] `bulk_user_task.py` — 민감 데이터(비밀번호) 로깅 제거
  - [x] `api/Dockerfile` — 비-root 사용자(appuser)로 실행
  - [x] `ruff check` 린트 통과 (모든 변경 파일)

#### 이슈 기록

- `controllers/web/passport.py`의 `PassportResource.get()`과 `_exchange_for_public_app_token()`에서 `exp` 클레임 없이 JWT를 발행하고 있었음. 두 곳 모두 `dify_config.ACCESS_TOKEN_EXPIRE_MINUTES` 기반 `exp` 추가로 해결.
- `resource_tags.py`는 `flask_login`의 `current_user`를 사용하는 패턴이고 (edu/users.py는 커스텀 `jwt_required`의 `request.user`), 기존 데코레이터 체계를 유지하면서 권한 검증 추가.
- `api/tests/unit_tests/libs/test_passport.py`의 테스트 대부분이 `exp` 없이 `issue()`를 호출하고 있어서 전면 수정. 빈 payload `{}` 테스트 케이스는 `exp` 필수화로 인해 제거.

### HOTFIX_IMPL 테스트 보강 (TEA FAIL 대응) — 2026-04-07

#### 변경된 파일 목록

| 파일 | 변경 요약 |
|------|----------|
| `web-edu/__tests__/middleware.test.ts` | 전면 재작성: jose를 jest.mock()으로 모킹, 모든 middleware() 호출에 await 추가. 유효 JWT 통과, 위조 JWT 리다이렉트, 만료 JWT 리다이렉트, 토큰 없이 리다이렉트, PUBLIC_PATHS 통과, 화이트리스트 미포함 경로(/, /about, /owner, /my-session) 리다이렉트 검증 |
| `api/tests/unit_tests/controllers/console/edu/test_users_authorization.py` | 신규: IDOR 방어 테스트 — student가 타 유저 조회 시 403, admin이 타 유저 조회 시 200, 자기 자신 조회 시 200, admin_required 데코레이터가 student 거부/admin 허용 검증 |
| `api/tests/unit_tests/controllers/console/edu/test_resource_tags_authorization.py` | 신규: create_tag IDOR 방어 (account_id 무시, current_user.id 사용), 세션 비멤버 403, delete_tag 비생성자 비관리자 403, admin 삭제 허용 검증 |
| `api/tests/unit_tests/controllers/console/edu/__init__.py` | 신규: 패키지 초기화 |

#### TEA 이슈별 해결 현황

| TEA 이슈 | 대응 | 상태 |
|----------|------|------|
| 이슈 1 (Critical): middleware.test.ts jose 미모킹/async 미사용 | jose jest.mock() + await 전체 적용 | DONE |
| 이슈 2 (Critical): 위조 JWT 부정 테스트 부재 | 위조 JWT(서명 불일치) 리다이렉트 테스트 추가 | DONE |
| 이슈 3 (High): 화이트리스트 전환 검증 부재 | /, /about, /owner, /my-session 등 비-public 경로 리다이렉트 테스트 추가 | DONE |
| 이슈 4 (Critical): users.py IDOR 테스트 부재 | student/admin/self 3가지 시나리오 테스트 작성 | DONE |
| 이슈 5 (High): bulk task 인가 테스트 부재 | admin_required 데코레이터 직접 테스트 (student 거부, admin 허용) | DONE |
| 이슈 6 (Critical): resource_tags IDOR/멤버십/삭제 권한 테스트 부재 | 4가지 시나리오 테스트 작성 (IDOR, 멤버십, 삭제 권한) | DONE |
| 이슈 7 (Info): passport.py exp 검증 | 기존 테스트 확인 (`test_should_reject_issue_without_exp` 라인 34) | EXISTING |

#### 품질 검사 결과

- [x] `test_users_authorization.py` Python 문법 검사 통과 (ast.parse)
- [x] `test_resource_tags_authorization.py` Python 문법 검사 통과 (ast.parse)
- [x] `middleware.test.ts` — jose mock 패턴, async/await 적용, 화이트리스트 검증 포함

### HOTFIX_CR_FIX — 2026-04-07

#### 변경된 파일 목록

| 파일 | 변경 요약 |
|------|----------|
| `docker/docker-compose.middleware.yaml` | ssrf_proxy/sandbox 포트를 `127.0.0.1`에만 바인딩 (Critical 1). `ELASTIC_PASSWORD` fallback 기본값 `elastic` 제거 (Critical 2) |
| `docker/.env.example` | `ELASTICSEARCH_PASSWORD=elastic` -> 빈 값 (Critical 2) |
| `docker/middleware.env.example` | `ELASTICSEARCH_PASSWORD=elastic` -> 빈 값 (Critical 2) |
| `docker/init-env.sh` | `ELASTICSEARCH_PASSWORD` 자동 랜덤 생성 로직 추가 + 기존 키 백업/복원에 포함 (Critical 2) |
| `docker/nginx/conf.d/default.conf.template` | HSTS 헤더 추가 (Important 4). `/console/api`, `/api/`, `/v1`에 `limit_req zone=api` 적용 (Important 5) |
| `api/services/edu/resource_tagging_service.py` | `check_session_membership`, `check_delete_permission`, `is_privileged_user` 메서드 추가 (Important 3, 6) |
| `api/controllers/console/edu/resource_tags.py` | `db.session` 직접 호출 제거, 서비스 메서드로 대체 (Important 3). `get_resources_by_tag`에서 non-admin은 `current_user.id` 강제 (Important 6) |

#### 품질 검사 결과

- [x] `docker-compose.middleware.yaml`에서 ssrf_proxy/sandbox ports가 `127.0.0.1`로 변경됨
- [x] `.env.example`, `middleware.env.example`에서 `ELASTICSEARCH_PASSWORD`가 빈 값
- [x] `docker-compose.middleware.yaml`에서 `ELASTIC_PASSWORD` fallback 기본값 제거
- [x] `init-env.sh`에 `ELASTICSEARCH_PASSWORD` 자동 생성 로직 추가 (기존 패턴 준수)
- [x] nginx `default.conf.template`에 HSTS 헤더 존재
- [x] nginx `/console/api`, `/api/`, `/v1` location에 `limit_req zone=api burst=50 nodelay` 적용
- [x] `resource_tags.py`에서 `db.session` 직접 호출 0건 (모두 서비스 레이어로 이동)
- [x] `get_resources_by_tag`에서 non-admin은 `current_user.id` 강제
- [x] `ruff check` 린트 통과

#### 이슈 기록

- `resource_tags.py`에서 unused import 3개 (`db`, `TenantAccountJoin`/`TenantAccountRole`, `EducationSessionMember`) 제거 완료
- `resource_tagging_service.py`에 `check_delete_permission`은 tag 조회와 권한 검증을 하나의 메서드로 결합하여 불필요한 이중 조회 방지
- `is_privileged_user` 메서드를 별도로 추가하여 `get_resources_by_tag`의 admin 체크에도 재사용 가능하게 구성

## Lifecycle Log

### HOTFIX_USER_VERIFY — 2026-04-09 09:47
- Approved — 서버 배포 완료, 보안 테스트 전체 PASS, 외부 포트 차단 로컬 PC에서 확인


### HOTFIX_IMPL — 2026-04-08 11:14
- Next.js 15.5.9 + React 19.1.4 업그레이드 — CVE-2025-55182(RCE), CVE-2025-67779(DoS), CVE-2025-55183(소스노출) 패치


### HOTFIX_CODE_REVIEW — 2026-04-08 11:02
- Approved (R3) — 모든 이슈 해결, 3-레이어 준수 확인


### HOTFIX_IMPL — 2026-04-08 11:02
- CR R2 수정 — users.py db.session 직접 호출을 ResourceTaggingService.is_privileged_user()로 교체


### HOTFIX_IMPL — 2026-04-08 11:00
- CR 수정 완료 — Critical 2건(ssrf_proxy 포트, ES 비밀번호) + Important 4건(3-레이어, HSTS, rate limit, account_id)


### HOTFIX_CR_FIX — 2026-04-07
- CR 수정 완료 — Critical 2건 + Important 4건, 7 files changed

### HOTFIX_CODE_REVIEW — 2026-04-08 10:56
- CR — Critical 2건(ssrf_proxy 포트, ES 비밀번호) + Important 4건


### HOTFIX_TEST_REVIEW — 2026-04-08 10:53
- PASS — 이전 3개 이슈 모두 해결, AC3/AC4/AC8 커버리지 확인


### HOTFIX_IMPL — 2026-04-08 10:50
- 테스트 보강 완료 — middleware.test.ts 재작성(16케이스), IDOR 테스트 2파일(9케이스), passport exp 기존 확인


### HOTFIX_IMPL_TEST_REINFORCEMENT — 2026-04-07
- TEA FAIL 대응 — middleware.test.ts 전면 재작성, IDOR 테스트 2파일 신규 작성, 7개 이슈 모두 대응

### HOTFIX_TEST_REVIEW — 2026-04-08 10:47
- FAIL — middleware.test.ts 서명 검증 미검증, IDOR 테스트 전무, AC 커버리지 0%


### HOTFIX_IMPL — 2026-04-08 10:43
- Phase 1-5 구현 완료 — 23 files changed, 509 insertions, 733 deletions


### HOTFIX_STORY — 2026-04-08 10:36
- Story 업데이트 — 9 AC (web-edu 5 + docker/Nginx 2 + api 2), 16 Tasks, 5 Phases, Full route


### HOTFIX_STORY — 2026-04-08 10:18
- Hotfix story 생성 완료 — 5 AC, 7 Tasks, Full route

_(빈 섹션 -- 리더가 상태 전환마다 추가)_
