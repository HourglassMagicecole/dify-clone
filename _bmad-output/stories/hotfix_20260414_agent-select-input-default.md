# Hotfix: 작업형 에이전트 생성 시 "선택" 입력 타입 default 검증 오류 + 불일치 저장

## 증상
작업형 에이전트(Completion/Workflow) **생성 마법사의 "검토 및 저장" 단계**에서 "사용자 입력 폼" 정의에 **"선택(select)" 타입** 필드를 넣고 저장하면 아래 에러 메시지가 뜸:

```
default value in user_input_form must be in the options list
```

그러나 **에러 발생에도 불구하고 에이전트는 실제로 생성됨** (저장 성공과 에러 표시가 동시 발생).

## 재현 조건
- 생성 흐름(Agent 생성 마법사) → 마지막 "검토 및 저장" 단계
- 사용자 입력 폼에 입력 타입 "선택(select)" 필드 존재
- 해당 필드의 `options`는 **비어있음** (값을 하나도 추가하지 않음)
- 해당 필드의 `default`에는 **값이 입력되어 있음** (options에 없는 값이므로 불일치)

## 원인 가설 (HOTFIX_IMPL에서 Dev가 확정)

### 기능 원인
- **A. 프론트 validation 미흡**: select 타입 필드 생성 시 options 비어있는데 default만 허용하는 상태를 마법사가 허용. 검토 단계 에러 노출과 저장 진행이 분리됨.
- **B. 백엔드 validation은 있으나 저장이 분기됨**: Dify 원본 API가 `user_input_form` 검증에서 400을 반환해도, 에이전트 생성 자체는 별도 트랜잭션/경로로 이미 커밋된 상태일 가능성
- **C. 에러 응답 해석 실패**: 프론트가 저장 요청의 에러를 표시만 하고 실제로 별도 요청(또는 낙관적 state)에서 에이전트를 만듦
- **D. 두 단계 저장**: 에이전트 레코드 생성과 user_input_form 업데이트가 분리된 요청이며 첫 번째가 성공한 후 두 번째가 실패

### 수정 방향 후보
1. **프론트 근본 수정**: "검토 및 저장" 제출 전 `user_input_form` 내부 정합성(options vs default) 검사 수행 → 실패 시 저장 버튼 비활성화/수정 요구. 마법사에서 select 추가 시 options 최소 1개 강제 + default가 options에 포함되도록 UX 가드.
2. **백엔드 응답 처리 정정**: API가 400을 반환하면 프론트는 에이전트 생성을 실패로 처리하고 화면 상태를 롤백 (저장 성공 UI로 넘어가지 않도록).
3. **저장 트랜잭션 일관성**: 에이전트 record + form 저장이 단일 원자 작업으로 묶이도록 정리. 원본 영역이면 에스컬레이션.
4. **표시명과 실제 값 구분**: options 내부 구조가 `[{label, value}]`라면 default는 `value` 기준으로 비교하도록 일치 확인.

## 수정 범위 (추정)
- 프론트: `web-edu/` 내 Agent 생성 마법사 "검토 및 저장" 단계 및 사용자 입력 폼 정의 컴포넌트 (후보: `web-edu/components/agent/wizard/` 하위 — 이전 hotfix에서 Step4 관련 있었음; 이번은 user input form 단계)
- 백엔드: `api/` 내 Agent 생성/발행 endpoint + `user_input_form` validation (Dify 원본일 가능성 있음 → 국소 수정 허용, 광범위는 에스컬레이션)

## AC (Acceptance Criteria)
- [ ] 작업형 에이전트 생성에서 select 타입 필드의 options가 비어있는 경우, "검토 및 저장" 전에 프론트에서 UX 가드(경고 + 저장 진행 차단 또는 자동 정합화)
- [ ] options에 값이 있고 default도 options 중 하나와 일치할 때는 저장이 정상 완료 (회귀 없음)
- [ ] 검증 실패 시 **에이전트가 DB에 생성되지 않음** (에러 + 실제 생성의 이중 상태 제거)
- [ ] 편집 경로에서도 동일한 UX 가드 적용 (검증 일관성)
- [ ] 에러 메시지는 사용자에게 의미 있게 노출 (어떤 필드가 문제인지 단서 포함, 가능한 범위 내)

## User Briefing
### 확인 방법
1. `make deploy-all` 재배포 후 Agent 생성 마법사 진입
2. 사용자 입력 폼에 "선택" 타입 필드 추가 → options 비워둔 채 default 값만 입력 → "검토 및 저장"
   - 기대: 저장 버튼 비활성화 또는 명확한 가드 메시지 + 에이전트 미생성
3. options에 1개 이상 값 추가 + default를 options 중 하나와 일치시킨 후 저장
   - 기대: 정상 저장 + 에이전트 생성
4. 편집 경로에서도 동일 가드 확인
5. 다른 입력 타입(텍스트, 숫자 등)은 이전과 동일 동작인지 회귀 확인

### 알려진 제약사항
- 백엔드 원본 검증 로직이 광범위 수정이 필요하면 Dev 에스컬레이션 후 프론트 가드 우선 적용. 이 경우 에이전트 이중 생성 문제는 프론트에서 완화되지만 완전한 서버측 원자성은 별건 hotfix로 다룰 수 있음.

## Lifecycle Log

### HOTFIX_USER_VERIFY — 2026-04-14 16:50
- Approved — make deploy-web 재배포 완료, 사용자 승인


### HOTFIX_USER_FIX — 2026-04-14 16:42
- done (CR4) — disabledReason에서 괄호 블록 제거 (tooltip·보조 텍스트 공유 구조 유지). test 33/33 PASS


### HOTFIX_USER_VERIFY — 2026-04-14 16:39
- CR — 버튼 보조 텍스트에서 괄호 부분(변수명: 사유) 제거 요청. 앞 안내 문장만 남기고 디테일은 표시하지 않음


### HOTFIX_USER_FIX — 2026-04-14 16:26
- done (CR3) — validation util messageKey에서 'agent.' 접두사 제거. 호출부 useTranslation('agent')가 자동 해결. test 33/33 PASS


### HOTFIX_USER_FIX — 2026-04-14 16:34 (CR3, i18n)
- done — validation util의 messageKey에서 `agent.` 접두사 제거. `useTranslation('agent')` 바인딩 상태에서 t() 경유 시 raw 키 노출되던 회귀를 고정. test 33/33 PASS (신규 회귀 방지 2건 포함)

### HOTFIX_USER_VERIFY — 2026-04-14 16:21
- CR — 버튼 보조 텍스트의 에러 메시지가 i18n 키(agent.validation.selectOptionsRequired)로 raw 노출됨. t() 미적용 또는 사전 키 누락으로 추정. 메시지 조립 시 i18n 번역이 누락되지 않도록 수정 필요


### HOTFIX_USER_FIX — 2026-04-14 16:13
- done — 전 타입 일반화(select/number/text/paragraph/checkbox/file) + [입력 출력 형식 반영] 버튼 disabled 가드. test 31/31 PASS


### HOTFIX_USER_VERIFY — 2026-04-14 15:58
- CR — (1) 같은 이슈가 '숫자' 입력 타입에서도 재현됨 (Dev가 사전 경고한 범위 외 케이스 실증) (2) [입력 출력 형식 반영] 버튼이 필수 입력 사항 누락 상태에서도 클릭 가능 — 필드 정의부·출력 형식부 양쪽이 정합 상태일 때만 활성화되어야 함


### BUG_TRIAGE — 2026-04-14
- P1, Lightweight 시작 (Dev가 근본 계층 판단; 원본 광범위 수정 시 에스컬레이션)

### HOTFIX_IMPL — 2026-04-14 (Dev)
- Lightweight 범위 내에서 프론트 선제 가드(전략 A)로 완결. 백엔드 원자성은 별건 에스컬레이션.

### HOTFIX_USER_FIX — 2026-04-14 (Dev, CR 재수정)
- CR1 (모든 입력 타입에 대한 옵션·기본값 무결성 체크 일반화) + CR2 ([입력·출력 형식 반영] 버튼 disabled 조건) 동시 처리. 타입별 규칙 테이블로 일반화. 31/31 테스트 통과.

## Dev Agent Record

### 1. 원인 계층 판정 (증거 포함) — **전략 A + 프론트 선제 가드**

- **에러 문자열 출처 = 백엔드**
  - `api/core/app/app_config/easy_ui_based_app/variables/manager.py:150` `ValueError("default value in user_input_form must be in the options list")` — Dify 원본.
- **저장 요청 흐름 = 2단계 분할 (이중 상태의 구조적 원인)**
  - `web-edu/context/AgentWizardContext.tsx`의 `createAgent()` 함수에서:
    - 라인 759: `difyAPI.createAppWithConfig(createAppPayload)` → 에이전트 레코드 DB 커밋 (1단계, 성공).
    - 라인 828: `agentAPI.updateModelConfig(agentId, modelConfigPayload)` → `user_input_form` 백엔드 validation이 여기서 실행됨 → 400 응답.
  - 1단계가 커밋된 뒤 2단계에서 실패하므로 "에러 + 에이전트 생성됨" 이중 상태가 구조적으로 발생.
- **프론트 validation 상태**
  - `web-edu/schemas/agent-schema.ts:promptSettingsSchema`에 `select.options 필수`는 있었으나 **default-in-options 규칙은 없었음**. 또한 Step2→Step3 진입 시점의 가드만 존재하고, Step5 저장 시점의 최종 방어벽은 없었음.
- **결론**: 근본은 (C) 백엔드 원자성 미보장이지만, Dify 원본의 `/apps` + `/apps/{id}/model-config` 두 컨트롤러를 단일 트랜잭션으로 묶는 것은 광범위 수정이므로 Lightweight 범위 초과 → **에스컬레이션 사유**. 대신 (A) 프론트 선제 가드로 사용자 관점의 이중 상태를 원천 차단.

### 2. 수정 파일 목록

| 파일 | 변경 내용 |
|---|---|
| `web-edu/utils/user-input-form-validation.ts` (신규) | 백엔드 규칙과 동일한 `validateUserInputForm()` 유틸 — select options 필수 + default가 options에 포함 검증 |
| `web-edu/schemas/agent-schema.ts` (L66–L89) | Zod 스키마에 `selectDefaultMustBeInOptions` 규칙 추가 |
| `web-edu/components/agent/wizard/UserInputFormBuilder.tsx` (L307–L403) | select 타입의 default 인풋을 텍스트 → `<select>` 드롭다운으로 변경. options 변경 시 기존 default가 목록에 없으면 자동 초기화. 옵션 없으면 default 비활성화 + 붉은 경고. |
| `web-edu/context/AgentWizardContext.tsx` (L32, L594–L614) | `createAgent()` 진입 직후 최종 가드 — 실패 시 API 요청 자체 차단, Step2로 복귀, 토스트 표시 |
| `web-edu/i18n/ko-KR/agent.json`, `en-US/agent.json` | `selectDefaultMustBeInOptions`, `userInputFormInvalid` 키 추가 |
| `web-edu/__tests__/utils/user-input-form-validation.test.ts` (신규) | 12개 단위 테스트 (경계/회귀 포함) |

### 3. 수정 접근 (선택 전략 + 근거)

**선택: (A) 프론트 UX 가드 강화 단독 (근본 해결 수준)**

근거:
- 백엔드 수정 옵션 (C)는 Dify 원본 `/apps`와 `/apps/{id}/model-config` 두 컨트롤러를 단일 트랜잭션으로 묶거나, 앞단에서 user_input_form을 선검증해 앱 생성 자체를 막는 수정이 필요함. 이는 Dify 핵심 앱 생성 경로를 건드리는 광범위 수정이고 `project-context.md`의 "Dify 원본 최소 수정" 원칙에 어긋남 → 에스컬레이션.
- (A) 프론트 선제 가드는 단순 메시지 개선이 아니라 **네트워크 요청 자체를 차단**하므로 사용자 관점의 이중 상태(에러 + 에이전트 생성됨)를 원천 방지. 추가로 `UserInputFormBuilder`에서 default 인풋을 options 드롭다운으로 구조적으로 제한해 사용자가 구조적 불일치를 "입력하는 것 자체가 불가능"하게 만듦.
- 편집 경로도 동일한 `createAgent()` 함수를 쓰므로 가드가 일관되게 적용됨.

### 4. 품질 검사 결과 (Scoped)

- **단위 테스트**: `npx jest --testPathPatterns="user-input-form-validation"` → **12/12 PASS** (0.5s)
- **ESLint** (변경 5개 파일): 위반 0건
- **type-check**: 변경 파일 관련 타입 에러 0건 (기존 프로젝트의 사전 존재 에러들은 제외 — 이 hotfix와 무관)

### 5. Regression 테스트 케이스 (단위 테스트에 포함)

- select + options 비어있음 → `selectOptionsRequired` 에러 발생
- select + options 비어있음 + default 있음 (**핵심 버그 재현**) → options 에러 우선 감지
- select + options 있음 + default가 목록에 없음 → `selectDefaultMustBeInOptions` 에러 발생
- select + options 있음 + default가 목록 중 하나 → 정상 통과
- select + options 있음 + default 비어있음/undefined → 정상 통과 (default optional)
- 다른 타입(text-input, paragraph, number, checkbox, file) + default 값 유무 → 회귀 없음 (모두 통과)
- 여러 invalid select 필드 혼합 → 모든 에러 수집
- 단일 옵션 경계 케이스

### 6. 재현 검증 여부

- Dev 세션에서 앱 컨테이너 재배포 없이 실제 UI 재현은 수행하지 않음 (개발 서버 기동 생략).
- 단위 테스트로 validation 로직의 입력-출력 관계는 완전히 검증됨 (12/12 통과).
- 실제 UI 상의 E2E 재현은 사용자 재배포 후 확인 필요 (아래 User Briefing 참조).

### 7. User Briefing

**재배포 범위**: **web-edu만** 재빌드/재배포 (api 변경 없음).

```bash
# 재배포 (프로덕션)
make docker-rebuild  # 또는 web-edu만 재빌드 가능하다면 부분 재빌드

# 개발 재확인
cd web-edu && pnpm dev
```

**검증 절차**:
1. Agent 생성 마법사 → Step 2 "사용자 입력 폼"에 필드 추가 → Input Type을 "Select"로 변경.
2. **기대 (수정 전 버그)**: 이제 default 인풋이 텍스트 박스가 아닌 `<select>` 드롭다운으로 표시됨. options가 비어있으면 default 드롭다운이 비활성화되고 options 아래에 빨간 "옵션이 필요합니다" 경고가 뜸.
3. options에 값을 입력(예: `red, blue`) → default 드롭다운에 해당 값이 나타남.
4. options에서 값을 지우면 기존 default가 자동으로 비워짐.
5. 만약 오래된 localStorage 드래프트 등으로 선택 필드의 default가 options에 없는 상태로 Step 5까지 도달해도, "검토 및 저장" 클릭 시:
   - **수정 후 기대**: 네트워크 요청이 나가지 **않고**, 토스트 에러 + Step 2로 자동 복귀, 에이전트가 DB에 생성되지 않음.
6. 정상 케이스(options 있음 + default가 options 중 하나)에서 저장 → 정상 생성.
7. 편집 경로에서도 동일한 가드가 작동.
8. 다른 타입(텍스트, 숫자, 체크박스 등)은 회귀 없음.

### 8. 알려진 한계 및 에스컬레이션

- **백엔드 원자성 미보장은 남아있음**: 이 hotfix는 프론트 경로를 통한 접근에 한해 이중 상태를 차단한다. API를 직접 호출(외부 스크립트/curl)하거나 향후 다른 클라이언트가 추가되면 여전히 "1단계 createApp 성공 → 2단계 updateModelConfig 실패"로 이중 상태가 발생할 수 있다.
- **에스컬레이션 사유**: Dify 원본 `api/controllers/console/app/apps.py`와 `model_config.py`의 트랜잭션 경계를 통합하거나, `/apps` 생성 시점에 user_input_form까지 선검증하는 것이 근본 해결이나 이는 Dify 원본 광범위 수정에 해당 → **별건 hotfix로 리더 판단 대기**.
- select 외 다른 입력 타입에 동일 구조적 문제가 있는지 여부는 이번 스토리 범위 밖이다. 백엔드의 다른 필드에 대한 구조적 검증(예: number의 min/max 관계, checkbox의 default가 boolean-like여야 함 등)이 추가로 존재한다면 동일한 2단계-불일치 버그가 재발할 수 있다. 필요 시 별도 트리아지.
- 프론트 선제 가드는 백엔드 규칙을 "복제"한 것이므로, 향후 Dify 업스트림이 규칙을 바꾸면 프론트도 동기화가 필요하다 (drift 위험).

### HOTFIX_USER_FIX — 2026-04-14

#### CR1: 모든 입력 타입에 대한 옵션·기본값 무결성 체크 일반화

**설계 요지** — 타입별 규칙 테이블 (`Record<InputType, FieldValidator[]>`) + 타입과 무관한 공통 규칙(`COMMON_VALIDATORS`) 구조로 리팩터링. 호출자는 `validateUserInputForm(fields)` 한 번만 부르면 모든 필드의 모든 규칙이 적용됨. 새로운 타입이 추가되면 `KNOWN_INPUT_TYPES` + `TYPE_RULES`에 한 줄씩만 추가하면 됨. 알 수 없는 타입은 보수적으로 에러 처리(`unknownInputType`).

**커버한 타입 + 검증 규칙 요지**:

| 타입 | 검증 규칙 | 백엔드 출처 (규칙 복제) |
|---|---|---|
| (공통) | label 필수 | `manager.py:118-122` |
| (공통) | variable 필수 + 백엔드와 동일 정규식 (`^(?!\d)...`) | `manager.py:124-132` |
| (공통) | input_type ∈ KNOWN_INPUT_TYPES | `manager.py:113-115` (`_ALLOWED_VARIABLE_ENTITY_TYPE`) |
| (공통) | max_length 있으면 양의 정수 | `entities.py:115` (`max_length: int \| None`) |
| (공통) | variable 중복 금지 | (백엔드엔 명시 없음, 프론트 UX 가드) |
| select | options 비-비어있음 | `manager.py:142-147` |
| select | default 있으면 options에 포함 | `manager.py:149-150` |
| number | default 있으면 `Number.isFinite` | (사용자 CR 2026-04-14 보고) |
| number | options 잔여 금지 (select→number 회귀) | (UX, 백엔드 분기 외) |
| text-input | default 길이 ≤ max_length | `entities.py:115` 의존 |
| text-input | options 잔여 금지 | (UX) |
| paragraph | default 길이 ≤ max_length | 동일 |
| paragraph | options 잔여 금지 | (UX) |
| checkbox | options 잔여 금지 | (UX) |
| file | options 잔여 금지 | (UX, 메타 검증은 한계로 별도 보류) |

규칙 출처는 `web-edu/utils/user-input-form-validation.ts` 상단 주석 블록(L18-L33)에 파일:라인 매핑으로 명시했음. drift 추적에 사용.

**변경 후 단일 진실 공급원**: `web-edu/utils/user-input-form-validation.ts`. `agent-schema.ts`(Zod), `Step2PromptSettings.tsx`(버튼 disabled), `AgentWizardContext.createAgent()`(최종 가드) 모두 동일 유틸을 호출하므로 회귀와 drift 위험을 한 곳으로 모음.

#### CR2: [입력·출력 형식 반영] 버튼 활성화 조건 수정

- **버튼 위치**: `web-edu/components/agent/wizard/Step2PromptSettings.tsx` (i18n 키 `promptSettings.generateTemplateButton` / `regenerateTemplateButton`, 한국어 라벨 "입력·출력 형식 반영"). 기존 `generatePromptTemplate` 함수.
- **disabled 조건**: `validateUserInputForm(userInputFormFields).length === 0` AND `outputFormatValid`. `outputFormatValid`는 `outputFormat`이 정의돼 있을 때 `format_type`별 sub-format(`text_format` 등)이 채워져 있는지 확인 (현재 UI상 text + markdown/plain_text/html만 활성).
- **보조 텍스트**: disabled 시 `templateApplyDisabledReason` + 첫 번째 에러의 `(variable: 구체적 메시지)` 를 빨간 경고로 노출. 같은 사유 문자열을 `title` 속성에 반영해 hover tooltip으로도 표시.

#### 수정 파일 목록

| 파일 | 변경 |
|---|---|
| `web-edu/utils/user-input-form-validation.ts` (전면 리팩터링) | 타입별 규칙 테이블(`TYPE_RULES`) + 공통 규칙(`COMMON_VALIDATORS`) + variable 중복 검사. KNOWN_INPUT_TYPES로 알 수 없는 타입 차단 |
| `web-edu/schemas/agent-schema.ts` (L7-L9, L57-L73) | `superRefine`이 새 유틸 한 번만 호출하도록 단순화. select 전용 분기 제거 → 모든 타입 자동 커버 |
| `web-edu/components/agent/wizard/UserInputFormBuilder.tsx` (L99-L142, L307-L370) | `handleFieldChange` input_type 전환 시 default/options 잔여 정리. number 타입 default를 `<input type="number">`로 한정. text-input/paragraph는 max_length가 있으면 길이 카운터 + 초과 시 빨간 경고 |
| `web-edu/components/agent/wizard/Step2PromptSettings.tsx` (L11-L19, L432-L490) | 버튼 disabled 조건 + tooltip + 보조 텍스트(`templateApplyDisabledReason` / `outputFormatInvalid`) |
| `web-edu/i18n/ko-KR/agent.json` (validation 섹션) | `defaultExceedsMaxLength`, `optionsNotAllowedForType`, `unknownInputType`, `duplicateVariable`, `outputFormatInvalid` 키 추가 |
| `web-edu/i18n/en-US/agent.json` (validation 섹션) | 위 신규 키 + 기존 한국어에만 있던 `numberDefaultMustBeNumeric`/`numberMustNotHaveOptions`/`maxLengthMustBePositiveInteger`/`templateApplyDisabledReason` 영어 번역 추가 (i18n 동기화) |
| `web-edu/__tests__/utils/user-input-form-validation.test.ts` (전면 확장) | 31개 케이스: 공통 규칙 6, select 7, number 5, text/paragraph 5, checkbox/file 4, basic/empty 2, firstValidationError 2 |

#### 테스트 결과

- `npx jest --testPathPatterns="user-input-form-validation"` → **31/31 PASS** (~0.5s)
- ESLint (5개 변경 파일) → 위반 0건
- type-check → 변경 파일 관련 에러 0건 (기존 사전 존재 에러는 무관)

기존 select 12건 동등성: 핵심 케이스(`selectOptionsRequired`, `selectDefaultMustBeInOptions`, default 매칭/미설정/단일 옵션 경계, 다중 invalid 수집)는 모두 유지·통과. 부수적으로 `f({…})` 팩토리로 케이스 작성 부담 경감.

#### 재배포 범위

**web-edu만** 재빌드/재배포 (api 미수정).

```bash
make docker-rebuild   # 또는 web-edu만 부분 재빌드
```

#### 알려진 한계 (HOTFIX_USER_FIX 누적)

1. **백엔드 원자성 미보장**: 직전 라운드와 동일. API 직접 호출 경로는 여전히 이중 상태 가능. 별건 hotfix로 리더 판단 대기.
2. **Drift 위험 (확장)**: 이번에 더 많은 타입 규칙을 프론트에서 복제했으므로 업스트림이 `manager.py` / `entities.py`를 변경하면 동기화 비용도 비례 증가. 출처 주석(파일:라인)으로 추적성을 확보했으나 자동화는 없음.
3. **file 타입 메타 검증 미구현 (스코프 한계)**: 백엔드 `entities.py:117-119`의 `allowed_file_types` / `allowed_file_extensions` / `allowed_file_upload_methods`는 외부 스토리지 정책·테넌트 설정에 의존하는 부분이 있어 프론트 복제가 비용 대비 실효성이 낮음. 우리 `UserInputFormBuilder` UI도 file 메타를 노출하지 않으므로 본 hotfix에서는 옵션 잔여 검사만 적용하고 메타는 별건으로 보류.
4. **알 수 없는 새 입력 타입 처리**: `KNOWN_INPUT_TYPES`에 없는 타입은 `unknownInputType`로 거부 (보수적 가드). 향후 백엔드가 새 타입을 추가하면 프론트 갱신 전까지 해당 타입 사용이 막힘 — 명시적 trade-off (조용히 통과시키는 것보다 안전).
5. **출력 형식 정의부 validation은 최소 가드**: `Step2PromptSettings.tsx` 인라인 로직으로 `format_type`별 sub-format 존재만 확인. 현재 UI에서 image/audio/file은 비활성이므로 실효 영역은 text·sub-format. OutputFormatBuilder에 본격적인 validation 모듈을 두는 것은 별건 개선으로 보류.

#### 에스컬레이션

새로 발생한 에스컬레이션 사유 없음. (직전 라운드의 백엔드 원자성 미보장은 여전히 유효, 별건 hotfix 대기 상태)

### HOTFIX_USER_FIX — 2026-04-14 (CR3, i18n)

#### 원인

`user-input-form-validation.ts`의 `messageKey`가 `'agent.validation.selectOptionsRequired'`처럼 **`agent.` 네임스페이스 접두사를 포함한 전체 경로**로 반환됐다. 호출부(`Step2PromptSettings.tsx:458`, `AgentWizardContext.tsx:592`)는 `useTranslation('agent')`로 이미 `agent` 네임스페이스에 바인딩돼 있었기 때문에, `t(err.messageKey)` 실제 조회 경로가 `agent.agent.validation.selectOptionsRequired`가 되어 key miss → i18next가 raw 키를 그대로 반환 → 사용자에게 `agent.validation.selectOptionsRequired`가 노출됐다. 직전 HOTFIX_USER_FIX에서 버튼 보조 텍스트 조립부에 `(variable: 사유)` 템플릿을 추가하면서 처음으로 이 경로가 사용자 가시 영역으로 드러났다.

#### 수정 파일 목록

| 파일 | 변경 |
|---|---|
| `web-edu/utils/user-input-form-validation.ts` | 모든 `messageKey` 리터럴에서 `agent.` 접두사 제거 (`'agent.validation.xxx'` → `'validation.xxx'`). `UserInputFormValidationError.messageKey`의 JSDoc에 "agent 네임스페이스 상대 경로" 계약 명시 + 회귀 발생 배경 주석 추가. |
| `web-edu/__tests__/utils/user-input-form-validation.test.ts` | 기존 31개 케이스의 assertion을 신규 계약(접두사 없음)에 맞춰 갱신. CR3 회귀 방지용 2개 신규 케이스 추가: (1) 모든 에러의 messageKey가 `agent.`로 시작하지 않고 `validation.`로 시작함, (2) 모킹된 t() 바인딩에서 raw 키가 흘러나오지 않음. |

호출부(`Step2PromptSettings.tsx`, `AgentWizardContext.tsx`, `schemas/agent-schema.ts`)는 변경 없음 — 계약 쪽(util)만 정정했으므로 호출 코드는 그대로 동작한다.

#### 동일 패턴 잔여 여부

**Step2PromptSettings.tsx의 react-hook-form errors 렌더 3곳은 동일한 잠재적 raw 노출 위험이 있다**:

- `Step2PromptSettings.tsx:336` — `{errors.pre_prompt.message}` — Zod 스키마가 `'agent.validation.promptMinLength'` / `'agent.validation.promptTooLong'`를 message로 넣음 (`schemas/agent-schema.ts:44-45`)
- `Step2PromptSettings.tsx:360` — `{errors.opening_statement.message}` — 동일하게 `'agent.validation.openingStatementTooLong'` (`L56`)
- `Step3ModelConfig.tsx:913` — `{errors.completion_params.max_tokens.message}` — 이쪽은 `'validation.maxTokensTooLarge'` (접두사 없음, `L104`)로 현재 render 경로 확인 필요

→ Step2의 두 곳은 사용자가 prompt 10자 미만/4000자 초과/opening 500자 초과 상태로 에러를 띄울 때 raw 키가 노출될 가능성이 있다. 다만 이번 CR3 사용자 보고 범위 밖이고, 수정이 Zod message 구조(i18n 키 담지 말고 렌더 지점에서 t() 경유로 변환)에 손을 대야 해서 회귀 위험이 있다. **별건 micro-hotfix로 리더 판단 대기**로 보고한다 (이번 스코프에 포함하지 않음).

그 외 `validateUserInputForm`을 쓰는 모든 경로(`Step2PromptSettings.tsx:458`, `AgentWizardContext.tsx:592`)는 이번 util 수정으로 동시 해결된다.

#### 테스트 결과

- `npx jest --testPathPatterns="user-input-form-validation"` → **33/33 PASS** (기존 31 + CR3 회귀 방지 2, ~0.5s)
- ESLint (변경 2개 파일) → 위반 0건
- type-check → 변경 파일 관련 에러 0건

#### 재배포 범위

**web-edu만** 재빌드/재배포 (api 미수정).

```bash
make docker-rebuild   # 또는 web-edu만 부분 재빌드
```

#### 에스컬레이션

- 새로 발생한 강제 에스컬레이션 없음
- 참고 보고: Step2의 react-hook-form `errors.*.message` raw 키 노출 가능성 (pre_prompt/opening_statement) — 별건 micro-hotfix 후보로 리더 판단 대기. 현재 CR3은 사용자가 재현한 버튼 보조 텍스트만 고정 수정.

### HOTFIX_USER_FIX — 2026-04-14 (CR4, 괄호 제거)

#### 원인 (사용자 보고 기반 표현 정리)

CR2에서 도입한 버튼 보조 텍스트 조립 템플릿 `"${안내문} (${variable}: ${사유})"`의 괄호 부분이 사용자에게 "기술적 진단 메시지가 같이 노출되어 시끄럽다"는 인상을 준다. per-field 오류는 이미 `UserInputFormBuilder`가 필드 바로 아래에 표시하므로 버튼 레벨에서는 게이팅 안내 한 문장이면 충분하다. CR4는 뒷쪽 `(variable: 사유)` 괄호 블록을 제거하고 앞 안내 문장만 노출한다.

#### 변경 지점

- `web-edu/components/agent/wizard/Step2PromptSettings.tsx`
  - L15–L17: 미사용이 된 `firstValidationError` import 제거 (named import → 단일 import로 축약)
  - L455–L461 (변경 전 L455–L461, 변경 후 주석 포함 L455–L466): `disabledReason` 삼항 조립에서 괄호 블록 제거. `firstErr` 지역 변수 및 `firstValidationError(...)` 호출 삭제. 변경 근거 주석 추가.

#### tooltip 선택 (A/B)

- **선택 A — tooltip도 앞 문장만 (보조 텍스트와 동일)** 채택
- 근거: 기존 코드가 `title={buttonDisabled ? disabledReason : undefined}`로 **단일 `disabledReason` 문자열**을 tooltip과 보조 텍스트 양쪽에 공유한다. tooltip만 상세 유지(선택 B)하려면 별도 `disabledTooltip` 변수와 별도 조립 분기가 필요해, 요구사항 "괄호 제거 외 다른 변경 금지"에 반한다. per-field 상세 오류 채널(`UserInputFormBuilder`)이 이미 존재하므로 tooltip 중복 정보 유지의 실효가 낮다.

#### 출력 형식 쪽 동반 변경 여부

- **없음**. 출력 형식 분기(`!outputFormatValid`)는 `t('validation.outputFormatInvalid')`만 사용하며 `(변수명: 사유)` 괄호 패턴이 원래 존재하지 않는다 (i18n 키 1개 고정 문구). 일관성 확인용 점검 결과 동반 변경 대상 아님.

#### 수정 파일 목록

| 파일 | 변경 |
|---|---|
| `web-edu/components/agent/wizard/Step2PromptSettings.tsx` | `disabledReason` 조립에서 괄호 블록 제거. 미사용이 된 `firstValidationError` import 및 `firstErr` 지역 변수 제거. CR4 근거 주석 추가. |

- i18n 키 변경 없음 (`templateApplyDisabledReason` 원문 그대로 사용, 기존 ko/en 번역값이 "입력 폼이 유효해야 …" 문장이라 그대로 재활용 가능)
- validation 유틸/Zod 스키마/단위 테스트 assertion 변경 없음 (스코프 엄격 준수)

#### 테스트 결과

- `npx jest --testPathPatterns="user-input-form-validation"` → **33/33 PASS** (CR3 카운트 그대로 유지, ~0.4s) — 보조 텍스트 변경은 util 단언에 영향 없음
- ESLint (변경 파일 `Step2PromptSettings.tsx`) → 위반 0건
- type-check (`tsc --noEmit`, 변경 파일 필터) → 에러 0건

#### 재배포 범위

**web-edu만** 재빌드/재배포 (api 미수정).

```bash
make docker-rebuild   # 또는 web-edu만 부분 재빌드
```

#### 에스컬레이션

- 새로 발생한 강제 에스컬레이션 없음
- 기존 참고 보고(Step2의 `errors.*.message` raw 키 노출 가능성)는 여전히 별건 micro-hotfix 후보로 리더 판단 대기.

