# MAI Studio

> Dify 기반 교육용 AI 플랫폼 — 사내 운영용 private 포크

## 정체성

MAI Studio는 [Dify](https://github.com/langgenius/dify) v1.9.1 포크 위에 교육 도메인(세션, 역할, 사용량 추적, LMS SSO, 관리자 API 키, 가격/모델 프로바이더 관리)을 오버레이한 사내 운영용 저장소입니다. 원본 Dify는 거의 손대지 않고, 교육 기능은 별도 모듈(`api/services/edu/`, `api/services/education_management/`, `api/controllers/console/edu/`, `api/models/education/`, `web-edu/`)로 분리해 업스트림 머지를 가능한 한 단순하게 유지합니다.

이 저장소는 사내/협력사 전용 private 포크로, 외부 기여를 받지 않습니다.

## 빠른 시작

상황별로 참조할 문서가 다릅니다.

- **고객사 서버에 신규 배포** (Rocky Linux 9 기준):
  → [`docs/deployment-guide.md`](docs/deployment-guide.md)
- **기존 서버 → 신규 서버 이전 / DNS 컷오버**:
  → [`docs/migration-notes.md`](docs/migration-notes.md)
- **로컬 개발 환경 셋업**:

  ```bash
  make dev-setup                                                          # 전체 환경 (docker 미들웨어 + web + api + web-edu)
  cd web-edu && pnpm dev                                                  # MAI Studio 프론트엔드 (http://localhost:3001)
  cd api && uv run flask run --host 0.0.0.0 --port 5001 --debug           # 백엔드 API
  ```

  포매팅·테스트·DB 마이그레이션 등 더 자세한 명령은 [`CLAUDE.md`](CLAUDE.md)의 "Quick Reference Commands" 섹션을 참조하세요.

## Dify 위에 추가된 기능

| 위치 | 역할 |
|------|------|
| `api/services/edu/` | 교육 핵심 서비스 (세션, 리소스 태깅 등 5개 파일) |
| `api/services/education_management/` | 교육 관리 서비스 (API 키, 쿼터, 대시보드, 사용량 분석 등 14개 파일) |
| `api/controllers/console/edu/` | 교육 도메인 Blueprint 컨트롤러 (Flask 함수 뷰 패턴) |
| `api/models/education/` | 교육 도메인 SQLAlchemy 엔티티 15개 |
| `api/tasks/education/` | 교육 도메인 Celery 비동기 작업 |
| `web-edu/` | MAI Studio 프론트엔드 (Next.js 15, 포트 3001) |

핵심 기능:

- **교육 세션 + 멤버 관리** — 세션 단위 데이터 격리
- **역할 기반 접근 제어** — Owner / Admin / Normal 3단 권한
- **세션·사용자별 사용량 쿼터** — 모델 호출 비용 상한 및 사용량 분석
- **LMS SSO** — 쿠키(`MOAI_LOGIN_EMAIL` 등) 기반 외부 LMS 연동
- **관리자 API 키 관리** — 세션별 API 키 발급·회수
- **가격 / 모델 프로바이더 관리** — 관리자 콘솔에서 모델 단가 및 프로바이더 설정

## 저장소 구조

| 디렉토리 | 역할 |
|---------|------|
| `api/` | Flask 백엔드 (Dify 원본 + 교육 도메인 모듈) |
| `web/` | Dify 원본 프론트엔드 (참고용, 프로덕션 미사용) |
| `web-edu/` | MAI Studio 프론트엔드 (Next.js 15, 포트 3001) |
| `docker/` | 프로덕션 Docker Compose 스택, nginx, init 스크립트 |
| `docs/` | 운영 가이드 (배포, 이전 등) |
| `_bmad-output/` | 프로젝트 컨텍스트, 스토리, 산출물 |
| `LICENSE` | Dify Open Source License (포크 의무) |

## 문서 인덱스

- [`docs/deployment-guide.md`](docs/deployment-guide.md) — 프로덕션 배포 가이드 (Rocky Linux 9)
- [`docs/migration-notes.md`](docs/migration-notes.md) — DNS 컷오버 / 서버 이전 런북
- [`_bmad-output/project-context.md`](_bmad-output/project-context.md) — 코드 규칙, 아키텍처, 보안·테스트 규칙
- [`CLAUDE.md`](CLAUDE.md) — 개발자용 명령 빠른 참조 (lint/test/migration 등)

## 외부 기여 정책

이 저장소는 사내 포크입니다. 외부 기여는 받지 않습니다.

## 라이선스

Dify Open Source License 승계. 자세한 내용은 [`LICENSE`](LICENSE) 참조.

---

English: [README/README_EN.md](README/README_EN.md)
