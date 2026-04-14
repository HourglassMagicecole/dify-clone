'use client'

import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { PlusIcon, TrashIcon, ArrowsUpDownIcon } from '@heroicons/react/24/outline'
import type { UserInputForm } from '@/types/agent'

/**
 * OptionsInput Component
 *
 * Handles comma-separated options input with local state
 * to prevent comma from being stripped during typing.
 */
interface OptionsInputProps {
  value: string[]
  onChange: (options: string[]) => void
  placeholder: string
  className: string
}

function OptionsInput({ value, onChange, placeholder, className }: OptionsInputProps) {
  const [localValue, setLocalValue] = useState(value.join(', '))

  // Sync local state when external value changes (e.g., initial load)
  useEffect(() => {
    setLocalValue(value.join(', '))
  }, [value])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setLocalValue(e.target.value)
  }

  const handleBlur = () => {
    // Convert to array only on blur
    const options = localValue
      .split(',')
      .map(opt => opt.trim())
      .filter(Boolean)
    onChange(options)
  }

  return (
    <input
      type="text"
      value={localValue}
      onChange={handleChange}
      onBlur={handleBlur}
      placeholder={placeholder}
      className={className}
    />
  )
}

interface UserInputFormBuilderProps {
  fields: UserInputForm[]
  onChange: (fields: UserInputForm[]) => void
  onPreview?: () => void
}

/**
 * UserInputFormBuilder Component
 *
 * Allows users to define input form fields for completion-mode agents.
 * Features:
 * - Add/remove fields dynamically
 * - Drag and drop to reorder (visual only, basic implementation)
 * - Field type selection
 * - Variable name validation (snake_case)
 * - Options definition for select type
 */
export function UserInputFormBuilder({ fields, onChange, onPreview }: UserInputFormBuilderProps) {
  const { t } = useTranslation('agent')

  /**
   * Add a new field with default values
   */
  const handleAddField = () => {
    const newField: UserInputForm = {
      variable: `field_${fields.length + 1}`,
      label: '',
      input_type: 'text-input',
      required: false,
      default_value: '',
    }
    onChange([...fields, newField])
  }

  /**
   * Remove a field by index
   */
  const handleRemoveField = (index: number) => {
    const newFields = fields.filter((_, i) => i !== index)
    onChange(newFields)
  }

  /**
   * Update a specific field property
   */
  const handleFieldChange = (index: number, property: keyof UserInputForm, value: string | boolean | string[] | number) => {
    const newFields = [...fields]

    // Special handling for variable name: convert to snake_case
    if (property === 'variable' && typeof value === 'string') {
      value = value.toLowerCase().replace(/[^a-z0-9_]/g, '_')
    }

    // Create updated field
    const updatedField = {
      ...newFields[index],
      [property]: value,
    } as UserInputForm

    // Special handling for input_type: clear type-incompatible residue
    // (hotfix_20260414_agent-select-input-default HOTFIX_USER_FIX:
    //  타입 전환 시 default_value/options 잔여 데이터가 백엔드 검증을 트리거하는 회귀 방지)
    if (property === 'input_type') {
      // 옵션은 select 타입에만 의미가 있다
      if (value !== 'select') {
        delete updatedField.options
      }
      // file/checkbox는 default_value 의미 없음
      if (value === 'file' || value === 'checkbox') {
        updatedField.default_value = ''
      }
      // 새 타입에서 기존 default가 부적합하면 비운다
      const oldType = newFields[index]?.input_type
      const def = (updatedField.default_value || '').trim()
      if (oldType !== value && def) {
        if (value === 'number' && !Number.isFinite(Number(def))) {
          updatedField.default_value = ''
        }
        if (value === 'select') {
          // select로 전환 시 default는 옵션 목록에 의해 결정되어야 함
          updatedField.default_value = ''
        }
      }
    }

    newFields[index] = updatedField
    onChange(newFields)
  }

  /**
   * Validate variable name uniqueness
   */
  const isVariableNameDuplicate = (variable: string, currentIndex: number): boolean => {
    return fields.some((field, index) =>
      index !== currentIndex && field.variable === variable
    )
  }

  /**
   * Move field up/down
   */
  const handleMoveField = (index: number, direction: 'up' | 'down') => {
    if (direction === 'up' && index === 0) return
    if (direction === 'down' && index === fields.length - 1) return

    const newFields = [...fields]
    const targetIndex = direction === 'up' ? index - 1 : index + 1
    const temp = newFields[index]
    newFields[index] = newFields[targetIndex]!
    newFields[targetIndex] = temp!

    onChange(newFields)
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
          {t('wizard.step2UserInputForm.title')}
        </h3>
        <div className="flex gap-2">
          {fields.length > 0 && onPreview && (
            <button
              type="button"
              onClick={onPreview}
              className="inline-flex items-center px-3 py-2 text-sm font-medium text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-blue-900/20 dark:text-blue-400 dark:hover:bg-blue-900/30"
            >
              👁️ {t('wizard.step2Preview.title')}
            </button>
          )}
          <button
            type="button"
            onClick={handleAddField}
            className="inline-flex items-center px-3 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
          >
            <PlusIcon className="h-4 w-4 mr-2" />
            {t('wizard.step2UserInputForm.addField')}
          </button>
        </div>
      </div>

      {/* Field List */}
      <div className="space-y-3">
        {fields.length === 0 ? (
          <div className="text-center py-8 border-2 border-dashed border-gray-300 rounded-lg dark:border-gray-600">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {t('wizard.step2UserInputForm.noFields')}
            </p>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
              {t('wizard.step2UserInputForm.noFieldsHint')}
            </p>
          </div>
        ) : (
          fields.map((field, index) => {
            const isDuplicate = isVariableNameDuplicate(field.variable, index)

            return (
              <div
                key={index}
                className="border border-gray-300 rounded-lg p-4 space-y-3 bg-white dark:bg-gray-800 dark:border-gray-600"
              >
                {/* Field Header with Move/Delete Buttons */}
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    {t('wizard.step2UserInputForm.fieldNumber', { number: index + 1 })}
                  </span>
                  <div className="flex gap-2">
                    {/* Move Up */}
                    <button
                      type="button"
                      onClick={() => handleMoveField(index, 'up')}
                      disabled={index === 0}
                      className="p-1 text-gray-600 hover:bg-gray-100 rounded disabled:opacity-30 disabled:cursor-not-allowed dark:text-gray-400 dark:hover:bg-gray-700"
                      aria-label="Move up"
                    >
                      <ArrowsUpDownIcon className="h-4 w-4 rotate-180" />
                    </button>
                    {/* Move Down */}
                    <button
                      type="button"
                      onClick={() => handleMoveField(index, 'down')}
                      disabled={index === fields.length - 1}
                      className="p-1 text-gray-600 hover:bg-gray-100 rounded disabled:opacity-30 disabled:cursor-not-allowed dark:text-gray-400 dark:hover:bg-gray-700"
                      aria-label="Move down"
                    >
                      <ArrowsUpDownIcon className="h-4 w-4" />
                    </button>
                    {/* Delete */}
                    <button
                      type="button"
                      onClick={() => handleRemoveField(index)}
                      className="p-1 text-red-600 hover:bg-red-50 rounded dark:hover:bg-red-900/20"
                      aria-label="Delete field"
                    >
                      <TrashIcon className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                {/* Variable Name */}
                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                    {t('wizard.step2UserInputForm.variableName')}
                    <span className="text-red-500 ml-1">*</span>
                  </label>
                  <input
                    type="text"
                    value={field.variable}
                    onChange={(e) => handleFieldChange(index, 'variable', e.target.value)}
                    placeholder="field_name"
                    className={`w-full px-3 py-2 text-sm border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono dark:bg-gray-700 dark:text-white ${
                      isDuplicate
                        ? 'border-red-500 dark:border-red-500'
                        : 'border-gray-300 dark:border-gray-600'
                    }`}
                  />
                  {isDuplicate && (
                    <p className="text-xs text-red-500 mt-1">
                      {t('wizard.step2UserInputForm.duplicateVariable')}
                    </p>
                  )}
                </div>

                {/* Label */}
                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                    {t('wizard.step2UserInputForm.label')}
                    <span className="text-red-500 ml-1">*</span>
                  </label>
                  <input
                    type="text"
                    value={field.label}
                    onChange={(e) => handleFieldChange(index, 'label', e.target.value)}
                    placeholder={t('wizard.step2UserInputForm.labelPlaceholder')}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                  />
                </div>

                {/* Input Type and Required in same row */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                      {t('wizard.step2UserInputForm.inputType')}
                    </label>
                    <select
                      value={field.input_type}
                      onChange={(e) => handleFieldChange(index, 'input_type', e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                    >
                      <option value="text-input">{t('wizard.step2UserInputForm.types.textInput')}</option>
                      <option value="paragraph">{t('wizard.step2UserInputForm.types.paragraph')}</option>
                      <option value="number">{t('wizard.step2UserInputForm.types.number')}</option>
                      <option value="select">{t('wizard.step2UserInputForm.types.select')}</option>
                      <option value="checkbox">{t('wizard.step2UserInputForm.types.checkbox')}</option>
                      <option value="file">{t('wizard.step2UserInputForm.types.file')}</option>
                    </select>
                  </div>

                  <div className="flex items-end">
                    <label className="flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={field.required}
                        onChange={(e) => handleFieldChange(index, 'required', e.target.checked)}
                        className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700"
                      />
                      <span className="ml-2 text-sm text-gray-700 dark:text-gray-300">
                        {t('wizard.step2UserInputForm.required')}
                      </span>
                    </label>
                  </div>
                </div>

                {/* Default Value (not for file type, not for checkbox, and NOT select — select has its own below)
                    hotfix_20260414_agent-select-input-default HOTFIX_USER_FIX (CR1):
                      - number 타입은 <input type="number">로 제한해 비숫자 입력 자체를 차단
                      - text-input/paragraph는 max_length가 있으면 길이 경계 표시 + 초과 시 빨간 경고 */}
                {field.input_type !== 'file' && field.input_type !== 'checkbox' && field.input_type !== 'select' && (() => {
                  const def = field.default_value || ''
                  const maxLen = field.max_length
                  const hasMax = typeof maxLen === 'number' && Number.isInteger(maxLen) && maxLen > 0
                  const exceedsMax = hasMax && def.length > (maxLen as number)
                  const isNumberType = field.input_type === 'number'
                  const numberInvalid =
                    isNumberType && def.trim() !== '' && !Number.isFinite(Number(def.trim()))

                  return (
                    <div>
                      <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                        {t('wizard.step2UserInputForm.defaultValue')}
                      </label>
                      <input
                        type={isNumberType ? 'number' : 'text'}
                        value={def}
                        onChange={(e) => handleFieldChange(index, 'default_value', e.target.value)}
                        placeholder={t('wizard.step2UserInputForm.defaultValuePlaceholder')}
                        className={`w-full px-3 py-2 text-sm border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white ${
                          (exceedsMax || numberInvalid)
                            ? 'border-red-500 dark:border-red-500'
                            : 'border-gray-300 dark:border-gray-600'
                        }`}
                      />
                      {hasMax && !isNumberType && (
                        <p className={`text-xs mt-1 ${exceedsMax ? 'text-red-500' : 'text-gray-400'}`}>
                          {def.length} / {maxLen}
                        </p>
                      )}
                      {exceedsMax && (
                        <p className="text-xs text-red-500 mt-1">
                          {t('validation.defaultExceedsMaxLength', { length: def.length, max_length: maxLen })}
                        </p>
                      )}
                      {numberInvalid && (
                        <p className="text-xs text-red-500 mt-1">
                          {t('validation.numberDefaultMustBeNumeric', { default: def })}
                        </p>
                      )}
                    </div>
                  )
                })()}

                {/* Options + Default (for select type only)
                    hotfix_20260414_agent-select-input-default:
                      - options가 비어있으면 default 입력을 비활성화해 구조적 불일치 방지
                      - default를 options 기반 <select>로 제한해 options에 없는 값 입력 자체를 차단
                      - options가 변경되어 기존 default가 더 이상 존재하지 않으면 자동으로 비운다 */}
                {field.input_type === 'select' && (() => {
                  const currentOptions = field.options || []
                  const hasOptions = currentOptions.length > 0
                  const defaultValue = field.default_value || ''
                  const defaultInvalid = !!defaultValue && !currentOptions.includes(defaultValue)

                  return (
                    <div className="space-y-3">
                      <div>
                        <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                          {t('wizard.step2UserInputForm.options')}
                          <span className="text-red-500 ml-1">*</span>
                        </label>
                        <OptionsInput
                          value={currentOptions}
                          onChange={(options) => {
                            // options 변경 시, 기존 default가 더 이상 존재하지 않으면 비운다
                            const currentDefault = field.default_value || ''
                            if (currentDefault && !options.includes(currentDefault)) {
                              handleFieldChange(index, 'default_value', '')
                            }
                            handleFieldChange(index, 'options', options)
                          }}
                          placeholder={t('wizard.step2UserInputForm.optionsPlaceholder')}
                          className={`w-full px-3 py-2 text-sm border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white ${
                            !hasOptions
                              ? 'border-red-500 dark:border-red-500'
                              : 'border-gray-300 dark:border-gray-600'
                          }`}
                        />
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                          {t('wizard.step2UserInputForm.optionsHelp')}
                        </p>
                        {!hasOptions && (
                          <p className="text-xs text-red-500 mt-1">
                            {t('validation.selectOptionsRequired')}
                          </p>
                        )}
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                          {t('wizard.step2UserInputForm.defaultValue')}
                        </label>
                        <select
                          value={hasOptions && currentOptions.includes(defaultValue) ? defaultValue : ''}
                          onChange={(e) => handleFieldChange(index, 'default_value', e.target.value)}
                          disabled={!hasOptions}
                          className={`w-full px-3 py-2 text-sm border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white disabled:bg-gray-100 disabled:cursor-not-allowed dark:disabled:bg-gray-800 ${
                            defaultInvalid
                              ? 'border-red-500 dark:border-red-500'
                              : 'border-gray-300 dark:border-gray-600'
                          }`}
                        >
                          <option value="">
                            {t('wizard.step2UserInputForm.defaultValuePlaceholder')}
                          </option>
                          {currentOptions.map((opt, optIdx) => (
                            <option key={`${opt}-${optIdx}`} value={opt}>{opt}</option>
                          ))}
                        </select>
                        {defaultInvalid && (
                          <p className="text-xs text-red-500 mt-1">
                            {t('validation.selectDefaultMustBeInOptions')}
                          </p>
                        )}
                      </div>
                    </div>
                  )
                })()}
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
