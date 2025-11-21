'use client'

import { useTranslation } from 'react-i18next'
import type { UserInputForm } from '@/types/agent'

interface InputFieldPreviewProps {
  fields: UserInputForm[]
}

/**
 * InputFieldPreview Component
 *
 * Renders a read-only preview of the user input form
 * Shows how the form will appear to end users
 */
export function InputFieldPreview({ fields }: InputFieldPreviewProps) {
  const { t } = useTranslation('agent')

  if (fields.length === 0) {
    return (
      <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center dark:border-gray-600">
        <p className="text-sm text-gray-500 dark:text-gray-400">
          {t('wizard.step2Preview.empty')}
        </p>
      </div>
    )
  }

  /**
   * Render a field based on its input_type
   */
  const renderField = (field: UserInputForm) => {
    const baseClasses = "w-full px-3 py-2 text-sm border border-gray-300 rounded-lg bg-gray-50 dark:bg-gray-700 dark:border-gray-600 dark:text-white"

    switch (field.input_type) {
      case 'text-input':
        return (
          <input
            type="text"
            placeholder={field.default_value || t('wizard.step2Preview.textPlaceholder')}
            className={baseClasses}
            disabled
          />
        )

      case 'paragraph':
        return (
          <textarea
            rows={4}
            placeholder={field.default_value || t('wizard.step2Preview.paragraphPlaceholder')}
            className={`${baseClasses} resize-none`}
            disabled
          />
        )

      case 'number':
        return (
          <input
            type="number"
            placeholder={field.default_value || '0'}
            className={baseClasses}
            disabled
          />
        )

      case 'select':
        return (
          <select className={baseClasses} disabled>
            <option>{t('wizard.step2Preview.selectPlaceholder')}</option>
            {field.options?.map((option, idx) => (
              <option key={idx} value={option}>
                {option}
              </option>
            ))}
          </select>
        )

      case 'checkbox':
        return (
          <div className="flex items-center">
            <input
              type="checkbox"
              defaultChecked={field.default_value === 'true'}
              className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700"
              disabled
            />
            <span className="ml-2 text-sm text-gray-600 dark:text-gray-400">
              {field.label}
            </span>
          </div>
        )

      case 'file':
        return (
          <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center bg-gray-50 dark:bg-gray-700 dark:border-gray-600">
            <svg
              className="mx-auto h-12 w-12 text-gray-400"
              stroke="currentColor"
              fill="none"
              viewBox="0 0 48 48"
              aria-hidden="true"
            >
              <path
                d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
              {t('wizard.step2Preview.filePlaceholder')}
            </p>
          </div>
        )

      default:
        return null
    }
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
          {t('wizard.step2Preview.title')}
        </h3>
        <span className="px-2 py-1 text-xs font-medium text-blue-600 bg-blue-50 rounded dark:bg-blue-900/20 dark:text-blue-400">
          {t('wizard.step2Preview.badge')}
        </span>
      </div>

      {/* Preview Container */}
      <div className="border border-gray-300 rounded-lg p-6 bg-white dark:bg-gray-800 dark:border-gray-600 space-y-4">
        {fields.map((field, index) => (
          <div key={index}>
            {/* Label (except for checkbox) */}
            {field.input_type !== 'checkbox' && (
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {field.label}
                {field.required && <span className="text-red-500 ml-1">*</span>}
              </label>
            )}

            {/* Field */}
            {renderField(field)}

            {/* Help text for required fields */}
            {field.required && field.input_type !== 'checkbox' && (
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                {t('wizard.step2Preview.requiredHelp')}
              </p>
            )}
          </div>
        ))}
      </div>

      {/* Info Message */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 dark:bg-blue-900/20 dark:border-blue-800">
        <p className="text-sm text-blue-700 dark:text-blue-300">
          💡 {t('wizard.step2Preview.infoMessage')}
        </p>
      </div>
    </div>
  )
}
