<!-- CHECKPOINT -->
## 현재 체크포인트

| 항목 | 값 |
|------|-----|
| Phase | Maintenance |
| Epic | — |
| Story | — |
| State | PROJECT_COMPLETE |
| Plan | _bmad-output/stories/hotfix_20260427_readme-mai-studio-rewrite.md |
| Mode | semi-auto |
| Status | Maintenance idle — readme-mai-studio-rewrite Approved 후 PROJECT_COMPLETE 복귀. 누적 unpushed 5 commits 대기 |
| Next Action | 사용자 push 확인 또는 다음 hotfix/maintenance 이슈 |
| Updated | 2026-04-27 15:42 |

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
- triage recorded — severity: P1 — init-env.sh가 EXPOSE_NGINX_PORT/SSL_PORT를 대화형으로 입력받도록 추가. 사용자 결정: 무인 배포 미고려, 항상 물음, default 80/443만 표시, 숫자 검증만, Lightweight. 2개 파일(docker/init-env.sh, docs/deployment-guide.md) 수정.
Route: lightweight
- hotfix completed — 2026-04-27 — init-env-port-prompt — Approved (2차 개정 후, 3개 활성 파일 + hotfix story). 1차 init-env.sh 대화형 입력 검증 6/6 PASS. 1차 CR(Makefile Access 안내가 입력 포트 미반영) → 2차 옵션 A 패턴(80 생략, 그 외 :port)을 docker-first-deploy/docker-up/docker-build-no-cache 3군데 일관 적용 + docker-build-no-cache에 Access API 한 줄 추가. 검증 4/4 PASS.
- triage recorded — severity: P1 — make docker-clean-all 실행 시 root 소유 파일(privkeys 등) Permission denied로 마지막 단계 실패 (운영 서버 재현). 사용자 결정: 옵션 A(Makefile sudo rm), 범위 B(docker-clean + docker-clean-all, dev-clean-all 제외), sudo 안내 echo 추가, deployment-guide 트러블슈팅 유지. Lightweight. 1개 파일(Makefile) 수정. 근본 해결(API 비-root)은 별도 hotfix로 미룸.
Route: lightweight
- hotfix completed — 2026-04-27 — clean-volumes-sudo — Approved (Makefile 1개 + hotfix story). docker-clean / docker-clean-all에 sudo rm + sudo 안내 echo 적용. 검증 5/5 PASS. dev-clean-all 무변경. 코드 commit(89cceb07a)은 검증 위해 선행 push됨. 후속: deployment-guide 5단계 흐름 갱신 필요성 발견(별도 hotfix로 분리 예정).
- triage recorded — severity: P1 — deployment-guide.md 5단계 포트 흐름이 init-env-port-prompt hotfix 이전 동작 가정에 머물러 있음. 권장 입력(8080/8443) 단일 경로로 정리 + 절 제목/도입부를 실수 복구로 재정의 + 운영 주의 박스 단순화(시안 A) + 체크리스트 한 줄 갱신. Lightweight, docs-only. 1개 파일 수정.
Route: lightweight
- hotfix completed — 2026-04-27 — deployment-guide-port-flow-update — Approved (docs/deployment-guide.md 1개 + hotfix story). 7개 영역 갱신(코멘트/절 제목/도입부/보조 경로/운영 주의 시안 A/체크리스트/변경 이력). 검증 6/6 PASS. Dev가 line 238 본문 참조도 정합성 차원에서 동반 보정 — 수용.
- triage recorded — severity: P1 — README가 오리지널 Dify 그대로. 사용자 결정: private 저장소이므로 사내 가이드 톤으로 전체 재작성, 한국어 메인(README.md) + 영어 보조(README/README_EN.md), 기타 다국어 README 12개 + CONTRIBUTING(메인+다국어 11개) 모두 폐기, 자산 없이 텍스트 위주, Community/Security 섹션 제외, LICENSE 보존. 신규 2개 + 삭제 26개(README_KR.md 포함). Lightweight, docs-only.
Route: lightweight
- hotfix completed — 2026-04-27 — readme-mai-studio-rewrite — Approved (신규 2개 + 삭제 25개 + hotfix story). 검증 7/7 PASS. 명세-실제 차이 1건(Contributing 명세 12 vs 실제 11, KL 부재) 사전 카운트 오류로 비차단 수용. 다른 .md 깨진 인용 0건.
