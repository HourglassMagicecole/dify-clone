# Hotfix: 작업형 에이전트 실행 화면에서 select 필드의 default 값이 미리 채워지지 않음

## 증상
작업형 에이전트 실행 페이지(`/agents/{id}/execute`)에서 사용자 입력 폼이 렌더될 때, **"선택(select)"** 타입 필드의 `default` 값이 드롭다운의 초기값으로 반영되지 않음. 사용자가 매번 드롭다운을 펼쳐 직접 값을 선택해야 함.

## 재현 조건
- 작업형 에이전트 생성 → 사용자 입력 폼에 **"선택"** 타입 필드 추가 → options 2개 이상 입력 → default를 options 중 하나로 설정 → 저장
- `/agents/{id}/execute` 실행 페이지 진입
- **기대**: select 드롭다운이 default 값으로 초기화되어 표시
- **현재**: 비어 있거나 첫 항목이 선택된 상태로 사용자가 수동 선택해야 함

## 연관성 (직전 hotfix)
직전 hotfix `hotfix_20260414_agent-select-input-default`는 **생성/편집 단계의 validation**(default가 options에 포함 + 버튼 가드)에만 집중. **실행 페이지의 입력 폼 초기값 렌더는 다루지 않음** — 별개 영역의 regression 또는 사전 존재 버그일 가능성.

## 원인 가설 (HOTFIX_IMPL에서 Dev가 확정)
1. **실행 페이지 입력 폼 컴포넌트가 field.default를 초깃값으로 적용하지 않음** — state init 시 빈 값 / 또는 default 필드명 오배치(`default` vs `default_value` 등 매핑 오류)
2. **다른 타입과 default 적용 방식 불일치** — text-input/number 등은 default가 채워지지만 select 분기만 누락
3. **저장 페이로드 포맷 변경** — 직전 hotfix에서 validation 강화로 저장 포맷이 바뀌었고 실행 렌더러가 옛 포맷을 기대
4. **드롭다운 컴포넌트 prop 불일치** — `defaultValue` vs `value`(controlled) 혼용, React 초기화 타이밍 이슈

## 수정 범위 (추정)
- `web-edu/app/(student)/agents/[id]/execute/` 페이지 컴포넌트
- `web-edu/components/` 내 사용자 입력 폼 렌더러 / select 입력 필드 컴포넌트
- API 응답 구조 확인 (select 필드의 default 속성 경로)

## AC (Acceptance Criteria)
- [ ] 실행 페이지 입력 폼에서 select 필드의 default가 드롭다운 초깃값으로 반영
- [ ] 다른 타입(text-input/paragraph/number/checkbox)의 default 반영에 회귀 없음
- [ ] default가 비어있는 select 필드는 빈 상태로 남음 (강제 선택 아님)
- [ ] options 목록이 비어있는 가드 상태에서 저장된 잘못된 과거 데이터(있다면)에 의한 런타임 에러 방지
- [ ] 사용자가 드롭다운을 열어 다른 값을 선택하면 기존 상호작용 정상 동작

## User Briefing
### 확인 방법
1. `make deploy-web` 재배포 후 실행 페이지 진입
2. default가 설정된 select 필드가 드롭다운 초깃값으로 표시되는지 확인
3. default가 없는 select 필드는 빈 상태로 남아있는지
4. 실행 후 에이전트가 default 값을 실제 입력으로 받는지(submit 동작 회귀 없음)
5. 다른 타입 필드의 default는 기존대로 반영되는지

### 알려진 제약사항
- 백엔드 원자성 미보장(별건 대기)과 무관한 렌더 경로 문제.

## Lifecycle Log

### HOTFIX_USER_VERIFY — 2026-04-14 17:24
- Approved — make deploy-web 재배포 완료, 사용자 승인


### BUG_TRIAGE — 2026-04-14
- P1, Lightweight 시작 (Dev가 근본 계층 판단; 범위 초과 시 에스컬레이션)

### HOTFIX_IMPL — 2026-04-14 (Dev)
- Lightweight 범위 내, 프론트 단일 컴포넌트(`DynamicFormRenderer`) 수정으로 완결. 백엔드/응답 구조/직전 hotfix 회귀 모두 무관함을 확인.

## Dev Agent Record

### 1. 원인 계층 판정 (증거 포함)

**근본 원인: 프론트 폼 렌더러의 초기값 누락 (사전 존재 버그)**

- **증거 1 — 백엔드 응답 매핑은 정상**
  - `web-edu/app/(student)/agents/[id]/execute/page.tsx:132`
    - `default_value: (fieldData.default as string) || ''`
    - 백엔드 `default` 필드를 프론트 `default_value`로 변환하는 로직은 올바름. select 필드의 `options`도 `web-edu/app/(student)/agents/[id]/execute/page.tsx:133`에서 함께 전달됨.
- **증거 2 — `DynamicFormRenderer`가 schema의 default_value를 폼 초깃값에 주입하지 않음**
  - `web-edu/components/agent/DynamicFormRenderer.tsx:129-132` (수정 전)
    - `useForm({ resolver: zodResolver(zodSchema), defaultValues })` — 외부 `defaultValues` prop만 폼 초기값으로 사용. `formSchema[].default_value`는 어디에서도 폼 state에 주입되지 않음.
  - 페이지에서 넘어오는 `defaultValues`는 `executionState.currentInputs` (페이지 마운트 시 빈 객체 `{}`).
  - 따라서 select 드롭다운은 항상 빈 placeholder(`<option value="">선택하세요</option>`)에서 시작.
- **증거 3 — 다른 타입과의 비교**
  - text-input(L162), paragraph(L183), number(L206)는 `placeholder={field.default_value}`로 default를 **placeholder로만** 표시. 실제 form value도 비어 있음.
  - select(L217-244)는 placeholder 개념 없음 → 사용자에게 가장 두드러져 보임.
  - 결과적으로 select가 신고된 증상의 원인이고, 다른 타입은 "이미 동일하게 비어 있지만 placeholder 때문에 채워진 것처럼 보였을 뿐"이라 회귀로 인지되지 않음.
- **증거 4 — 직전 hotfix와의 관계**
  - 직전 hotfix(`hotfix_20260414_agent-select-input-default`)는 생성/편집 마법사(`UserInputFormBuilder`, `AgentWizardContext`, `agent-schema.ts`)와 validation util만 수정. 실행 페이지 렌더러는 건드리지 않음.
  - 백엔드 응답 포맷 변경도 없음. 본 버그는 사전 존재 버그가 별건으로 표면화된 것.
- **증거 5 — Reset 버튼은 default를 적용하고 있었음**
  - L307-317의 reset 버튼은 `setValue(field.variable, field.default_value || '')`로 default를 폼에 주입. 즉 **초기 마운트 시점에만** 누락됨이 확정됨.

### 2. 수정 파일 목록

| 파일 | 변경 내용 |
|---|---|
| `web-edu/components/agent/DynamicFormRenderer.tsx` | `useMemo`로 schema-derived defaults(`mergedDefaults`) 계산 후 `useForm`의 `defaultValues`로 주입. select 타입에 한해 `field.default_value`가 `field.options`에 포함될 때만 초깃값으로 적용. 외부 `defaultValues` prop이 우선순위 높음. `useEffect` 동기화 로직도 `mergedDefaults` 기준으로 변경. |
| `web-edu/__tests__/components/agent/DynamicFormRenderer.test.tsx` | Regression 테스트 6건 추가 (`Select field default value (hotfix)` describe 블록). |

### 3. Fallback 정책 (options에 없는 default 처리)

- **stale default 방어**: `field.default_value`가 `field.options`에 없으면 빈 값으로 fallback. 강제로 첫 옵션을 선택하지 않음.
- **default 미설정**: 빈 placeholder 그대로 유지. 사용자가 명시적으로 선택해야 함(필수 필드면 zod 검증으로 차단).
- **외부 defaultValues prop 우선**: rerun-from-history 등 호출자가 명시적으로 값을 전달하는 시나리오는 그대로 동작 (호출자 값이 schema default를 덮어씀).
- **다른 타입 회귀 차단**: select 외 타입(text/paragraph/number/checkbox/file)은 schema-derived default를 적용하지 않음. 기존 동작(placeholder만 표시) 보존.

### 4. 품질 검사 결과 (Scoped)

- **Jest 단위 테스트**: `pnpm jest --testPathPatterns="DynamicFormRenderer"` → **19/19 PASS** (0.852s)
  - 기존 13건 모두 통과 (회귀 없음)
  - 신규 6건 모두 통과
- **ESLint** (변경 2개 파일): 위반 0건
- **TypeScript type-check** (전체 프로젝트, 변경 파일 관련): 에러 0건

### 5. Regression 테스트 케이스 (신규 6건)

- select + default가 options에 포함 → 드롭다운 초깃값으로 반영 (핵심 AC)
- select + default 미설정 → 빈 상태 유지 (강제 선택 없음)
- select + default가 options에 없음(stale) → 빈 값 fallback (런타임 에러 없음)
- 외부 defaultValues prop이 schema default를 덮어씀 → rerun 시나리오 보존
- default 적용 후 사용자가 다른 값 선택 + submit → 사용자 입력값으로 정상 제출 (상호작용 회귀 없음)
- text-input/number 타입은 schema default를 폼 값으로 주입하지 **않음** → 다른 타입 회귀 차단 가드

### 6. 재현 검증 여부

- 단위 테스트 19/19로 입력-출력 관계는 완전히 검증됨.
- E2E 재현(앱 컨테이너 재배포 + 브라우저 검증)은 사용자 검증 단계에서 수행 필요.

### 7. User Briefing

**재배포 범위**: **web-edu만** 재빌드/재배포 (api/백엔드/직전 hotfix 영역 변경 없음).

```bash
make deploy-web   # 또는 cd web-edu && pnpm dev (개발 확인)
```

**검증 절차**:
1. select 타입 필드(options 2개 이상 + default를 options 중 하나로 설정)가 있는 작업형 에이전트 생성/편집.
2. `/agents/{id}/execute` 진입 → **드롭다운이 default 값으로 미리 선택되어 표시**되는지 확인.
3. default가 비어 있는 select 필드는 빈 placeholder("선택하세요")로 남아있는지.
4. 드롭다운을 열어 다른 값으로 변경 → submit 시 변경된 값으로 제출되는지.
5. 다른 타입(text-input/paragraph/number/checkbox/file) 동작이 이전과 동일한지 (placeholder 표시 등).
6. 만약 과거에 잘못 저장된 default(현재 options에 없는 값)가 있더라도 런타임 에러 없이 빈 상태로 시작하는지.

### 8. 알려진 한계

- **다른 타입의 default 미적용은 그대로 유지**: text-input/paragraph/number도 `default_value`가 폼 값에 주입되지 않고 placeholder로만 보인다. 이는 본 스토리 AC("다른 타입 회귀 없음")를 보수적으로 해석한 결과이며, 사용자/리더가 "다른 타입도 default가 실제 값으로 채워져야 한다"라고 판단하면 별건 hotfix로 처리 가능 (구조적으로는 동일한 `mergedDefaults` 계산에 분기 추가 한 줄로 일반화 가능).
- **select default가 placeholder 옵션과 충돌 없음**: 빈 값 옵션(`<option value="">`)은 default가 적용되지 않을 때만 선택 상태가 되므로 충돌 없음.
- **localStorage/draft 캐시**: 본 컴포넌트는 localStorage를 사용하지 않으므로 draft drift 위험 없음. 페이지 진입마다 백엔드 응답 + schema default로 새로 초기화.

### 9. 에스컬레이션 여부

- **없음**. Lightweight 범위 내에서 단일 컴포넌트의 6줄 + 테스트로 완결. 백엔드/Dify 원본 수정 불필요.
