/**
 * User Input Form validation utilities (hotfix_20260414_agent-select-input-default)
 *
 * 백엔드(Dify 원본 `api/core/app/app_config/easy_ui_based_app/variables/manager.py` 및
 *       `api/core/app/app_config/entities.py:VariableEntity`)의 검증 규칙과
 * 동일한 검사를 프론트에서 선제적으로 수행한다.
 *
 * 배경: Agent 생성 시 createApp → updateModelConfig 2단계 요청 중 2단계에서
 *       백엔드 validation이 실패하면 1단계로 이미 생성된 앱이 남아 "에러 + 에이전트 생성됨"
 *       이중 상태가 발생. 프론트에서 최종 저장 전에 동일 규칙을 검사해 네트워크 요청
 *       자체를 차단하고 이중 상태를 원천 방지한다.
 *
 * HOTFIX_USER_FIX (2026-04-14):
 *   - select 단일 가드에서 → 타입별 규칙 테이블로 일반화
 *   - text-input / paragraph / number / select / checkbox / file 모두 커버
 *   - 공통 규칙(label, variable, max_length 등)은 타입과 무관하게 항상 검사
 *   - 알 수 없는 타입은 보수적으로 통과시키지 않음(에러로 보고)
 *
 * 백엔드 규칙 출처 (drift 추적용):
 *   - api/core/app/app_config/easy_ui_based_app/variables/manager.py:97-152
 *       · L113-115  : 허용 type enum 검사 (TEXT_INPUT/PARAGRAPH/NUMBER/SELECT/CHECKBOX/FILE/EXTERNAL_DATA_TOOL)
 *       · L118-122  : label 필수 + string
 *       · L124-128  : variable 필수 + string
 *       · L130-132  : variable 패턴 `^(?!\d)[A-Za-z0-9_...]{1,100}$` (숫자로 시작 금지)
 *       · L136-140  : required boolean
 *       · L142-150  : select — options list 필수 + default가 options에 포함
 *   - api/core/app/app_config/entities.py:92-129 (VariableEntityType / VariableEntity Pydantic)
 *       · max_length: int | None
 *       · options: Sequence[str] (default factory list)
 */

import type { UserInputForm } from '@/types/agent'

export type UserInputFormValidationError = {
  fieldIndex: number
  variable: string
  /**
   * i18n key — `agent` 네임스페이스 내부 상대 경로 (예: `validation.selectOptionsRequired`).
   *
   * 호출부는 `useTranslation('agent')`로 이미 `agent` 네임스페이스에 바인딩되어 있으므로
   * `agent.` 접두사를 붙이면 `agent.agent.validation.*`로 조회돼 miss → raw 키가 그대로
   * 렌더된다 (hotfix_20260414 CR3, 2026-04-14 확인).
   *
   * 따라서 이 유틸은 접두사 없이 반환하고, 호출부는 `t(err.messageKey, err.params)`로
   * 그대로 t() 를 거쳐 사용한다. 다른 네임스페이스(`agent` 외)에서 재사용이 필요해지면
   * 호출 시점에 `t(`agent:${err.messageKey}`, ...)`로 네임스페이스를 명시한다.
   */
  messageKey: string
  /** extra interpolation payload for i18n */
  params?: Record<string, unknown>
}

/**
 * 백엔드 manager.py:130 의 정규식과 동일.
 * `^(?!\d)[\u4e00-\u9fa5A-Za-z0-9_<emoji ranges>]{1,100}$`
 *
 * 프론트 입장에서 ASCII + 한자 + 이모지 일부를 허용하되, 우리 UI는
 * 이미 입력 시점에 영문/숫자/언더스코어로 sanitize 하므로(`UserInputFormBuilder.handleFieldChange`),
 * 여기서는 백엔드와 동일한 패턴으로 마지막 방어만 한다.
 */
const VARIABLE_NAME_PATTERN =
  /^(?!\d)[\u4e00-\u9fa5A-Za-z0-9_\u{1F300}-\u{1F64F}\u{1F680}-\u{1F6FF}]{1,100}$/u

/**
 * 백엔드가 user_input_form에서 수용하는 모든 타입.
 * (EXTERNAL_DATA_TOOL은 별도 경로라 본 가드에서 제외)
 */
const KNOWN_INPUT_TYPES: ReadonlyArray<UserInputForm['input_type']> = [
  'text-input',
  'paragraph',
  'number',
  'select',
  'checkbox',
  'file',
]

/** 단일 필드 검증 함수. 에러는 errors 배열에 push한다. */
type FieldValidator = (
  field: UserInputForm,
  index: number,
  errors: UserInputFormValidationError[],
) => 'stop' | 'continue'

/**
 * 모든 타입에 공통으로 적용되는 검증.
 * (manager.py L118-140 — label/variable/required)
 *
 * `'stop'` 반환 시 호출자는 이후 타입별 검증을 건너뛴다.
 * (예: variable 자체가 깨졌으면 타입별 추가 검사를 해도 의미가 없다)
 */
const COMMON_VALIDATORS: FieldValidator[] = [
  // label 필수
  (field, index, errors) => {
    const label = (field.label ?? '').toString().trim()
    if (label === '') {
      errors.push({
        fieldIndex: index,
        variable: field.variable,
        messageKey: 'validation.labelRequired',
      })
      return 'stop'
    }
    return 'continue'
  },
  // variable 필수 + 패턴
  (field, index, errors) => {
    const variable = (field.variable ?? '').toString()
    if (variable === '') {
      errors.push({
        fieldIndex: index,
        variable,
        messageKey: 'validation.invalidVariableName',
      })
      return 'stop'
    }
    if (!VARIABLE_NAME_PATTERN.test(variable)) {
      errors.push({
        fieldIndex: index,
        variable,
        messageKey: 'validation.invalidVariableName',
      })
      return 'stop'
    }
    return 'continue'
  },
  // 알 수 없는 input_type 거부 (보수적 가드)
  (field, index, errors) => {
    if (!KNOWN_INPUT_TYPES.includes(field.input_type)) {
      errors.push({
        fieldIndex: index,
        variable: field.variable,
        messageKey: 'validation.unknownInputType',
        params: { type: String(field.input_type) },
      })
      return 'stop'
    }
    return 'continue'
  },
  // max_length: 있다면 양의 정수
  // (entities.py:115 max_length: int | None)
  (field, index, errors) => {
    if (field.max_length === undefined || field.max_length === null) return 'continue'
    const maxLen = field.max_length
    if (!Number.isInteger(maxLen) || maxLen <= 0) {
      errors.push({
        fieldIndex: index,
        variable: field.variable,
        messageKey: 'validation.maxLengthMustBePositiveInteger',
        params: { max_length: maxLen },
      })
    }
    return 'continue'
  },
]

/**
 * 옵션을 가질 수 있는 타입(select)에서 옵션 잔여 검사를 수행하는 헬퍼.
 * 옵션 비-허용 타입(text-input, number 등)에 options가 잔여로 남아있으면 에러.
 */
const noStrayOptionsValidator: FieldValidator = (field, index, errors) => {
  if (field.options && field.options.length > 0) {
    errors.push({
      fieldIndex: index,
      variable: field.variable,
      messageKey: 'validation.optionsNotAllowedForType',
      params: { type: field.input_type },
    })
  }
  return 'continue'
}

/**
 * default가 max_length를 넘지 않는지 검사하는 헬퍼.
 * (text-input / paragraph 공통)
 */
const defaultWithinMaxLength: FieldValidator = (field, index, errors) => {
  const def = (field.default_value ?? '').toString()
  if (def === '') return 'continue'
  if (
    field.max_length !== undefined &&
    field.max_length !== null &&
    Number.isInteger(field.max_length) &&
    field.max_length > 0 &&
    def.length > field.max_length
  ) {
    errors.push({
      fieldIndex: index,
      variable: field.variable,
      messageKey: 'validation.defaultExceedsMaxLength',
      params: { max_length: field.max_length, length: def.length },
    })
  }
  return 'continue'
}

/**
 * 타입별 규칙 테이블.
 * 새로운 입력 타입에 구조적 검증이 필요해지면 여기에 한 줄만 추가하면 된다.
 *
 * 규칙 출처 (백엔드 → 프론트 매핑):
 *   - select   : manager.py:142-150
 *   - number   : entities.py:115 (max_length) + 사용자 CR(2026-04-14, number 동일 증상 보고)
 *   - text/par : manager.py 공통 + entities.py max_length 의존
 *   - file     : manager.py 분기 (validate 누락 — 프론트는 구조 안정성만 확인)
 *   - checkbox : manager.py 분기 (default 자유, 옵션 없음)
 */
const TYPE_RULES: Record<UserInputForm['input_type'], FieldValidator[]> = {
  select: [
    // 1) options가 최소 1개 이상 있어야 한다 (manager.py:143)
    (field, index, errors) => {
      const options = field.options || []
      if (options.length === 0) {
        errors.push({
          fieldIndex: index,
          variable: field.variable,
          messageKey: 'validation.selectOptionsRequired',
        })
        return 'stop' // options가 없으면 default 검사 의미 없음 → 조기 종료
      }
      return 'continue'
    },
    // 2) default가 비어있지 않다면 options에 포함돼야 한다 (manager.py:149)
    (field, index, errors) => {
      const options = field.options || []
      const defaultValue = field.default_value || ''
      if (defaultValue && !options.includes(defaultValue)) {
        errors.push({
          fieldIndex: index,
          variable: field.variable,
          messageKey: 'validation.selectDefaultMustBeInOptions',
          params: { default: defaultValue, options: options.join(', ') },
        })
      }
      return 'continue'
    },
  ],
  number: [
    // 1) default가 비어있거나 유한한 숫자여야 한다
    (field, index, errors) => {
      const defaultValue = (field.default_value ?? '').toString().trim()
      if (defaultValue === '') return 'continue' // optional
      const parsed = Number(defaultValue)
      if (!Number.isFinite(parsed)) {
        errors.push({
          fieldIndex: index,
          variable: field.variable,
          messageKey: 'validation.numberDefaultMustBeNumeric',
          params: { default: defaultValue },
        })
        return 'stop'
      }
      return 'continue'
    },
    // 2) options 잔여 금지 (input_type을 select → number로 바꾼 회귀 케이스 방어
    //    — 사용자 CR 2026-04-14: number에서 동일 select 메시지 재현 보고)
    noStrayOptionsValidator,
  ],
  'text-input': [
    defaultWithinMaxLength,
    noStrayOptionsValidator,
  ],
  paragraph: [
    defaultWithinMaxLength,
    noStrayOptionsValidator,
  ],
  checkbox: [
    // checkbox는 백엔드에서 default 검증이 없다.
    // 옵션 잔여만 거부.
    noStrayOptionsValidator,
  ],
  file: [
    // file은 메타(allowed_file_types/extensions)가 entities.py에 있으나
    // 우리 UI(UserInputFormBuilder)는 file 메타를 노출하지 않으므로 옵션 잔여만 검사.
    // (메타 확장 시 별도 hotfix로 추가)
    noStrayOptionsValidator,
  ],
}

/**
 * user_input_form 전체를 검증하고 모든 에러를 수집한다.
 *
 * 각 필드에 대해:
 *   1. 공통 검증을 모두 적용 (label/variable/maxLength 등)
 *   2. 공통 검증이 'stop'을 반환하지 않았다면 타입별 검증을 차례로 적용
 *
 * @returns 빈 배열이면 통과, 아니면 에러 목록.
 */
export function validateUserInputForm(fields: UserInputForm[] | undefined | null): UserInputFormValidationError[] {
  const errors: UserInputFormValidationError[] = []

  if (!fields || fields.length === 0) {
    return errors
  }

  // variable 중복 검사 (manager.py에는 명시적 중복 검사 없으나 user_input_form 변수명 충돌은
  // 이후 prompt rendering 단계에서 모호성을 만들므로 프론트에서 막는다)
  const seen = new Map<string, number>()
  fields.forEach((field, index) => {
    const v = (field.variable ?? '').toString()
    if (v && seen.has(v)) {
      errors.push({
        fieldIndex: index,
        variable: v,
        messageKey: 'validation.duplicateVariable',
        params: { variable: v, firstIndex: seen.get(v)! + 1 },
      })
    } else if (v) {
      seen.set(v, index)
    }
  })

  fields.forEach((field, index) => {
    // 1) 공통 검증
    let stopped = false
    for (const validate of COMMON_VALIDATORS) {
      const result = validate(field, index, errors)
      if (result === 'stop') {
        stopped = true
        break
      }
    }
    if (stopped) return

    // 2) 타입별 검증
    const validators = TYPE_RULES[field.input_type]
    if (!validators) return // KNOWN_INPUT_TYPES 가드를 통과했으므로 거의 도달하지 않음

    for (const validate of validators) {
      const result = validate(field, index, errors)
      if (result === 'stop') break
    }
  })

  return errors
}

/**
 * 여러 에러 중 첫 번째를 사용자 토스트용 메시지 키로 반환. 없으면 null.
 * (i18n 문자열 interpolation은 호출부에서 처리)
 */
export function firstValidationError(
  errors: UserInputFormValidationError[]
): UserInputFormValidationError | null {
  return errors[0] ?? null
}
