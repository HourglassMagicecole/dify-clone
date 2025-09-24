# Dify Clone 브라운필드 아키텍처 문서

## 소개

이 문서는 Dify Clone 프로젝트의 현재 상태를 포착한 문서로, 기술적 부채, 해결책, 그리고 실제 패턴을 포함합니다. AI 에이전트가 개선 작업을 수행할 때 참조하는 문서입니다.

### 문서 범위

전체 시스템의 포괄적인 문서화

### 변경 로그

| 날짜       | 버전 | 설명                    | 작성자   |
| ---------- | ---- | ----------------------- | -------- |
| 2025-09-23 | 1.0  | 초기 브라운필드 분석    | Winston  |

## 빠른 참조 - 주요 파일 및 진입점

### 시스템 이해를 위한 핵심 파일들

- **백엔드 진입점**: `api/app.py`, `api/app_factory.py`
- **프론트엔드 진입점**: `web/app/page.tsx`, `web/app/layout.tsx`
- **환경 설정**: `api/.env.example`, `docker/.env.example`
- **핵심 비즈니스 로직**: `api/services/`, `api/core/`
- **API 정의**: `api/controllers/`
- **데이터베이스 모델**: `api/models/`
- **프론트엔드 서비스**: `web/service/`
- **i18n**: `web/i18n/en-US/` (소스 언어)

## 고수준 아키텍처

### 기술 요약

Dify는 LLM 애플리케이션 개발을 위한 오픈소스 플랫폼으로, 에이전틱 AI 워크플로우, RAG 파이프라인, 에이전트 기능, 모델 관리, 관측 기능 등을 통합한 직관적인 인터페이스를 제공합니다.

### 실제 기술 스택 (pyproject.toml/package.json 기반)

| 카테고리     | 기술           | 버전           | 비고                                         |
| ------------ | -------------- | -------------- | -------------------------------------------- |
| 런타임       | Python         | 3.11-3.13      | UV로 패키지 관리                             |
| 런타임       | Node.js        | >=22.11.0      | pnpm 패키지 매니저 사용                      |
| 백엔드       | Flask          | 3.1.2          | Flask-SQLAlchemy, Flask-Migrate 사용        |
| 프론트엔드   | Next.js        | 15             | React 19, TypeScript 사용                   |
| 데이터베이스 | PostgreSQL     | 최신           | Docker Compose로 관리                        |
| 캐시/브로커  | Redis          | 최신           | Celery 브로커로 사용                         |
| 작업 큐      | Celery         | 5.5.2          | 비동기 작업 처리                             |
| 웹 서버      | Gunicorn       | 23.0.0         | gevent worker 클래스 사용                    |
| 컨테이너     | Docker         | -              | Docker Compose로 오케스트레이션              |
| AI/ML        | OpenAI SDK     | 1.61.0         | 다양한 LLM 제공자 지원                       |
| 검색         | OpenSearch     | 선택적         | 벡터 검색 지원                               |

### 저장소 구조 현실 체크

- 타입: 모노레포
- 패키지 매니저: 백엔드는 UV, 프론트엔드는 pnpm
- 주목할 점: 백엔드와 프론트엔드가 독립적으로 배포 가능한 구조

## 소스 트리 및 모듈 구성

### 프로젝트 구조 (실제)

```text
dify-clone/
├── api/                      # Python Flask 백엔드
│   ├── commands.py          # CLI 명령어 (DB 마이그레이션, 초기화 등)
│   ├── app_factory.py       # Flask 애플리케이션 팩토리
│   ├── controllers/         # HTTP 요청 핸들러
│   │   ├── console/        # 관리 콘솔 API
│   │   ├── service_api/    # 서비스 API
│   │   └── web/            # 웹 애플리케이션 API
│   ├── services/            # 비즈니스 로직 (도메인 주도 설계)
│   ├── models/              # SQLAlchemy 데이터베이스 모델
│   ├── core/                # 핵심 기능 (LLM, RAG, 워크플로우 등)
│   │   ├── agent/          # AI 에이전트 로직
│   │   ├── rag/            # RAG 파이프라인
│   │   ├── workflow/       # 워크플로우 엔진
│   │   └── model_runtime/  # 모델 런타임 추상화
│   ├── tasks/               # Celery 태스크
│   ├── extensions/          # Flask 확장 및 초기화
│   ├── fields/              # API 필드 정의
│   └── tests/               # 테스트 (유닛, 통합)
├── web/                      # Next.js 프론트엔드
│   ├── app/                 # Next.js 15 App Router
│   │   ├── (commonLayout)/ # 공통 레이아웃
│   │   ├── (shareLayout)/  # 공유 레이아웃
│   │   ├── components/     # React 컴포넌트
│   │   ├── signin/         # 인증 페이지
│   │   └── install/        # 설치 마법사
│   ├── service/             # API 클라이언트 서비스
│   ├── i18n/                # 국제화 (21개 언어 지원)
│   ├── models/              # TypeScript 타입 정의
│   └── utils/               # 유틸리티 함수
├── docker/                   # Docker 설정
│   ├── docker-compose.yaml  # 메인 오케스트레이션 파일
│   ├── .env.example         # 환경 변수 템플릿
│   └── volumes/             # 컨테이너 볼륨 설정
└── sdks/                     # 클라이언트 SDK
    └── nodejs-client/       # Node.js SDK
```

### 주요 모듈 및 용도

- **인증 관리**: `api/services/account_service.py` - JWT 기반 인증
- **워크플로우 엔진**: `api/core/workflow/` - 비주얼 워크플로우 실행
- **RAG 시스템**: `api/core/rag/` - 문서 인제스션 및 검색
- **모델 런타임**: `api/core/model_runtime/` - 다중 LLM 제공자 추상화
- **데이터셋 관리**: `api/services/dataset_service.py` - 지식 베이스 관리
- **앱 관리**: `api/services/app_service.py` - AI 애플리케이션 관리

## 데이터 모델 및 API

### 데이터 모델

실제 모델 파일 참조:
- **Account 모델**: `api/models/account.py`
- **Dataset 모델**: `api/models/dataset.py`
- **Workflow 모델**: `api/models/workflow.py`
- **Provider 모델**: `api/models/provider.py`
- **Task 모델**: `api/models/task.py`

### API 구조

- **Console API**: `/console/api/` - 관리자 및 개발자용 API
- **Service API**: `/v1/` - 외부 서비스 통합 API
- **Web API**: `/api/` - 최종 사용자 애플리케이션 API
- **Files API**: `/files/` - 파일 업로드 및 다운로드

## 기술적 부채 및 알려진 이슈

### 중요한 기술적 부채

1. **환경 변수 복잡성**: `.env.example`에 100개 이상의 설정 - 구성 관리 개선 필요
2. **다중 스토리지 백엔드**: OpenDAL 통합 진행 중이지만 레거시 로컬 스토리지 코드 잔존
3. **테스트 커버리지**: 테스트 존재하지만 커버리지 측정 없음
4. **프론트엔드 상태 관리**: Context API와 props drilling 혼재 사용

### 해결책 및 주의사항

- **UV 사용 필수**: 모든 Python 명령은 `uv run --project api` 프리픽스 필요
- **pnpm 사용**: 프론트엔드는 반드시 pnpm 사용 (package.json에 강제)
- **i18n 규칙**: 모든 사용자 대면 텍스트는 i18n 키 사용, 하드코딩 금지
- **코드 품질**: 백엔드 변경 시 항상 `./dev/reformat` 실행

## 통합 포인트 및 외부 종속성

### 외부 서비스

| 서비스         | 용도              | 통합 타입    | 주요 파일                                |
| -------------- | ----------------- | ------------ | ---------------------------------------- |
| OpenAI         | LLM 제공자        | REST API     | `api/core/model_runtime/model_providers/openai/` |
| Anthropic      | LLM 제공자        | REST API     | `api/core/model_runtime/model_providers/anthropic/` |
| Azure          | 클라우드 서비스   | SDK          | 다양한 Azure 통합                        |
| Google AI      | LLM 제공자        | SDK          | `api/core/model_runtime/model_providers/google/` |
| S3 호환        | 객체 스토리지     | SDK          | OpenDAL을 통한 통합                      |

### 내부 통합 포인트

- **프론트엔드-백엔드 통신**: REST API, JWT 인증 사용
- **백그라운드 작업**: Celery + Redis 큐
- **실시간 업데이트**: SSE (Server-Sent Events) 사용
- **파일 처리**: 별도 파일 서비스 엔드포인트

## 개발 및 배포

### 로컬 개발 설정

```bash
# 백엔드 개발
./dev/start-api           # API 서버 시작
./dev/start-worker        # Celery worker 시작

# 프론트엔드 개발
cd web
pnpm dev                  # Next.js 개발 서버

# Docker 환경
cd docker
cp .env.example .env
docker compose up -d
```

### 테스트 실행

```bash
# 백엔드 테스트
uv run --project api pytest
uv run --project api pytest tests/unit_tests/
uv run --project api pytest tests/integration_tests/

# 프론트엔드 테스트
cd web
pnpm test
pnpm lint
pnpm eslint-fix
```

### 코드 품질 도구

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

### 빌드 및 배포 프로세스

- **빌드 명령**:
  - 백엔드: Docker 이미지 빌드
  - 프론트엔드: `pnpm build`
- **배포**: Docker Compose 또는 Kubernetes
- **환경**: 개발, 스테이징, 프로덕션

## 테스팅 현실

### 현재 테스트 커버리지

- 유닛 테스트: `api/tests/unit_tests/`에 존재
- 통합 테스트: `api/tests/integration_tests/`에 존재
- E2E 테스트: 제한적
- 프론트엔드 테스트: Jest 설정 존재

### 테스트 실행

```bash
# 백엔드
uv run --project api pytest                    # 모든 테스트
uv run --project api pytest tests/unit_tests/  # 유닛 테스트만

# 프론트엔드
cd web && pnpm test                           # Jest 테스트
```

## 개발 규칙 및 패턴

### Python (백엔드)

- 도메인 주도 설계 (DDD) 아키텍처
- 타입 힌트 필수 사용
- `Any` 타입 사용 최소화
- Ruff로 코드 포매팅 및 린팅

### TypeScript/JavaScript (프론트엔드)

- Strict TypeScript 구성
- ESLint + Prettier 통합
- `any` 타입 사용 금지
- React 19 + Next.js 15 App Router 패턴

### 공통 규칙

- 의미 있는 주석만 작성 ("왜"를 설명)
- 기존 파일 편집 우선 (새 파일 생성 최소화)
- 모든 사용자 대면 텍스트는 i18n 키 사용

## 부록 - 유용한 명령어 및 스크립트

### 자주 사용하는 명령어

```bash
# 백엔드
./dev/start-api                # 개발 서버 시작
./dev/start-worker            # Worker 시작
uv run --project api flask db upgrade  # DB 마이그레이션
./dev/reformat                # 코드 포매팅

# 프론트엔드
pnpm dev                      # 개발 서버
pnpm build                    # 프로덕션 빌드
pnpm lint                     # 린팅
pnpm test                     # 테스트

# Docker
docker compose up -d          # 전체 스택 시작
docker compose logs -f api    # API 로그 확인
docker compose down          # 전체 스택 중지
```

### 디버깅 및 문제 해결

- **로그**: Docker 환경에서 `docker compose logs -f [service]`
- **디버그 모드**: 환경 변수 `DEBUG=true` 설정
- **일반적인 이슈**:
  - UV 명령어 사용 확인
  - pnpm 설치 확인
  - Docker 리소스 할당 확인

## 아키텍처 결정 기록

### 주요 기술 선택

1. **Flask over FastAPI**: 기존 코드베이스와 호환성 유지
2. **Next.js 15 App Router**: 최신 React 패턴 적용
3. **PostgreSQL + Redis**: 검증된 데이터 스토리지 조합
4. **Celery**: 성숙한 비동기 작업 처리 시스템
5. **Docker Compose**: 간단한 로컬 개발 및 배포

### 향후 개선 고려사항

- GraphQL API 도입 검토
- 마이크로서비스 아키텍처 전환 가능성
- Kubernetes 네이티브 배포
- 테스트 커버리지 향상
- 성능 모니터링 강화