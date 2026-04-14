# Hotfix: md_exporter (Markdown 변환기) 내부 tool 나열 순서 고정

## 증상
Agent 생성/편집의 도구 구성 단계에서 `md_exporter` (Markdown 변환기) provider 내부의 개별 tool 목록 순서가 고정되어 있지 않음. 직전 hotfix(`hotfix_20260414_agent-tool-order`)는 provider 레벨 정렬이었고, 이번은 provider 내부의 tool 레벨 정렬.

## 원인 (추정 — HOTFIX_IMPL에서 확정)
provider의 tools 배열이 서버 응답/registry 순서 그대로 노출됨. 안정적 순서 규칙 없음.

## 수정 범위 (추정)
- `web-edu/components/agent/wizard/Step4ToolsConfig.tsx` 또는 `ToolConfigModal.tsx` — provider 내부 tool 목록 렌더 지점
- 직전 hotfix에서 도입한 `web-edu/components/agent/wizard/sortToolProviders.ts`와 유사한 형태로 tool 레벨 정렬 헬퍼 추가 권장 (예: `sortMdExporterTools` 또는 provider별 tool 순서를 반영하는 일반화된 함수)

## 요구 정렬 순서 (md_exporter 내부 tool, 상단→하단)
1. Markdown을 MD로
2. Markdown을 DOCX로
3. Markdown을 PPTX로
4. Markdown을 XLSX로
5. Markdown을 HTML로

## 정렬 규칙
- 위 5개는 **명시 순서 그대로** `md_exporter` provider 내부에 고정
- 목록에 없는 신규 tool이 등장할 경우 **원래 응답 순서 유지하여 5개 뒤에 배치** (폴백, 숨김 금지)
- `md_exporter` 이외 다른 provider의 내부 tool은 이번 hotfix 대상 아님
- 매칭 키: 영문 tool name 권장 (i18n 표시명 변경에 영향 없도록)

## AC (Acceptance Criteria)
- [ ] Agent 생성 마법사 Step 4에서 `md_exporter` 카드를 열었을 때 내부 tool이 위 순서로 고정 노출
- [ ] Agent 편집 Step 4에서도 동일 순서
- [ ] 매핑 실패(명세에 없는 tool)는 5개 뒤에 원 응답 순서로 노출 (regression test로 보장)
- [ ] 다른 provider의 내부 tool 순서에는 영향 없음 (스코프 한정)
- [ ] 도구 선택/해제/설정 등 기존 동작 영향 없음

## User Briefing
### 확인 방법
1. `make deploy-web` 재배포 후 `http://localhost/`
2. Agent 생성 → Step 4 → Markdown 변환기 선택/확장 → 내부 tool 위 5개 순서 확인
3. 기존 Agent 편집 → Step 4 → 동일 순서 확인
4. 다른 provider(예: markitdown, OpenAI) 내부 tool은 이전과 동일한지 회귀 확인

### 알려진 제약사항
- `md_exporter`에 한정. 다른 provider의 내부 tool 정렬이 필요해지면 별건 hotfix.

## Lifecycle Log

### HOTFIX_USER_VERIFY — 2026-04-14 14:40
- Approved — make deploy-web 재배포 완료, 사용자 승인


### BUG_TRIAGE — 2026-04-14
- P1, Lightweight 경로 선택, 최소 스토리 작성 완료

### HOTFIX_IMPL — 2026-04-14
- Dev 에이전트 구현 완료, scoped 품질 검사 통과

## Dev Agent Record

### 수정/신규 파일

- **신규**: `web-edu/components/agent/wizard/sortProviderTools.ts`
  - `PROVIDER_TOOL_ORDER: Record<string, readonly string[]>` 상수(라인 24–37) — 현재 `md_exporter` 키 1건만 등록
  - `sortProviderTools(providerName, tools)` 순수 함수(라인 49–72)
  - 폴백 규칙: 스코프 외 provider는 입력 그대로 반환(noop, 불변 복사본)
- **수정**: `web-edu/components/agent/wizard/Step4ToolsConfig.tsx`
  - L31: `sortProviderTools` import 추가 (기존 `sortToolProviders` 라인 바로 위, 알파벳 순 유지)
  - L400–406: `loadAvailableTools()`에서 provider 정렬 직후, 각 provider에 대해 `provider.tools`를 `sortProviderTools(provider.name, provider.tools)`로 정렬하여 `setToolProviders`에 넘김
- **신규**: `web-edu/__tests__/components/agent/wizard/sortProviderTools.test.ts`
  - Jest 단위 테스트 5건 (5/5 PASS)

### 직전 hotfix와의 관계 및 구조적 선택(옵션 A)

- 직전 hotfix(`sortToolProviders.ts`, provider 레벨)의 패턴(고정 순서 상수 + 순수 함수)을 **그대로 이어받음**. 정렬 의미/폴백 규칙 동일.
- **옵션 A(별도 파일)** 채택 이유: provider 레벨 정렬과 provider 내부 tool 레벨 정렬은 입력 타입(`ToolProvider` vs `Tool`)과 매핑 스키마(평평한 배열 vs provider-keyed Record)가 달라, 한 파일에 두 책임을 섞으면 파일 역할이 흐려짐. 별도 파일로 분리하되 동일 디렉토리(`components/agent/wizard/`)에 배치하여 찾기 쉽게 유지.
- **단일 적용 지점**: `Step4ToolsConfig.loadAvailableTools()` 한 곳에 꽂음. 직전 hotfix에서 확인했듯이 생성(`app/agents/create/page.tsx`)과 편집(`app/agents/[id]/edit/AgentWizardEditContent.tsx`)이 같은 `Step4ToolsConfig` 컴포넌트를 공유하므로 양쪽 경로 자동 반영. `ToolConfigModal.tsx`는 provider 내부 tools 목록을 렌더하지 않으므로(개별 tool의 설정 모달) 수정 불필요.
- **스코프 한정**: `PROVIDER_TOOL_ORDER`에 등록되지 않은 provider는 `sortProviderTools`가 입력 배열을 그대로 돌려주므로(noop) `md_exporter` 외 다른 provider의 내부 tool 순서는 전혀 변하지 않음. 테스트 case 4로 명시 검증.

### md_exporter 5개 tool 표시명 → 영문 tool name 매핑

YAML의 `identity.name`을 안정 식별자로 채택. 표시명 변경(i18n 편집)과 독립적인 키.

| 요구 표시명(ko_KR) | 영문 tool name | 근거 (파일 경로) |
|---|---|---|
| Markdown을 MD로 | `md_to_md` | `api/core/tools/builtin_tool/providers/md_exporter/tools/md_to_md.yaml` — `identity.name: md_to_md`, `label.ko_KR: "Markdown을 MD로"` |
| Markdown을 DOCX로 | `md_to_docx` | `.../tools/md_to_docx.yaml` — `identity.name: md_to_docx`, `label.ko_KR: "Markdown을 DOCX로"` |
| Markdown을 PPTX로 | `md_to_pptx` | `.../tools/md_to_pptx.yaml` — `identity.name: md_to_pptx`, `label.ko_KR: "Markdown을 PPTX로"` |
| Markdown을 XLSX로 | `md_to_xlsx` | `.../tools/md_to_xlsx.yaml` — `identity.name: md_to_xlsx`, `label.ko_KR: "Markdown을 XLSX로"` |
| Markdown을 HTML로 | `md_to_html` | `.../tools/md_to_html.yaml` — `identity.name: md_to_html`, `label.ko_KR: "Markdown을 HTML로"` |

참고: `md_exporter` 디렉토리에는 위 5개 외에도 `md_to_pdf`, `md_to_csv`, `md_to_json`, `md_to_xml`, `md_to_latex`, `md_to_png`, `md_to_html_text`, `md_to_codeblock`, `md_to_linked_image` 등 추가 tool이 존재. 이들은 이번 명세에 포함되지 않았으므로 폴백 규칙에 따라 5개 뒤에 **서버 응답 순서 유지**하여 배치됨 (testcase 2로 검증).

### 품질 검사 결과

| 명령 | 결과 |
|---|---|
| `pnpm test -- __tests__/components/agent/wizard/sortProviderTools.test.ts` | 5/5 PASS (~0.43s) |
| `npx eslint components/agent/wizard/sortProviderTools.ts components/agent/wizard/Step4ToolsConfig.tsx __tests__/components/agent/wizard/sortProviderTools.test.ts` | 0 warning / 0 error |
| `npx tsc --noEmit` (변경 파일 grep) | 변경 파일 관련 타입 에러 0건 |

### Regression 테스트 케이스 요약

1. **md_exporter 5개 역순 → 명세 순서로 정렬**: 결정성 검증
2. **md_exporter에 5개 + 미지 tool 2개(md_to_pdf, md_to_csv) 섞음**: 5개 먼저 명세 순서, 미지 2개는 입력 순서 유지하여 뒤에
3. **md_exporter 3개만 있는 부분 집합**: 명세 순서의 부분 집합 유지
4. **'webscraper' 등 스코프 외 provider name 입력**: 입력 그대로 반환 (noop, 다른 provider 무영향)
5. **원본 배열 불변성**: 입력 배열 변조하지 않음

### User Briefing

**실행 방법 / 확인 포인트:**

1. `web-edu` 개발서버는 hot reload로 반영됨 (`cd web-edu && pnpm dev`).
2. **생성 경로**: 상단 메뉴 Agents → 새 Agent 생성 → 마법사 Step 4(도구 구성) → **Markdown 변환기** 카드 확장 → 내부 tool이 다음 순서로 노출되는지 확인:
   Markdown을 MD로 → Markdown을 DOCX로 → Markdown을 PPTX로 → Markdown을 XLSX로 → Markdown을 HTML로 → (그 외 tool은 서버 응답 순서대로 뒤에)
3. **편집 경로**: 기존 Agent 편집 → 같은 Step 4 → Markdown 변환기 확장 → 동일 순서 확인.
4. **다른 provider 회귀 확인**: markitdown, OpenAI, 웹 스크래퍼 등 다른 provider의 내부 tool 순서는 이전과 **동일**해야 함 (이번 hotfix는 `md_exporter`에만 적용).
5. **기능 회귀 확인**: 도구 검색/선택/해제, 설정 모달 열기 동작이 이전과 동일한지 확인.
6. **프로덕션 반영**: 정적 자산 변경이므로 `make docker-rebuild` 또는 CI/CD로 web-edu 이미지 재빌드 필요.

### 알려진 제약 / 에스컬레이션 없음

- 5개 tool 전부 YAML `identity.name`으로 1:1 매핑 확인 완료 (에스컬레이션 사유 없음).
- `md_exporter` provider 내부 tool은 단일 지점(`Step4ToolsConfig.loadAvailableTools`)에서만 로드되며 `ToolConfigModal`은 provider 내부 tools 목록 렌더 책임이 없음 → 이중 구현 없음.
- 3회 시도 내 테스트/린트/타입체크 전부 1회차 통과.
