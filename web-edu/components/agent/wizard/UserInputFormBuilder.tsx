'use client'

import { useTranslation } from 'react-i18next'
import { PlusIcon, TrashIcon, ArrowsUpDownIcon } from '@heroicons/react/24/outline'
import type { UserInputForm } from '@/types/agent'

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

    // Special handling for input_type: clear options if not select
    if (property === 'input_type' && value !== 'select') {
      delete updatedField.options
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

                {/* Default Value (not for file type) */}
                {field.input_type !== 'file' && field.input_type !== 'checkbox' && (
                  <div>
                    <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                      {t('wizard.step2UserInputForm.defaultValue')}
                    </label>
                    <input
                      type="text"
                      value={field.default_value || ''}
                      onChange={(e) => handleFieldChange(index, 'default_value', e.target.value)}
                      placeholder={t('wizard.step2UserInputForm.defaultValuePlaceholder')}
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                    />
                  </div>
                )}

                {/* Options (for select type only) */}
                {field.input_type === 'select' && (
                  <div>
                    <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                      {t('wizard.step2UserInputForm.options')}
                      <span className="text-red-500 ml-1">*</span>
                    </label>
                    <input
                      type="text"
                      value={field.options?.join(', ') || ''}
                      onChange={(e) => handleFieldChange(
                        index,
                        'options',
                        e.target.value.split(',').map(opt => opt.trim()).filter(Boolean)
                      )}
                      placeholder={t('wizard.step2UserInputForm.optionsPlaceholder')}
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                    />
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      {t('wizard.step2UserInputForm.optionsHelp')}
                    </p>
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
