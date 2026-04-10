# Hotfix: auto-retrieve 제거 및 KB 도구 hit rate 개선

**ID**: hotfix_20260410_kb-tool-improvement
**Severity**: P1
**Route**: Lightweight
**Date**: 2026-04-10

## 배경

- auto-retrieve는 검색 결과를 무조건 프롬프트에 주입하는데, reranker 미적용 상태에서 score_threshold가 동작하지 않아 관련 없는 결과도 주입될 위험
- KB 도구와 auto-retrieve가 중복 검색 발생
- LLM의 도구 호출 판단에 맡기는 것이 검색 품질에 더 유리

## 수정 범위

### 1. auto-retrieve 제거
- `api/core/app/apps/agent_chat/app_runner.py`의 auto-retrieve 블록 제거
- KB 검색은 LLM의 도구 호출에 맡김

### 2. KB 도구 hit rate 향상
- KB 도구의 description 검토/강화 (LLM이 도구 용도를 잘 이해하도록)
- 지식베이스 연결 시 시스템 프롬프트에 적용되는 KB 활용 지침 검토/강화
- Agent 시스템 프롬프트에서 KB 사용 유도

### 3. 출처 표시 확인
- tool-call 경로에서 citation이 web-edu UI까지 전달되는지 확인/수정
- 프론트엔드는 web-edu만 사용 (Dify 원본 web은 사용하지 않음)

### AC (Acceptance Criteria)

- [ ] auto-retrieve 코드 제거됨
- [ ] KB 도구가 연결된 Agent Chat에서 질문 시 LLM이 KB 도구를 호출함
- [ ] KB 도구 description이 명확함
- [ ] 시스템 프롬프트의 KB 활용 지침이 hit rate에 긍정적
- [ ] web-edu에서 검색 출처가 표시됨 (show_retrieve_source 활성 시)
- [ ] 기존 동작(KB 없는 Agent Chat)에 영향 없음

## Lifecycle Log

### HOTFIX_USER_VERIFY — 2026-04-10 16:12
- Approved — KB 도구 hit rate 개선 확인, JSON 직렬화 에러 수정


### HOTFIX_IMPL — 2026-04-10 10:53
- lint PASS, tests PASS. auto-retrieve 제거, KB 도구 description 개선, 시스템 프롬프트 KB 지침 추가


### BUG_TRIAGE — 2026-04-10
- Classification: P1, Small enhancement (KB search architecture)
- Route: Lightweight
- 설계 논의: auto-retrieve vs KB tool → KB tool 방식 채택 (reranker 미적용 환경에서 무조건 주입은 위험)

## Dev Agent Record

### 품질 검사
- lint: All checks passed (ruff check 3개 파일)
- test: 전체 관련 테스트 통과 (`-k "retrieval or agent_chat or rag or dataset_retriever"`)

### 변경 파일
| 파일 | 변경 내용 |
|------|----------|
| `api/core/app/apps/agent_chat/app_runner.py` | auto-retrieve 블록(166~218행) 제거, KB 도구 사용 지침을 시스템 프롬프트에 주입하는 코드로 교체. `DatasetIndexToolCallbackHandler`, `DatasetRetrieval` import 제거 |
| `api/core/tools/utils/dataset_retriever/dataset_multi_retriever_tool.py` | `from_dataset()`에서 DB 조회하여 연결된 KB들의 이름/설명을 도구 description에 반영. query 파라미터 description 한국어화. 강한 유도 문구 추가 |
| `api/core/tools/utils/dataset_retriever/dataset_retriever_tool.py` | 단일 KB 도구 description에 "반드시 이 도구로 관련 정보를 검색하세요" 유도 문구 추가. 기존 long line 린트 오류 수정 |

### 출처 표시 확인 결과
- `easy_ui_based_generate_task_pipeline.py`에서 `QueueRetrieverResourcesEvent`는 큐 이벤트 루프에서 `_task_state.metadata.retriever_resources`에 저장되고, 이후 `QueueMessageEndEvent` 처리 시 `_message_end_to_stream_response()`에서 metadata에 포함되어 SSE로 전송됨
- Agent 도구 호출 경로에서 `hit_callback.return_retriever_resource_info()`가 도구 실행 시점에 호출되므로, `QueueRetrieverResourcesEvent`가 `QueueMessageEndEvent`보다 먼저 큐에 들어감 → 순서 정상
- `web-edu/components/chat/RetrieverResources.tsx` 컴포넌트 존재 확인 완료

### User Briefing
- 확인 방법: Agent Chat에서 KB를 연결한 앱으로 질문 시 (1) LLM이 KB 도구를 호출하는지 확인, (2) 응답 하단에 출처 표시가 나오는지 확인, (3) KB 없는 Agent Chat이 정상 동작하는지 확인
- 주요 변경사항:
  1. auto-retrieve(무조건 프롬프트 주입) 제거 → LLM의 도구 호출 판단에 위임
  2. KB 도구 description 개선으로 LLM이 도구 용도를 명확히 이해하도록 함
  3. 시스템 프롬프트에 KB 사용 유도 지침 주입으로 hit rate 향상 기대
