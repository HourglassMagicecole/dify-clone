'use client'

import { useEffect, useState, useRef } from 'react'
import { useForm, useFieldArray } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useTranslation } from 'react-i18next'
import { PlusIcon, TrashIcon } from '@heroicons/react/24/outline'
import { promptSettingsSchema, type PromptSettingsFormData } from '@/schemas/agent-schema'
import { useAgentWizard } from '@/context/AgentWizardContext'
import type { AgentPromptSettings, UserInputForm, OutputFormat } from '@/types/agent'
import { UserInputFormBuilder } from './UserInputFormBuilder'
import { InputFieldPreview } from './InputFieldPreview'
import { OutputFormatBuilder } from './OutputFormatBuilder'
import { Modal } from '@/components/common/Modal'
import { validateUserInputForm } from '@/utils/user-input-form-validation'

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
  const { promptSettings, setPromptSettings, basicSettings, nextStep, previousStep, isEditMode } = useAgentWizard()

  const {
    control,
    register,
    handleSubmit,
    watch,
    reset,
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
  const isCompletionMode = basicSettings?.mode === 'completion'

  // User input form state (for completion mode)
  const [userInputFormFields, setUserInputFormFields] = useState<UserInputForm[]>(
    promptSettings?.user_input_form || []
  )

  // Output format state (for completion mode)
  const [outputFormat, setOutputFormat] = useState<OutputFormat | undefined>(
    promptSettings?.output_format
  )

  // Track if template has been generated
  const [hasGeneratedTemplate, setHasGeneratedTemplate] = useState(false)

  // Track if input/output format needs to be synced to prompt
  const [needsPromptSync, setNeedsPromptSync] = useState(false)

  // Store initial values for edit mode comparison (to detect actual changes)
  const initialInputFormRef = useRef<string | null>(null)
  const initialOutputFormatRef = useRef<string | null>(null)
  const isInitializedRef = useRef(false)

  // Initialize refs with initial values once data is loaded
  useEffect(() => {
    if (!isInitializedRef.current && isCompletionMode) {
      // Wait for data to be loaded (either empty for new or populated for edit)
      initialInputFormRef.current = JSON.stringify(userInputFormFields)
      initialOutputFormatRef.current = JSON.stringify(outputFormat)
      isInitializedRef.current = true
    }
  }, [isCompletionMode, userInputFormFields, outputFormat])

  // Initialize hasGeneratedTemplate in edit mode if prompt already has input/output sections
  useEffect(() => {
    if (isEditMode && isCompletionMode && promptSettings?.pre_prompt) {
      const hasInputSection = promptSettings.pre_prompt.includes('## 입력 정보')
      const hasOutputSection = promptSettings.pre_prompt.includes('## 출력 형식')
      if (hasInputSection || hasOutputSection) {
        setHasGeneratedTemplate(true)
      }
    }
  }, [isEditMode, isCompletionMode, promptSettings?.pre_prompt])

  // Preview modal state
  const [isPreviewOpen, setIsPreviewOpen] = useState(false)

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

  /**
   * Check if input/output format is properly reflected in the prompt
   * Returns true if sync is needed (not reflected or outdated)
   */
  const checkPromptSyncNeeded = (): boolean => {
    if (!isCompletionMode) return false

    // In edit mode, check if there's an actual change from initial values
    if (isEditMode && isInitializedRef.current) {
      const currentInputForm = JSON.stringify(userInputFormFields)
      const currentOutputFormat = JSON.stringify(outputFormat)
      const inputChanged = initialInputFormRef.current !== currentInputForm

      // For outputFormat, undefined → default value is NOT a real change
      const DEFAULT_OUTPUT_FORMAT = '{"format_type":"text","text_format":"markdown"}'
      const initialOutput = initialOutputFormatRef.current
      const outputChanged = (() => {
        // If initial was undefined/null and current is default, not a real change
        // Note: JSON.stringify(undefined) returns undefined (not string), so check both
        if ((initialOutput === undefined || initialOutput === null || initialOutput === 'undefined') && currentOutputFormat === DEFAULT_OUTPUT_FORMAT) {
          return false
        }
        return initialOutput !== currentOutputFormat
      })()

      // No actual change from initial values - but respect needsPromptSync state
      // (user might have changed and then changed back, but prompt still needs update)
      if (!inputChanged && !outputChanged) {
        return needsPromptSync
      }
    }

    const prompt = prePromptValue || ''
    const hasInputSection = prompt.includes('## 입력 정보')
    const hasOutputSection = prompt.includes('## 출력 형식')

    // If there are input fields, prompt must have input section
    if (userInputFormFields.length > 0 && !hasInputSection) {
      return true
    }

    // If output format is set, prompt must have output section
    if (outputFormat && !hasOutputSection) {
      return true
    }

    return needsPromptSync
  }

  /**
   * Whether the form can proceed to next step
   */
  const canProceed = isValid && (!isCompletionMode || !checkPromptSyncNeeded())

  /**
   * Generate prompt template from user input form and output format
   */
  const generatePromptTemplate = () => {
    if (!isCompletionMode) return

    const currentValues = watch()

    // Extract base role by removing auto-generated sections
    let baseRole = currentValues.pre_prompt || basicSettings?.role || ''

    // Remove "## 입력 정보" section and everything after it
    const inputInfoIndex = baseRole.indexOf('## 입력 정보')
    if (inputInfoIndex !== -1) {
      baseRole = baseRole.substring(0, inputInfoIndex).trim()
    }

    // Remove "## 출력 형식" section and everything after it
    const outputFormatIndex = baseRole.indexOf('## 출력 형식')
    if (outputFormatIndex !== -1) {
      baseRole = baseRole.substring(0, outputFormatIndex).trim()
    }

    // Start with clean base role
    let template = baseRole

    // Add input information section
    if (userInputFormFields.length > 0) {
      template += '\n\n## 입력 정보\n'
      userInputFormFields.forEach(field => {
        template += `- **${field.label}** ({{${field.variable}}}): `
        if (field.required) {
          template += '필수 입력'
        } else {
          template += '선택 입력'
        }
        if (field.input_type === 'select' && field.options) {
          template += ` (옵션: ${field.options.join(', ')})`
        }
        template += '\n'
      })
    }

    // Add output format section
    if (outputFormat) {
      template += '\n## 출력 형식\n'

      if (outputFormat.format_type === 'text') {
        template += `**형식**: ${outputFormat.text_format || 'Markdown'}\n`
      } else if (outputFormat.format_type === 'image') {
        template += `**형식**: ${outputFormat.image_format || 'PNG'} 이미지\n`
      } else if (outputFormat.format_type === 'audio') {
        template += `**형식**: ${outputFormat.audio_format || 'MP3'} 오디오\n`
      } else if (outputFormat.format_type === 'file') {
        template += `**형식**: ${outputFormat.file_format || 'PDF'} 파일\n`
      }
    }

    // Set the generated template to the form
    reset({
      ...currentValues,
      pre_prompt: template,
    })
    setHasGeneratedTemplate(true)
    setNeedsPromptSync(false)

    // Update initial refs to current values (new baseline for change detection)
    initialInputFormRef.current = JSON.stringify(userInputFormFields)
    initialOutputFormatRef.current = JSON.stringify(outputFormat)
  }

  // Mark prompt sync needed when input/output format actually changes from initial values
  useEffect(() => {
    // Skip if not initialized yet
    if (!isInitializedRef.current || !isCompletionMode) {
      return
    }

    // Check if values actually changed from initial
    const currentInputForm = JSON.stringify(userInputFormFields)
    const currentOutputFormat = JSON.stringify(outputFormat)
    const inputChanged = initialInputFormRef.current !== currentInputForm

    // For outputFormat, undefined → default value is NOT a real change
    const DEFAULT_OUTPUT_FORMAT = '{"format_type":"text","text_format":"markdown"}'
    const initialOutput = initialOutputFormatRef.current
    const outputChanged = (() => {
      if ((initialOutput === undefined || initialOutput === null) && currentOutputFormat === DEFAULT_OUTPUT_FORMAT) {
        return false
      }
      return initialOutput !== currentOutputFormat
    })()

    // Mark as needing sync if there's an actual change, otherwise reset
    if ((inputChanged || outputChanged) && (hasGeneratedTemplate || isEditMode)) {
      setNeedsPromptSync(true)
    } else {
      setNeedsPromptSync(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userInputFormFields, outputFormat])

  // Auto-save user_input_form and output_format to context
  useEffect(() => {
    if (isCompletionMode && isValid) {
      setPromptSettings({
        ...promptSettings,
        user_input_form: userInputFormFields,
        output_format: outputFormat,
      } as AgentPromptSettings)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userInputFormFields, outputFormat, isCompletionMode, isValid])

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
    // Include user_input_form and output_format in the data
    const fullData = {
      ...data,
      user_input_form: isCompletionMode ? userInputFormFields : undefined,
      output_format: isCompletionMode ? outputFormat : undefined,
    } as AgentPromptSettings

    setPromptSettings(fullData)
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
            <span className="text-red-500">{t(errors.pre_prompt.message as string)}</span>
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
              <span className="text-red-500">{t(errors.opening_statement.message as string)}</span>
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

      {/* User Input Form (Completion mode only) */}
      {isCompletionMode && (
        <UserInputFormBuilder
          fields={userInputFormFields}
          onChange={setUserInputFormFields}
          onPreview={() => setIsPreviewOpen(true)}
        />
      )}

      {/* Output Format Definition (Completion mode only) */}
      {isCompletionMode && (
        <div className="space-y-4">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              {t('promptSettings.outputFormatTitle')}
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              {t('promptSettings.outputFormatDescription')}
            </p>
          </div>

          <OutputFormatBuilder
            outputFormat={outputFormat}
            onChange={setOutputFormat}
          />
        </div>
      )}

      {/* Generate Template Button (Completion mode only)
          hotfix_20260414_agent-select-input-default HOTFIX_USER_FIX (CR2):
            - 사용자 입력 폼 + 출력 형식 정의부 양쪽이 정합 상태일 때만 활성화
            - disabled 사유는 보조 텍스트(tooltip + 라벨)로 노출 */}
      {isCompletionMode && (() => {
        const inputFormErrors = validateUserInputForm(userInputFormFields)
        const isInputFormValid = inputFormErrors.length === 0

        // 출력 형식 정의부 validation:
        //   - format_type이 'text'이면 text_format 필수
        //   - 다른 format_type은 현재 UI에서 비활성 (OutputFormatBuilder 참조)
        //   - outputFormat 자체가 undefined여도 generatePromptTemplate은 동작하므로 통과로 본다
        const outputFormatValid = (() => {
          if (!outputFormat) return true
          if (outputFormat.format_type === 'text') return !!outputFormat.text_format
          if (outputFormat.format_type === 'image') return !!outputFormat.image_format
          if (outputFormat.format_type === 'audio') return !!outputFormat.audio_format
          if (outputFormat.format_type === 'file') return !!outputFormat.file_format
          return true
        })()

        const buttonDisabled = !isInputFormValid || !outputFormatValid
        // HOTFIX_USER_FIX (CR4, 2026-04-14): 보조 텍스트·tooltip에서 `(변수명: 사유)` 괄호 블록 제거.
        // 사용자 보고에 따라 앞 안내 문장만 노출. 실제 필드 단위 오류는 UserInputFormBuilder의
        // per-field 에러 표시가 이미 담당한다. tooltip은 Option A(동일 문구) 채택: 버튼은 단일
        // `disabledReason` 문자열을 title/보조텍스트 양쪽에 공유하고 있으며, 분리하려면 추가 변수/
        // 로직이 필요해 스코프("괄호 제거 외 변경 금지")에서 벗어난다.
        const disabledReason = !isInputFormValid
          ? t('validation.templateApplyDisabledReason')
          : !outputFormatValid
            ? t('validation.outputFormatInvalid')
            : ''

        return (
          <div className="flex flex-col items-center space-y-2">
            <button
              type="button"
              onClick={generatePromptTemplate}
              disabled={buttonDisabled}
              title={buttonDisabled ? disabledReason : undefined}
              aria-disabled={buttonDisabled}
              className="px-6 py-3 bg-gradient-to-r from-purple-600 to-blue-600 text-white font-medium rounded-lg hover:from-purple-700 hover:to-blue-700 focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 transition-all shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:from-purple-600 disabled:hover:to-blue-600 disabled:hover:shadow-md"
            >
              📝 {hasGeneratedTemplate ? t('promptSettings.regenerateTemplateButton') : t('promptSettings.generateTemplateButton')}
            </button>
            {buttonDisabled && (
              <p className="text-sm text-red-600 dark:text-red-400 font-medium" role="alert">
                ⚠️ {disabledReason}
              </p>
            )}
            {!buttonDisabled && checkPromptSyncNeeded() && (
              <p className="text-sm text-amber-600 dark:text-amber-400 font-medium">
                ⚠️ {t('promptSettings.promptSyncRequired')}
              </p>
            )}
            {!buttonDisabled && (userInputFormFields.length > 0 || outputFormat) && !hasGeneratedTemplate && !checkPromptSyncNeeded() && (
              <p className="text-xs text-gray-500 dark:text-gray-400">
                💡 {t('promptSettings.templateGeneratedNotice')}
              </p>
            )}
          </div>
        )
      })()}

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
          disabled={!canProceed}
          className="px-6 py-3 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed dark:bg-blue-500 dark:hover:bg-blue-600"
        >
          {t('buttons.next')}
        </button>
      </div>

      {/* Preview Modal */}
      <Modal
        isOpen={isPreviewOpen}
        onClose={() => setIsPreviewOpen(false)}
        title={t('wizard.step2Preview.title')}
      >
        <InputFieldPreview fields={userInputFormFields} />
      </Modal>
    </form>
  )
}
