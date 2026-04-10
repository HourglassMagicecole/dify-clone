# Hotfix: Agent Chat RAG 검색 디버그 로깅 추가

**ID**: hotfix_20260410_rag-logging
**Severity**: P1
**Route**: Lightweight
**Date**: 2026-04-10

## 증상

Agent Chat에 지식베이스를 연결했을 때, 검색이 실제로 제대로 작동하는지 확인할 수 있는 로그가 없음.

## 수정 범위

RAG 검색 흐름의 핵심 지점에 디버그 로그를 추가하여 검색 동작을 추적 가능하게 만든다.

### 로그 추가 지점

1. **`api/core/app/apps/agent_chat/app_runner.py`** (~166-199행)
   - 검색 시작: query, dataset_ids
   - 검색 완료: context 길이, 프롬프트 주입 여부

2. **`api/core/rag/retrieval/dataset_retrieval.py`** (~76행 retrieve 메서드)
   - 사용 가능한 dataset 수, 검색 방법
   - 검색 결과 문서 수

3. **`api/core/rag/datasource/retrieval_service.py`** (~34행 retrieve 메서드)
   - 검색 방법, dataset_id, query
   - 검색 결과 문서 수, 예외 발생 여부

### AC (Acceptance Criteria)

- [ ] 지식베이스 연결된 Agent Chat에서 질문 시 로그에 검색 흐름이 출력됨
- [ ] 로그 레벨은 `logger.info` (검색 요약) + `logger.debug` (상세 내용)
- [ ] 기존 동작에 영향 없음

## Lifecycle Log

### HOTFIX_USER_VERIFY — 2026-04-10 10:17
- Approved — auto-retrieve/tool-call 출처 구분 로그 확인 완료


### HOTFIX_USER_VERIFY — 2026-04-10 10:09
- CR — auto-retrieve vs tool-call 출처 구분 로그 필요


### HOTFIX_IMPL — 2026-04-10 10:05
- lint PASS, 31 tests PASS. 3 files modified with [RAG] logging


### BUG_TRIAGE — 2026-04-10
- Classification: P1, Small enhancement (observability)
- Route: Lightweight

## Dev Agent Record

### 품질 검사
- lint: All checks passed (ruff check 3 files)
- test: 31 tests passed (`-k "retrieval or agent_chat or rag"`)

### 변경 파일
| 파일 | 변경 내용 |
|------|----------|
| `api/core/app/apps/agent_chat/app_runner.py` | 검색 시작/완료 로그, context 존재 여부, 프롬프트 주입 여부 로그 추가. import 순서 수정, 기존 long line 수정 |
| `api/core/rag/retrieval/dataset_retrieval.py` | `logging` import 및 `logger` 추가. available_datasets 수, 검색 결과 문서 수 로그 추가 |
| `api/core/rag/datasource/retrieval_service.py` | `logging` import 및 `logger` 추가. 검색 방법/dataset_id/query 로그, 결과 문서 수, 예외 로그 추가 |

### User Briefing
- 확인 방법: API 서버를 debug 모드로 실행하고 Agent Chat에서 지식베이스 연결된 앱으로 질문하면 로그가 출력됨
- 로그 필터: `[RAG]` 키워드로 grep
