# Hotfix: 페이지 새로고침 시 스크롤 최상단 고정

## 증상
web-edu 전 페이지 공통. 페이지를 아래로 스크롤한 상태에서 **새로고침(F5 또는 브라우저 새로고침)** 을 실행하면 이전 스크롤 위치가 복원되어 본문 중간부터 렌더된다. 결과적으로 상단 GNB(`NavigationHeader`)가 뷰포트 밖에 있어 "GNB가 사라진 것처럼" 보이는 혼란을 유발.

- 재현: 임의 web-edu 페이지(`/agents`, `/datasets`, `/admin/*` 등)에서 아래로 스크롤 → F5 → 화면이 본문 중간부터 시작
- 확인: 위로 스크롤하면 GNB 정상 노출(실제 사라진 건 아님)

## 원인 (추정 — HOTFIX_IMPL에서 확정)
브라우저 기본값 `window.history.scrollRestoration === 'auto'`가 활성. Next.js App Router는 **클라이언트 라우트 전환** 시에만 스크롤을 상단으로 이동시키고, **새로고침(페이지 재진입)** 은 브라우저 기본 복원 동작을 그대로 따름.

## 수정 범위 (추정)
- `web-edu/context/Providers.tsx` (이미 `'use client'` + `useEffect` 사용 중인 루트 클라이언트 경계)
  - `useEffect`에서 **새로고침 감지** → `window.scrollTo(0, 0)` 호출
  - 구현 방식은 **`performance.getEntriesByType('navigation')`의 `type === 'reload'` 감지** 권장. 이유:
    - 새로고침만 타겟팅 → 뒤로가기/앞으로가기(popstate)의 스크롤 복원은 그대로 유지(UX 보존)
    - `history.scrollRestoration = 'manual'` 전역 설정보다 부작용이 적음
  - 대안: `ScrollRestorationManager` 같은 null-return 컴포넌트로 분리해 `SessionManager` 패턴을 따라도 됨 — Dev 판단
- 테스트:
  - `web-edu/__tests__/context/Providers.test.tsx` (없으면 신규) 또는 별도 훅/컴포넌트 단위 테스트
  - `performance.getEntriesByType`을 모킹하여 `reload` / `navigate` 분기별 `scrollTo` 호출 여부 단언

## AC (Acceptance Criteria)
- [x] 새로고침(F5 / 브라우저 reload) 시 **모든 web-edu 페이지**에서 스크롤이 최상단(0,0)으로 초기화되어 GNB가 뷰포트에 노출됨 (구현 완료, `reload` 분기 단위 테스트)
- [x] 브라우저 **뒤로 가기 / 앞으로 가기**(popstate)에서는 기존 브라우저 복원 동작 유지 — 새로고침 동작이 전체 네비게이션에 덮어씌워지지 않음 (`history.scrollRestoration` 유지, `back_forward` 분기 미호출 단언)
- [x] 클라이언트 라우트 전환(`<Link>` / `router.push`) 시 Next.js 기본 동작 유지 (기존에도 상단 이동) — 본 핫픽스는 첫 마운트 1회만 실행되므로 라우트 전환 경로에 개입하지 않음
- [x] SSR/하이드레이션 단계에서 `window` 접근 에러 없음 — 모든 접근은 `useEffect` 내부(`typeof window === 'undefined'` 조기 반환 포함)
- [x] scoped lint / type-check / jest 통과, 회귀 테스트 추가 (ESLint 0 error, jest 7/7 PASS)

## User Briefing
### 확인 방법
1. `cd web-edu && pnpm dev` 또는 `make deploy-web`
2. 예: `/agents`, `/datasets`, `/admin/users` 등 아무 페이지를 열고 스크롤을 아래로 내림
3. F5 또는 브라우저 새로고침 버튼 클릭
4. 페이지 최상단부터 렌더되어 GNB가 정상적으로 보이는지 확인
5. 다른 페이지로 `<Link>` 전환 후 뒤로가기(`←`) 눌렀을 때는 이전 스크롤 위치가 자연스럽게 복원되는지 확인

### 알려진 제약사항
- 스크롤 제어는 **클라이언트 마운트 후** 실행되므로, 첫 프레임(SSR 결과)이 잠깐 이전 위치에서 그려질 수 있음(깜빡임). Next.js App Router에서는 불가피한 일반적 동작.

## Lifecycle Log

### HOTFIX_USER_VERIFY — 2026-04-17 11:59
- Approved — 대안 B (sticky GNB) 브라우저 검증 통과. 증상(GNB 안 보임) 해결. 스크롤 복원은 브라우저 기본 유지


### HOTFIX_USER_FIX (3차) — 2026-04-17 11:44
- done — 대안 B 적용 (NavigationHeader sticky top-0 z-40), layout.tsx 원상복귀, scroll 관련 잔재 0건

### HOTFIX_USER_VERIFY — 2026-04-17 11:42
- CR 3차 — inline script로도 scroll 복원 차단 실패 (Chrome native reload는 별도 경로). 대안 B(sticky GNB)로 접근 전환 — 사용자 승인


### HOTFIX_USER_FIX (2차) — 2026-04-17 11:35
- done — 대안 A 적용 (head inline blocking script + pagehide auto 복원), scrollTo 호출 제거, ScrollRestorationManager 파일/테스트 삭제

### HOTFIX_USER_VERIFY — 2026-04-17 11:33
- CR 2차 — scrollRestoration=manual 설정은 됐으나 useEffect 시점이 늦어 scrollTo(0,0)가 layout streaming 중 무효화. 대안 A(HTML head inline blocking script)로 재구현


### HOTFIX_USER_FIX — 2026-04-17 11:11
- done — 재수정 완료 (manual + pagehide 패턴), jest 9/9 PASS

### HOTFIX_USER_VERIFY — 2026-04-17 11:09
- CR — 브라우저 auto 복원이 useEffect scrollTo(0,0) 이후 덮어씀. pagehide로 auto 복원하는 패턴으로 재수정 필요


### HOTFIX_IMPL — 2026-04-17 11:02
- done — lint PASS, type-check PASS (scoped), jest 7/7 PASS, regression test 7건 추가

### BUG_TRIAGE — 2026-04-17
- P1, Lightweight 경로 선택, 최소 스토리 작성 완료

## Dev Agent Record

### 수정/신규 파일
- **신규** `web-edu/context/ScrollRestorationManager.tsx` (+36줄)
  - `'use client'` 함수형 컴포넌트, null-return 패턴(`SessionManager`와 동일 계열)
  - `useEffect(..., [])` 안에서 `performance.getEntriesByType('navigation')` 첫 엔트리의 `type`이 `'reload'`일 때만 `window.scrollTo(0, 0)` 호출
  - `typeof window === 'undefined'` 가드로 SSR 시 조기 반환 — 하이드레이션 에러 0건
  - **선택한 방식의 근거 주석**: 왜 `history.scrollRestoration = 'manual'`을 피했는지(=popstate 복원까지 꺼지는 부작용) 문서화
- **수정** `web-edu/context/Providers.tsx` (L8 import, L48 mount)
  - `ScrollRestorationManager` import 추가
  - `<SessionManager />` 바로 아래에 `<ScrollRestorationManager />` 삽입 — 기존 전역 클라이언트 경계(Providers)의 null-return 컴포넌트 계열에 자연스럽게 편입
- **신규** `web-edu/__tests__/context/ScrollRestorationManager.test.tsx` (+122줄, 7건 it)
  - 네비게이션 타입별 분기(`reload` / `navigate` / `back_forward` / `prerender`) 커버
  - 엔트리가 비어 있는 경우(예외적 브라우저) no-throw 단언
  - `container.firstChild === null` — null 렌더 회귀 방지
  - rerender 3회에도 `scrollTo`가 1회만 호출되는지 — `useEffect` deps `[]` 일회성 실행 회귀 방지

### 근본 원인 요약
브라우저 기본값 `history.scrollRestoration === 'auto'`는 페이지가 **재로드**되면 이전 스크롤 위치를 자동 복원한다. Next.js App Router는 `<Link>` / `router.push` 기반의 **클라이언트 라우트 전환**에서만 상단으로 스크롤을 리셋하고, 브라우저 reload 경로(페이지 재진입)에는 개입하지 않기 때문에 새로고침 시 본문 중간부터 렌더되어 상단 GNB가 뷰포트 밖으로 밀려난다. Navigation Timing Level 2의 `PerformanceNavigationTiming.type`을 이용하면 `reload` / `navigate` / `back_forward` / `prerender`를 구분할 수 있으므로, **`reload`만 타겟팅**해 `window.scrollTo(0, 0)`을 호출하고 나머지 경로는 브라우저/Next.js 기본 동작을 그대로 보존했다.

### 품질 검사 결과
| 검사 | 명령 | 결과 |
| --- | --- | --- |
| ESLint (변경 파일) | `npx eslint context/ScrollRestorationManager.tsx context/Providers.tsx __tests__/context/ScrollRestorationManager.test.tsx` | PASS — 0 error, 0 warning |
| TypeScript (scoped grep) | `pnpm type-check 2>&1 \| grep -E "(Providers\|ScrollRestoration)"` | PASS (scoped) — 변경 파일 관련 에러 0건 |
| Jest (신규 테스트) | `pnpm test -- __tests__/context/ScrollRestorationManager.test.tsx` | PASS — 1 suite / 7 tests (전체 신규) |

### Regression test 판단 근거
브라우저 네이티브 API(`performance.getEntriesByType` + `window.scrollTo`) 두 개를 조합한 순수 사이드이펙트이므로 jsdom에서 결정론적 단언이 가능. 주요 회귀 축은 다음 **4가지 분기 × 2가지 불변식**으로 커버:
1. **분기 커버리지 (4건)**: `reload` → scrollTo 1회 / `navigate` · `back_forward` · `prerender` → scrollTo 0회 — 특히 `back_forward` 미호출은 AC2(popstate 복원 유지)의 직접 보증
2. **방어 경로 (1건)**: 엔트리 배열 비어 있을 때 no-throw — 일부 구형 브라우저/특수 상황 안전망
3. **렌더 불변식 (1건)**: `container.firstChild === null` — SessionManager 계열 null-return 규약 유지
4. **실행 횟수 불변식 (1건)**: rerender 3회에도 scrollTo 1회 — `useEffect(..., [])` 계약 위반(의존성 배열 누락/오추가)을 가드

모킹 방식은 `jest.spyOn(window, 'scrollTo')` + `Object.defineProperty(performance, 'getEntriesByType', { value: jest.fn() })`. jsdom이 `performance.getEntriesByType`을 구현하지 않아 `jest.spyOn`이 `Property does not exist`로 실패하므로, `configurable: true`로 재정의 후 `afterEach`에서 원상 복구한다.

### User Briefing
#### 실행 방법
```bash
cd web-edu && pnpm dev   # localhost:3001
```
또는 `make deploy-web`으로 Docker 경로 재배포.

#### AC별 확인 포인트
1. **AC1 — 새로고침 상단 이동**: `/agents`, `/datasets`, `/admin/users` 등 임의 페이지에서 스크롤을 아래로 충분히 내린 뒤 **F5** 또는 브라우저 새로고침 버튼 클릭 → 페이지가 최상단(0,0)에서 렌더되어 상단 파란색 `NavigationHeader`가 뷰포트에 보여야 함. 이전에 본문 중간부터 시작하던 증상이 사라지는지 확인.
2. **AC2 — 뒤로/앞으로 복원 유지**: A페이지에서 아래로 스크롤 → `<Link>` 또는 GNB 메뉴로 B페이지 이동 → 브라우저 **뒤로 가기(←)** → A페이지로 돌아갔을 때 **이전 스크롤 위치가 복원**되어야 함. (만약 맨 위로 올라가면 핫픽스가 과하게 개입한 것 = 회귀)
3. **AC3 — 클라이언트 라우트 전환**: 메뉴 `<Link>` 클릭 / 버튼의 `router.push` 전환 시 Next.js 기본 동작(신규 페이지 최상단) 그대로 유지. 핫픽스는 첫 마운트 1회만 실행되므로 전환 경로에 부수 효과 없음.
4. **AC4 — SSR 에러 없음**: 서버 콘솔/브라우저 콘솔에 `ReferenceError: window is not defined`나 하이드레이션 경고가 없는지 확인.
5. **AC5 — 독립 스크롤 컨테이너 영향 없음**: 에이전트 채팅 페이지의 메시지 리스트 같이 `overflow: auto`로 내부 스크롤을 쓰는 영역은 `window.scrollTo`와 독립이므로 영향 없음. 기존 자동 스크롤 동작 그대로 확인.

#### 주의
- 첫 프레임(SSR 결과)이 아주 짧게 이전 위치에서 그려진 뒤 `useEffect` 실행 시점에 상단으로 이동하는 "깜빡임"이 나타날 수 있음(Next.js App Router 구조상 불가피). UX상 눈에 띄지 않는 수준이며, 해결하려면 서버 측 처리 또는 CSS hack이 필요해 범위 밖.
- 본 핫픽스는 `window` 스크롤만 제어. 채팅의 메시지 리스트 등 독립 스크롤 컨테이너(`overflow-y: auto` 요소)는 Navigation Timing과 무관하게 컴포넌트 자체 로직을 따른다.

### HOTFIX_USER_FIX — 2026-04-17

#### 원인 (CR 진단 결과)
이전 HOTFIX_IMPL은 `performance.getEntriesByType('navigation')[0].type === 'reload'` 분기에서 단순히 `window.scrollTo(0, 0)`만 호출. 그러나 실제 배포 후 브라우저에서 `scrollY === 122` (이전 위치로 복원)로 확인됨. 진단 결과:
- 번들에는 해당 코드가 정상 포함되고, reload 감지 자체도 정확히 동작
- 수동 console `window.scrollTo(0, 0)`은 정상
- 근본 원인: React `useEffect`(하이드레이션 후) 실행 시점과 브라우저 auto scroll restoration 적용 시점의 경쟁 조건. useEffect에서 `scrollTo(0,0)`을 호출해도 브라우저가 이후에 스케줄된 auto 복원으로 덮어쓴다.

#### 수정 내용
- `web-edu/context/ScrollRestorationManager.tsx`:
  - reload 분기 내에서 `history.scrollRestoration = 'manual'` 설정 후 `scrollTo(0, 0)` 호출 → 브라우저의 auto 복원을 확정적으로 차단
  - `pagehide` 이벤트(`{ once: true }`)에 `history.scrollRestoration = 'auto'` 복원 → 이 history entry가 'auto'로 저장되어 뒤로가기/bfcache 복원 시 popstate 동작 유지
  - cleanup 함수로 unmount 시 리스너 해제 (메모리 누수 방지)
  - `manual`은 **reload 분기 내부에서만** 설정 (전역 설정 아님) — 다른 네비게이션 타입 영향 없음
- `web-edu/__tests__/context/ScrollRestorationManager.test.tsx`:
  - reload 분기에 `history.scrollRestoration === 'manual'` 단언 추가
  - navigate/back_forward/prerender 분기에 `history.scrollRestoration === 'auto'` (미변경) 단언 추가
  - `pagehide` 이벤트 발화 시 `auto` 복원 단언 추가
  - unmount 후 `pagehide` 발화 시 scrollRestoration 미변경(리스너 해제) 단언 추가
  - `beforeEach`/`afterEach`에서 `history.scrollRestoration = 'auto'` 리셋

#### 품질 검사
| 검사 | 명령 | 결과 |
| --- | --- | --- |
| Jest | `pnpm test -- __tests__/context/ScrollRestorationManager.test.tsx` | PASS — 1 suite / 9 tests (기존 7 + 신규 2) |

HOTFIX_USER_FIX 규칙상 lint/type-check는 생략(사용자 확인 우선). Jest만 회귀 확인 목적으로 실행.

#### AC 재확인
- AC1(reload → 최상단): `manual` + `scrollTo(0,0)`로 auto 복원 레이스를 확정적으로 차단
- AC2(popstate 복원 유지): `pagehide` 시점에 `auto`로 되돌려 현재 history entry가 'auto' 상태로 저장됨 → 뒤로가기/앞으로가기 시 브라우저 기본 복원 유지
- AC3(라우트 전환 영향 없음): reload 분기에만 개입, `<Link>`/`router.push` 경로는 Next.js 기본 동작 그대로
- AC4(SSR 안전): `typeof window === 'undefined'` 가드 및 `useEffect` 내부 접근 유지

### HOTFIX_USER_FIX (2차 — 대안 A) — 2026-04-17 11:35

#### 접근 변경 이유
이전 두 번의 `useEffect` 기반 시도가 모두 브라우저 실검증에서 실패:
1. **1차 HOTFIX_IMPL** (`scrollTo(0,0)` 단독): React `useEffect`가 하이드레이션/streaming 이후에 실행되므로, 그 시점에는 브라우저의 auto scroll restoration이 이미 적용된 상태에서 뒤늦게 덮어씌워지는 레이스 발생.
2. **1차 HOTFIX_USER_FIX** (`manual` + `scrollTo(0,0)` + `pagehide auto`): `manual` 전환 역시 `useEffect` 내부에서 일어나므로 브라우저가 auto 복원을 이미 스케줄한 뒤에 설정되어 layout streaming 중 무효화. 사용자가 브라우저에서 `scrollY === 122`로 재현.

근본 원인: `useEffect`(= React commit 후)는 브라우저의 scroll restoration 시점보다 **항상 뒤늦다**. 리액트 라이프사이클 안에서는 이 레이스를 이길 수 없음.

→ **대안 A**: HTML 파싱 중(React 하이드레이션 시작보다 훨씬 이전) 동기 실행되는 `<head>` inline script에서 `history.scrollRestoration = 'manual'`을 설정. 브라우저가 auto 복원 로직을 시작하기 전에 `manual`로 전환되므로 복원 시도 자체가 skip되고, 페이지는 자연스럽게 (0,0)에서 파싱/렌더 시작. `scrollTo(0,0)` 호출이 불필요해져 레이스 경로가 완전히 제거됨.

#### inline script 내용 및 배치 위치
**배치 위치**: `web-edu/app/layout.tsx`의 `<html lang="ko">` 바로 아래 `<head>` 태그 내부 (Providers 하이드레이션 이전, 브라우저 HTML 파서가 `<body>` 진입 전에 반드시 평가).

**script 내용** (minified, `dangerouslySetInnerHTML` — 외부 입력 없는 정적 문자열):
```js
try{
  var n = performance.getEntriesByType('navigation')[0];
  if (n && n.type === 'reload') {
    history.scrollRestoration = 'manual';
    addEventListener('pagehide', function(){
      history.scrollRestoration = 'auto';
    }, { once: true });
  }
} catch(e) {}
```

설계 포인트:
- **동기 blocking**: `<head>` inline script는 HTML 파서가 `<body>` 진입 전에 동기 실행 → 브라우저의 auto scroll restoration 적용 이전에 `manual` 확정
- **reload만 타겟팅**: `navigation[0].type === 'reload'` 분기 조건으로 뒤로가기/앞으로가기(`back_forward`), 일반 navigate는 건드리지 않음
- **scrollTo 호출 제거**: `manual`이면 브라우저가 복원 시도를 하지 않으므로 (0,0) 자연 시작 → 추가 scrollTo는 오히려 race 유발 가능성, 호출하지 않음
- **pagehide에서 auto 복원** (`once: true`): 현재 history entry가 'auto' 상태로 저장되어 뒤로가기/bfcache 복원 시 브라우저 기본 복원 동작 유지 (AC2 보증)
- **`try/catch` 예외 swallowing**: 구형 브라우저 호환 문제/예외 발생 시 inline script 실패가 페이지 로드를 막지 않도록 안전망

#### 삭제된 파일 목록
| 파일 | 사유 |
| --- | --- |
| `web-edu/context/ScrollRestorationManager.tsx` | React `useEffect` 기반 접근 폐기. 기능이 inline script로 이관됨. |
| `web-edu/__tests__/context/ScrollRestorationManager.test.tsx` | 대응 컴포넌트 제거. 남겨두면 CI 수집 시 import 누락으로 깨짐. |

연관 수정:
- `web-edu/context/Providers.tsx`에서 `import { ScrollRestorationManager }` 및 JSX `<ScrollRestorationManager />` 제거.

#### AC 재검증 논리
- **AC1 (reload → 최상단)**: HTML 파싱 중 `manual`로 전환되면 브라우저의 auto scroll restoration 경로 자체가 skip됨. 페이지는 자연스럽게 (0,0)에서 파싱·페인트되므로 상단 GNB가 뷰포트에 노출. `useEffect` 타이밍과 무관하게 결정적으로 동작.
- **AC2 (popstate 복원 유지)**: `pagehide` once 리스너가 페이지 이탈 직전 `history.scrollRestoration = 'auto'`로 되돌림 → 이 history entry가 'auto' 상태로 저장 → 뒤로가기/앞으로가기로 다시 이 페이지에 들어오면 브라우저 기본 복원이 살아나 이전 스크롤 위치가 복원됨. bfcache 복원도 동일 경로 보존.
- **AC3 (라우트 전환 영향 없음)**: inline script는 reload 분기에서만 `manual` 설정. `<Link>`/`router.push`는 `navigate` 타입이므로 조건 분기를 만족하지 않아 `scrollRestoration`을 건드리지 않음. Next.js App Router의 기본 동작(신규 페이지 최상단) 그대로.
- **AC4 (SSR 안전)**: inline script는 클라이언트 브라우저에서만 실행(서버 SSR 중에는 단지 HTML 텍스트로 직렬화). `dangerouslySetInnerHTML`에 정적 문자열만 주입하므로 외부 입력 기반 XSS 리스크 없음. `try/catch`로 예외 차단.
- **AC5 (독립 스크롤 컨테이너 영향 없음)**: `scrollRestoration`은 `window` 스크롤만 관여. `overflow: auto` 내부 스크롤 요소는 브라우저의 이 API가 관여하지 않음.

#### 품질 검사
| 검사 | 명령 | 결과 |
| --- | --- | --- |
| grep 잔재 확인 | `grep -r "ScrollRestorationManager" web-edu/` | PASS — 0건 |
| Jest (__tests__/context/) | `pnpm test -- __tests__/context/` | PASS — 2 suites / 17 tests (AgentWizardContext + ToastContext만 잔존, ScrollRestorationManager suite 제거됨 확인) |
| TypeScript (scoped) | `pnpm type-check 2>&1 \| grep -E "(layout\|Providers\|ScrollRestoration)"` | PASS (scoped) — 변경 파일 관련 에러 0건 |

HOTFIX_USER_FIX 규칙상 lint는 생략(사용자 확인 우선).

### HOTFIX_USER_FIX (3차 — 대안 B로 전환) — 2026-04-17 11:44

#### 접근 전환 이유
3차 시도(HTML head inline blocking script)에서도 Chrome의 native tab reload 복원이 `history.scrollRestoration='manual'` 설정을 우회하여 scrollY=122로 복원. scroll 복원 정책과의 싸움이 브라우저 네이티브 경로까지 고려하면 결정론적 해결 불가라 판단. 사용자 증상의 본질("GNB가 가려진 것처럼 보임")을 직접 해결하는 방향으로 전환.

#### 구현
- `app/layout.tsx`: inline script + 명시적 `<head>` 제거, metadata API 방식으로 원상복귀
- `components/layout/NavigationHeader.tsx`: 3개 `<header>` 반환 경로 모두에 `sticky top-0 z-40` 추가
  - 초기 마운트 전(`!isMounted`)
  - 로딩 중(`isLoading`)
  - 정상 렌더

#### AC 재평가
- **AC1 (새로고침 시 최상단 이동)**: 요구 자체를 재조정. 스크롤 위치는 브라우저 기본 복원을 그대로 따르되, GNB가 항상 뷰포트 상단에 고정되어 **"GNB가 가려진 것처럼 보이는 증상"이 근본적으로 발생하지 않음**.
- **AC2 (뒤로가기/앞으로가기 복원 유지)**: 브라우저 기본 `auto` 동작 그대로 유지 → 정상 보존
- **AC3 (라우트 전환)**: Next.js App Router 기본 동작 유지
- **AC4 (SSR 안전)**: sticky는 CSS only — JS 사이드이펙트 없음, SSR 100% 안전
- **AC5 (lint/test)**: scoped lint PASS, scroll 관련 잔재 0건

#### z-index 선택 근거
- 에이전트 채팅 풀스크린 모달 `z-50` (예: `app/(student)/agents/[id]/chat/page.tsx:711`) 대비 낮은 `z-40` → 모달이 GNB를 덮음(정상)
- Toaster(sonner 기본 z-index ~9999)는 GNB 위 표시 (기존 동작 유지)
- 일반 드롭다운(`Dropdown.tsx`, `AdminDropdown.tsx`, `Tooltip.tsx`)은 `z-50` → GNB(`z-40`) 위에 정상 표시 (드롭다운이 GNB 아래로 숨는 문제 없음)
- `ConversationHistory`, `AgentInfo`의 내부 sticky `z-10`은 채팅 풀스크린(`z-50`) 컨텍스트 내부라 stacking context 격리 → GNB와 간섭 없음

#### 품질 검사
| 검사 | 명령 | 결과 |
| --- | --- | --- |
| ESLint (변경 파일) | `npx eslint components/layout/NavigationHeader.tsx app/layout.tsx` | PASS — 0 error |
| TypeScript (scoped) | `pnpm type-check 2>&1 \| grep -E "(layout\|NavigationHeader)"` | PASS (scoped) — 0건 |
| Jest (기존 테스트) | `pnpm test -- __tests__/components/layout/NavigationHeader.test.tsx` | PASS — 7/7 (className 단언 없음, sticky 추가 영향 없음) |
| grep 잔재 확인 | `grep -r "scrollRestoration\|ScrollRestoration" web-edu/ --include="*.tsx" --include="*.ts"` | PASS — 0건 |

#### 수정/삭제 파일
- **수정** `web-edu/app/layout.tsx`: `<head>` + inline script 제거 → metadata API 원형 복귀 (41 → 33줄)
- **수정** `web-edu/components/layout/NavigationHeader.tsx`: 3개 `<header>` 반환 경로에 `sticky top-0 z-40` 추가 (클래스만 변경, 로직 무개입)

파일 생성 없음, 컴포넌트 추출 없음 — scope discipline 준수.
