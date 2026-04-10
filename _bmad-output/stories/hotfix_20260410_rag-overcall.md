# Hotfix: RAG 지식베이스 도구 과도 호출

## 증상
지식베이스와 무관한 질문(사진 설명, 그림 그리기 등)에서도 dataset_retriever_tool이 호출됨. 같은 쿼리로 2회 호출되는 경우도 있음.

## 원인
이전 hotfix(00fb64541)에서 KB 도구 description과 프롬프트에 "모든 질문에 반드시 먼저 검색하라"는 지시를 넣어 LLM이 무조건 호출.

## 수정 범위
1. `api/core/tools/utils/dataset_retriever/dataset_retriever_tool.py:53` — guidance 텍스트 수정
2. `web-edu/components/agent/wizard/Step4ToolsConfig.tsx:533,599` — 프롬프트 템플릿 수정

## AC (Acceptance Criteria)
- [ ] KB 도구 description에 "질문이 이 지식 베이스의 내용과 관련될 때만 검색"으로 변경
- [ ] 프롬프트 템플릿에서 "모든 질문에 반드시 검색" → 관련 질문에만 검색하도록 변경
- [ ] 기존 KB 관련 질문에서는 여전히 검색이 동작하는지 확인

## User Briefing
### 확인 방법
1. Agent 채팅에서 KB와 무관한 질문 ("이 사진 설명해줘", "광화문을 반고흐 스타일로 그려줘") → KB 검색 안 되는지 확인
2. KB와 관련된 질문 → KB 검색이 정상 동작하는지 확인
3. 로그에서 `[RAG:tool-call]` 발생 여부 확인

### 알려진 제약사항
- 프롬프트 변경은 기존에 생성된 Agent 앱에는 자동 적용되지 않음 (새로 만들거나 프롬프트 재저장 필요)

## Lifecycle Log

### HOTFIX_USER_VERIFY — 2026-04-10 23:18
- Approved — hit rate 개선 + 이미지 첨부 시 KB 검색 제외 확인


### HOTFIX_USER_FIX — 2026-04-10 22:02
- done — 프롬프트 옵트아웃 전환 + RAG_INSTRUCTIONS 상수 통일 + 전체 도구 호출 로깅 추가


### HOTFIX_IMPL — 2026-04-10 16:53
- done — Python syntax PASS, ESLint PASS (기존 에러만), type-check PASS (기존 에러만)


### BUG_TRIAGE — 2026-04-10 16:51
- P1, Lightweight 경로 선택

### HOTFIX_IMPL — 2026-04-10
- 수정 파일: dataset_retriever_tool.py, Step4ToolsConfig.tsx
- 품질 검사: Python 구문 PASS, ESLint/TypeScript 기존 에러만 존재 (이번 수정 무관)
- 변경 요약: KB 도구 description과 프롬프트 템플릿에서 "모든 질문에 반드시 검색" → "관련 질문에만 검색, 무관한 요청에는 호출 금지"로 변경
