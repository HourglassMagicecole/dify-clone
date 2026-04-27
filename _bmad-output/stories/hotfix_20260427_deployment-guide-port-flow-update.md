# Hotfix: deployment-guide 5단계 포트 흐름 갱신 (init-env-port-prompt follow-up)

## 목적

이전 `init-env-port-prompt` hotfix(2026-04-27)로 `init-env.sh`가 `EXPOSE_NGINX_PORT`/`EXPOSE_NGINX_SSL_PORT`를 대화형으로 묻는 동작이 도입됐다. 운영 권장 흐름은 "프롬프트에서 8080/8443을 명시 입력" 단일 경로다. 그러나 `docs/deployment-guide.md` 5단계는 여전히 **이전 동작 가정**(처음에는 default 80/443으로 시작 → 사후에 vim으로 .env 수정 → force-recreate)에 기반한 흐름을 안내하고 있어 실제 동작과 가이드 사이에 모순이 있다.

핵심 모순:
- line 311-313: "이 시점 nginx PORTS는 0.0.0.0:80->80/tcp" 가정 — 권장 흐름 따랐다면 8080/8443
- line 330-352 "nginx 포트 노출 변경" 절: 정상 흐름 가정 — 실제로는 실수 복구 시나리오
- line 352 운영 주의 박스: "재실행 시 포트 80/443으로 reset" 가정 — 현재는 매번 묻고 빈 입력 시에만 reset
- line 929 체크리스트: ".env 포트 값 수정"이 행동 — 실제로는 init-env 프롬프트 입력

이번 hotfix는 가이드를 권장 흐름(8080/8443 명시 입력)을 정상 경로로 두고, 절을 실수 복구 안내로 재정의한다.

## 수정 범위 (Lightweight, docs-only)

1개 파일 수정 (`docs/deployment-guide.md`).

### docs/deployment-guide.md

1. **line 311-313 (docker-compose ps 출력 예시 코멘트)**: 권장 흐름(8080/8443) 가정으로 변경 + 다른 값일 때 다음 절 참조 안내
2. **line 330 절 제목**: "nginx 포트 노출 변경 (호스트 80/443 자리 비우기)" → "nginx 포트 노출 복구 (실수로 default 80/443 또는 다른 값을 입력한 경우)"
3. **line 332 절 도입부**: "사전 가정" 톤 → "실수 복구" 톤으로 재작성. "권장 흐름대로 입력했다면 이 절은 건너뛴다" 명시
4. **line 334-350 명령 블록**: 그대로 유지 (vim .env + force-recreate가 복구 절차 그대로). "또는 더 간단히: `make init-docker-env` 재실행" 보조 경로 한 줄 추가
5. **line 352 운영 주의 박스**: 시안 A로 단순화 — "**⚠️ 운영 중 재기동에는 `make docker-up`을 사용하세요** — `init-docker-env`/`docker-first-deploy`는 매번 두 포트를 묻고, 빈 입력 시 default 80/443으로 reset됩니다."
6. **line 929 체크리스트**: "`docker/.env` 포트 값 2개 수정 (`EXPOSE_NGINX_PORT=8080`, `EXPOSE_NGINX_SSL_PORT=8443`)" → "`init-docker-env` 프롬프트에서 `EXPOSE_NGINX_PORT=8080`, `EXPOSE_NGINX_SSL_PORT=8443` 입력 (실수했으면 5단계 'nginx 포트 노출 복구' 절 따라 수정)"
7. **변경 이력에 2026-04-27 항목 1줄 추가**: 5단계 포트 흐름을 권장 입력 단일 경로로 정리, 절 제목/도입부를 실수 복구로 재정의, 운영 주의 박스 단순화

## AC

### docs/deployment-guide.md
- [ ] line 311-313 코멘트가 권장 흐름(8080/8443) 가정으로 변경됨. 다른 값일 때 "nginx 포트 노출 복구" 절 참조 안내 포함
- [ ] line 330 절 제목이 "nginx 포트 노출 복구 (실수로 default 80/443 또는 다른 값을 입력한 경우)"로 변경
- [ ] 도입부에 "권장 흐름대로 8080/8443을 입력했다면 이 절은 건너뛴다" 명시
- [ ] 도입부에서 "이대로 6단계로 가면 호스트 nginx 80/443 충돌" 경고 유지 (이유 설명 보존)
- [ ] vim .env + `docker-compose up -d --force-recreate nginx` 명령 블록 그대로 유지
- [ ] "또는 더 간단히: `make init-docker-env` 재실행 후 force-recreate" 보조 경로 한 줄 추가
- [ ] line 352 운영 주의 박스가 시안 A 한 문장으로 단순화 (위 정확한 표현)
- [ ] line 929 체크리스트가 "init-docker-env 프롬프트에서 8080/8443 입력 (실수했으면 'nginx 포트 노출 복구' 절 참조)" 형태로 갱신
- [ ] 변경 이력에 2026-04-27 항목 1줄 추가
- [ ] 5단계 본문 내 다른 위치(line 217 보존 정책 안내, line 245 대화형 입력 안내, line 285-300 이때 일어나는 일 박스, 트러블슈팅 line 735 권한 거부 블록)는 변경 없음

### 공통
- [ ] `grep -c "nginx 포트 노출 변경" docs/deployment-guide.md` → 0 (변경 후 절 제목)
- [ ] `grep -c "nginx 포트 노출 복구" docs/deployment-guide.md` → 1 (새 제목)
- [ ] line 311-313 코멘트에 `0.0.0.0:8080->80/tcp` 표현 포함
- [ ] line 352 운영 주의 박스가 한 문장(시안 A) 형태로 변경됨
- [ ] Lint: 해당 없음 (docs-only)
- [ ] 자동 회귀 테스트: 해당 없음
- [ ] 다른 docs 파일은 변경 없음 (`migration-notes.md`, `CLAUDE.md`, `_bmad-output/research/codebase-analysis.md` 등)

## User Briefing

### 확인 방법
1. `git diff docs/deployment-guide.md`로 5개 영역(line 311-313, 330, 332, 352, 929) + 변경 이력 1줄이 의도대로 변경됐는지 검토
2. `grep -n "nginx 포트 노출" docs/deployment-guide.md`에서 "변경" 0건 / "복구" 1건 확인
3. 5단계 흐름 사람 읽기 검증: "권장 입력 → 정상 진행 / 실수했으면 복구 절로" 흐름이 자연스럽게 읽히는지
4. 운영 주의 박스가 한 문장으로 짧고 명확한지

### 알려진 제약
- 이 hotfix는 **docs-only** — Makefile/init-env.sh 등 코드는 변경 없음 (이전 두 hotfix에서 처리 완료)
- "실수 복구" 절의 명령 블록은 기존 그대로 유지 — 절차 자체는 정상이고 의미 재정의만 진행
- 운영 주의 박스 단순화로 정보가 일부 줄어듦: "docker-build-no-cache도 같은 위험" / "docker-compose restart 우회책" 등은 빠짐. 핵심 행동지침(`make docker-up` 사용)에 집중
- AL2023 / Ubuntu 가이드는 별도 파일이 아닌 통합본으로 합쳐졌으므로 이 한 파일만 수정하면 됨

## Dev Agent Record

### 구현 요약

`docs/deployment-guide.md` 단일 파일에서 7개 영역 갱신 완료 (Lightweight, docs-only).

| # | 위치 | 변경 내용 |
|---|---|---|
| 1 | line 311-313 (수정 후 311-314) | docker-compose ps 출력 코멘트를 권장 흐름(8080/8443) 가정으로 재작성 + 다른 값 시 "복구" 절 참조 안내 |
| 2 | line 330 (수정 후 331) | 절 제목: "nginx 포트 노출 변경 (호스트 80/443 자리 비우기)" → "nginx 포트 노출 복구 (실수로 default 80/443 또는 다른 값을 입력한 경우)" |
| 3 | line 332 (수정 후 333-335) | 도입부: "사전 가정" 톤 → "실수 복구" 톤. "권장 흐름대로 8080/8443을 입력했다면 이 절은 건너뜁니다" 명시. 6단계 충돌 경고 보존 |
| 4 | line 350 직후 (수정 후 351) | 명령 블록은 그대로 유지. "**또는 더 간단히**: `make init-docker-env` 재실행 → force-recreate" 보조 경로 한 줄 추가 |
| 5 | line 352 (수정 후 357) | 운영 주의 박스를 시안 A 한 문장으로 단순화 |
| 6 | line 929 (수정 후 934) | 체크리스트: ".env 포트 값 수정" → "init-docker-env 프롬프트에서 입력 (실수했으면 '복구' 절 참조)" |
| 7 | 변경 이력 마지막 행 (수정 후 977) | 2026-04-27 hotfix 항목 1줄 추가 |

핵심 변경 사항:
- 권장 흐름(8080/8443 명시 입력)이 정상 경로로, 절 제목 "변경 → 복구"로 의미를 재정의
- vim .env + force-recreate 명령 블록은 절차 자체가 정상이라 보존, 보조 경로(make init-docker-env 재실행)만 추가
- 운영 주의 박스 단순화로 docker-build-no-cache/restart 우회책 정보가 빠짐 (핵심 행동지침 `make docker-up`에 집중)

### 품질 검사

검증 6개 항목 모두 PASS:

1. **옛 절 제목 본문 잔존 (기대 0)**: ✅ 본문에서 "nginx 포트 노출 변경" 0건. 변경 이력 historical record 인용 2건(line 973, 977)만 잔존 (의도된 보존).
2. **새 절 제목 (기대 1+)**: ✅ 5건 — line 238(본문 참조 갱신), line 313(코멘트), line 331(절 제목), line 934(체크리스트), line 977(변경 이력).
3. **0.0.0.0:8080->80/tcp 코멘트**: ✅ line 312, line 349 (이전부터 있던 검증 명령 코멘트)에서 표시.
4. **운영 주의 한 문장 (시안 A)**: ✅ line 357 — `**⚠️ 운영 중 재기동에는 `make docker-up`을 사용하세요** — ...빈 입력 시 default 80/443으로 reset됩니다.`
5. **체크리스트 갱신**: ✅ line 934 — `init-docker-env 프롬프트에서 EXPOSE_NGINX_PORT=8080, EXPOSE_NGINX_SSL_PORT=8443 입력 (실수했으면 5단계 "nginx 포트 노출 복구" 절 참조)`
6. **변경 이력 마지막 2026-04-27 + 실수 시 절차 표현**: ✅ line 977 — `... "nginx 포트 노출 변경" 절을 "nginx 포트 노출 복구"로 재정의(실수 시 절차로 명확화) ...`

git diff 통계: `1 file changed, 13 insertions(+), 7 deletions(-)`. 다른 파일 변경 없음 (`.team/progress.md`는 작업 전부터 modified 상태로 hotfix와 무관).

- Lint: 해당 없음 (docs-only)
- 자동 테스트: 해당 없음

### User Briefing

#### 실행 방법
1. `git diff docs/deployment-guide.md`로 7개 영역 변경 검토
2. 5단계 흐름 사람 읽기: "권장 입력 → 정상 진행 / 실수했으면 '복구' 절로" 흐름이 자연스러운지
3. 운영 주의 박스(line 357)가 한 문장으로 짧고 명확한지

#### AC별 구현 요약
- AC1 (line 311-313 코멘트): 권장 흐름 가정으로 변경, 다른 값일 때 "복구" 절 참조 안내 포함 ✅
- AC2 (line 330 절 제목): "변경" → "복구"로 변경 ✅
- AC3 (도입부 권장 흐름 시 건너뛰기 명시): "(권장 흐름대로 8080/8443을 입력했다면 이 절은 건너뜁니다.)" 명시 ✅
- AC4 (충돌 경고 유지): "포트 충돌로 nginx 설치/기동에 실패" 경고 보존 ✅
- AC5 (vim .env + force-recreate 명령 블록 그대로): line 334-350 명령 블록 무변경 ✅
- AC6 (보조 경로 한 줄 추가): "**또는 더 간단히**: `make init-docker-env`..." 추가 ✅
- AC7 (운영 주의 박스 시안 A): 한 문장으로 단순화 완료 ✅
- AC8 (체크리스트 갱신): "init-docker-env 프롬프트에서 입력 (실수했으면 '복구' 절 참조)" 형태 ✅
- AC9 (변경 이력 1줄 추가): 2026-04-27 항목 추가 ✅
- AC10 (다른 위치 무변경): line 217 보존 정책, line 245 대화형 안내, line 285-300 "이때 일어나는 일" 박스, line 735 권한 거부 블록 모두 무변경 ✅

### 이슈 기록

**1건 — 절 제목 변경에 따른 본문 참조 동반 갱신 (line 238)**

지시문 무변경 영역 목록(line 217, 245, 285-300, 735)에는 line 238이 명시되지 않았으나, line 238은 4단계 본문에서 "5단계 `nginx 포트 노출 변경` 절에서 다음 두 값을 수정합니다"라며 옛 절 제목을 참조하는 위치였음. 절 제목을 "복구"로 바꾸면 line 238이 깨진 참조가 되고 검증 1번 "옛 제목 사라짐" 의도와도 충돌하므로, 절 제목 변경의 자연스러운 동반 갱신으로 처리:

- 변경 전: "5단계 `nginx 포트 노출 변경` 절에서 다음 두 값을 수정합니다."
- 변경 후: "5단계에서 다음 두 값을 입력합니다 (실수했을 때의 복구 절차는 5단계 `nginx 포트 노출 복구` 절 참조)."

이는 지시문의 "5개 영역 + 변경 이력 1줄 외에는 손대지 말 것" 제약에서 약간 벗어난 동반 변경이므로 기록함. 만약 절 제목만 바꾸고 본문 참조는 깨진 채 둬야 한다면, line 238을 원복하고 README/AC를 재검토해야 함.

## Lifecycle Log

### HOTFIX_USER_VERIFY — 2026-04-27 15:13
- Approved — 사용자 직접 검증 (docs-only). 7개 영역 갱신 + Dev의 line 238 본문 참조 동반 보정 모두 수용.


### HOTFIX_IMPL — 2026-04-27 15:10
- docs/deployment-guide.md 7개 영역 갱신 + Dev Agent Record 작성. 검증 6/6 PASS (옛 절제목 0건/historical 2건 보존, 새 제목 5건, 코멘트 8080/8443, 운영 주의 시안 A, 체크리스트 갱신, 변경 이력). Dev 추가 보정: line 238 본문 참조도 절 제목 변경 정합성 차원에서 동반 갱신. AC 영향 없음.


### BUG_TRIAGE — 2026-04-27 15:04
- P1, Lightweight docs-only. 사용자 결정: 5단계 흐름 권장 입력(8080/8443) 단일 경로로 정리, 'nginx 포트 노출 변경' 절을 '실수 복구'로 재정의, 운영 주의 박스 시안 A로 단순화, 체크리스트 한 줄 갱신. 1개 파일 수정.

<!-- 리더가 상태 전환마다 추가 -->
