'use client'

import type React from 'react'
import { useEffect, useMemo } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useTranslation } from 'react-i18next'
import type { UserInputForm } from '@/types/agent'
import { FileUploadField, type UploadedFileInfo } from './FileUploadField'

/**
 * Dynamic form renderer props
 */
export interface DynamicFormRendererProps {
  formSchema: UserInputForm[]
  onSubmit: (values: Record<string, unknown>) => void
  isSubmitting: boolean
  defaultValues?: Record<string, unknown>
  executionStatus?: 'idle' | 'running' | 'success' | 'failed'
}

/**
 * Dynamic form renderer component
 *
 * Features:
 * - Renders form fields based on UserInputForm schema
 * - Supports multiple input types (text, paragraph, number, select, checkbox, file)
 * - Dynamic Zod validation based on field requirements
 * - React Hook Form integration
 * - i18n support
 */
export function DynamicFormRenderer({
  formSchema,
  onSubmit,
  isSubmitting,
  defaultValues = {},
  executionStatus = 'idle',
}: DynamicFormRendererProps) {
  const { t } = useTranslation()

  /**
   * Build Zod schema dynamically from UserInputForm[]
   */
  const zodSchema = useMemo(() => {
    const schemaObject: Record<string, z.ZodTypeAny> = {}

    formSchema.forEach((field) => {
      let fieldSchema: z.ZodTypeAny

      // Define base schema based on input type
      switch (field.input_type) {
        case 'number':
          fieldSchema = z.coerce.number()
          break

        case 'checkbox':
          fieldSchema = z.boolean().default(false)
          break

        case 'file':
          fieldSchema = z.object({
            id: z.string(),
            name: z.string(),
            type: z.string(),
            size: z.number(),
            url: z.string(),
          }).nullable()
          break

        default:
          fieldSchema = z.string()
          break
      }

      // Apply required validation
      if (field.required && field.input_type !== 'checkbox') {
        if (field.input_type === 'file') {
          fieldSchema = fieldSchema.refine(
            val => val !== null,
            {
              message: t('execute.inputForm.validation.required', {
                field: field.label,
                defaultValue: `${field.label}은(는) 필수 입력입니다`,
              }),
            },
          )
        }
        else if (field.input_type !== 'number') {
          fieldSchema = (fieldSchema as z.ZodString).min(1, {
            message: t('execute.inputForm.validation.required', {
              field: field.label,
              defaultValue: `${field.label}은(는) 필수 입력입니다`,
            }),
          })
        }
      }
      else if (!field.required) {
        // Make optional fields nullable
        fieldSchema = fieldSchema.optional().nullable()
      }

      // Apply max_length validation
      if (field.max_length && field.input_type !== 'number' && field.input_type !== 'checkbox') {
        fieldSchema = (fieldSchema as z.ZodString).max(field.max_length, {
          message: t('execute.inputForm.validation.maxLength', {
            field: field.label,
            maxLength: field.max_length,
            defaultValue: `${field.label}은(는) 최대 ${field.max_length}자까지 입력 가능합니다`,
          }),
        })
      }

      schemaObject[field.variable] = fieldSchema
    })

    return z.object(schemaObject)
  }, [formSchema, t])

  /**
   * Compute schema-derived defaults (e.g., field.default_value for select fields).
   *
   * Precedence: explicit `defaultValues` prop wins over schema defaults so that
   * caller-supplied values (e.g., rerun with previous inputs) are preserved.
   *
   * Scope (hotfix_20260414_agent-execute-select-default):
   * - Select fields populate the dropdown initial value from `field.default_value`
   *   only when it appears in `field.options`. Stale defaults that are no longer
   *   in the options list fall back to an empty value (placeholder).
   * - Other input types are intentionally untouched to avoid regressions.
   */
  const mergedDefaults = useMemo(() => {
    const fromSchema: Record<string, unknown> = {}
    formSchema.forEach((field) => {
      if (field.input_type === 'select') {
        const candidate = field.default_value
        if (candidate && field.options?.includes(candidate)) {
          fromSchema[field.variable] = candidate
        }
      }
    })
    return { ...fromSchema, ...defaultValues }
  }, [formSchema, defaultValues])

  /**
   * Initialize React Hook Form
   */
  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
    watch,
  } = useForm({
    resolver: zodResolver(zodSchema),
    defaultValues: mergedDefaults,
  })

  /**
   * Update default values when changed (keeps form in sync with caller-driven
   * defaultValues, e.g., rerun-from-history).
   */
  useEffect(() => {
    Object.entries(mergedDefaults).forEach(([key, value]) => {
      setValue(key, value)
    })
  }, [mergedDefaults, setValue])

  /**
   * Render field based on input type
   */
  const renderField = (field: UserInputForm) => {
    const error = errors[field.variable]
    const errorMessage = error?.message as string | undefined

    switch (field.input_type) {
      case 'text-input':
        return (
          <div key={field.variable} className="space-y-2">
            <label htmlFor={field.variable} className="block text-sm font-medium text-gray-900">
              {field.label}
              {field.required && <span className="text-red-500 ml-1">*</span>}
            </label>
            <input
              id={field.variable}
              type="text"
              {...register(field.variable)}
              placeholder={field.default_value}
              className={`
                w-full px-3 py-2 border rounded-lg
                focus:outline-none focus:ring-2 focus:ring-blue-500
                ${error ? 'border-red-500' : 'border-gray-300'}
              `}
            />
            {errorMessage && <p className="text-sm text-red-500">{errorMessage}</p>}
          </div>
        )

      case 'paragraph':
        return (
          <div key={field.variable} className="space-y-2">
            <label htmlFor={field.variable} className="block text-sm font-medium text-gray-900">
              {field.label}
              {field.required && <span className="text-red-500 ml-1">*</span>}
            </label>
            <textarea
              id={field.variable}
              {...register(field.variable)}
              placeholder={field.default_value}
              rows={4}
              className={`
                w-full px-3 py-2 border rounded-lg
                focus:outline-none focus:ring-2 focus:ring-blue-500
                ${error ? 'border-red-500' : 'border-gray-300'}
              `}
            />
            {errorMessage && <p className="text-sm text-red-500">{errorMessage}</p>}
          </div>
        )

      case 'number':
        return (
          <div key={field.variable} className="space-y-2">
            <label htmlFor={field.variable} className="block text-sm font-medium text-gray-900">
              {field.label}
              {field.required && <span className="text-red-500 ml-1">*</span>}
            </label>
            <input
              id={field.variable}
              type="number"
              {...register(field.variable, { valueAsNumber: true })}
              placeholder={field.default_value}
              className={`
                w-full px-3 py-2 border rounded-lg
                focus:outline-none focus:ring-2 focus:ring-blue-500
                ${error ? 'border-red-500' : 'border-gray-300'}
              `}
            />
            {errorMessage && <p className="text-sm text-red-500">{errorMessage}</p>}
          </div>
        )

      case 'select':
        return (
          <div key={field.variable} className="space-y-2">
            <label htmlFor={field.variable} className="block text-sm font-medium text-gray-900">
              {field.label}
              {field.required && <span className="text-red-500 ml-1">*</span>}
            </label>
            <select
              id={field.variable}
              {...register(field.variable)}
              className={`
                w-full px-3 py-2 border rounded-lg
                focus:outline-none focus:ring-2 focus:ring-blue-500
                ${error ? 'border-red-500' : 'border-gray-300'}
              `}
            >
              <option value="">
                {t('execute.inputForm.selectPlaceholder', { defaultValue: '선택하세요' })}
              </option>
              {field.options?.map(option => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
            {errorMessage && <p className="text-sm text-red-500">{errorMessage}</p>}
          </div>
        )

      case 'checkbox':
        return (
          <div key={field.variable} className="flex items-center space-x-2">
            <input
              id={field.variable}
              type="checkbox"
              {...register(field.variable)}
              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
            />
            <label htmlFor={field.variable} className="text-sm font-medium text-gray-900">
              {field.label}
              {field.required && <span className="text-red-500 ml-1">*</span>}
            </label>
            {errorMessage && <p className="text-sm text-red-500 ml-6">{errorMessage}</p>}
          </div>
        )

      case 'file':
        return (
          <FileUploadField
            key={field.variable}
            name={field.variable}
            label={field.label}
            required={field.required}
            value={watch(field.variable) as UploadedFileInfo | null}
            onChange={(fileInfo) => {
              setValue(field.variable, fileInfo)
            }}
          />
        )

      default:
        return null
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {/* Title */}
      <div>
        <h3 className="text-lg font-semibold text-gray-900">
          {t('execute.inputForm.title', { defaultValue: '입력 정보' })}
        </h3>
        <p className="text-sm text-gray-600 mt-1">
          {t('execute.inputForm.description', {
            defaultValue: 'Agent 실행에 필요한 정보를 입력하세요',
          })}
        </p>
      </div>

      {/* Dynamic fields */}
      <div className="space-y-4">
        {formSchema.map(field => renderField(field))}
      </div>

      {/* Submit button */}
      <div className="flex justify-end space-x-3">
        <button
          type="button"
          onClick={() => {
            // Reset form to empty values or defaults
            formSchema.forEach((field) => {
              if (field.input_type === 'checkbox') {
                setValue(field.variable, false)
              } else if (field.input_type === 'file') {
                setValue(field.variable, null)
              } else if (field.input_type === 'number') {
                setValue(field.variable, field.default_value ? Number(field.default_value) : undefined)
              } else {
                setValue(field.variable, field.default_value || '')
              }
            })
          }}
          disabled={isSubmitting}
          className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {t('execute.inputForm.reset', { defaultValue: '초기화' })}
        </button>

        <button
          type="submit"
          disabled={isSubmitting}
          className={`px-6 py-2 text-sm font-medium text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2 ${
            executionStatus === 'success'
              ? 'bg-green-600 hover:bg-green-700'
              : executionStatus === 'failed'
                ? 'bg-red-600 hover:bg-red-700'
                : 'bg-blue-600 hover:bg-blue-700'
          }`}
        >
          {isSubmitting
            ? (
                <>
                  <svg
                    className="animate-spin h-4 w-4 text-white"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                  </svg>
                  <span>{t('execute.inputForm.submitting', { defaultValue: '실행 중...' })}</span>
                </>
              )
            : executionStatus === 'success'
              ? (
                  <>
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <span>{t('execute.inputForm.success', { defaultValue: '완료' })}</span>
                  </>
                )
              : executionStatus === 'failed'
                ? (
                    <>
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                      <span>{t('execute.inputForm.failed', { defaultValue: '실패' })}</span>
                    </>
                  )
                : (
                    <span>{t('execute.inputForm.submit', { defaultValue: '실행' })}</span>
                  )}
        </button>
      </div>
    </form>
  )
}
