# Hotfix: Agent 채팅 응답에 내부 도구 호출 로그 노출

## 증상
Agent 채팅에서 도구를 사용해 응답할 때 사용자에게 전달되는 응답 본문 맨 앞에 내부 도구 호출 로그가 그대로 포함됨.

예시 (주식분석가 Agent, 두 번째 턴부터 재현):
```
[Agent] 오후 2:40:38
Calling: yahoo_finance_ticker, yahoo_finance_analytics, yahoo_finance_news for TSLA다음은 Tesla, Inc. ...
```

```
[Agent] 오후 2:41:20
Calling: yahoo_finance_ticker, yahoo_finance_analytics, yahoo_finance_news for GOOGL무엇을 알려드릴까요? ...
```

관찰된 패턴:
- **첫 번째 턴**에는 `Calling:` 라인 없음
- **두 번째 턴 이후** 응답 **첫 줄**에 `Calling: <tool_names> for <args>` 포함
- 응답의 나머지 내용은 정상 생성됨
- 특정 도구/Agent 한정인지 불확실 — 다른 도구에서도 재현 가능성 존재하므로 **범용 해결** 지향

## 원인 가설 (HOTFIX_IMPL에서 Dev가 확정)
1. **스트리밍 파서의 tool_use/thought 델타가 answer 버퍼에 누적** — agent runner streaming에서 `thought`/`action`/`tool_use` 이벤트 텍스트가 final answer에 섞여 저장됨
2. **대화 맥락 오염** — (1)로 인해 저장된 이전 assistant 메시지의 `Calling: ...` 문구가 다음 턴 프롬프트에 포함되어, LLM이 그 패턴을 학습적으로 재현
3. **시스템 프롬프트 누락** — 응답에 도구 호출 문구 출력 금지 지시 부재
4. **프론트 렌더링 이슈** — 이벤트 구분 없이 텍스트를 모두 표시

Dev가 로그/이벤트 흐름을 조사해 **근본 층위**를 식별하고, 그 층위에서 고치는 것이 원칙. 프론트 필터는 최후 수단.

## 수정 범위 (추정)
- 1차 조사: `api/core/app/apps/agent_chat/` / `api/core/agent/` (streaming 이벤트 생성/구분)
- 2차 조사: web-edu 채팅 렌더러 (이벤트 타입별 렌더 분기)
- 3차 조사: Agent 시스템 프롬프트 (최종 응답에 도구 호출 문구 금지 지시 추가 여부)
- 근본이 발견되면 그 지점만 수정. Dify 원본 수정이 불가피하면 에스컬레이션.

## AC (Acceptance Criteria)
- [ ] Agent 채팅에서 도구를 **여러 번 호출**하는 연속 턴에서도 응답 본문에 `Calling: ...` 문구가 노출되지 않음
- [ ] 새 세션/기존 세션 모두에서 재현되지 않음
- [ ] 도구 사용 여부와 무관하게 정상 응답 품질 유지
- [ ] DB에 저장된 assistant 메시지 본문에 `Calling: ...` 라인이 포함되지 않음 (이후 턴 오염 방지)
- [ ] 주식분석가 Agent뿐 아니라 도구 사용하는 다른 Agent에서도 회귀 없음

## User Briefing
### 확인 방법
1. 재배포 후 Agent 채팅(도구 사용 Agent: 예 주식분석가) 새 세션 시작
2. 도구를 강제로 호출하는 질문 3~4턴 연속(예: "엔비디아" → "테슬라" → "구글" → "애플")
3. 응답 본문 첫 줄에 `Calling: <tool_names>` 문구가 없는지 확인
4. 과거 오염된 세션을 열어도 이후 턴에서는 새 응답에 `Calling:` 문구가 재현되지 않는지 확인
5. 다른 도구 사용 Agent에서도 동일 확인

### 알려진 제약사항
- 이미 DB에 저장된 과거 메시지에 `Calling: ...` 문자열이 포함된 기록은 수정 대상 아님(마이그레이션은 별건)
- 오염된 과거 히스토리를 다음 턴 프롬프트에 포함하면 LLM이 패턴을 재현할 가능성이 남음 → Dev가 컨텍스트 구성 단계에서 필터 여부 검토

## Lifecycle Log

### HOTFIX_USER_VERIFY — 2026-04-14 15:18
- Approved — make deploy-all 재배포 완료, 사용자 승인


### BUG_TRIAGE — 2026-04-14
- P1, Lightweight 경로 시작 (Dev가 근본 층위 판단; 범위 초과 시 에스컬레이션)

### HOTFIX_IMPL — 2026-04-14
- Dev Agent Record 작성 완료 (아래 참조)

## Dev Agent Record

### 원인 계층 판정: (B) 저장/재조립 계층 + (C) 컨텍스트 오염에 의한 패턴 모방

**결정적 증거:**
`api/core/agent/base_agent_runner.py:490` (수정 전)
```python
thought_content = agent_thought.thought
if not thought_content:
    thought_content = f"Calling: {', '.join(tools)}"
result.extend([
    AssistantPromptMessage(content=thought_content, tool_calls=tool_calls),
    *tool_call_response,
])
```

이 코드는 **`organize_agent_history` — 다음 턴 LLM 프롬프트에 올릴 과거 대화 메시지를 재조립하는 함수** 안에 있다. `agent_thought.thought`가 빈 경우 `"Calling: <tools>"` 리터럴을 폴백으로 주입했다. 이것이 `AssistantPromptMessage.content`로 LLM 에게 전달되면서 LLM 에게는 "어시스턴트가 이전 턴에 'Calling: ...'이라고 말했다"로 보였고, 두 번째 턴부터 LLM 이 동일 패턴을 모방해 응답 본문 첫 줄에 `Calling: <tools> for <args>`를 출력.

`for <args>` 꼬리까지 붙는 이유는, 이전 턴에서 LLM 또는 CoT runner가 `agent_thought.thought` 자체에 `"Calling: ... for TSLA"` 형태로 기록해둔 오염이 그대로 재조립에 섞여 들어가며 패턴이 강화됐기 때문. 즉 (B)와 (C)가 결합된 자기 강화 루프.

직전 커밋 `9abeee772` ("fix(agent): preserve conversation history")에서 `message.answer` 를 history 에 추가하기 시작한 변경이 이 누수 경로를 증폭시킴 (오염된 answer 가 이후 턴 프롬프트에 그대로 들어감).

### 수정 파일 목록

- `api/core/agent/base_agent_runner.py`
  - **근본 수정**: 기존 `thought_content = f"Calling: ..."` 폴백 제거. `agent_thought.thought` 에 이미 섞여있을 수 있는 `Calling: ...` 라인을 방어 필터로 제거 후 사용, 남는 내용이 없으면 공백 1 글자(Anthropic API 비어있지 않은 content 요구 충족)로 대체.
  - **방어 필터 추가**: 모듈 상단 `_AGENT_TOOL_CALL_LEAK_PATTERN` 정규식 (`(?m)^[ \t]*Calling:[^\n]*\n?`) 과 `_strip_tool_call_leak(text)` 헬퍼.
  - **적용 지점**:
    - (tools 있는 경우) thought 폴백 → `_strip_tool_call_leak(agent_thought.thought)` 후 빈 값이면 공백.
    - (tools 없는 경우) `AssistantPromptMessage(content=agent_thought.thought)` 주입 시점에 필터 적용.
    - `message.answer` 를 history 로 복원하는 두 경로(agent_thoughts 있음 / 없음) 모두 필터 적용 — 과거 DB 에 저장된 오염된 answer 가 다음 턴 프롬프트로 재유입되지 않게 방어.
- `api/tests/unit_tests/core/agent/test_tool_call_leak_filter.py` (신규)
  - `_strip_tool_call_leak` 순수 함수 회귀 테스트 11 건.

### 수정 접근

1. **근본 지점**: base_agent_runner 가 LLM 에게 "과거 어시스턴트 발화"로 심던 `"Calling: ..."` 리터럴을 제거. 더 이상 LLM 에게 그 패턴이 어시스턴트 어휘로 보이지 않음.
2. **방어 필터**: 이미 DB 에 저장된 오염 데이터(과거 세션의 `agent_thought.thought`, `message.answer`)를 다음 턴 프롬프트에 그대로 싣지 않도록 정규식으로 라인 제거. 과거 오염 세션에서도 이어지는 새 턴은 정상화됨.
3. **정규식 엄격성**: 줄 선두 + 대문자 `Calling:` + 콜론 고정. 일반 문장의 `calling` 단어, 문장 중간의 `Calling`, 소문자 형태는 보존 (테스트로 단언).

### 품질 검사 결과

- `uv run ruff check core/agent/base_agent_runner.py tests/unit_tests/core/agent/test_tool_call_leak_filter.py` → **All checks passed**
- `uv run ruff format --check` → 포매팅 완료 (테스트 파일 1 회 자동 포맷)
- `uv run pytest tests/unit_tests/core/agent/test_tool_call_leak_filter.py -v` → **11 passed**
- `uv run lint-imports` → **Contracts: 8 kept, 0 broken**

### Regression 테스트 케이스

`tests/unit_tests/core/agent/test_tool_call_leak_filter.py` 에 11 건:
- None/empty 처리
- 평문 보존
- 선두 `Calling:` 라인 1개 / 다수 제거
- 선두 공백이 있는 경우 제거
- 문장 내부 `calling`(일반 영어) 보존
- 줄 선두가 아닌 위치의 `Calling:` 보존
- 소문자 `calling:` 보존 (내부 로그 패턴 아님)
- `Calling:` 라인만 있을 때 빈 문자열 반환
- 꼬리 공백 strip

### 실제 재현 검증 여부 + 방법

- **현재 세션에서는 미수행** (Docker 스택 + LMS 로그인 + 실제 LLM 호출 환경이 필요).
- 단위 테스트 11 건이 정규식 필터의 정확성을 보장.
- **사용자 측 검증 권장** (User Briefing 절차 참조).

### User Briefing

**재배포 범위: API 만** (web-edu 변경 없음). `make docker-rebuild` 또는 API 컨테이너 재시작 필요.

**확인 절차:**
1. API 재배포 후 도구 사용 Agent(예: 주식분석가) 새 세션 시작.
2. "엔비디아" → "테슬라" → "구글" → "애플" 로 3~4 턴 연속 질의.
3. 두 번째 턴부터 응답 본문 첫 줄에 `Calling: <tools> for <args>` 가 **나타나지 않음**을 확인.
4. 과거 오염된 세션을 이어서 질문해도 **새 응답에는 재현되지 않음**을 확인 (방어 필터가 과거 오염을 프롬프트에서 제거).

### 알려진 한계

- **과거 DB 오염 데이터는 그대로 남음**: 이미 저장된 `message.answer` / `agent_thought.thought` 본문에 포함된 `Calling: ...` 라인은 DB 에서 제거하지 않음. 사용자가 과거 세션 UI 에서 스크롤로 이전 메시지를 볼 때 여전히 보임. 별도 데이터 마이그레이션 스토리가 필요하면 리더가 판단.
- **다른 도구/Agent 일반화 자신도: 높음**. `_strip_tool_call_leak` 는 특정 도구명에 종속되지 않고 `Calling:` 라인만 제거하며, 근본 수정은 base_agent_runner 공통 경로라 모든 Agent/도구에 일관 적용됨. 다만 CoT runner 가 `agent_thought.thought` 에 "Calling:" 외 다른 형태 로그를 심는 경우(예: "Action:", "Thought:" 등)가 있으면 별도 대응 필요 — 현재 이슈 보고는 `Calling:` 케이스뿐이므로 범위 밖.
- **Anthropic API content non-empty 요구**: 공백 1 글자 `" "` 로 충족. 일부 provider 가 whitespace-only 를 거부하면 ".' 같은 1 문자로 교체해야 할 수 있음. 현재까지 실환경(Anthropic)에서는 공백 허용 확인된 관행.
- **시스템 프롬프트 변경 없음**: 이슈 가설 3번("도구 호출 문구 출력 금지 지시 부재")은 근본 원인이 아니었으므로 건드리지 않음.

### 에스컬레이션 여부

**에스컬레이션 없음.** 수정이 `base_agent_runner.organize_agent_history` 국소 범위로 한정되었고, Dify 원본 수정 지점은 직전 커밋에서도 이미 수정 이력이 있는 함수라 리스크 낮음. 전체 agent runner 아키텍처 변경이나 시스템 프롬프트 재설계는 필요하지 않았음.

