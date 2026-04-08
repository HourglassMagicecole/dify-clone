# MAI Studio — Agent Configuration

## 필수 참조

모든 서브에이전트는 작업 시작 전 아래 문서를 읽어야 합니다:
- `_bmad-output/project-context.md` — 기술스택, 아키텍처 규칙, 코드 패턴, 테스트 규칙, 디렉토리 구조

## 품질 기준

- **작업 중**: 변경한 파일에 대해 린트 실행 + 관련 테스트만 실행
  - 백엔드: `make lint` + `cd api && uv run pytest tests/unit_tests/services/교육_관련_경로/`
  - 프론트엔드: `cd web-edu && pnpm lint` + `cd web-edu && pnpm type-check`
- **커밋 전**: CLAUDE.md `<critical_rules>` 항목 전체 확인

## 코드 작성 규칙

- project-context.md의 금지 패턴을 위반하지 않는다:
  - 컨트롤러에서 직접 DB 접근 금지
  - 서비스에서 Flask request/response 직접 참조 금지
  - 교육 도메인에서 flask-restx Resource 패턴 사용 금지
  - Dify 원본 파일 직접 수정 최소화
- 기존 코드의 네이밍 컨벤션과 패턴을 따른다:
  - Python: snake_case 파일/함수, PascalCase 클래스
  - TypeScript: kebab-case 파일, PascalCase 컴포넌트/타입
  - DB 테이블: snake_case 복수형
  - API URL: kebab-case
- 새 기능 추가 시 project-context.md Section 6.2의 파일 생성 위치 가이드를 따른다

## 이슈 보고

작업 중 아래 상황이 발생하면 즉시 사용자에게 보고한다:

- **아키텍처 위반 발견**: 기존 코드에서 3-레이어 위반, 레이어 건너뛰기 등 발견 시
- **테스트 실패**: 기존 테스트가 실패하거나, 변경으로 인해 다른 테스트가 깨질 경우
- **보안 우려**: 하드코딩된 시크릿, 인증 우회 가능성, SQL 인젝션 위험 등 발견 시
- **Dify 원본 수정 필요**: 교육 모듈 외 Dify 원본 코드 수정이 불가피한 경우
- **기술 부채 발견**: project-context.md Section 7에 없는 새로운 기술 부채 발견 시
