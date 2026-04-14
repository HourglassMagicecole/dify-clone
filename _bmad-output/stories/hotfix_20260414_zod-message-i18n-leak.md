# Hotfix: Zod error.message의 i18n 키가 렌더 시 raw로 노출되는 잠재 버그

## 증상 (직전 hotfix Dev 보고로 확인된 잠재 잔여)
`web-edu/components/agent/wizard/Step2PromptSettings.tsx`에서 Zod 검증 에러의 `message` 필드를 `t()` 없이 그대로 렌더하는 지점이 있고, 해당 message에는 i18n 키 문자열(`agent.validation.promptMinLength/TooLong` 등)이 담겨 있음 → 사용자에게 raw 키가 그대로 노출 가능.

- L336: `{errors.pre_prompt.message}` — pre_prompt 10자 미만/4000자 초과일 때 발생
- L360: `{errors.opening_statement.message}` — opening_statement 글자수 초과
- 참고: L913 (Step3ModelConfig `max_tokens`)는 message에 접두사 없음으로 렌더 경로에 따라 문제 없음 → 이번 스코프 밖

## 재현 조건
- Agent 생성/편집 Step 2에서 pre_prompt를 10자 미만으로 입력 → 에러 문구 자리에 `agent.validation.promptMinLength` 문자열 표시
- opening_statement를 제한 초과로 입력 → 동일 증상

## 원인 (추정 — HOTFIX_IMPL에서 Dev가 확정)
Zod 스키마가 message에 i18n 키 전체 경로를 담고 있고, 렌더 측에서 `errors.{field}.message`를 **t() 없이** 그대로 출력. 이전 CR3(validation util)과 동일한 구조적 원인이지만 다른 지점.

## 수정 방향 (Dev 판단)
- (A) 렌더 시 `t(errors.{field}.message)`로 번역. 단, i18next의 네임스페이스 바인딩과 중복 접두사 이슈(`agent.agent.validation.*`) 주의 — 직전 CR3 수정과 동일하게 `agent.` 접두사를 떼거나 한 번만 붙이도록 정리
- (B) Zod 스키마의 message를 i18n 키 대신 코드로 담고, 렌더 헬퍼에서 코드 → 번역 문자열로 매핑 (구조적으로 더 깔끔)
- Dev가 프로젝트 관례와 직전 CR3 수정 구조를 고려해 선택

## 수정 범위
- `web-edu/schemas/agent-schema.ts` (pre_prompt/opening_statement 관련 Zod 스키마)
- `web-edu/components/agent/wizard/Step2PromptSettings.tsx` (error.message 렌더 지점)
- i18n 사전 키가 누락되어 있다면 보강

## AC (Acceptance Criteria)
- [ ] pre_prompt 길이 제한 실패 시 **번역된 한국어/영어 문구**가 노출 (raw 키 없음)
- [ ] opening_statement 길이 제한 실패 시 동일
- [ ] 정상 입력 시 에러 메시지 영역 비어있음 (회귀 없음)
- [ ] 직전 hotfix들의 validation 가드, 버튼 disabled 등 동작 유지

## User Briefing
### 확인 방법
1. `make deploy-web` 재배포 후 Agent 생성/편집 진입
2. 프롬프트 필드를 짧게(10자 미만) 또는 길게(4000자 초과) 입력
3. 에러 메시지가 **번역된 문구**로 뜨는지 확인
4. opening_statement 제한 초과 시 동일
5. 정상 입력 시 에러 사라지는지

### 알려진 제약사항
- Dify 업스트림과 별개의 프론트 전용 메시지라 drift 영향 없음

## Lifecycle Log

### HOTFIX_USER_VERIFY — 2026-04-14 17:43
- Approved — make deploy-web 재배포 완료, 사용자 승인


### BUG_TRIAGE — 2026-04-14
- P1, Lightweight 경로, 직전 hotfix에서 Dev가 선발견한 잠재 잔여. 범위 명확하고 수정 지점 식별됨.

## Dev Agent Record

### 원인 지점
- `web-edu/components/agent/wizard/Step2PromptSettings.tsx:333` — `{errors.pre_prompt.message}` (t() 미경유)
- `web-edu/components/agent/wizard/Step2PromptSettings.tsx:357` — `{errors.opening_statement.message}` (t() 미경유)
- 추가로 `web-edu/schemas/agent-schema.ts`의 Zod 스키마 message가 `agent.validation.*` 형태로 **이중 접두사** 구조 (`useTranslation('agent')`로 조회 시 `agent.agent.validation.*` 조회 → 키 미스 → raw 노출)

### 선택한 접근 (A)
CR3와 동일 패턴: Zod 스키마 message에서 `agent.` 접두사 제거 + 렌더 측에서 `t(errors.*.message as string)` 래핑.
- 근거:
  1) `user-input-form-validation.ts`, Step1, Step3이 이미 이 패턴 사용 → 일관성 확보.
  2) 번역 사전(`agent.json`)에 `validation.promptMinLength` 등이 이미 등록되어 있음 → 사전 변경 불필요.
  3) 선택 B(코드→메시지 매핑 헬퍼)는 구조 변경 범위가 커서 핫픽스 스코프 초과.

### 수정 파일
- `web-edu/schemas/agent-schema.ts` — `pre_prompt.min/max`, `opening_statement.max`, `user_input_form` 내부 3개, `userInputFormRequired` superRefine message에서 모두 `agent.` 접두사 제거 (6개소)
- `web-edu/components/agent/wizard/Step2PromptSettings.tsx` — L333, L357을 `t(errors.*.message as string)`로 래핑
- `web-edu/__tests__/schemas/agent-schema.test.ts` — 신규 테스트 (5 케이스): 에러 메시지가 접두사 없는 키이고 번역 사전에 실제 등록되어 있음을 단언

### 동일 패턴 잔여 여부
- Step2 내 `errors.user_input_form`을 직접 렌더하는 지점은 없음 (UserInputFormBuilder가 자체 표시).
- `errors.*.message`를 `t()` 없이 렌더하는 다른 지점(스코프 밖, 별건 권고):
  - `components/api-keys/AddAPIKeyModal.tsx` L121/144/176/195
  - `components/api-keys/EditAPIKeyModal.tsx` L129/148
  - `components/auth/SignInForm.tsx` L55/90
  - `components/admin/EditUserModal.tsx` L136/209
  - `components/admin/CreateUserModal.tsx` L168/184/220/237
  위 파일들은 현재 Zod message가 일반 문자열(영문 하드코딩)로 보이며, i18n 키 형태라면 동일 버그 가능 → 각 모듈의 스키마 확인이 필요하나, 이번 핫픽스 스코프는 agent wizard Step2로 한정하고 별건 티켓 권고.

### 테스트 결과
- 신규 `agent-schema.test.ts`: 5 passed (접두사 없는 키 형태 + 사전 존재 단언).
- 회귀: `user-input-form-validation.test.ts`(40+), `Step1BasicSettings.test.tsx` 모두 통과, 45 passed total.
- TypeScript type-check: 변경 파일 에러 없음 (기존에 존재하던 error-messages.test.ts/SessionSelector.test.tsx의 무관한 타입 에러는 그대로, 내 변경과 무관).
- ESLint: 변경 파일 0 경고.

### 재배포 범위
- 프론트엔드만: `make deploy-web` 또는 `cd web-edu && pnpm build` 후 배포.
- 백엔드/DB 마이그레이션 변경 없음.

### 알려진 한계
- 스코프를 Step2에 한정했으므로 다른 모듈(`api-keys`, `auth`, `admin`)에 동일 구조의 i18n 키 누출이 있을 경우 별건 수정 필요. 위 "동일 패턴 잔여 여부"에 나열함.
- Zod 에러 메시지에 interpolation(예: `{{count}}`)이 들어가는 시나리오는 없음 — 현재 스키마 범위에서는 모두 정적 문자열 키라 `t(key)` 단독 호출로 충분.

### 에스컬레이션 여부
- 없음. 1회 시도에 성공, 프로젝트 전반 리팩터링은 요구되지 않음(별건 권고로 충분).
