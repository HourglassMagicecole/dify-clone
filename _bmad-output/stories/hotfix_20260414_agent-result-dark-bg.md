# Hotfix: 작업형 에이전트 실행 결과 영역 배경/글자 가독성

## 증상
web-edu 작업형 에이전트 실행 페이지(`/agents/{app_id}/execute`)의 `결과` 패널에서 출력 영역의 배경이 어두운 검정(거의 #000)으로 렌더링되며 글자색도 어두워 결과 텍스트를 읽을 수 없음.

- 재현 URL: `http://localhost/agents/d9d42643-1b31-47e1-8c7f-727ac6cc528a/execute`
- 메트릭 영역(토큰/시간/비용)은 정상, **결과 본문 영역만** 가독성 문제
- 라이트/다크 모드 전환 없음 (web-edu는 단일 테마)

## 원인 (추정 — HOTFIX_IMPL에서 확정)
- 작업형 에이전트 결과 렌더링 컴포넌트(마크다운/코드블록 렌더러 가능성)에 어두운 배경 스타일이 잘못 적용됨
- 또는 prose/코드블록 기본 스타일이 단일 테마 환경에서 다크 배경으로 고정됨

## 수정 범위 (추정)
- `web-edu/` 내 에이전트 실행 결과 출력 컴포넌트 (result/output panel)
- 관련 Tailwind 클래스 또는 마크다운 렌더러 스타일
- 정확한 파일은 HOTFIX_IMPL에서 Dev 에이전트가 식별

## AC (Acceptance Criteria)
- [ ] 작업형 에이전트 실행 결과 영역의 배경이 주변 UI와 일관된 밝은 톤으로 렌더링
- [ ] 결과 텍스트가 배경과 충분한 대비로 명확히 읽힘
- [ ] 코드블록/인용/표 등 마크다운 요소도 가독성 유지
- [ ] 메트릭/Processing Steps 등 다른 섹션의 기존 스타일은 영향 없음

## User Briefing
### 확인 방법
1. web-edu에서 작업형 에이전트 앱 실행 페이지 열기 (`/agents/{app_id}/execute`)
2. 에이전트 실행 후 하단 `결과` 패널 확인
3. 배경이 밝은 톤이고 결과 텍스트가 선명하게 읽히는지 확인
4. `DEBUG` 탭, 복사/다운로드 버튼, DOCX 다운로드 등 기타 기능은 기존대로 동작하는지 확인

### 알려진 제약사항
- 단일 테마(light) 기준으로 수정. 향후 다크 모드 도입 시 재검토 필요.

## Lifecycle Log

### HOTFIX_USER_VERIFY — 2026-04-14 10:29
- Approved — make deploy-web 재배포 후 라이트 팔레트 반영 확인 (브라우저 DOM 검증: prose bg rgb(249,250,251), 변경 전 검증 시 시스템 다크 모드 감지 + 구 번들의 dark:prose-invert 활성이 원인으로 확인됨)


### HOTFIX_IMPL — 2026-04-14 10:09
- done — lint PASS, type-check PASS (scoped), jest 3/3 PASS, regression test 3건 추가


### BUG_TRIAGE — 2026-04-14
- P1, Lightweight 경로 선택, 최소 스토리 작성 완료

### HOTFIX_IMPL — 2026-04-14
- 근본 원인 분석 완료, 결과 패널 라이트 팔레트 고정 + Typography CSS 변수 오버라이드로 수정 완료
- Scoped 품질 검사 통과, Regression test 3건 추가

## Dev Agent Record

### 수정 파일
- `web-edu/components/agent/ExecutionResultPanel.tsx` (L622–L651)
  - 결과 본문 컨테이너에서 `dark:` 변종(`dark:prose-invert`, `dark:bg-gray-900`, `dark:border-gray-700`) 전면 제거
  - `bg-white text-gray-900 border-gray-200`로 라이트 팔레트 고정
  - `[&_pre]:bg-gray-100 [&_pre]:text-gray-900 [&_code]:text-gray-900` 자식 선택자로 prose 내부 `<pre>`/`<code>` 배경·텍스트 라이트화
  - `style={{ '--tw-prose-pre-bg', '--tw-prose-pre-code', '--tw-prose-body', '--tw-prose-code', '--tw-prose-headings' }}` 인라인 설정으로 `@tailwindcss/typography` 기본 다크 토큰을 명시적으로 오버라이드
  - `plain_text` 분기의 `<pre>`도 `dark:text-gray-100` 제거, `bg-transparent` 추가
  - `html` 분기의 래퍼에 `text-gray-900` 추가로 sanitized HTML의 기본 텍스트 색상 보장
- `web-edu/__tests__/components/agent/ExecutionResultPanel.test.tsx` (신규, 89줄)
  - 결과 컨테이너가 라이트 팔레트 클래스를 가지고 `dark:` 변종이 없는지 DOM 단언
  - Typography CSS 변수(`--tw-prose-pre-bg` 등)가 라이트 토큰으로 세팅됐는지 검증
  - `markdown`/`plain_text` 두 포맷 모두 라이트 표면 위에 렌더됨을 확인

### 근본 원인 요약
web-edu는 라이트 단일 테마인데도 `@tailwindcss/typography` 플러그인이 `prose` 내부 `<pre>`/`<code>`에 **기본으로** 다크 토큰(`--tw-prose-pre-bg: #1f2937`, `--tw-prose-pre-code: #e5e7eb`)을 적용한다. 또한 결과 컨테이너에 `dark:prose-invert dark:bg-gray-900` 같은 `dark:` 변종이 남아 있어, 사용자 브라우저나 OS 레벨에서 `html.dark` 클래스가 간헐적으로 활성화되거나(예: 개발자 도구 에뮬레이션, 일부 확장 프로그램) 상위 컨테이너에서 `dark` 클래스를 올렸을 때 배경이 `#111827` 계열로 반전되면서 결과 텍스트의 `prose` 색상이 어두운 배경 위 어두운 글자로 렌더되어 가독성이 사라졌다. 즉, **"prose 기본 다크 코드블록 + 의도치 않은 `dark:` 변종 활성화"의 합작**으로, 단순한 `bg-black` 지정 문제가 아니다. 수정은 두 축 모두를 제거: (1) `dark:` 변종 자체를 결과 표면에서 삭제, (2) 그래도 프로세가 내부 하위 요소에 다크 토큰을 뿌리는 걸 인라인 CSS 변수로 명시 오버라이드.

### 품질 검사 결과
| 검사 | 명령 | 결과 |
| --- | --- | --- |
| ESLint (변경 파일) | `cd web-edu && npx eslint components/agent/ExecutionResultPanel.tsx __tests__/components/agent/ExecutionResultPanel.test.tsx` | 통과 (0 error, 0 warning) |
| TypeScript (변경 파일 필터) | `cd web-edu && pnpm type-check \| grep ExecutionResultPanel` | 통과 (해당 파일 관련 에러 0건; 저장소 내 기존 타입 에러 다수는 본 핫픽스 스코프 외) |
| Jest (신규 regression test) | `cd web-edu && pnpm test -- __tests__/components/agent/ExecutionResultPanel.test.tsx` | 3/3 통과 |

### Regression test 판단 근거
시각적 이슈이지만 "라이트 팔레트 클래스 존재 + `dark:` 변종 부재 + prose CSS 변수 라이트 값" 세 가지는 DOM 상에서 결정론적으로 단언 가능하므로 추가 가치 있음. 3개 케이스(`markdown` 클래스 단언, CSS 변수 오버라이드 단언, `plain_text` 포맷 확인)로 같은 회귀를 차단한다. 실제 색상 픽셀 수준 검증은 HOTFIX_USER_VERIFY에서 사용자가 브라우저로 육안 확인.

### User Briefing
#### 실행 방법
```bash
cd web-edu && pnpm dev   # localhost:3001
```
브라우저에서 `http://localhost/agents/d9d42643-1b31-47e1-8c7f-727ac6cc528a/execute` 열기.

#### 확인 포인트
1. 작업형 에이전트 실행 후 하단 `결과` 패널 본문이 **흰색 배경 + 짙은 회색 글자**로 렌더되는지.
2. 결과 안에 마크다운 코드블록(```` ```json ```` 등)이 있을 때 배경이 라이트 그레이(`#f3f4f6`)로 바뀌고 글자는 검정 계열로 읽히는지.
3. `🔍 DEBUG` 버튼, `복사`, `다운로드`, `DOCX` 버튼이 정상 동작하는지(기능 변경 없음).
4. Processing Steps / 메트릭(토큰·시간·비용) 카드는 기존 톤 그대로인지(수정 스코프 밖 = 영향 없어야 함).

#### 주의
- 이 수정은 web-edu 라이트 단일 테마 기준으로만 유효. 추후 web-edu에 다크 모드를 도입한다면 결과 패널용 별도 다크 토큰을 재설계해야 함(현재는 인라인 CSS 변수로 강제 라이트).
