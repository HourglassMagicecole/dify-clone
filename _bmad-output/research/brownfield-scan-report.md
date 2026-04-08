# Brownfield 스캔 보고서 - dify-moai-v2

**스캔 일자:** 2026-04-07
**스캔 유형:** Phase 0 초기 코드베이스 스캔 (Quick Scan)
**프로젝트 루트:** /Users/bhahn/MyProject/dify-moai-v2
**브랜치:** moai-v2

---

## 1. 프로젝트 개요

이 프로젝트는 **Dify** 오픈소스 LLM 애플리케이션 플랫폼(v1.9.1)을 기반으로 한 **교육용 AI 플랫폼(MAI Studio)**이다. 원본 Dify를 포크하여, 교육(Education) 도메인에 특화된 기능들(세션 관리, 사용자 역할, 사용량 추적, LMS SSO 등)을 추가 개발하고 있다.

---

## 2. 프로젝트 분류

| 항목 | 값 |
|------|-----|
| 프로젝트 타입 | 모노레포 (Monorepo) - 멀티파트 웹 애플리케이션 |
| 저장소 구조 | 백엔드(api/) + 프론트엔드(web/) + 교육용 프론트엔드(web-edu/) + 인프라(docker/) + SDK(sdks/) |
| 라이선스 | 프로젝트 루트에 LICENSE 파일 존재 |
| 파트 수 | 5개 (api, web, web-edu, docker, sdks) |

---

## 3. 디렉토리 구조 및 역할

```
dify-moai-v2/
├── api/                    # 백엔드 API 서버 (Python/Flask)
│   ├── configs/            # 애플리케이션 설정
│   ├── controllers/        # REST API 컨트롤러 (console/, service_api/, web/, inner_api/, mcp/)
│   │   └── console/edu/    # 교육 도메인 API 엔드포인트
│   ├── core/               # 핵심 비즈니스 로직
│   │   ├── agent/          # AI 에이전트 엔진
│   │   ├── app/            # 앱 실행 엔진
│   │   ├── model_runtime/  # LLM 모델 런타임
│   │   ├── rag/            # RAG (검색 증강 생성) 파이프라인
│   │   ├── tools/          # 도구 통합
│   │   └── workflow/       # 워크플로우 엔진
│   ├── models/             # SQLAlchemy ORM 모델
│   │   └── education/      # 교육 도메인 데이터 모델 (15개 모델)
│   ├── services/           # 서비스 계층
│   │   ├── edu/            # 교육 관련 서비스
│   │   └── education_management/  # 교육 관리 서비스
│   ├── migrations/         # Alembic DB 마이그레이션 (167개 버전)
│   ├── tasks/              # Celery 비동기 작업
│   ├── events/             # 이벤트 핸들러
│   └── tests/              # 테스트 코드
│
├── web/                    # Dify 메인 프론트엔드 (Next.js/React)
│   ├── app/                # Next.js App Router 페이지
│   │   ├── (commonLayout)/ # 공통 레이아웃 페이지
│   │   ├── (shareLayout)/  # 공유 레이아웃 페이지
│   │   ├── components/     # 페이지별 컴포넌트
│   │   └── education-apply/# 교육 신청 페이지
│   ├── context/            # React 컨텍스트
│   ├── hooks/              # 커스텀 훅
│   ├── i18n/               # 국제화 (다국어 지원)
│   ├── models/             # TypeScript 타입 정의
│   ├── service/            # API 통신 계층
│   └── themes/             # 테마 설정
│
├── web-edu/                # 교육용 별도 프론트엔드 (Next.js/React) - MAI Studio
│   ├── app/                # Next.js App Router
│   │   ├── (auth)/         # 인증 관련 페이지
│   │   ├── (student)/      # 학생 전용 페이지
│   │   ├── admin/          # 관리자 페이지 (세션, 사용자, API 키, 대시보드)
│   │   ├── agents/         # 에이전트 관리 페이지
│   │   └── owner/          # 오너 역할 페이지
│   ├── components/         # UI 컴포넌트
│   ├── context/            # React 컨텍스트
│   ├── hooks/              # 커스텀 훅
│   ├── i18n/               # 국제화 (Korean 우선)
│   ├── schemas/            # Zod 유효성 검사 스키마
│   ├── service/            # API 통신 계층
│   └── types/              # TypeScript 타입 정의
│
├── docker/                 # Docker 인프라 구성
│   ├── docker-compose.yaml # 메인 Docker Compose (자동 생성됨)
│   ├── docker-compose-template.yaml  # 템플릿
│   ├── nginx/              # Nginx 리버스 프록시 설정
│   ├── pgvector/           # PostgreSQL + pgvector 확장
│   ├── elasticsearch/      # Elasticsearch 설정
│   ├── ssrf_proxy/         # SSRF 방지 프록시
│   ├── certbot/            # SSL 인증서 관리
│   └── startupscripts/     # 초기화 스크립트
│
├── sdks/                   # 클라이언트 SDK
│   ├── nodejs-client/      # Node.js SDK
│   ├── python-client/      # Python SDK
│   └── php-client/         # PHP SDK
│
├── scripts/                # 유틸리티 스크립트
│   └── stress-test/        # 스트레스 테스트 도구
│
├── dev/                    # 개발 환경 설정
│   └── pytest/             # Pytest 설정
│
├── .github/                # GitHub 설정
│   └── workflows/          # CI/CD 워크플로우 (16개)
│
├── .devcontainer/          # VS Code Dev Container 설정
├── .team/                  # 팀 협업 관련 (핸드오프, 리포트)
├── _bmad/                  # BMAD 프레임워크 설정
├── _bmad-output/           # BMAD 산출물
└── Makefile                # 빌드/개발 자동화 명령
```

---

## 4. 기술 스택

### 4.1 백엔드 (api/)

| 카테고리 | 기술 | 버전 | 비고 |
|----------|------|------|------|
| 언어 | Python | >=3.11, <3.13 | |
| 웹 프레임워크 | Flask | ~3.1.2 | flask-restx로 REST API 구축 |
| ORM | SQLAlchemy | ~2.0.29 | flask-sqlalchemy, flask-migrate |
| DB 마이그레이션 | Alembic | (flask-migrate 내장) | 167개 마이그레이션 |
| 데이터베이스 | PostgreSQL | (Docker 기반) | pgvector 확장 포함 |
| 캐시/큐 | Redis | ~6.1.0 | hiredis 드라이버 |
| 작업 큐 | Celery | ~5.5.2 | 비동기 작업 처리 |
| WSGI 서버 | Gunicorn | ~23.0.0 | gevent 워커 |
| AI/LLM | OpenAI SDK | ~1.61.0 | LLM 통합 |
| 검색 | Elasticsearch | (Docker) | 벡터 검색 지원 |
| 관측성 | OpenTelemetry | 1.27.0 | 분산 추적 |
| 에러 추적 | Sentry | ~2.28.0 | Flask 통합 |
| 데이터 검증 | Pydantic | ~2.11.4 | |
| 인증 | Authlib | 1.6.4 | OAuth, JWT |

### 4.2 프론트엔드 - web/ (Dify 메인 UI)

| 카테고리 | 기술 | 버전 | 비고 |
|----------|------|------|------|
| 프레임워크 | Next.js | 15.5.0 | App Router, Turbopack |
| UI 라이브러리 | React | 19.1.1 | |
| 언어 | TypeScript | - | |
| 패키지 매니저 | pnpm | 10.16.0 | |
| 상태 관리 | SWR | - | 데이터 페칭 |
| UI 컴포넌트 | Headless UI | 2.2.1 | |
| 차트 | ECharts | ~5.5.1 | |
| 에디터 | Lexical | ^0.30.0 | 리치 텍스트 에디터 |
| 코드 에디터 | Monaco Editor | ^4.6.0 | |
| 플로우 시각화 | ReactFlow | ^11.11.3 | 워크플로우 에디터 |
| 국제화 | i18next | ^23.16.4 | 다국어 지원 |
| 스토리북 | Storybook | 있음 | 컴포넌트 문서화 |
| 데이터 쿼리 | TanStack React Query | ^5.60.5 | |

### 4.3 프론트엔드 - web-edu/ (MAI Studio 교육용 UI)

| 카테고리 | 기술 | 버전 | 비고 |
|----------|------|------|------|
| 프레임워크 | Next.js | 15.5.4 | App Router |
| UI 라이브러리 | React | 19.1.0 | |
| 언어 | TypeScript | - | |
| 상태 관리 | Zustand | ^5.0.8 | |
| 데이터 쿼리 | TanStack React Query | ^5.90.2 | |
| 폼 관리 | React Hook Form + Zod | ^7.65.0 / ^4.1.12 | |
| 차트 | ECharts + Chart.js | ^6.0.0 / ^4.5.0 | |
| 플로우 시각화 | @xyflow/react | ^12.8.6 | |
| 국제화 | i18next | ^25.6.0 | Korean 우선 |
| 포트 | 3001 | | Dify web(3000)과 분리 |

### 4.4 인프라 (docker/)

| 카테고리 | 기술 | 비고 |
|----------|------|------|
| 컨테이너 | Docker Compose | 멀티 서비스 구성 |
| 웹서버 | Nginx | 리버스 프록시 |
| DB | PostgreSQL + pgvector | 벡터 검색 지원 |
| 캐시/큐 | Redis | 세션 + Celery 브로커 |
| 검색엔진 | Elasticsearch | 한국어 지원 (nori) |
| SSL | Certbot | Let's Encrypt |
| 보안 | SSRF Proxy | 외부 요청 보안 |

### 4.5 CI/CD

| 워크플로우 | 역할 |
|-----------|------|
| main-ci.yml | 메인 CI 파이프라인 |
| api-tests.yml | API 테스트 |
| web-tests.yml | Web 테스트 |
| db-migration-test.yml | DB 마이그레이션 테스트 |
| build-push.yml | Docker 이미지 빌드/푸시 |
| deploy-dev.yml | 개발 환경 배포 |
| deploy-enterprise.yml | 엔터프라이즈 배포 |
| style.yml | 코드 스타일 검사 |
| vdb-tests.yml | 벡터 DB 테스트 |

---

## 5. 아키텍처 패턴

### 5.1 전체 아키텍처
- **모노레포 멀티파트**: 백엔드(api/) + 2개 프론트엔드(web/, web-edu/) + 인프라(docker/)가 하나의 저장소에 존재
- **마이크로서비스 지향 모놀리스**: 단일 Flask 서버이지만 내부적으로 모듈화된 구조 (controllers, services, core 레이어)

### 5.2 백엔드 아키텍처 패턴
- **3-레이어 아키텍처**: Controllers(API 엔드포인트) -> Services(비즈니스 로직) -> Models(데이터 접근)
- **REST API**: Flask-RESTx 기반 REST API (`controllers/console/`, `controllers/service_api/`, `controllers/web/`)
- **이벤트 기반 처리**: `events/` 디렉토리에서 이벤트 핸들러 패턴 사용
- **비동기 작업 큐**: Celery를 이용한 비동기 작업 처리 (`tasks/`)
- **플러그인 아키텍처**: `model_plugins/`, `core/tools/`에서 확장 가능한 구조
- **팩토리 패턴**: `factories/` 디렉토리 존재

### 5.3 프론트엔드 아키텍처 패턴
- **Next.js App Router**: 파일 시스템 기반 라우팅, 레이아웃 그룹 `(commonLayout)`, `(shareLayout)`, `(auth)`, `(student)` 사용
- **컴포넌트 기반 UI**: Headless UI + 커스텀 컴포넌트
- **서비스 레이어 분리**: `service/` 디렉토리에서 API 호출 로직 분리
- **Hook 기반 상태 관리**: `hooks/`, `context/` 패턴
- **web-edu는 Zustand로 상태 관리**: web은 SWR, web-edu는 Zustand + TanStack Query로 분리

### 5.4 교육 도메인 확장 패턴
- **도메인별 모듈 분리**: `models/education/`, `controllers/console/edu/`, `services/edu/`로 교육 기능을 별도 모듈로 관리
- **역할 기반 접근 제어(RBAC)**: `user_role.py`, `auth_decorators.py`
- **세션 기반 리소스 관리**: `session.py`, `session_member.py`, `session_quota.py`
- **사용량 추적**: `api_usage_log.py`, `api_usage_summary.py`, `user_usage_quota.py`

---

## 6. 발견된 기존 문서

| 원본 경로 | 복사 위치 | 유형 |
|-----------|-----------|------|
| `/README.md` | `_bmad-output/research/existing-docs/README.md` | 프로젝트 소개 (Dify 원본) |
| `/CONTRIBUTING.md` | `_bmad-output/research/existing-docs/CONTRIBUTING.md` | 기여 가이드 |
| `/api/README.md` | `_bmad-output/research/existing-docs/api-README.md` | API 서버 설명 |
| `/web/README.md` | `_bmad-output/research/existing-docs/web-README.md` | Web 프론트엔드 설명 |
| `/web-edu/README.md` | `_bmad-output/research/existing-docs/web-edu-README.md` | 교육용 프론트엔드 설명 |
| `/docker/README.md` | `_bmad-output/research/existing-docs/docker-README.md` | Docker 배포 가이드 |
| `/sdks/README.md` | `_bmad-output/research/existing-docs/sdks-README.md` | SDK 사용 가이드 |

추가 발견된 문서 (복사 생략 - 참고용):
- `.devcontainer/README.md` - Dev Container 설정 가이드
- `.github/CODE_OF_CONDUCT.md` - 행동 강령
- `.github/pull_request_template.md` - PR 템플릿
- `.team/progress.md` - 팀 진행 상황
- `web/i18n-config/DEV.md`, `web/i18n-config/README.md` - i18n 개발 가이드
- `docker/certbot/README.md` - SSL 인증서 관리 가이드

---

## 7. 누락된 문서 목록

아래 문서들은 이 규모의 프로젝트에서 필요하지만 존재하지 않는다:

| 문서 | 상태 | 중요도 |
|------|------|--------|
| 아키텍처 설계 문서 (architecture.md) | 누락 | 높음 |
| API 엔드포인트 명세서 | 누락 | 높음 |
| 데이터 모델/ERD 문서 | 누락 | 높음 |
| 교육 도메인 기능 명세서 | 누락 | 높음 |
| 배포/운영 가이드 (Deployment Guide) | 부분 (docker/README.md에 일부) | 중간 |
| 환경 변수 설명 문서 | 누락 | 중간 |
| web-edu와 web의 관계 설명 | 누락 | 중간 |
| 테스트 전략 문서 | 누락 | 중간 |
| Dify 원본 대비 커스터마이징 변경 내역 | 누락 | 높음 |

---

## 8. 프로젝트 현재 상태 (커밋 히스토리 기반)

### 8.1 개발 단계
프로젝트는 **활발한 기능 개발 및 안정화 단계**에 있다. 최근 50개 커밋을 분석한 결과:

### 8.2 주요 개발 흐름
1. **교육 플랫폼 스토리 순차 개발**: Story 3.4 ~ Story 4.1까지 순차적으로 구현됨
   - Story 3.4: RAG 검색 테스트 인터페이스
   - Story 3.5: RAG와 에이전트 연결
   - Story 3.6: 워크플로우 참조 제거
   - Story 3.7: 모델 활성화 관리
   - Story 3.8: 대시보드 및 네비게이션 UI 개선
   - Story 3.10: 세션 리소스 관리
   - Story 4.1: API 사용량 추적 시스템

2. **에이전트 채팅 안정화**: 대화 생성, 스트리밍 응답, 페이지 새로고침 복구 등 다수의 버그 수정
3. **Docker 인프라 개선**: 환경 변수 관리, Fernet 키 생성, 빌드 프로세스 개선
4. **브랜딩 변경**: EduAI -> MAI로 이름 변경 완료
5. **LMS SSO 통합**: LMS 시스템과의 SSO 로그인 기능 추가 (최신)
6. **국제화**: 한국어 번역 적용 확대

### 8.3 커밋 컨벤션
- Conventional Commits 스타일 사용: `feat()`, `fix()`, `refactor()`, `chore()`, `test()`
- 스코프: `agent`, `agent-chat`, `docker`, `education`, `workflow`, `i18n`, `security` 등

### 8.4 활동 수준
- 매우 활발한 개발 진행 중 (최근 커밋들이 밀집)
- 단일 개발자 또는 소규모 팀 패턴으로 보임

---

## 9. 주요 발견 및 참고 사항

1. **Dify 포크 프로젝트**: 이 프로젝트는 Dify(langgenius/dify) v1.9.1을 포크한 것으로, 원본 코드 위에 교육 도메인 기능을 오버레이하고 있다. 업스트림 머지 관리가 중요한 고려 사항이다.

2. **이중 프론트엔드 구조**: `web/`(Dify 원본 UI, 포트 3000)과 `web-edu/`(MAI Studio, 포트 3001)가 별도로 존재한다. web-edu는 교육 전용 인터페이스로 더 현대적인 기술 스택(Zustand, 최신 React Hook Form + Zod)을 사용한다.

3. **교육 도메인 모델 15개**: 세션, 사용자 역할, API 키, 사용량 추적, 리소스 태그 등 교육 플랫폼에 필요한 데이터 모델이 별도 모듈로 분리되어 있다.

4. **docs/ 디렉토리 비어 있음**: 프로젝트 규모에 비해 별도 문서 디렉토리가 비어 있다.

5. **CI/CD 파이프라인 16개**: 테스트, 빌드, 배포가 자동화되어 있으며 개발(dev) 및 엔터프라이즈 배포 파이프라인이 존재한다.

---

*이 보고서는 Phase 0 Brownfield 스캔의 결과물이며, 이후 아키텍처 문서 작성의 기반 자료로 활용된다.*
