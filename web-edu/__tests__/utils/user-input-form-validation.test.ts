/**
 * User Input Form Validation Tests (hotfix_20260414_agent-select-input-default)
 *
 * 백엔드(Dify 원본) validate_variables_and_set_defaults 규칙과 동일한
 * 프론트 선제 가드를 검증한다.
 *
 * HOTFIX_USER_FIX (2026-04-14):
 *   - 타입별 규칙 테이블 일반화 후 회귀 보장 + 신규 타입(number/text/paragraph/file/checkbox) 케이스 추가.
 */

import {
  validateUserInputForm,
  firstValidationError,
} from '@/utils/user-input-form-validation'
import type { UserInputForm } from '@/types/agent'

// 공통 valid 필드 팩토리: label/variable/타입만 다르게 줘서 회귀 케이스를 깔끔히 작성한다.
const f = (overrides: Partial<UserInputForm> & Pick<UserInputForm, 'input_type'>): UserInputForm => ({
  variable: overrides.variable ?? 'v',
  label: overrides.label ?? 'L',
  required: overrides.required ?? false,
  ...overrides,
}) as UserInputForm

describe('validateUserInputForm — basic & empty', () => {
  it('returns no errors for empty or undefined form', () => {
    expect(validateUserInputForm(undefined)).toEqual([])
    expect(validateUserInputForm(null)).toEqual([])
    expect(validateUserInputForm([])).toEqual([])
  })

  it('returns no errors for valid fields of every supported type (regression guard)', () => {
    const fields: UserInputForm[] = [
      f({ variable: 'q', label: 'Q', input_type: 'text-input', default_value: 'anything' }),
      f({ variable: 'p', label: 'P', input_type: 'paragraph', default_value: 'anything' }),
      f({ variable: 'n', label: 'N', input_type: 'number', default_value: '42' }),
      f({ variable: 'c', label: 'C', input_type: 'checkbox' }),
      f({ variable: 'fl', label: 'F', input_type: 'file' }),
      f({ variable: 'sel', label: 'S', input_type: 'select', options: ['a'], default_value: 'a' }),
    ]
    expect(validateUserInputForm(fields)).toEqual([])
  })
})

describe('validateUserInputForm — common rules (label/variable/maxLength)', () => {
  it('flags missing label', () => {
    const errors = validateUserInputForm([
      f({ variable: 'a', label: '', input_type: 'text-input' }),
    ])
    expect(errors).toHaveLength(1)
    expect(errors[0]?.messageKey).toBe('validation.labelRequired')
  })

  it('flags variable starting with a digit (backend manager.py:130 regex)', () => {
    const errors = validateUserInputForm([
      f({ variable: '1abc', label: 'A', input_type: 'text-input' }),
    ])
    expect(errors).toHaveLength(1)
    expect(errors[0]?.messageKey).toBe('validation.invalidVariableName')
  })

  it('flags empty variable', () => {
    const errors = validateUserInputForm([
      f({ variable: '', label: 'A', input_type: 'text-input' }),
    ])
    expect(errors).toHaveLength(1)
    expect(errors[0]?.messageKey).toBe('validation.invalidVariableName')
  })

  it('flags non-positive max_length', () => {
    const errors = validateUserInputForm([
      f({ variable: 'a', label: 'A', input_type: 'text-input', max_length: 0 }),
      f({ variable: 'b', label: 'B', input_type: 'text-input', max_length: -1 }),
    ])
    expect(errors).toHaveLength(2)
    expect(errors.every(e => e.messageKey === 'validation.maxLengthMustBePositiveInteger')).toBe(true)
  })

  it('flags duplicate variable names', () => {
    const errors = validateUserInputForm([
      f({ variable: 'dup', label: 'A', input_type: 'text-input' }),
      f({ variable: 'dup', label: 'B', input_type: 'text-input' }),
    ])
    expect(errors.some(e => e.messageKey === 'validation.duplicateVariable')).toBe(true)
  })

  it('flags unknown input_type', () => {
    const errors = validateUserInputForm([
      // @ts-expect-error — intentionally bad type for fallback test
      f({ variable: 'a', label: 'A', input_type: 'date-picker' }),
    ])
    expect(errors).toHaveLength(1)
    expect(errors[0]?.messageKey).toBe('validation.unknownInputType')
  })
})

describe('validateUserInputForm — select rules (회귀 보장)', () => {
  it('flags select field with empty options (핵심 재현 케이스 1)', () => {
    const errors = validateUserInputForm([
      f({ variable: 'color', label: 'Color', input_type: 'select', options: [], default_value: '' }),
    ])
    expect(errors).toHaveLength(1)
    expect(errors[0]).toMatchObject({
      fieldIndex: 0,
      variable: 'color',
      messageKey: 'validation.selectOptionsRequired',
    })
  })

  it('flags select field with default value but empty options (원본 핵심 버그)', () => {
    const errors = validateUserInputForm([
      f({ variable: 'color', label: 'Color', input_type: 'select', options: [], default_value: 'red' }),
    ])
    expect(errors).toHaveLength(1)
    expect(errors[0]?.messageKey).toBe('validation.selectOptionsRequired')
  })

  it('flags select field whose default is not in options', () => {
    const errors = validateUserInputForm([
      f({ variable: 'color', label: 'Color', input_type: 'select', options: ['red', 'blue'], default_value: 'green' }),
    ])
    expect(errors).toHaveLength(1)
    expect(errors[0]?.messageKey).toBe('validation.selectDefaultMustBeInOptions')
  })

  it('accepts select field with default matching one of options', () => {
    expect(
      validateUserInputForm([
        f({ variable: 'color', label: 'Color', input_type: 'select', options: ['red', 'blue'], default_value: 'red' }),
      ])
    ).toEqual([])
  })

  it('accepts select field with options and empty/undefined default', () => {
    expect(
      validateUserInputForm([
        f({ variable: 'a', label: 'A', input_type: 'select', options: ['red'], default_value: '' }),
        f({ variable: 'b', label: 'B', input_type: 'select', options: ['red'] }),
      ])
    ).toEqual([])
  })

  it('accepts select field with single option when default matches (boundary)', () => {
    expect(
      validateUserInputForm([
        f({ variable: 'c', label: 'C', input_type: 'select', options: ['only'], default_value: 'only' }),
      ])
    ).toEqual([])
  })

  it('collects errors from multiple invalid select fields', () => {
    const errors = validateUserInputForm([
      f({ variable: 'a', label: 'A', input_type: 'select', options: [], default_value: 'x' }),
      f({ variable: 'b', label: 'B', input_type: 'text-input', default_value: 'ok' }),
      f({ variable: 'c', label: 'C', input_type: 'select', options: ['one'], default_value: 'two' }),
    ])
    expect(errors).toHaveLength(2)
    expect(errors.map(e => e.variable)).toEqual(['a', 'c'])
    expect(errors[0]?.messageKey).toBe('validation.selectOptionsRequired')
    expect(errors[1]?.messageKey).toBe('validation.selectDefaultMustBeInOptions')
  })
})

describe('validateUserInputForm — number rules (CR1: 사용자 보고 케이스)', () => {
  it('accepts number field with numeric default', () => {
    expect(
      validateUserInputForm([
        f({ variable: 'n', label: 'N', input_type: 'number', default_value: '42' }),
        f({ variable: 'm', label: 'M', input_type: 'number', default_value: '-3.14' }),
      ])
    ).toEqual([])
  })

  it('accepts number field with empty default', () => {
    expect(
      validateUserInputForm([
        f({ variable: 'n', label: 'N', input_type: 'number', default_value: '' }),
        f({ variable: 'm', label: 'M', input_type: 'number' }),
      ])
    ).toEqual([])
  })

  it('flags number field with non-numeric default', () => {
    const errors = validateUserInputForm([
      f({ variable: 'n', label: 'N', input_type: 'number', default_value: 'abc' }),
    ])
    expect(errors).toHaveLength(1)
    expect(errors[0]?.messageKey).toBe('validation.numberDefaultMustBeNumeric')
  })

  it('flags number field that retains stray options (select → number 회귀)', () => {
    const errors = validateUserInputForm([
      f({ variable: 'n', label: 'N', input_type: 'number', options: ['a', 'b'] }),
    ])
    expect(errors).toHaveLength(1)
    expect(errors[0]?.messageKey).toBe('validation.optionsNotAllowedForType')
  })

  it('flags number field with invalid max_length', () => {
    const errors = validateUserInputForm([
      f({ variable: 'n', label: 'N', input_type: 'number', max_length: 0 }),
    ])
    expect(errors).toHaveLength(1)
    expect(errors[0]?.messageKey).toBe('validation.maxLengthMustBePositiveInteger')
  })
})

describe('validateUserInputForm — text-input / paragraph rules', () => {
  it('accepts text-input default within max_length (boundary equal)', () => {
    expect(
      validateUserInputForm([
        f({ variable: 't', label: 'T', input_type: 'text-input', max_length: 5, default_value: 'hello' }),
      ])
    ).toEqual([])
  })

  it('flags text-input default exceeding max_length', () => {
    const errors = validateUserInputForm([
      f({ variable: 't', label: 'T', input_type: 'text-input', max_length: 3, default_value: 'hello' }),
    ])
    expect(errors).toHaveLength(1)
    expect(errors[0]?.messageKey).toBe('validation.defaultExceedsMaxLength')
  })

  it('flags paragraph default exceeding max_length', () => {
    const errors = validateUserInputForm([
      f({ variable: 'p', label: 'P', input_type: 'paragraph', max_length: 4, default_value: 'overflow' }),
    ])
    expect(errors).toHaveLength(1)
    expect(errors[0]?.messageKey).toBe('validation.defaultExceedsMaxLength')
  })

  it('flags text-input that retains stray options (select → text-input 회귀)', () => {
    const errors = validateUserInputForm([
      f({ variable: 't', label: 'T', input_type: 'text-input', options: ['x'] }),
    ])
    expect(errors).toHaveLength(1)
    expect(errors[0]?.messageKey).toBe('validation.optionsNotAllowedForType')
  })

  it('accepts text-input/paragraph without max_length (no length boundary)', () => {
    expect(
      validateUserInputForm([
        f({ variable: 't', label: 'T', input_type: 'text-input', default_value: 'a'.repeat(1000) }),
        f({ variable: 'p', label: 'P', input_type: 'paragraph', default_value: 'a'.repeat(1000) }),
      ])
    ).toEqual([])
  })
})

describe('validateUserInputForm — checkbox / file rules', () => {
  it('accepts checkbox without default', () => {
    expect(validateUserInputForm([f({ variable: 'c', label: 'C', input_type: 'checkbox' })])).toEqual([])
  })

  it('flags checkbox with stray options', () => {
    const errors = validateUserInputForm([
      f({ variable: 'c', label: 'C', input_type: 'checkbox', options: ['yes', 'no'] }),
    ])
    expect(errors).toHaveLength(1)
    expect(errors[0]?.messageKey).toBe('validation.optionsNotAllowedForType')
  })

  it('accepts file without default and options', () => {
    expect(validateUserInputForm([f({ variable: 'fl', label: 'F', input_type: 'file' })])).toEqual([])
  })

  it('flags file with stray options', () => {
    const errors = validateUserInputForm([
      f({ variable: 'fl', label: 'F', input_type: 'file', options: ['x'] }),
    ])
    expect(errors).toHaveLength(1)
    expect(errors[0]?.messageKey).toBe('validation.optionsNotAllowedForType')
  })
})

describe('firstValidationError', () => {
  it('returns null for empty error list', () => {
    expect(firstValidationError([])).toBeNull()
  })

  it('returns the first error', () => {
    const err1 = { fieldIndex: 0, variable: 'a', messageKey: 'k1' }
    const err2 = { fieldIndex: 1, variable: 'b', messageKey: 'k2' }
    expect(firstValidationError([err1, err2])).toBe(err1)
  })
})

describe('messageKey i18n contract (CR3 회귀 방지)', () => {
  // 호출부가 `useTranslation('agent')`로 `agent` 네임스페이스에 바인딩된 상태에서
  // `t(err.messageKey)`를 호출한다. 이때 `messageKey`에 `agent.` 접두사가 들어가 있으면
  // 실제 조회 경로가 `agent.agent.validation.*`가 되어 raw 키가 그대로 렌더된다.
  // 이번 CR3(2026-04-14)에서 실제로 사용자에게 raw `agent.validation.selectOptionsRequired`가
  // 노출됐던 사건을 회귀 방지로 고정한다.

  it('never prefixes messageKey with the "agent." namespace', () => {
    const fields: UserInputForm[] = [
      f({ variable: 'a', label: '', input_type: 'text-input' }),
      f({ variable: '1bad', label: 'L', input_type: 'text-input' }),
      f({ variable: 's', label: 'S', input_type: 'select', options: [], default_value: 'x' }),
      f({ variable: 's2', label: 'S2', input_type: 'select', options: ['a'], default_value: 'b' }),
      f({ variable: 'n', label: 'N', input_type: 'number', default_value: 'nope' }),
      f({ variable: 't', label: 'T', input_type: 'text-input', max_length: 2, default_value: 'long' }),
      f({ variable: 'dup', label: 'A', input_type: 'text-input' }),
      f({ variable: 'dup', label: 'B', input_type: 'text-input' }),
    ]
    const errors = validateUserInputForm(fields)
    expect(errors.length).toBeGreaterThan(0)
    for (const e of errors) {
      expect(e.messageKey.startsWith('agent.')).toBe(false)
      // 또한 네임스페이스 상대 경로 계약: `validation.<camelCase>` 형태
      expect(e.messageKey).toMatch(/^validation\.[A-Za-z]/)
    }
  })

  it('keys translate via mocked t() bound to the agent namespace (no raw leakage)', () => {
    // i18next가 `agent` 네임스페이스에 바인딩된 상태에서 `t('validation.xxx')`만 hit하고
    // `t('agent.validation.xxx')`는 miss(raw 반환)하는 동작을 모사해 계약을 고정한다.
    const dict: Record<string, string> = {
      'validation.selectOptionsRequired': '선택 타입 필드에는 옵션이 필요합니다',
      'validation.selectDefaultMustBeInOptions': '기본값은 옵션 중 하나여야 합니다',
    }
    const tMock = jest.fn((key: string) => dict[key] ?? key)

    const errors = validateUserInputForm([
      f({ variable: 'color', label: 'Color', input_type: 'select', options: [], default_value: 'red' }),
    ])
    expect(errors).toHaveLength(1)

    const translated = tMock(errors[0]!.messageKey)
    expect(translated).toBe('선택 타입 필드에는 옵션이 필요합니다')
    expect(translated.includes('agent.')).toBe(false)
    expect(translated.startsWith('validation.')).toBe(false)
    expect(tMock).toHaveBeenCalledWith('validation.selectOptionsRequired')
  })
})
