'use client'

import { useEffect } from 'react'
import { useForm, useFieldArray } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useTranslation } from 'react-i18next'
import { PlusIcon, TrashIcon } from '@heroicons/react/24/outline'
import { promptSettingsSchema, type PromptSettingsFormData } from '@/schemas/agent-schema'
import { useAgentWizard } from '@/context/AgentWizardContext'
import type { AgentPromptSettings } from '@/types/agent'

/**
 * Step 2: Prompt Configuration Component
 *
 * Features:
 * - System prompt input (auto-filled from Step 1 role)
 * - Opening statement (chat mode only, optional)
 * - Suggested questions (chat mode only, dynamic add/remove, max 5)
 */
export default function Step2PromptSettings() {
  const { t } = useTranslation('agent')
  const { promptSettings, setPromptSettings, basicSettings, nextStep, previousStep } = useAgentWizard()

  const {
    control,
    register,
    handleSubmit,
    watch,
    formState: { errors, isValid },
  } = useForm<PromptSettingsFormData>({
    resolver: zodResolver(promptSettingsSchema) as any, // eslint-disable-line @typescript-eslint/no-explicit-any
    mode: 'onChange',
    defaultValues: promptSettings || {
      pre_prompt: basicSettings?.role || '',
      prompt_type: 'simple',
      opening_statement: '',
      suggested_questions: [],
    },
  })

  // Check if current mode is chat (for conditional rendering)
  const isChatMode = basicSettings?.mode === 'chat'

  // Type assertion needed: TypeScript has trouble inferring array field types when multiple arrays exist in schema
  const {
    fields: questionFields,
    append: appendQuestion,
    remove: removeQuestion,
  } = useFieldArray({
    control,
    name: 'suggested_questions' as any, // eslint-disable-line @typescript-eslint/no-explicit-any
  })

  const prePromptValue = watch('pre_prompt')
  const openingStatementValue = watch('opening_statement')

  // Auto-save to context when form changes
  useEffect(() => {
    const subscription = watch((value) => {
      if (isValid) {
        setPromptSettings(value as AgentPromptSettings)
      }
    })
    return () => subscription.unsubscribe()
  }, [watch, isValid, setPromptSettings])

  const onSubmit = (data: PromptSettingsFormData) => {
    setPromptSettings(data)
    nextStep()
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-8 max-w-4xl mx-auto">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
          {t('promptSettings.title')}
        </h2>
        <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
          {t('promptSettings.description')}
        </p>
      </div>

      {/* System Prompt */}
      <div className="space-y-2">
        <label htmlFor="pre_prompt" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
          {t('promptSettings.prePromptLabel')}
          <span className="text-red-500 ml-1">*</span>
        </label>
        <textarea
          id="pre_prompt"
          {...register('pre_prompt')}
          rows={12}
          maxLength={4000}
          placeholder={t('promptSettings.prePromptPlaceholder')}
          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm resize-y min-h-[200px] dark:bg-gray-800 dark:border-gray-600 dark:text-white"
        />
        <p className="text-xs text-gray-500 dark:text-gray-400">
          {t('promptSettings.prePromptHelp')}
        </p>
        <div className="flex justify-between text-xs">
          <span className="text-gray-400">
            {prePromptValue?.length || 0} / 4000
          </span>
          {errors.pre_prompt && (
            <span className="text-red-500">{errors.pre_prompt.message}</span>
          )}
        </div>
      </div>

      {/* Opening Statement (Chat mode only) */}
      {isChatMode && (
        <div className="space-y-2">
          <label htmlFor="opening_statement" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            {t('promptSettings.openingStatementLabel')}
          </label>
          <input
            id="opening_statement"
            type="text"
            {...register('opening_statement')}
            maxLength={500}
            placeholder={t('promptSettings.openingStatementPlaceholder')}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-800 dark:border-gray-600 dark:text-white"
          />
          <div className="flex justify-between text-xs">
            <span className="text-gray-400">
              {openingStatementValue?.length || 0} / 500
            </span>
            {errors.opening_statement && (
              <span className="text-red-500">{errors.opening_statement.message}</span>
            )}
          </div>
        </div>
      )}

      {/* Suggested Questions (Chat mode only) */}
      {isChatMode && (
        <div className="space-y-3">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            {t('promptSettings.suggestedQuestionsLabel')}
          </label>
          <div className="space-y-2">
            {questionFields.map((field, index) => (
              <div key={field.id} className="flex gap-2">
                <input
                  {...register(`suggested_questions.${index}` as const)}
                  type="text"
                  maxLength={200}
                  placeholder={t('promptSettings.questionPlaceholder')}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-800 dark:border-gray-600 dark:text-white"
                />
                <button
                  type="button"
                  onClick={() => removeQuestion(index)}
                  className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors dark:hover:bg-red-900/20"
                  aria-label="Remove question"
                >
                  <TrashIcon className="h-5 w-5" />
                </button>
              </div>
            ))}
          </div>
          {questionFields.length < 5 && (
            <button
              type="button"
              onClick={() => appendQuestion('')}
              className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
            >
              <PlusIcon className="h-4 w-4 mr-2" />
              {t('promptSettings.addQuestionButton')}
            </button>
          )}
        </div>
      )}

      {/* Navigation Buttons */}
      <div className="flex justify-between pt-6 border-t dark:border-gray-700">
        <button
          type="button"
          onClick={previousStep}
          className="px-6 py-3 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-600 dark:hover:bg-gray-700"
        >
          {t('buttons.previous')}
        </button>
        <button
          type="submit"
          disabled={!isValid}
          className="px-6 py-3 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed dark:bg-blue-500 dark:hover:bg-blue-600"
        >
          {t('buttons.next')}
        </button>
      </div>
    </form>
  )
}
