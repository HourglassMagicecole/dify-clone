# Hotfix 20260413 — Dataset 자동 설명 생성 시 모델 비활성 예외

**Severity**: P1 (운영 로그에 ERROR stack trace 노이즈)
**Route**: lightweight
**Created**: 2026-04-13

## 증상

지식베이스 생성 시 `generate_dataset_description_task`가 아래 예외 발생:
```
ValueError: Model gpt-4 is disabled.
  at core/entities/provider_configuration.py:107 get_current_credentials
  via core/llm_generator/llm_generator.py:363 generate_dataset_description
       ModelManager.get_default_model_instance(tenant_id, ModelType.LLM)
```

Celery task는 `except Exception`으로 포착되어 `succeeded: None`으로 종료. 지식베이스 생성 자체는 성공하지만 자동 description이 비어 있고 로그에 ERROR + stack trace가 노출됨.

## 근본 원인

테넌트 기본 LLM으로 `gpt-4`가 지정되어 있으나 해당 모델이 비활성 상태. `get_default_model_instance`는 대안 모델을 탐색하지 않고 즉시 예외.

## 수정 방향 (승인됨)

`LLMGenerator.generate_dataset_description`에서 **처음부터 현재 활성화된 LLM 모델을 사용**한다:
1. 테넌트의 `ProviderManager.get_configurations(tenant_id)`로 활성 provider configuration들을 조회
2. 각 configuration에서 활성화된(enabled) LLM 모델 중 첫 번째를 선택 → `get_model_instance(provider, model)`로 인스턴스 생성
3. 활성 LLM이 하나도 없으면 WARNING 로그 후 빈 문자열 반환 (task는 graceful skip, 예외 전파 X)

`get_default_model_instance`는 저장된 default 모델을 강제 참조해 disabled 상태에서도 `ValueError`를 던지므로 사용하지 않는다.

## 수정 범위

- `api/core/llm_generator/llm_generator.py` — `generate_dataset_description` 메서드 내 모델 조회 로직만 보강
- `api/tests/unit_tests/core/llm_generator/test_generate_dataset_description.py` — regression test 신규 또는 기존 테스트 파일 확장

## Acceptance

- [x] 활성 LLM이 존재하면 그 중 하나로 description 생성 (default 모델 설정과 무관)
- [x] 활성 LLM이 없으면 WARNING 로그 후 빈 문자열 반환 (예외 전파 X)
- [x] stale default 모델(`gpt-4 disabled`) 케이스에서 ERROR stack trace 사라짐
- [x] 변경 파일 ruff 통과
- [x] regression test 통과

## Dev Agent Record

### 변경 파일
- `api/core/llm_generator/llm_generator.py` — `generate_dataset_description` 메서드의 모델 조회 로직만 교체
- `api/tests/unit_tests/core/llm_generator/__init__.py` — 신규 (빈 패키지 마커)
- `api/tests/unit_tests/core/llm_generator/test_generate_dataset_description.py` — 신규 regression 테스트 3케이스

### 수정 요약
`ModelManager.get_default_model_instance(tenant_id, ModelType.LLM)` 호출을 제거하고 다음 흐름으로 변경:
1. `ProviderManager().get_configurations(tenant_id)` 로 `ProviderConfigurations` 획득
2. `configurations.get_models(model_type=ModelType.LLM, only_active=True)` 로 활성 LLM 목록 조회
3. 첫 번째 활성 모델의 `(provider, model)` 로 `ModelManager().get_model_instance(...)` 인스턴스화
4. 활성 LLM이 0건이면 `logger.warning(...)` 후 `""` 반환 — 예외 전파하지 않아 Celery task가 graceful skip

메서드 외부 로직(프롬프트 조립, truncation, 500자 제한)은 그대로 유지. `ProviderManager` import는 메서드 내부 지역 import로 두어 모듈 로드 순환을 피함.

### 사용한 활성 LLM 조회 API
- `core.provider_manager.ProviderManager.get_configurations(tenant_id) -> ProviderConfigurations`
- `ProviderConfigurations.get_models(model_type: ModelType, only_active: bool) -> list[ModelWithProviderEntity]`
  - `entry.provider.provider` (provider 이름), `entry.model` (모델 이름) 사용
- (`core/entities/provider_configuration.py:1777` 정의 확인)

### Lint / Test 결과
```
$ uv run ruff format core/llm_generator/llm_generator.py tests/unit_tests/core/llm_generator/test_generate_dataset_description.py
1 file reformatted, 1 file left unchanged

$ uv run ruff check <same files>
All checks passed!

$ uv run pytest tests/unit_tests/core/llm_generator/test_generate_dataset_description.py -v
test_generate_dataset_description_uses_first_active_llm PASSED               [ 33%]
test_generate_dataset_description_returns_empty_when_no_active_llm PASSED    [ 66%]
test_generate_dataset_description_does_not_use_default_model_path PASSED     [100%]
======================== 3 passed, 2 warnings in 4.11s =========================
```

### 주의사항
- 선택 모델은 `ProviderConfigurations` 순회 순서의 첫 활성 LLM에 의존 — 테넌트 구성에 따라 달라질 수 있음 (User Briefing 에 명시됨).
- 동일 이슈 패턴(`get_default_model_instance` 호출로 stale default → ValueError)이 `LLMGenerator`의 다른 메서드(`generate_conversation_name` 등)에도 존재하나, 범위 유지를 위해 이번 수정에는 포함하지 않음. 필요 시 별도 hotfix 로 다룰 것.

### CR 수정 (2026-04-13, HOTFIX_USER_FIX)

User verify 중 후속 예외 보고: `AttributeError: 'list' object has no attribute 'strip'`.
원인: 일부 provider/모델에서 `response.message.content`가 `list[PromptMessageContent]` (멀티모달 content parts)로 반환됨. 기존 코드는 `cast(str, ...)` 후 `.strip()` 호출 → 런타임에서 list에 대한 `.strip()` 실패.

**변경 파일**:
- `api/core/llm_generator/llm_generator.py` — `generate_dataset_description` 응답 처리부 (라인 391 주변)
- `api/tests/unit_tests/core/llm_generator/test_generate_dataset_description.py` — list content 케이스 테스트 1개 추가

**변경 요약**:
- `response.message.content`가 `str`이면 기존처럼 사용.
- `list`이면 각 part의 `data` 속성(텍스트)만 추출해 concat. 텍스트가 아닌 파트(`data` 없는 이미지 등)는 무시.
- 그 외 타입은 빈 문자열로 방어.
- 기존 500자 truncation 규칙은 유지.
- `TextPromptMessageContent` (`api/core/model_runtime/entities/message_entities.py:72`) 의 텍스트 필드명은 `data`.

**Lint / Test 결과**:
```
$ uv run ruff format <files> && uv run ruff check <files>
2 files left unchanged
All checks passed!

$ uv run pytest tests/unit_tests/core/llm_generator/test_generate_dataset_description.py -v
4 passed (기존 3 + list content 케이스 1 신규)
```

**남은 이슈**: 없음.

## User Briefing (HOTFIX_USER_VERIFY용)

**확인 방법**: 기존에 ERROR가 났던 테넌트에서 지식베이스 신규 생성 → worker 로그에 ERROR stack trace 없이 정상 종료 + description 자동 생성 확인.
**수정 요약**: stale한 default 모델 대신 현재 활성화된 LLM을 직접 조회해 사용.
**알려진 제약**: 선택되는 모델은 provider configuration 순회 순서에 의존 (첫 활성 LLM).

## CR 2차 수정 (diagnostic + TEXT type filter + reasoning fallback)

**배경**: 1차 CR 수정 후 ERROR는 사라졌으나 description이 빈 문자열로 저장됨. LLM invoke가 5.1s 걸렸으므로 응답 본문은 존재. list content에서 잘못된 파트를 읽거나, 텍스트가 `reasoning_content` 필드로 오는 provider 가능성 의심.

**변경 사항** (`api/core/llm_generator/llm_generator.py::generate_dataset_description`):
1. `invoke_llm` 직후 진단용 `logger.info` 추가 — `type(content).__name__`, `repr(content)[:500]`, `reasoning_content`(있을 때만).
2. list content 파싱 강화 — `PromptMessageContentType.TEXT` 인 파트만 `.data`로 수집. non-TEXT 파트는 `.data`가 URL 등일 수 있으므로 제외. TEXT 파트 0개면 WARNING으로 part_type 목록 기록.
3. `reasoning_content` fallback — 최종 description이 비어있고 `response.message.reasoning_content`에 텍스트가 있으면 그것을 사용.
4. `PromptMessageContentType` import 추가.

**테스트 업데이트** (`tests/unit_tests/core/llm_generator/test_generate_dataset_description.py`):
- `test_generate_dataset_description_handles_list_content`: 파트에 `type` 속성 추가 (TEXT/IMAGE). image_part는 `.data=URL` 이지만 TEXT가 아니어서 무시됨을 검증.

**Lint / Test 결과**:
```
$ uv run ruff format core/llm_generator/llm_generator.py && uv run ruff check core/llm_generator/llm_generator.py
1 file left unchanged
All checks passed!

$ uv run pytest tests/unit_tests/core/llm_generator/test_generate_dataset_description.py -v
4 passed
```

**다음 단계**: 사용자가 재배포 → 지식베이스 생성 재시도 → worker 로그의 `generate_dataset_description diagnostic: ...` INFO 라인을 공유 받아 원인 재분석.

## Lifecycle Log

### HOTFIX_USER_VERIFY — 2026-04-13 16:32
- Approved — 활성 LLM 기반 조회 + get_text_content() 단순화로 정상 동작 확인


### HOTFIX_USER_FIX — 2026-04-13 (CR2)
- diagnostic logging + TEXT-only filter + reasoning_content fallback 추가, tests 4 passed

### HOTFIX_USER_FIX — 2026-04-13 16:14
- list content 처리 추가 (TextPromptMessageContent.data 추출), tests 4 passed


### HOTFIX_USER_VERIFY — 2026-04-13 16:12
- CR — 활성 모델 조회는 성공했으나 response.message.content가 list일 때 AttributeError: 'list' object has no attribute 'strip' 발생


### HOTFIX_IMPL — 2026-04-13 15:59
- Scoped lint PASS, regression tests 3 passed (active LLM/no active/default path not used)


### BUG_TRIAGE — 2026-04-13
- Severity: P1, Route: lightweight
- Root cause: default model `gpt-4` disabled, no fallback logic in generate_dataset_description
