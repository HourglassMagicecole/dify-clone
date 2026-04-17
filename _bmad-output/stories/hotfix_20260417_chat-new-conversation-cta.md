# Hotfix: 에이전트 채팅 — 새 대화 생성 CTA 시인성 개선

## 증상
web-edu 대화형 에이전트 채팅 페이지(`/agents/{id}/chat`)에서 "새 대화 생성" 버튼(`+`)의 시인성과 행동 유도력이 약함.

- 현재 `+` 버튼은 좌측 사이드바 `대화 기록` 타이틀 **우측**의 작은 영역에만 존재 (`ConversationHistory.tsx` 56–65행)
- 중앙 빈 상태 박스에는 "먼저 대화를 선택하거나 없을 시에는 새 대화를 생성하세요" 안내만 있고, 박스 내부에서 **클릭으로 바로 새 대화를 생성할 수 있는 CTA가 없음** (`MessageList.tsx` 88행 주변)
- 결과: 신규 사용자가 첫 대화 시작 경로를 즉각 발견하기 어려움 (핵심 경로 UX 저하)

## 원인 (추정 — HOTFIX_IMPL에서 확정)
초기 UI 설계가 "히스토리 사이드바 헤더 우측 아이콘" 일반 패턴을 따랐으나, 안내 박스와 버튼 위치가 분리되어 있어 사용자 시선 흐름과 CTA 위치가 맞지 않음.

## 수정 범위 (추정)
- `web-edu/components/chat/ConversationHistory.tsx`
  - `+` 버튼을 `대화 기록` 타이틀 **하단**으로 이동, 버튼 가로폭을 사이드바 너비(패딩 제외)에 맞춰 확장
  - 버튼 내부 레이블은 `+` 아이콘 + 접근성 라벨(`aria-label={t('newConversationButton')}`) 유지. 시인성 확보 위해 텍스트 병기 여부는 Dev 판단(기존 i18n 키 `newConversationButton` = "새 대화" 재활용 권장)
- `web-edu/components/chat/MessageList.tsx`
  - 빈 상태 박스(`!hasConversationSelected && messages.length === 0 && !isStreaming`) 내부에 "새 대화 생성" 버튼/클릭 영역 추가
  - `onNewConversation?: () => void` prop 추가 (optional — 기존 사용처 호환)
- `web-edu/app/(student)/agents/[id]/chat/page.tsx`
  - `<MessageList>`에 `onNewConversation={handleNewConversation}` prop 전달
- 관련 테스트:
  - `web-edu/__tests__/components/chat/ConversationHistory.test.tsx` (버튼 위치/너비 회귀 방지)
  - `web-edu/__tests__/components/chat/MessageList.test.tsx` (빈 상태 CTA 클릭 → onNewConversation 호출)

## AC (Acceptance Criteria)
- [x] `대화 기록` 타이틀 **하단**에 "새 대화 생성" 버튼이 배치됨 (구현 완료, DOM 순서 회귀 테스트로 가드)
- [x] 해당 버튼이 사이드바 좌우폭(헤더 패딩 제외)을 **가득** 채우는 넓이로 렌더됨 (`w-full`, 회귀 테스트 추가)
- [x] 빈 상태 박스("먼저 대화를 선택하거나 없을 시에는 새 대화를 생성하세요") 안에서 **클릭으로 신규 대화 생성 가능** (기존 `handleNewConversation`과 동일 동작)
- [x] 빈 상태 CTA 클릭 시: 서버에 새 대화 생성 → 자동 선택 → `opening_statement` 있으면 표시 → MessageInput 노출 (기존 흐름 재사용)
- [x] 스트리밍 중 CTA 클릭 시 기존 `streamingWarning.switchConversation` 확인 대화 동일하게 동작 (`handleNewConversation` 재사용이므로 자동 유지)
- [x] 대화 선택/삭제, `← 목록`, `에이전트 정보`, `대화 내보내기` 등 기존 기능 영향 없음 (수정 스코프 제한)
- [x] 키보드 접근성(Tab/Enter/Space) 유지, `aria-label` 존재 (네이티브 `<button>` 시맨틱 + `aria-label={t('newConversationButton')}`)
- [x] scoped lint / type-check / jest 통과, regression test 추가 (Jest 33/33, 회귀 7건 추가)

## User Briefing
### 확인 방법
1. `cd web-edu && pnpm dev` (localhost:3001)
2. 에이전트 채팅 페이지 접속 (`/agents/{agent_id}/chat`)
3. 좌측 사이드바에서 `대화 기록` 타이틀 **아래**에 새 대화 버튼이 **가로로 넓게** 표시되는지 확인
4. 대화 기록이 없는 상태에서 중앙 박스 안을 **클릭**해 새 대화가 즉시 생성되고 입력창이 나타나는지 확인
5. 기존 대화 선택/삭제, 스트리밍 중 전환 경고 등 기존 동작 확인

### 알려진 제약사항
- 시각적 변경이라 Jest DOM 단언(클래스/prop) 수준에서만 회귀 방지. 실제 폭/정렬 픽셀 확인은 사용자 브라우저 검증에 의존.

## Lifecycle Log

### HOTFIX_USER_VERIFY — 2026-04-17 10:49
- Approved — make deploy-web 재배포 후 브라우저 검증 통과


### HOTFIX_IMPL — 2026-04-17 10:14
- done — lint PASS, type-check PASS (scoped), jest 33/33 PASS, regression test 7건 추가

### BUG_TRIAGE — 2026-04-17
- P1, Lightweight 경로 선택, 최소 스토리 작성 완료

## Dev Agent Record

### 수정 파일
- `web-edu/components/chat/ConversationHistory.tsx` (L53–L68)
  - 헤더 레이아웃을 `flex justify-between`에서 `flex flex-col gap-2 justify-center`로 전환 — 타이틀 아래에 버튼을 쌓는 구조
  - 헤더 패딩 `p-4` → `px-4 py-3`로 축소, 타이틀 폰트 크기 `text-sm`으로 조정하여 `h-[85px]` 고정 높이(중앙 헤더와 정렬) 안에 두 행 수용
  - 버튼 클래스를 `w-full flex items-center justify-center gap-1 px-3 py-1.5 ... rounded text-sm font-medium transition-colors`로 교체 — 사이드바 좌우폭(패딩 제외)을 가득 채움
  - 레이블을 `+` 아이콘 + `{t('newConversationButton')}` 텍스트 병기로 변경 (아이콘은 `aria-hidden="true"`로 스크린리더 중복 방지, `aria-label`은 그대로 유지)
- `web-edu/components/chat/MessageList.tsx` (L14–L31, L88–L117)
  - `MessageListProps`에 `onNewConversation?: () => void` optional prop 추가 (하위 호환)
  - 빈 상태 박스(`!hasConversationSelected && messages.length === 0 && !isStreaming`)를 `onNewConversation` 제공 여부에 따라 두 가지로 분기
    - 제공 시: `<button type="button">`으로 박스 전체를 클릭 가능한 CTA로 변환, `aria-label={t('newConversationButton')}`, 안내 문구 하단에 `+ 새 대화` 강조 라벨 추가, hover/focus 스타일(`hover:bg-blue-100`, `focus:ring-2`) 부여 — Enter/Space는 기본 버튼 시맨틱으로 커버됨
    - 미제공 시: 기존 `<div>` 안내 박스 그대로 유지 (레거시 호출자 호환)
- `web-edu/app/(student)/agents/[id]/chat/page.tsx` (L785)
  - `<MessageList>`에 `onNewConversation={handleNewConversation}` prop 전달 — 기존 `handleNewConversation` 로직(스트리밍 중 확인 → 서버 생성 → 자동 선택 → opening_statement → MessageInput 노출) 그대로 재사용
- `web-edu/__tests__/components/chat/ConversationHistory.test.tsx` (+62줄, 3건 신규 it)
  - 타이틀과 버튼이 같은 헤더 컨테이너 안에 있고, `compareDocumentPosition`으로 버튼이 타이틀 다음에 배치되는지 DOM 순서 단언
  - 버튼에 `w-full` 클래스가 존재하는지 단언 (사이드바 너비 가득 채움)
  - 재배치 후에도 클릭 시 `onNewConversation`이 정확히 1회 호출되는지 단언
- `web-edu/__tests__/components/chat/MessageList.test.tsx` (+76줄, 4건 신규 it)
  - `hasConversationSelected=false, messages=[]` 상태에서 빈 상태 CTA 클릭 시 `onNewConversation` 콜백 호출
  - CTA가 `<button>` 태그로 렌더되고 `newConversationButton` aria-label을 가지며, 기존 안내 문구(`selectConversation`)도 유지되는지 확인
  - `onNewConversation` 미제공 시 CTA 버튼이 렌더되지 않고 기존 안내 박스가 유지되는지 — 하위 호환 가드
  - 대화가 선택된 이후에는 CTA가 더 이상 렌더되지 않고 `noMessages` 상태로 전환되는지 확인

> i18n은 기존 `newConversationButton` 키("새 대화" / "New Conversation")를 그대로 재활용했으므로 `ko-KR/chat.json`, `en-US/chat.json`은 변경하지 않았습니다.

### 근본 원인 요약
기존 UI는 "히스토리 사이드바 헤더 우측 아이콘" 일반 패턴을 따라 `+` 버튼을 작은 정사각형(약 28x24px)으로 타이틀 우측에 배치했는데, (a) 시선이 타이틀 텍스트에서 오른쪽으로 이동하며 아이콘만 있는 버튼은 저시인성, (b) 중앙 빈 상태 박스의 "먼저 대화를 선택하거나 없을 시에는 새 대화를 생성하세요" 안내는 **텍스트일 뿐 클릭 대상이 아니었음** — 즉 사용자에게 "CTA가 어디에 있는가"를 추측하게 만드는 구조. 핵심 경로(첫 대화 시작)의 CTA는 (1) 현저하게 넓고 잘 보이는 버튼, (2) 안내 문구가 있는 위치에서 바로 액션 가능 두 조건이 동시에 충족되어야 하며, 본 수정은 두 축 모두를 만족시킨다: 사이드바 풀-너비 버튼(아이콘+텍스트 병기) + 중앙 안내 박스 자체를 버튼화.

### 품질 검사 결과
| 검사 | 명령 | 결과 |
| --- | --- | --- |
| ESLint (변경 파일) | `npx eslint components/chat/ConversationHistory.tsx components/chat/MessageList.tsx 'app/(student)/agents/[id]/chat/page.tsx' __tests__/components/chat/ConversationHistory.test.tsx __tests__/components/chat/MessageList.test.tsx` | PASS — 0 error. `chat/page.tsx`에 기존 `<img>` 관련 warning 1건이 있으나 수정 스코프 밖 |
| TypeScript (변경 파일 필터) | `pnpm type-check \| grep -E "(ConversationHistory\|MessageList\|chat/page)"` | PASS (scoped) — 소스 파일 3개(`.tsx`) 에러 0건. 테스트 파일에 기존부터 존재하던 `Conversation` 타입 누락 필드(`agentId`, `createdAt`) · `Message | undefined` 인덱싱 에러가 있으나 이번 핫픽스 이전부터 존재했고 추가 회귀 케이스에는 해당 없음 |
| Jest (변경 테스트 2개) | `pnpm test -- __tests__/components/chat/ConversationHistory.test.tsx __tests__/components/chat/MessageList.test.tsx` | PASS — 2 suites / 33 tests (기존 26 + 회귀 7 추가) |

### Regression test 판단 근거
시각 이슈이지만 회귀가 발생할 주요 경로는 DOM 구조에서 결정론적으로 단언 가능: (1) **DOM 순서** — 버튼이 타이틀 다음에 오는지(`compareDocumentPosition`), (2) **레이아웃 클래스** — 버튼이 `w-full` 너비인지, (3) **콜백 연결** — 레이아웃 변경에도 클릭 핸들러가 정상 바인딩되는지, (4) **CTA 버튼화** — 빈 상태 박스가 `<button>`이 되고 클릭 시 `onNewConversation`을 호출하는지, (5) **하위 호환** — `onNewConversation` 미제공 시 기존 `<div>` 안내 박스가 유지되는지, (6) **조건부 렌더** — 대화 선택 후 CTA가 사라지고 `noMessages`가 표시되는지. 이 6축(7건의 `it`)은 의도치 않게 레이아웃이 원상 복귀되거나 prop wiring이 끊어지는 회귀를 차단한다. 픽셀 단위의 너비·정렬은 사용자 브라우저 육안 검증에 의존.

### User Briefing
#### 실행 방법
```bash
cd web-edu && pnpm dev   # localhost:3001
```
브라우저에서 `http://localhost:3001/agents/{agent_id}/chat` 열기 (세션에 에이전트가 하나 이상 있어야 함).

#### AC별 확인 포인트
1. **AC1 — 버튼 위치**: 좌측 사이드바 상단에 `대화 기록` 타이틀이 있고, 그 **바로 아래**에 파란색 `+ 새 대화` 버튼이 보여야 함.
2. **AC2 — 버튼 너비**: 해당 버튼이 사이드바 좌우 패딩을 제외한 **가로 전체**(약 240px 내외)로 뻗어야 함. 우측에 짜부러져 있으면 회귀.
3. **AC3/AC4 — 빈 상태 CTA**: 대화 기록이 전혀 선택되지 않은 상태에서 중앙의 💬 박스가 **hover 시 배경이 진해지며** 마우스 포인터가 손가락으로 바뀌어야 함. 박스를 클릭하면 즉시 (a) 좌측 목록에 새 대화 추가, (b) opening_statement가 있으면 중앙에 표시, (c) 하단에 `MessageInput`이 노출되어야 함.
4. **AC5 — 스트리밍 중 전환**: 다른 대화에서 응답 스트리밍 중 좌측 `+ 새 대화` 버튼 또는 박스 클릭 시 기존 확인 다이얼로그("응답 생성 중입니다 ... 계속하시겠습니까?")가 뜨는지.
5. **AC6 — 기존 기능**: 대화 선택/삭제, `← 목록` 버튼, `에이전트 정보` 모달, `대화 내보내기` 다운로드 등이 종전 그대로 동작하는지.
6. **AC7 — 키보드**: Tab으로 `+ 새 대화` 버튼 또는 빈 상태 박스에 포커스가 들어가는지. Enter/Space로 동일하게 새 대화가 생성되는지 (브라우저 기본 `<button>` 시맨틱으로 커버됨).

#### 주의
- 이 변경은 `(student)` 경로의 에이전트 채팅 페이지만 타겟입니다. 동일 컴포넌트를 다른 경로에서 import하더라도 `onNewConversation`을 전달하지 않으면 빈 상태 박스는 기존 `<div>` 안내 박스로 렌더되어 시각적 영향이 없습니다. 즉, 다른 경로에서 새로운 CTA 동작이 **켜지지 않습니다** — 의도적인 opt-in 구조입니다.
- 헤더 높이(`h-[85px]`)는 유지하여 중앙 헤더와 상단선이 정렬되도록 했습니다. 타이틀 폰트와 패딩을 미세 조정해 두 행이 들어가게 했으므로, 추후 사이드바 너비/헤더 높이를 변경할 경우 이 공간 배분을 재검토해야 합니다.
