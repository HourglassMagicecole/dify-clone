# Hotfix: Agent 채팅 드래그 앤 드롭 파일 첨부

## 증상
web-edu Agent 채팅창에 파일을 드래그 앤 드롭해도 아무 반응 없음. 파일 첨부 버튼(클릭)은 정상 동작.

## 원인
`web-edu/components/chat/MessageInput.tsx`에 `onDrop`, `onDragOver` 등 드래그 이벤트 핸들러가 미구현.

## 수정 범위
- `web-edu/components/chat/MessageInput.tsx` — D&D 핸들러 추가 + 드래그 시각 피드백
- 참고: `web/app/components/base/file-uploader/hooks.ts` (원본 Dify D&D 구현)

## AC (Acceptance Criteria)
- [ ] 채팅 입력 영역에 파일을 드래그하면 시각적 피드백(테두리 변경 등) 표시
- [ ] 파일을 드롭하면 기존 파일 첨부 버튼과 동일하게 첨부파일 목록에 추가
- [ ] 기존 제한(5개, 10MB) 동일 적용
- [ ] 드래그 영역 밖으로 나가면 시각 피드백 해제

## User Briefing
### 확인 방법
1. web-edu에서 Agent 앱 채팅 열기
2. 파일을 채팅 입력창으로 드래그 — 시각 피드백 확인
3. 파일 드롭 — 첨부파일 목록에 추가되는지 확인
4. 5개 초과/10MB 초과 파일 드롭 시 에러 처리 확인

### 알려진 제약사항
- 없음

## Lifecycle Log

### HOTFIX_USER_VERIFY — 2026-04-10 16:38
- Approved — 사용자 확인 완료


### HOTFIX_IMPL — 2026-04-10 16:26
- done — lint PASS, type-check PASS, test 19/19 PASS


### BUG_TRIAGE — 2026-04-10 16:23
- P1, Lightweight 경로 선택, 최소 스토리 작성 완료

### HOTFIX_IMPL — 2026-04-10
- 수정 파일: web-edu/components/chat/MessageInput.tsx
- 품질 검사: lint PASS (대상 파일 에러 없음), type-check PASS (대상 파일 에러 없음), test PASS (19/19)
- 변경 요약: 채팅 입력 영역에 드래그 앤 드롭 파일 첨부 기능 추가 (isDragActive 상태 + 4개 D&D 핸들러 + 시각 피드백)
