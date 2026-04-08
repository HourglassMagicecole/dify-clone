# MAI Studio — 프로젝트 설정

<law>
매 응답 시작 시, `.team/orchestrator.yaml`의 `active` 값을 읽어 오케스트레이터 활성 상태를 판별한다.

- **`active: true`**: 매 응답 시작에 반드시 상태 표시줄 2줄을 출력한다:
  [{Phase}/{Epic}/{Story}] {STATE} | {auto|semi-auto} | Tier: {L/S/C} | Next: {action}
  ⚠️ {현재 상태의 핵심 리마인더 1줄}
  이 상태에서는 모든 작업이 상태 머신을 거쳐야 한다.
- **`active: false` 또는 파일 없음**: 상태 표시줄을 출력하지 않는다. 일반 개발 모드로 동작한다.
</law>

## 프로젝트 개요

Dify v1.9.1 포크 기반 교육용 AI 플랫폼 "MAI Studio".
교육 도메인(세션, 역할, 사용량, LMS SSO 등)을 별도 모듈로 오버레이한 구조.

**필수 참조 문서:**
- `_bmad-output/project-context.md` — 기술스택, 아키텍처 규칙, 코드 패턴, 금지사항, 테스트 규칙, 디렉토리 구조

## 핵심 개발 원칙

<critical_rules>
1. **3-레이어 아키텍처 준수**: Controller -> Service -> Model. 레이어를 건너뛰지 않는다.
2. **Dify 원본 최소 수정**: 교육 기능은 `edu/`, `education/` 모듈로 분리. 원본 수정은 등록 지점(`ext_blueprints.py`, `__init__.py`)으로 한정.
3. **교육 도메인은 Blueprint 함수 뷰**: flask-restx Resource 패턴이 아닌 Blueprint + 함수 뷰(패턴 B) 사용.
4. **커밋 전 린트 필수**: `make lint` 통과 확인 후 커밋.
5. **테스트 작성**: 새 서비스는 반드시 단위 테스트 동반. `api/tests/unit_tests/services/education_management/` 에 배치.
6. **Conventional Commits**: `feat(scope)`, `fix(scope)`, `refactor(scope)` 형식 사용.
</critical_rules>

## Quick Reference Commands

<common_tasks>

### 개발 환경 셋업
```bash
make dev-setup              # 전체 개발 환경 (docker + web + api + web-edu)
make prepare-docker         # Docker 미들웨어만
make prepare-api            # API 환경 (uv sync, DB 마이그레이션, 초기 테넌트 생성)
make prepare-web            # web 환경 (pnpm install + build)
make prepare-web-edu        # web-edu 환경 (pnpm install)
```

### 개발 서버 실행
```bash
# API (api/ 디렉토리)
cd api && uv run flask run --host 0.0.0.0 --port 5001 --debug

# web-edu (web-edu/ 디렉토리)
cd web-edu && pnpm dev      # localhost:3001

# web (web/ 디렉토리)
cd web && pnpm dev           # localhost:3000 (Turbopack)
```

### 백엔드 코드 품질
```bash
make format                 # ruff 포매팅
make check                  # ruff 체크
make lint                   # ruff 포매팅 + 체크 + 임포트 린터
make type-check             # basedpyright 타입 체크
```

### 프론트엔드 코드 품질
```bash
cd web-edu && pnpm lint         # ESLint
cd web-edu && pnpm lint:fix     # ESLint 자동 수정
cd web-edu && pnpm type-check   # TypeScript 타입 체크
```

### 테스트
```bash
# 백엔드 (api/ 디렉토리)
cd api && uv run pytest tests/unit_tests/                      # 전체 단위 테스트
cd api && uv run pytest tests/unit_tests/services/edu/         # 교육 핵심 서비스 테스트
cd api && uv run pytest tests/unit_tests/services/education_management/  # 교육 관리 서비스 테스트
cd api && uv run pytest tests/integration_tests/               # 통합 테스트

# 프론트엔드 (web-edu/ 디렉토리)
cd web-edu && pnpm test         # Jest
cd web-edu && pnpm test:watch   # Jest watch 모드
```

### DB 마이그레이션
```bash
cd api && uv run flask db migrate -m "description"    # 마이그레이션 생성
cd api && uv run flask db upgrade                     # 마이그레이션 적용
cd api && uv run flask db downgrade                   # 마이그레이션 롤백
```

### Docker 프로덕션
```bash
make docker-up              # 프로덕션 컨테이너 시작 (자동 초기화)
make docker-rebuild         # 캐시 없이 재빌드
make docker-down            # 컨테이너 중지
make docker-restart         # 컨테이너 재시작
make docker-clean           # 컨테이너 + 볼륨 제거
```

### 정리
```bash
make dev-clean              # 빠른 정리 (데이터 보존)
make dev-clean-all          # 전체 리셋 (.env, volumes 포함)
```

</common_tasks>

## 리더 참조 — 프로젝트 배치 전략

- **배치**: Dev 1인 (유지보수 모드)
- **작업 흐름**: 기능 브랜치 -> PR -> moai-v2 머지
- **Hotfix**: moai-v2에서 직접 수정 후 즉시 배포
- **배포**: `make docker-rebuild` 또는 CI/CD 파이프라인

## System Reminders

- 모든 응답은 Korean으로 작성
- project-context.md 참조 없이 아키텍처 결정 금지
- 새 의존성 추가 시 반드시 알파벳 순서 유지 (pyproject.toml 주석 참조)
- `.env` 파일은 절대 커밋하지 않음
