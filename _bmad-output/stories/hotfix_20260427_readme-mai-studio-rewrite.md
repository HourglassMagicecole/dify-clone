# Hotfix: README를 MAI Studio 단독 사내 가이드로 재작성 + 다국어/Contributing 폐기

## 목적

`README.md`가 오리지널 Dify 내용 그대로다. `magicecoleai/dify-moai-v2`는 **private 저장소**(사내/협력사 전용)이므로 외부 오픈소스 README가 의미 없고, MAI Studio 정체성과 사내 운영자가 빠르게 시작할 수 있는 가이드 톤이 적합하다.

또 다국어 README 13개와 다국어 CONTRIBUTING 11개도 외부 공개 가정 하에 존재하던 자산이라 private 저장소에서는 유지 가치가 없다. 한 번에 정리한다.

## 사용자 결정 (BUG_TRIAGE 합의)

| 항목 | 결정 |
|------|------|
| 저장소 공개 범위 | **private** (사내 가이드 톤) |
| 변경 범위 | **C 최대** — 전체 재작성, Dify 흔적 최소화 (LICENSE만 유지) |
| 메인 언어 | **한국어** (`README.md` 루트 메인 — 사내 표준 한국어, 운영자 1차 문서) |
| 보조 언어 | **영어** (`README/README_EN.md` — GitHub 다국어 폴더 패턴 유지) |
| 기타 다국어 12개 | **모두 폐기** |
| 자산(로고/배지/이미지) | **자산 없이 텍스트 위주** |
| Contributing | **모두 폐기** (외부 기여 안 받음) |
| Community 채널 | **없음** (섹션 제거) |
| Security 신고 채널 | **제외** |
| LICENSE | **그대로 유지** (Dify 원본 라이선스 — 포크 의무) |

## 수정 범위 (Lightweight, docs-only — 변경 폭은 크지만 코드 영향 없음)

### 신규/재작성 파일
- `README.md` — **한국어 메인** (전체 재작성, 사내 운영자 1차 문서)
- `README/README_EN.md` — **영어 보조** (전체 재작성, 한국어와 동일 구조의 영어 번역)

### 삭제 파일 (총 26개)

**다국어 README 14개** (`README/README_KR.md` 포함 — 한국어 컨텐츠가 루트 `README.md`로 이동하므로 폴더 안의 한국어 파일도 폐기):
- `README/README_AR.md` `README/README_BN.md` `README/README_CN.md` `README/README_DE.md`
- `README/README_ES.md` `README/README_FR.md` `README/README_JA.md` `README/README_KL.md`
- `README/README_KR.md` (한국어가 루트 메인으로 이동)
- `README/README_PT.md` `README/README_SI.md` `README/README_TR.md` `README/README_TW.md`
- `README/README_VI.md`

**Contributing 12개**:
- `CONTRIBUTING.md`
- `CONTRIBUTING/CONTRIBUTING_CN.md` `CONTRIBUTING/CONTRIBUTING_DE.md` `CONTRIBUTING/CONTRIBUTING_ES.md`
- `CONTRIBUTING/CONTRIBUTING_FR.md` `CONTRIBUTING/CONTRIBUTING_JA.md` `CONTRIBUTING/CONTRIBUTING_KR.md`
- `CONTRIBUTING/CONTRIBUTING_PT.md` `CONTRIBUTING/CONTRIBUTING_TR.md` `CONTRIBUTING/CONTRIBUTING_TW.md`
- `CONTRIBUTING/CONTRIBUTING_VI.md`

> CONTRIBUTING 폴더가 비면 git에서 자동으로 사라짐. README 폴더는 신규 `README_EN.md`만 남음.

### 보존 파일 (변경 금지)
- `LICENSE` — Dify 원본 라이선스 그대로
- `images/` 폴더는 그대로 둠 (README에서 참조 제거 후 파일 정리는 별도 hotfix)
- 코드, docs, .team/, _bmad-output/ 등 모든 다른 파일

## README.md (한국어, 메인) — 구조 가이드

private 사내 가이드 톤. 외부 마케팅 요소 없음. 사내 운영자/개발자가 1차로 보는 문서. 핵심 8개 섹션:

1. **제목 + 한 줄 소개**
   - "MAI Studio — Dify 기반 교육용 AI 플랫폼"
2. **정체성 (1 단락)**
   - Dify v1.9.1 포크에 교육 도메인(세션, 역할, 사용량 추적, LMS SSO)을 오버레이
   - 사내 운영용 private 저장소. 외부 기여는 받지 않음.
3. **빠른 시작 (사내 운영자 + 개발자용)**
   - 프로덕션 배포: `docs/deployment-guide.md` 참조 (Rocky Linux 9)
   - DNS 컷오버/이전: `docs/migration-notes.md` 참조
   - 로컬 개발: `make dev-setup` + 4줄 정도 명령, `CLAUDE.md` Quick Reference 참조
4. **Dify 위에 추가된 기능**
   - 교육 도메인 모듈 위치 (`api/services/edu/`, `api/services/education_management/`, `web-edu/`)
   - 핵심 기능 bullet (세션, 역할, 쿼터, 사용량 분석, LMS SSO, 커스텀 UI)
5. **저장소 구조 (개략)**
   - 표: `api/`, `web/`, `web-edu/`, `docker/`, `docs/`, `_bmad-output/`
6. **문서 인덱스**
   - `docs/deployment-guide.md` — 프로덕션 배포 (Rocky Linux 9)
   - `docs/migration-notes.md` — DNS 컷오버 / 이전 런북
   - `_bmad-output/project-context.md` — 코드 규칙과 아키텍처
   - `CLAUDE.md` — 개발자용 명령 빠른 참조
7. **English README 안내**
   - 한 줄: "English: [README/README_EN.md](README/README_EN.md)"
8. **라이선스**
   - Dify Open Source License 승계 (LICENSE 참조)

## README/README_EN.md (영어, 보조) — 구조 가이드

한국어 README와 **동일 구조의 영어 번역**. 마지막에 "한국어: [../README.md](../README.md)" 한 줄로 메인 링크.

## AC

### README.md (한국어, 메인)
- [ ] 위 8개 섹션 구성
- [ ] Dify 외부 마케팅 요소 모두 제거 (Discord/Reddit/Twitter/LinkedIn 배지, Cloud 안내, Star history, Helm/Terraform/AWS CDK 외부 가이드 링크 등)
- [ ] 다국어 배지 모두 제거 (영어 안내 한 줄만 잔존)
- [ ] cover 이미지(`./images/GitHub_README_if.png`) 참조 제거
- [ ] Community/Security 섹션 없음
- [ ] Contributing 섹션은 짧은 한 줄만: "이 저장소는 사내 포크입니다. 외부 기여는 받지 않습니다."
- [ ] LICENSE 섹션은 한 줄: Dify Open Source License 승계, LICENSE 참조
- [ ] 빠른 시작은 사내 운영자가 5초 안에 어디로 가야 하는지 안내 (deployment-guide / migration-notes 링크 + 로컬 개발 4줄 명령)
- [ ] 한국어 사내 톤 (높임말 일관성, 외래어/약어 한글 표기 등)

### README/README_EN.md (영어, 보조)
- [ ] 한국어와 동일 구조 + 영어 번역
- [ ] 마지막에 "한국어: [../README.md](../README.md)" 한 줄
- [ ] 한국어 README의 모든 섹션이 동일하게 영어로 존재 (대응 누락 없음)
- [ ] 영어 톤 (자연스러운 영어 표현, 한국어 직역 금지)

### 삭제
- [ ] 다국어 README 14개 모두 `git rm` (`README/README_KR.md` 포함, `README/README_EN.md`는 신규 추가이므로 삭제 대상 아님)
- [ ] `CONTRIBUTING.md` `git rm`
- [ ] `CONTRIBUTING/CONTRIBUTING_*.md` 11개 모두 `git rm`
- [ ] CONTRIBUTING 폴더가 비면 자동으로 git에서 사라짐 — 별도 조치 불필요
- [ ] `README/` 폴더는 신규 `README_EN.md`만 남음

### 보존 (변경 금지)
- [ ] `LICENSE` 변경 없음
- [ ] `images/` 폴더 변경 없음 (Dify 원본 이미지지만 README에서 참조 제거 후 파일은 그대로 — 별도 정리는 후속 hotfix)
- [ ] `docs/`, `api/`, `web/`, `web-edu/`, `docker/`, `.team/`, `_bmad-output/` 등 모든 다른 파일 변경 없음
- [ ] 다른 .md 파일에 README 인용/링크가 있는지 확인 후, 깨진 링크 발견 시 보고만 (해결은 별도 hotfix)

### 공통
- [ ] `git rm` 로 26개 파일 깔끔하게 삭제
- [ ] 신규/재작성 2개 파일이 정확한 위치 (`README.md` 루트, `README/README_EN.md` 폴더 안)
- [ ] Markdown 문법 검증 (헤더/링크/표 모두 정상)
- [ ] Lint: 해당 없음 (docs)
- [ ] 자동 테스트: 해당 없음 (Lightweight)

## User Briefing

### 확인 방법
1. `git status -s`로 26개 deleted + 2개 new(`README.md` 수정, `README/README_EN.md` 신규) 확인
2. `cat README.md` — 한국어 사내 가이드 톤, 외부 마케팅 요소 없음, 빠른 시작으로 deployment-guide 안내, 약 50-100줄 분량
3. `cat README/README_EN.md` — 영어 동일 구조
4. `ls README/` → `README_EN.md`만 남음
5. `ls CONTRIBUTING/ 2>/dev/null` → 폴더 없음 (또는 빈 폴더)
6. `git diff LICENSE` → 변경 없음

### 알려진 제약
- **다국어 14개/Contributing 12개 삭제는 git history에 남으므로 필요 시 복원 가능** (push 전이라면 commit 되돌림 가능)
- **이미지 자산 부재**: cover/로고가 없어 README가 텍스트 위주. 추후 MAI Studio 로고/스크린샷 준비 시 별도 hotfix
- **외부 사용자 채널 없음 가정**: Community/Security 섹션 없음. 추후 외부 사용자 지원 필요 시 별도 hotfix
- **Dify attribution 유지**: 정체성 문단에 "Dify 기반" 표현 유지 (포크 정체성 + 라이선스 의무 정신)
- **CONTRIBUTING.md 폐기 = 정책 부재가 아니라 명확화**: "이 저장소는 외부 기여를 받지 않음"으로 정책 명확. 향후 정책 변경 시 새로 작성.
- **`images/GitHub_README_if.png` 등 Dify 원본 이미지 파일은 디스크에 남음**: README에서 참조만 제거. 파일 자체 정리는 별도 hotfix (지금 같이 처리하면 스코프 크리프).
- **이전 hotfix들이 README를 인용하는지**: 확인 후 발견 시 보고. 일반적으로 hotfix story들은 deployment-guide / CLAUDE.md를 참조하지 README 자체는 거의 인용 안 함.

## Dev Agent Record

### 구현 요약

- **신규/재작성 파일 2개**:
  - `README.md` (루트, 한국어 메인) — 78줄 — 8개 섹션 모두 포함 (제목/정체성/빠른 시작/추가 기능/저장소 구조/문서 인덱스/외부 기여 정책/라이선스 + English 안내)
  - `README/README_EN.md` (영어 보조) — 78줄 — 한국어와 동일 8개 섹션 구조의 자연스러운 영어 번역, 마지막에 한국어 안내 링크
- **삭제 파일 25개** (`git rm`로 staged): 다국어 README 14개 (AR/BN/CN/DE/ES/FR/JA/KL/KR/PT/SI/TR/TW/VI) + 루트 `CONTRIBUTING.md` + 다국어 CONTRIBUTING 10개 (CN/DE/ES/FR/JA/KR/PT/TR/TW/VI). CONTRIBUTING 폴더는 비어 git에서 자동 사라짐.
- **8개 섹션 한 줄 요약**:
  1. 제목 + 한 줄 소개 (Dify 기반 교육용 AI 플랫폼, 사내 운영용 private 포크)
  2. 정체성 (Dify v1.9.1 포크 + 교육 도메인 오버레이, 외부 기여 안 받음)
  3. 빠른 시작 (3개 시나리오 분기: 신규 배포 / 이전 / 로컬 개발)
  4. Dify 위에 추가된 기능 (모듈 위치 표 + 핵심 기능 6개 bullet)
  5. 저장소 구조 (디렉토리 표 7개 행)
  6. 문서 인덱스 (deployment-guide / migration-notes / project-context / CLAUDE.md)
  7. 외부 기여 정책 (한 줄)
  8. 라이선스 (Dify Open Source License 승계 + LICENSE 링크) + English 안내

### 품질 검사

**검증 1 — 파일 변경 카운트** (PASS):
- `git diff --cached --name-only --diff-filter=D | wc -l` → **25** (스토리 명세 26과 1 차이 — 이슈 기록 참조)
- 신규(`??`) 2: `README/` 폴더 자체(안에 `README_EN.md`) + 스토리 메타파일 자기 자신
- 수정(`M`) 2: `README.md`(unstaged, 워킹트리에서 새 콘텐츠로 덮어쓴 결과) + `.team/progress.md`(오케스트레이터 자동 갱신, 스코프 외)

**검증 2 — 신규 파일 분량** (PASS, 권장 80-120 살짝 미달이나 사내 가이드 톤으로는 충분):
- `wc -l README.md` → **78줄**
- `wc -l README/README_EN.md` → **78줄**
- 인위적 padding 없이 8개 섹션 모두 수록. 권장 범위와 2줄 차이로 의도적으로 늘리지 않음.

**검증 3 — README.md 한국어 톤 grep** (PASS):
- "MAI Studio" 5회 등장 ✓
- "Dify 기반" + "Dify v1.9.1 포크" 표현으로 attribution 유지 ✓
- "외부 기여" 3회 명시 (정체성 단락 + 외부 기여 정책 섹션) ✓
- `docs/deployment-guide.md` 2회, `docs/migration-notes.md` 2회, `CLAUDE.md` 2회 모두 링크 ✓
- `GitHub_README_if` 0건, Discord/Reddit/Twitter/LinkedIn 배지 0건, Star history 0건 ✓
- 외부 마케팅 요소(Cloud 안내, Helm/Terraform/AWS CDK, FAQ 등) 모두 제거됨

**검증 4 — README/README_EN.md 영어 톤 grep** (PASS):
- "MAI Studio" 6회 등장 ✓
- "internal private fork" / "fork of Dify" attribution 유지 ✓
- "External contributions are not accepted" 명시 (정체성 + Contribution Policy 섹션) ✓
- `../docs/deployment-guide.md`, `../docs/migration-notes.md`, `../CLAUDE.md` 모두 링크 (영문 README 위치가 `README/` 폴더 안이므로 `../` 상대경로 사용) ✓
- 마지막 줄 "한국어: [../README.md](../README.md)" 안내 ✓

**검증 5 — 삭제 검증** (PASS):
- `ls README/` → `README_EN.md` 단 1개 ✓
- `ls CONTRIBUTING/` → "No such file or directory" (폴더 자동 소멸) ✓
- `ls CONTRIBUTING.md` → "No such file or directory" ✓

**검증 6 — 보존 검증** (PASS):
- `git diff LICENSE` → 출력 없음 (변경 없음) ✓
- `git status images/` → 변경 없음 ✓
- `docs/`, `api/`, `web/`, `web-edu/`, `docker/` 등 다른 모든 디렉토리 변경 없음 (`git status -s` 출력에 미등장) ✓

**검증 7 — 링크 정합성** (PASS):
- README.md / README_EN.md의 모든 상대 링크 대상 파일 실존 확인:
  - `docs/deployment-guide.md` ✓
  - `docs/migration-notes.md` ✓
  - `_bmad-output/project-context.md` ✓
  - `CLAUDE.md` ✓
  - `LICENSE` ✓
- 다른 .md 파일에서 루트 `README.md` / `README/README_*` / `CONTRIBUTING.md`를 인용하는 곳 grep 검사:
  - `docs/`, `CLAUDE.md`, `_bmad-output/project-context.md`: 인용 0건
  - `docker/README.md`: 자기 자신 또는 `docker/certbot/README.md`만 참조 → 루트 README 무관
  - `web/i18n-config/README.md`: 루트 README/CONTRIBUTING 인용 없음
  - **결론: 깨진 링크 0건**

**Lint**: 해당 없음 (docs-only).
**자동 테스트**: 해당 없음 (Lightweight, docs-only).

### User Briefing

**확인 방법**:
1. `git status -s` 로 다음 확인:
   - `D` 25개 (CONTRIBUTING 11개 + README 14개)
   - `M README.md` (콘텐츠 전체 교체로 modified로 표시 — 신규 작성과 동일 효과)
   - `?? README/` (안에 신규 `README_EN.md`)
2. `cat README.md` — 한국어 사내 가이드 톤, 외부 마케팅 요소 0건, 빠른 시작 3개 시나리오 분기, 약 78줄
3. `cat README/README_EN.md` — 영어 동일 구조, 자연스러운 영어 표현
4. `ls README/` → `README_EN.md`만 존재
5. `ls CONTRIBUTING/ 2>&1` → "No such file or directory"
6. `git diff LICENSE` → 출력 없음

**AC별 구현 요약**:
- README.md (한국어, 메인) AC 9개 — 8개 섹션 + 외부 마케팅 요소 제거 + 다국어 배지 제거 + 커버 이미지 참조 제거 + Community/Security 섹션 없음 + Contributing 한 줄 + LICENSE 한 줄 + 빠른 시작 3시나리오 + 한국어 사내 톤 모두 충족
- README/README_EN.md (영어, 보조) AC 4개 — 한국어와 동일 구조 + 한국어 안내 한 줄 + 섹션 누락 0건 + 자연스러운 영어 표현 모두 충족
- 삭제 AC 5개 — 다국어 README 14개 + CONTRIBUTING.md + CONTRIBUTING_*.md 10개 git rm + CONTRIBUTING 폴더 자동 소멸 + README 폴더에 README_EN.md만 잔존 모두 충족 (단 폴더 안 파일 수 차이 — 이슈 기록 참조)
- 보존 AC 4개 — LICENSE/images/ 무변경, 코드/docs/api/web/web-edu/docker 무변경, 다른 .md 파일에서 깨진 README 인용 0건
- 공통 AC 5개 — `git rm` 사용, 신규 파일 정확한 위치, Markdown 문법 정상, Lint·자동 테스트 해당 없음

### 이슈 기록

1. **명세-실제 파일 수 불일치 (1개)** — 스토리 본문 "총 26개 삭제"라고 명시되어 있고 Lifecycle Log에서 "25 → 26 (README_KR 추가)"으로 보정했으나, 실제 디스크에 존재했던 CONTRIBUTING 관련 파일은 `CONTRIBUTING.md`(루트) + `CONTRIBUTING/CONTRIBUTING_*.md` 10개 = **11개**였습니다. 명세 "Contributing 12개"는 11개의 단순 카운트 오류로 보이며, 실제 삭제 결과는 README 14개 + Contributing 11개 = **총 25개**가 맞습니다. 의도된 항목(다국어 README 전체 + Contributing 전체)은 빠짐없이 모두 삭제됐으므로 작업 완료성에는 영향 없음. 향후 사양 작성 시 사전 `ls`로 실제 카운트 검증 권장.

2. **다른 .md 파일에서 README/CONTRIBUTING 인용 발견 사항** (수정 안 함, 발견만 보고):
   - `docker/README.md`: 자기 자신("This README ...") 및 `docker/certbot/README.md`만 참조. 루트 README나 삭제된 다국어 파일을 가리키는 링크는 없음 → 영향 없음.
   - `web/i18n-config/README.md`: 루트 README/CONTRIBUTING 직접 인용 없음.
   - `_bmad-output/research/existing-docs/` 하위에는 `README.md`, `CONTRIBUTING.md`, `docker-README.md` 사본이 존재하나 이는 brownfield-scan 산출물의 스냅샷이라 외부 링크 무관 (스코프 외).
   - **결론**: 이번 hotfix로 깨지는 링크 없음. 후속 정리 불필요.

3. **README.md 분량(78줄)** — 권장 범위 80-120줄에 2줄 모자라지만, 8개 섹션 모두 수록하면서 인위적 padding 없는 사내 가이드 톤을 우선했음. 정보 부족 지점 없음. 향후 운영 사례가 쌓이면 "트러블슈팅 빠른 안내" 등으로 자연스럽게 확장 가능.

4. **`README.md`가 "modified"로 표시되는 이유** — `git rm`이 아닌 콘텐츠 교체이므로 git는 새 콘텐츠로 덮어쓴 modified로 분류. 신규 작성과 효과상 동일 (98% 이상 라인 변경). 검증 카운트 체크리스트의 "M = 1 이상" 기준에 부합.

## Lifecycle Log

### HOTFIX_USER_VERIFY — 2026-04-27 15:42
- Approved — 사용자 직접 검증 (docs-only). 신규 2개 + 삭제 25개 모두 수용. 명세-실제 차이(Contributing 12 vs 11)는 비차단으로 인정.


### HOTFIX_IMPL — 2026-04-27 15:40
- 신규 2개(README.md 78줄 한국어 메인 + README/README_EN.md 78줄 영어 보조) + 25개 git rm + Dev Agent Record 작성. 검증 7/7 PASS. 명세-실제 차이 1건 발견(Contributing 명세 12개 vs 실제 11개, KL 부재). 다른 .md 깨진 인용 0건.


## Lifecycle Log

### BUG_TRIAGE — 2026-04-27 15:21
- P1, Lightweight docs-only. 사용자 결정 5건: private/C 최대/영어+한국어만/자산 없이 텍스트/Contributing 폐기/Community·Security 제외/LICENSE 보존. 신규 2개 + 삭제 25개.

### BUG_TRIAGE 보정 — 2026-04-27 15:25
- 사용자 추가 결정: 메인 언어를 **영어 → 한국어**로 변경. 영어는 보조로 `README/README_EN.md` 위치(폴더 패턴 유지). 기존 `README/README_KR.md`도 삭제 대상에 추가(한국어 컨텐츠가 루트 `README.md`로 이동). 삭제 파일 25 → 26.

<!-- 리더가 상태 전환마다 추가 -->
