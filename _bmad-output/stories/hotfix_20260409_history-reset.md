# Hotfix: Agent 대화 히스토리 초기화 버그

| 항목 | 값 |
|------|-----|
| ID | hotfix_20260409_history-reset |
| Severity | P1 |
| Route | lightweight |
| Status | open |
| Created | 2026-04-09 |

## 증상

Agent 채팅에서 3~4턴 후 LLM이 "안녕하세요! 학습 멘토입니다."라며 처음 대화하는 것처럼 반응. 대화 히스토리가 전부 잘린 것으로 보임.

### 재현 절차

1. web-edu에서 Agent 채팅 진입
2. 긴 답변이 나오는 질문 3~4개 연속 (예: 피타고라스 정리, 근의 공식, 파이썬 변수, 프로젝트 종료 절차)
3. 4번째 응답부터 인사말 반복 — 이전 대화 맥락 없음

### 원인

`api/core/prompt/agent_history_prompt_transform.py`의 `AgentHistoryPromptTransform.get_prompt()`에서 모델 context window 남은 공간 기준으로 히스토리를 잘라냄. 교육용 긴 응답이 몇 턴만에 한도를 초과하면 모든 히스토리가 삭제됨.

## Acceptance Criteria

- [ ] 최소 최근 N턴(예: 3턴)의 대화 히스토리가 항상 유지됨
- [ ] 히스토리가 잘려도 LLM이 인사를 반복하지 않음

## Dev Agent Record

<!-- Dev 에이전트가 구현 시 아래에 기록 -->

## Lifecycle Log

### HOTFIX_IMPL — 2026-04-09 15:46
- done — Agent 히스토리에 assistant 응답 누락 수정 + opening_statement 반복 방지


### BUG_TRIAGE — 2026-04-09 14:21
- P1 classified, Route: lightweight — Agent 대화 히스토리 3~4턴 후 초기화
