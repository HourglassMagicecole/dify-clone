<!-- CHECKPOINT -->
## 현재 체크포인트

| 항목 | 값 |
|------|-----|
| Phase | Maintenance |
| Epic | — |
| Story | — |
| State | PROJECT_COMPLETE |
| Plan | _bmad-output/stories/hotfix_20260427_makefile-first-deploy-target.md |
| Mode | semi-auto |
| Status | Maintenance idle — makefile-first-deploy-target hotfix Approved 후 PROJECT_COMPLETE 복귀 |
| Next Action | init-env.sh 포트 백업 추가 hotfix 진입 (옵션 B 대화형 입력 합의) |
| Updated | 2026-04-27 12:11 |

## Phase 0 Log
- P0_INIT — done — 2026-04-08
- P0_BF_SCAN — done — 2026-04-08
- P0_BF_CONTEXT — done — 2026-04-08
- P0_BF_CONTEXT_REVIEW — Approved — 2026-04-08
- P0_BF_PRD — skipped — maintenance entry — 2026-04-08
- P0_BF_PROJECT_SETUP — done — 2026-04-08
- P0_SECURITY_SETUP — done — 2026-04-08
- P0_SECURITY_REVIEW — Approved — 2026-04-08
- P0_COMPLETE — done — 2026-04-08
- PROJECT_COMPLETE — done — 2026-04-08

## Maintenance Notes
- triage recorded — severity: P0 — web-edu 컨테이너 암호화폐 채굴 악성코드 감염, 502 Bad Gateway 발생
Route: full
- triage recorded — severity: P1 — Agent 채팅 응답에 이전 답변 내용 누적 (web-edu)
Route: lightweight
- triage recorded — severity: P1 — Agent 대화 히스토리 초기화 (3~4턴 후 인사 반복)
Route: lightweight
- triage recorded — severity: P1 — Agent Chat RAG 검색 디버그 로깅 없음
Route: lightweight
- triage recorded — severity: P1 — auto-retrieve 제거 및 KB 도구 hit rate 개선
Route: lightweight
- triage recorded — severity: P1 — Agent 채팅 D&D 파일 첨부 미동작 (web-edu)
Route: lightweight
- triage recorded — severity: P1 — RAG KB 도구 과도 호출 (무관 질문에서도 검색)
Route: lightweight
- triage recorded — severity: P1 — 사용자 일괄 생성 CSV 업로드 실패 (탭 구분 파일 파싱 오류)
Route: lightweight
- triage recorded — severity: P1 — 지식베이스 자동 설명 생성이 stale default 모델(gpt-4 disabled) 사용 → 활성 모델 기반으로 변경 필요
Route: lightweight
- triage recorded — severity: P1 — 작업형 에이전트 실행 결과 영역 배경 어두움 + 글자 가독성 저하 (web-edu)
Route: lightweight
- triage recorded — severity: P1 — Agent 생성/편집의 도구 구성 단계 도구 나열 순서 고정 (web-edu)
Route: lightweight
- triage recorded — severity: P1 — md_exporter (Markdown 변환기) provider 내부 tool 나열 순서 고정 (web-edu)
Route: lightweight
- triage recorded — severity: P1 — Agent 채팅 응답 본문에 내부 도구 호출 로그(Calling: ...) 노출 (2턴부터 재현)
Route: lightweight
- triage recorded — severity: P1 — 작업형 에이전트 생성 "검토 및 저장"에서 select 타입 default 검증 에러 + 에이전트는 생성되는 이중 상태
Route: lightweight
- triage recorded — severity: P1 — 작업형 에이전트 실행 화면에서 select 필드 default가 초깃값으로 반영 안 됨
Route: lightweight
- decision — 2026-04-14 — 백엔드 원자성(/apps + /model-config 트랜잭션 통합) → 버리기 (프론트 가드로 충분, 직접 API 호출 리스크 수용)
- decision — 2026-04-14 — 다른 타입(text/paragraph/number 등) default 실제 값 주입 → 버리기 (placeholder만으로 충분)
- triage recorded — severity: P1 — Zod error.message가 렌더 시 i18n 키로 raw 노출되는 잠재 버그 (pre_prompt/opening_statement)
Route: lightweight
- triage recorded — severity: P1 — 에이전트 채팅 '새 대화 생성' CTA 시인성 약함 (web-edu) — 버튼 재배치 + 빈 상태 박스 클릭 활성화
Route: lightweight
- triage recorded — severity: P1 — web-edu 전 페이지 새로고침 시 이전 스크롤 위치 복원되어 GNB 미노출 — 새로고침 감지 후 최상단 이동
Route: lightweight
- triage recorded — severity: P1 — yahoo_finance_analytics 도구가 분기별 재무(매출/EPS) 미제공 → 에이전트가 "진행할까요?" 확인 루프. yfinance quarterly_income_stmt / earnings_dates 호출 추가
Route: lightweight
- triage recorded — severity: P1 — deployment-guide.md 2단계에 Docker Buildx 플러그인 설치 누락 → 고객사 배포 시 "compose build requires buildx 0.17.0 or later" 실패
Route: lightweight
- triage recorded — severity: P1 — Ubuntu 22.04/24.04 기반 배포 가이드 + 이전 노트 신규 작성 (기존 AL2023 문서 유지, 별도 파일 추가)
Route: lightweight
- hotfix completed — 2026-04-24 — ubuntu-deployment-docs — Approved (신규 파일 2개: docs/deployment-guide-ubuntu.md, docs/migration-notes-ubuntu.md)
- triage recorded — severity: P1 — Rocky Linux 9 기반 배포 가이드 + 이전 노트 신규 작성 (기존 AL2023/Ubuntu 문서 유지, 별도 파일 추가, Rocky 9만 지원)
Route: lightweight
- hotfix completed — 2026-04-24 — rocky-deployment-docs — Approved (신규 파일 2개: docs/deployment-guide-rocky.md, docs/migration-notes-rocky.md). 실서버 배포까지 검증 완료. 4차 개정에서 firewalld/SELinux Disabled 환경 대응 + init-env.sh 동기화 주의 + make docker-clean-all 권한 거부 복구 순서 등 필드 피드백 흡수.
- triage recorded — severity: P1 — Makefile docker target 정리: docker-first-deploy 신규 + docker-up/docker-build에서 init-docker-env 의존성 제거 + docker-clean-all에 builder cache prune 추가 + docker-rebuild → docker-build-no-cache 이름 변경. 5개 파일(Makefile, deployment-guide.md, CLAUDE.md, security-test.sh, codebase-analysis.md) 동기화.
Route: lightweight
- hotfix completed — 2026-04-27 — makefile-first-deploy-target — Approved (5개 활성 파일 + hotfix story). 검증 6/6 PASS. Dev가 deployment-guide.md 정합성 보정을 line 263-266 외 6곳(line 205, 321, 341, 517, 848, 870, 918)으로 확장 — AC "문서 내 docker-rebuild grep 0건" 충족 위해 정합성 차원에서 수용.
