# Hotfix: Agent 도구 구성 단계 도구 나열 순서 고정

## 증상
Agent 생성 마법사 및 편집 화면의 도구 구성 단계에서 "사용 가능한 도구" 목록의 나열 순서가 고정되어 있지 않아 운영상 혼란을 유발.

## 원인 (추정 — HOTFIX_IMPL에서 확정)
도구 목록이 API 응답 순서(또는 Dify provider 응답 순서) 그대로 노출되어 일관된 정렬 기준이 없음.

## 수정 범위 (추정)
- `web-edu/components/agent/wizard/ToolConfigModal.tsx` 및 Agent 편집 측에서 동일 목록을 그리는 컴포넌트 / 데이터 훅
- 정확한 파일은 HOTFIX_IMPL에서 Dev 에이전트가 식별 (Agent 생성과 편집 두 경로 모두)

## 요구 정렬 순서 (상단→하단, 15개)
1. Markdown 변환기
2. OpenAI
3. 웹 스크래퍼
4. 수학
5. Google 번역
6. markitdown
7. 데이터 분석
8. Google
9. JSON 처리
10. 시간
11. 오디오
12. OpenWeather
13. Yahoo 금융
14. 데이터 시각화
15. 위키백과

## 정렬 규칙
- 위 15개는 **명시된 순서 그대로** 상단에 고정
- 목록에 없는 신규 도구가 응답에 등장할 경우: **원래(서버 응답) 순서를 유지하여 15개 뒤에 그대로 노출** — 숨기거나 재정렬하지 않음 (현재는 신규 도구 추가 계획 없음, 폴백 용도)
- 매칭 방식은 Dev가 결정 — 한글 표시명(locale-aware)과 provider identifier 중 안정적인 키 선택. 다만 사용자에게 보이는 표시명을 기준으로 매칭하는 것이 의미론적으로 안전함

## AC (Acceptance Criteria)
- [ ] Agent **생성 마법사**의 도구 구성 단계 목록이 위 15개 순서로 고정 노출
- [ ] Agent **편집** 화면의 도구 구성 목록도 동일한 순서로 노출 (두 경로에서 같은 소스를 쓰거나 동일한 정렬 로직이 적용)
- [ ] 목록에 없는 신규 도구가 있다면 15개 뒤에 기존 응답 순서대로 노출됨 (테스트로 보장)
- [ ] 도구 검색/필터/선택 등 기존 동작 영향 없음

## User Briefing
### 확인 방법
1. web-edu에서 **Agent 생성** 시작 → 도구 구성 단계 → 사용 가능한 도구 목록 상단부터 15개가 위 순서대로 보이는지 확인
2. 기존 Agent **편집** → 도구 구성 열기 → 동일 순서로 보이는지 확인
3. 도구 선택/검색/추가 삭제 동작이 기존대로 되는지 확인

### 알려진 제약사항
- 목록에 없는 신규 도구는 폴백 규칙(15개 뒤에 서버 순서 유지)으로 처리. 향후 도구가 추가되면 이 명단도 재검토 필요.

## Lifecycle Log

### HOTFIX_USER_VERIFY — 2026-04-14 14:01
- Approved — make deploy-web 재배포 완료, 사용자 승인


### BUG_TRIAGE — 2026-04-14
- P1, Lightweight 경로 선택, 최소 스토리 작성 완료

### HOTFIX_IMPL — 2026-04-14
- Dev 에이전트 구현 완료, scoped 품질 검사 통과

## Dev Agent Record

### 수정/신규 파일

- **신규**: `web-edu/components/agent/wizard/sortToolProviders.ts`
  - `TOOL_PROVIDER_ORDER` 상수(라인 31–47)와 `sortToolProviders()` 순수 함수(라인 55–74)
- **수정**: `web-edu/components/agent/wizard/Step4ToolsConfig.tsx`
  - L32: `sortToolProviders` import 추가
  - L388–396: `loadAvailableTools()` 내 `setToolProviders` 직전 정렬 적용
- **신규**: `web-edu/__tests__/components/agent/wizard/sortToolProviders.test.ts`
  - Jest 단위 테스트 5건

### 공통 유틸 위치 및 생성/편집 공유 확인

`Step4ToolsConfig`는 생성 경로(`app/agents/create/page.tsx` L115)와 편집 경로(`app/agents/[id]/edit/AgentWizardEditContent.tsx` L102)에서 **동일 컴포넌트**가 재사용됨. 따라서 `Step4ToolsConfig.loadAvailableTools()`에 정렬을 한 번만 꽂으면 두 경로 모두 자동 적용. 별도 편집 전용 컴포넌트는 없음.

추가 확인: `web-edu/components/agent/wizard/ToolList.tsx`는 프로젝트 내 import 참조가 0건(dead code)이므로 이번 핫픽스 범위에서 제외함.

### 매칭 키 선택 근거

**provider name(영문 식별자)** 기준 매핑 채택. 이유:

- provider name은 YAML(예: `data_alchemy/data_alchemy.yaml`)과 서버 상수(`tool_registry_service.py`의 `allowed_providers`)로 고정된 안정 식별자.
- 한글 표시명(`label.ko_KR`)은 i18n 편집/번역 정책 변경에 취약(예: "Markdown 변환기" 문구가 바뀌면 정렬이 깨짐).
- 요구된 15개 표시명 전부가 provider name 하나씩과 1:1 대응됨(아래 표).

| 요구 표시명 | provider name | 근거 |
|---|---|---|
| Markdown 변환기 | `md_exporter` | 유일한 MD 변환 provider |
| OpenAI | `openai_tool` | OpenAI 통합 provider (DALL-E 등) |
| 웹 스크래퍼 | `webscraper` | - |
| 수학 | `maths` | - |
| Google 번역 | `google_translate` | - |
| markitdown | `markitdown` | - |
| 데이터 분석 | `data_analysis` | DigitForce API |
| Google | `google` | Google 검색 (SerpAPI) |
| JSON 처리 | `json_process` | - |
| 시간 | `time` | - |
| 오디오 | `audio` | TTS/STT |
| OpenWeather | `openweather` | - |
| Yahoo 금융 | `yahoo` | Yahoo Finance |
| 데이터 시각화 | `data_alchemy` | `data_alchemy.yaml`의 `label.ko_KR: 데이터 시각화`로 확인 |
| 위키백과 | `wikipedia` | - |

### 품질 검사 결과

| 명령 | 결과 |
|---|---|
| `pnpm test -- __tests__/components/agent/wizard/sortToolProviders.test.ts` | 5/5 PASS |
| `npx eslint components/agent/wizard/sortToolProviders.ts components/agent/wizard/Step4ToolsConfig.tsx __tests__/components/agent/wizard/sortToolProviders.test.ts` | 0 warning / 0 error |
| `npx tsc --noEmit` (변경 파일 grep) | 변경 파일 관련 타입 에러 0건 |

### Regression 테스트 케이스 요약

1. **전체 15개 역순 입력 → 명세 순서로 정렬**: 결정성 검증
2. **미지 provider 2개 + 기지 2개 섞음**: 기지 2개 먼저 명세 순서로, 미지 2개는 입력 순서 유지하여 뒤에 배치
3. **기지 provider 7개 부분 집합**: 명세 순서의 부분 집합 유지
4. **원본 배열 불변성**: 입력 배열 변조하지 않음 검증
5. **빈 배열 대응**: 빈 배열 입력 시 빈 배열 반환

### User Briefing

**실행 방법 / 확인 포인트:**

1. `web-edu` 개발서버 재실행 불필요 — hot reload로 반영됨 (`cd web-edu && pnpm dev`).
2. **생성 경로**: 상단 메뉴 Agents → 새 Agent 생성 → 마법사 Step 4(도구 구성) → 사용 가능한 도구 목록 상단부터 다음 순서 확인:
   Markdown 변환기 → OpenAI → 웹 스크래퍼 → 수학 → Google 번역 → markitdown → 데이터 분석 → Google → JSON 처리 → 시간 → 오디오 → OpenWeather → Yahoo 금융 → 데이터 시각화 → 위키백과
3. **편집 경로**: 기존 Agent 편집 → 같은 Step 4 → 동일 순서로 노출되는지 확인.
4. **기능 회귀 확인**: 도구 검색/선택/해제, 설정 모달 열기 동작이 이전과 동일한지 확인.
5. **프로덕션 반영**: 정적 자산이므로 `make docker-rebuild` 혹은 CI/CD로 web-edu 이미지 재빌드 필요.

### 알려진 제약 / 에스컬레이션 없음

- 정렬 테이블에 매칭되지 않는 provider는 없음(15개 전부 provider name 1:1 매칭).
- 생성/편집이 동일 컴포넌트를 공유하므로 이중 구현 문제 없음.
- 3회 시도 내 UI 반영 성공(1회차 구현으로 테스트 통과).
