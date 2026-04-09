# Hotfix: Agent 응답에 이전 답변 내용 누적

| 항목 | 값 |
|------|-----|
| ID | hotfix_20260409_response-accumulation |
| Severity | P1 |
| Route | lightweight |
| Status | dev-done (re-fix) |
| Created | 2026-04-09 |

## 증상

web-edu 채팅에서 Agent와 대화 시, 현재 턴의 응답에 이전 턴의 답변 내용이 함께 포함되어 출력됨.

### 재현 절차

1. web-edu에서 Agent 앱 채팅 진입
2. 첫 질문: "배열에 대해 설명해줘" → 정상 응답
3. 두 번째 질문: "소프트웨어 개발 방법론에는 뭐가 있지?" → **첫 번째 응답 + 두 번째 응답이 합쳐져서 출력됨**

### 기대 동작

각 턴의 응답은 해당 질문에 대한 내용만 표시되어야 함.

### 제약 조건

- Agent가 이전 대화를 맥락(context)으로 참고하는 것은 정상 동작 — 유지해야 함
- 응답 **텍스트 출력**에만 현재 턴의 답변이 나와야 함

## Acceptance Criteria

- [ ] Agent 채팅에서 두 번째 이후 턴의 응답에 이전 답변 내용이 포함되지 않음
- [ ] 이전 대화 맥락 참조 기능은 정상 유지
- [ ] Regression test 추가

## Dev Agent Record

### Root Cause Analysis

**원인**: Dify의 `agent_message` SSE 이벤트에서 `answer` 필드가 **누적된 전체 텍스트**를 전달하는 반면, web-edu의 onChunk 핸들러는 이를 **증분(delta)으로 취급**하여 `fullContent += chunk.answer`로 처리했음. 이로 인해:

- 1번째 chunk: answer="Hello" → fullContent="Hello" (정상)
- 2번째 chunk: answer="Hello World" → fullContent="HelloHello World" (중복!)

Dify 원본 web/에서는 agent 모드일 때 `lastThought.thought += message` 패턴으로 별도 처리하며, 완료 후 서버에서 최종 메시지를 다시 가져옴. web-edu는 이 차이를 반영하지 않았음.

### Fix

**파일**: `web-edu/app/(student)/agents/[id]/chat/page.tsx`

`message` 이벤트와 `agent_message` 이벤트의 처리를 분리:
- `message` 이벤트: 기존대로 delta 누적 (`fullContent += chunk.answer`)
- `agent_message` 이벤트: 이전 누적값과 비교하여 delta를 계산한 후 누적 (`delta = currentAnswer.slice(lastAgentAnswer.length)`)

### Regression Test

**파일**: `web-edu/__tests__/app/agents/chat/response-accumulation.test.ts`

9개 테스트 케이스:
- 누적된 agent_message에서 delta 추출
- 한국어 텍스트 누적 시나리오 (실제 버그 재현)
- 단일 chunk, 빈 answer 처리
- message 이벤트 delta 처리
- agent_thought 혼합 이벤트
- 멀티턴 격리 (핵심: 2번째 턴에 1번째 턴 내용이 포함되지 않음)
- 엣지 케이스 (answer가 이전값으로 시작하지 않는 경우, undefined)

### Scoped Quality Check

- **Lint**: `npx eslint app/(student)/agents/[id]/chat/page.tsx` → 0 errors, 1 warning (기존 img 태그 warning)
- **Tests**: `npx jest __tests__/app/agents/chat/` → 19 passed (기존 10 + regression 9)
- **Component tests**: `npx jest __tests__/components/chat/` → 68 passed (전부 통과, 기존 대비 변화 없음)

## Lifecycle Log

### HOTFIX_USER_VERIFY — 2026-04-09 11:39
- Approved — 새 Agent에서 이전 답변 반복 현상 해결 확인


### HOTFIX_USER_FIX — 2026-04-09 (re-fix)
- 이전 프론트엔드 수정은 잘못된 가정(agent_message가 누적 텍스트)에 기반. 실제로 백엔드 SSE 자체에 이미 합쳐진 텍스트가 포함됨.
- **프론트엔드**: `agent_message` delta 계산 로직 제거, 원래 코드로 복원 (`message`와 `agent_message`를 동일하게 delta 누적)
- **백엔드**: `FunctionCallAgentRunner._init_system_message`의 BUILTIN_CHAT_GUIDELINES에 응답 반복 방지 지시 추가
- **백엔드**: `CotChatAgentRunner._organize_system_prompt`에도 동일 지시 추가
- 수정 파일:
  - `web-edu/app/(student)/agents/[id]/chat/page.tsx` — 프론트엔드 복원
  - `api/core/agent/fc_agent_runner.py` — FunctionCall Agent 시스템 프롬프트 지시 추가
  - `api/core/agent/cot_chat_agent_runner.py` — CoT Chat Agent 시스템 프롬프트 지시 추가

### HOTFIX_USER_VERIFY — 2026-04-09 10:50
- CR — 사용자 확인: 같은 현상 지속됨. 컨테이너 재빌드 후에도 Agent 응답 누적 버그 미해결


### HOTFIX_IMPL — 2026-04-09 10:42
- done — Root cause: agent_message SSE가 누적 텍스트를 전송하는데 delta로 처리함. Lint 0 errors, Regression 9/9 PASS, Chat tests 78/78 PASS


### BUG_TRIAGE — 2026-04-09 10:26
- P1 classified, Route: lightweight — Agent 채팅 응답 누적 버그
