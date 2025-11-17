/**
 * Step 1: Basic Settings Component for Agent Creation Wizard
 * Collects basic information about the Agent: name, description, type, and role
 */

'use client'

import React, { useState } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useTranslation } from 'react-i18next'
import { useAgentWizard } from '@/context/AgentWizardContext'
import { AgentType, ConfigMode } from '@/types/agent'
import { basicSettingsSchema, BasicSettingsFormData } from '@/schemas/agent-schema'
import { Input } from '@/components/common/Input'
import { Textarea } from '@/components/common/Textarea'
import { RadioGroup, RadioOption } from '@/components/common/RadioGroup'
import { Button } from '@/components/common/Button'

export function Step1BasicSettings(): React.ReactElement {
  const { t } = useTranslation('agent')
  const { basicSettings, setBasicSettings, nextStep, isEditMode } = useAgentWizard()

  /**
   * Configuration mode state (Auto or Manual)
   * Always starts with Manual mode
   */
  const [configMode, setConfigMode] = useState<ConfigMode>(ConfigMode.MANUAL)

  /**
   * Track selected sample ID in auto mode
   */
  const [selectedSampleId, setSelectedSampleId] = useState<string | null>(null)

  /**
   * Track previous configMode to detect actual changes
   */
  const prevConfigModeRef = React.useRef<ConfigMode>(configMode)

  /**
   * Initialize React Hook Form with Zod validation
   */
  const {
    register,
    control,
    handleSubmit,
    formState,
    watch,
    setValue,
    reset,
    trigger,
  } = useForm<BasicSettingsFormData>({
    resolver: zodResolver(basicSettingsSchema) as any, // eslint-disable-line @typescript-eslint/no-explicit-any
    mode: isEditMode ? 'all' : 'onChange', // In edit mode, validate on mount
    defaultValues: basicSettings || {
      name: '',
      description: '',
      mode: AgentType.CHAT,
      role: '',
      tool_enabled: true,
      icon_type: 'emoji',
      icon: '🤖',
      icon_background: '#3B82F6',
    },
  })

  /**
   * Destructure formState
   */
  const { errors, isSubmitting, isValid } = formState

  /**
   * Debug: Log validation state in edit mode
   */
  React.useEffect(() => {
    if (isEditMode) {
      const errorDetails = Object.entries(errors).map(([key, err]) => ({
        field: key,
        message: err?.message,
        type: err?.type
      }))
      const hasErrors = Object.keys(errors).length > 0
      console.warn('[Step1] Edit mode validation state:', {
        isValid,
        errorCount: Object.keys(errors).length,
        errorFields: Object.keys(errors),
        errorDetails,
        hasErrors,
        buttonShouldBeDisabled: hasErrors || isSubmitting,
        isSubmitting,
        basicSettings,
        formValues: watch()
      })
    }
  }, [isEditMode, isValid, errors, basicSettings, watch, isSubmitting])

  /**
   * Watch values for character count and mode
   */
  const descriptionValue = watch('description') || ''
  const currentMode = watch('mode')

  /**
   * Sync form with basicSettings from context
   * - When user clicks "Previous" button, form should be filled with saved data
   * - When user clicks "Start Fresh", form should be reset
   */
  React.useEffect(() => {
    if (basicSettings === null) {
      // Reset to initial values when starting fresh
      reset({
        name: '',
        description: '',
        mode: AgentType.CHAT,
        role: '',
        tool_enabled: true,
        icon_type: 'emoji',
        icon: '🤖',
        icon_background: '#3B82F6',
      })
      setConfigMode(ConfigMode.MANUAL)
    } else {
      // Update form with saved data when navigating back
      // In edit mode, trigger validation after reset
      reset(basicSettings, {
        keepDefaultValues: false,
        keepDirty: false,
        keepTouched: false,
      })
      // Don't change configMode - keep user's previous selection
    }
  }, [basicSettings, reset])

  /**
   * Trigger validation in edit mode after data is loaded
   * This ensures the "Next" button is enabled when form is pre-filled
   */
  React.useEffect(() => {
    if (isEditMode && basicSettings) {
      // Trigger validation after a short delay to ensure form is fully initialized
      const timer = setTimeout(async () => {
        await trigger()
      }, 200)
      return () => clearTimeout(timer)
    }
  }, [isEditMode, basicSettings, trigger])

  /**
   * Reset form when configuration mode changes
   * This ensures a clean slate when switching between Auto and Manual modes
   */
  React.useEffect(() => {
    // Only reset if configMode actually changed (not on mount/remount)
    if (prevConfigModeRef.current !== configMode) {
      // Reset form to initial values when config mode changes
      reset({
        name: '',
        description: '',
        mode: AgentType.CHAT,
        role: '',
        tool_enabled: true,
        icon_type: 'emoji',
        icon: '🤖',
        icon_background: '#3B82F6',
      })

      // Clear selected sample when switching modes
      setSelectedSampleId(null)

      // Update the previous value
      prevConfigModeRef.current = configMode
    }
  }, [configMode, reset])


  /**
   * Radio options for Agent type selection
   */
  const agentTypeOptions: RadioOption[] = [
    {
      value: AgentType.CHAT,
      title: t('types.chat.title'),
      description: t('types.chat.description'),
      icon: '💬',
    },
    {
      value: AgentType.COMPLETION,
      title: t('types.completion.title'),
      description: t('types.completion.description'),
      icon: '⚙️',
    },
  ]

  /**
   * ConfigMode radio options
   */
  const configModeOptions: RadioOption[] = [
    {
      value: ConfigMode.AUTO,
      title: t('configMode.auto.title'),
      description: t('configMode.auto.description'),
      icon: '✨',
    },
    {
      value: ConfigMode.MANUAL,
      title: t('configMode.manual.title'),
      description: t('configMode.manual.description'),
      icon: '✏️',
    },
  ]

  /**
   * Role template samples with full data for auto-fill
   */
  const allRoleSamples = [
    // Chat mode samples (대화형)
    {
      id: 'learningMentor',
      mode: AgentType.CHAT,
      icon: t('roleSamples.learningMentor.icon'),
      title: t('roleSamples.learningMentor.title'),
      suggestedName: t('roleSamples.learningMentor.suggestedName'),
      description: t('roleSamples.learningMentor.description'),
      content: t('roleSamples.learningMentor.content'),
    },
    {
      id: 'travelGuide',
      mode: AgentType.CHAT,
      icon: t('roleSamples.travelGuide.icon'),
      title: t('roleSamples.travelGuide.title'),
      suggestedName: t('roleSamples.travelGuide.suggestedName'),
      description: t('roleSamples.travelGuide.description'),
      content: t('roleSamples.travelGuide.content'),
    },
    {
      id: 'healthCoach',
      mode: AgentType.CHAT,
      icon: t('roleSamples.healthCoach.icon'),
      title: t('roleSamples.healthCoach.title'),
      suggestedName: t('roleSamples.healthCoach.suggestedName'),
      description: t('roleSamples.healthCoach.description'),
      content: t('roleSamples.healthCoach.content'),
    },
    {
      id: 'customerSupport',
      mode: AgentType.CHAT,
      icon: t('roleSamples.customerSupport.icon'),
      title: t('roleSamples.customerSupport.title'),
      suggestedName: t('roleSamples.customerSupport.suggestedName'),
      description: t('roleSamples.customerSupport.description'),
      content: t('roleSamples.customerSupport.content'),
    },
    {
      id: 'bookCurator',
      mode: AgentType.CHAT,
      icon: t('roleSamples.bookCurator.icon'),
      title: t('roleSamples.bookCurator.title'),
      suggestedName: t('roleSamples.bookCurator.suggestedName'),
      description: t('roleSamples.bookCurator.description'),
      content: t('roleSamples.bookCurator.content'),
    },
    {
      id: 'friendlyCompanion',
      mode: AgentType.CHAT,
      icon: t('roleSamples.friendlyCompanion.icon'),
      title: t('roleSamples.friendlyCompanion.title'),
      suggestedName: t('roleSamples.friendlyCompanion.suggestedName'),
      description: t('roleSamples.friendlyCompanion.description'),
      content: t('roleSamples.friendlyCompanion.content'),
    },
    // Completion mode samples (작업형)
    {
      id: 'translator',
      mode: AgentType.COMPLETION,
      icon: t('roleSamples.translator.icon'),
      title: t('roleSamples.translator.title'),
      suggestedName: t('roleSamples.translator.suggestedName'),
      description: t('roleSamples.translator.description'),
      content: t('roleSamples.translator.content'),
    },
    {
      id: 'summarizer',
      mode: AgentType.COMPLETION,
      icon: t('roleSamples.summarizer.icon'),
      title: t('roleSamples.summarizer.title'),
      suggestedName: t('roleSamples.summarizer.suggestedName'),
      description: t('roleSamples.summarizer.description'),
      content: t('roleSamples.summarizer.content'),
    },
    {
      id: 'emailWriter',
      mode: AgentType.COMPLETION,
      icon: t('roleSamples.emailWriter.icon'),
      title: t('roleSamples.emailWriter.title'),
      suggestedName: t('roleSamples.emailWriter.suggestedName'),
      description: t('roleSamples.emailWriter.description'),
      content: t('roleSamples.emailWriter.content'),
    },
    {
      id: 'copywriter',
      mode: AgentType.COMPLETION,
      icon: t('roleSamples.copywriter.icon'),
      title: t('roleSamples.copywriter.title'),
      suggestedName: t('roleSamples.copywriter.suggestedName'),
      description: t('roleSamples.copywriter.description'),
      content: t('roleSamples.copywriter.content'),
    },
    {
      id: 'technicalWriter',
      mode: AgentType.COMPLETION,
      icon: t('roleSamples.technicalWriter.icon'),
      title: t('roleSamples.technicalWriter.title'),
      suggestedName: t('roleSamples.technicalWriter.suggestedName'),
      description: t('roleSamples.technicalWriter.description'),
      content: t('roleSamples.technicalWriter.content'),
    },
    {
      id: 'reportWriter',
      mode: AgentType.COMPLETION,
      icon: t('roleSamples.reportWriter.icon'),
      title: t('roleSamples.reportWriter.title'),
      suggestedName: t('roleSamples.reportWriter.suggestedName'),
      description: t('roleSamples.reportWriter.description'),
      content: t('roleSamples.reportWriter.content'),
    },
  ]

  /**
   * Filter samples based on currently selected mode
   */
  const roleSamples = allRoleSamples.filter((sample) => sample.mode === currentMode)

  /**
   * Handle sample selection (Auto mode)
   * Auto-fills name, description, role, and icon
   */
  const handleSampleSelect = (sampleId: string): void => {
    const sample = allRoleSamples.find((s) => s.id === sampleId)
    if (sample) {
      setValue('name', sample.suggestedName, { shouldValidate: true })
      setValue('description', sample.description, { shouldValidate: true })
      setValue('role', sample.content, { shouldValidate: true })
      setValue('icon', sample.icon, { shouldValidate: true })
      // Track selected sample
      setSelectedSampleId(sampleId)
      // Stay in auto mode to allow selecting different samples
    }
  }

  /**
   * Handle role sample selection (Manual mode dropdown)
   * Auto-fills name, description, and role
   */
  const handleRoleSampleSelect = (sampleId: string): void => {
    const sample = allRoleSamples.find((s) => s.id === sampleId)
    if (sample) {
      setValue('name', sample.suggestedName, { shouldValidate: true })
      setValue('description', sample.description, { shouldValidate: true })
      setValue('role', sample.content, { shouldValidate: true })
      setValue('icon', sample.icon, { shouldValidate: true })
    }
  }

  /**
   * Form submission handler
   */
  const onSubmit = async (data: BasicSettingsFormData): Promise<void> => {
    try {
      // Save to context
      setBasicSettings(data)

      // Auto-save is handled by context's useEffect
      // Move to next step
      nextStep()
    } catch (error) {
      console.error('Failed to save basic settings:', error)
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {/* Configuration Mode Selection - Hide in edit mode */}
      {!isEditMode && (
        <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
          <h3 className="text-sm font-medium text-gray-900 mb-3">{t('configMode.title')}</h3>
          <RadioGroup
            name="config-mode"
            options={configModeOptions}
            value={configMode}
            onChange={(value) => setConfigMode(value as ConfigMode)}
          />
        </div>
      )}

      {/* Auto Mode: Sample Selection Cards - Hide in edit mode */}
      {!isEditMode && configMode === ConfigMode.AUTO && (
        <div className="space-y-4">
          {/* Agent Type Selection (for filtering samples) */}
          <Controller
            name="mode"
            control={control}
            render={({ field }) => (
              <RadioGroup
                name="agent-type"
                label={t('basicSettings.typeLabel')}
                options={agentTypeOptions}
                value={field.value}
                onChange={field.onChange}
                error={errors.mode ? t(errors.mode.message as string) : undefined}
                required
              />
            )}
          />

          {/* Sample Cards Grid */}
          <div>
            <h4 className="text-sm font-medium text-gray-900 mb-3">{t('configMode.selectSample')}</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {roleSamples.map((sample) => {
                const isSelected = selectedSampleId === sample.id
                return (
                  <button
                    key={sample.id}
                    type="button"
                    onClick={() => handleSampleSelect(sample.id)}
                    className={`relative text-left p-4 border-2 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                      isSelected
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 hover:border-blue-500 hover:bg-blue-50'
                    }`}
                  >
                    {/* Checkbox indicator */}
                    <div className="absolute top-2 right-2">
                      <div className={`w-5 h-5 rounded border-2 flex items-center justify-center ${
                        isSelected
                          ? 'bg-blue-500 border-blue-500'
                          : 'bg-white border-gray-300'
                      }`}>
                        {isSelected && (
                          <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </div>
                    </div>

                    <div className="flex items-start space-x-3 pr-6">
                      <span className="text-3xl">{sample.icon}</span>
                      <div className="flex-1 min-w-0">
                        <h5 className="font-semibold text-gray-900 text-sm mb-1">{sample.title}</h5>
                        <p className="text-xs text-gray-600 line-clamp-2">{sample.description}</p>
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {/* Manual Mode: Full Form */}
      {(isEditMode || configMode === ConfigMode.MANUAL) && (
        <>
          {/* Agent Type Selection - Hide in edit mode */}
          {!isEditMode && (
            <Controller
              name="mode"
              control={control}
              render={({ field }) => (
                <RadioGroup
                  name="agent-type"
                  label={t('basicSettings.typeLabel')}
                  options={agentTypeOptions}
                  value={field.value}
                  onChange={field.onChange}
                  error={errors.mode ? t(errors.mode.message as string) : undefined}
                  required
                />
              )}
            />
          )}

          {/* Sample Dropdown - Hide in edit mode */}
          {!isEditMode && (
            <div>
              <label htmlFor="sample-select" className="block text-sm font-medium text-gray-900 mb-2">
                {t('configMode.selectSample')}
              </label>
              <select
                id="sample-select"
                onChange={(e) => handleRoleSampleSelect(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                defaultValue=""
              >
                <option value="">{t('basicSettings.roleSamplePlaceholder')}</option>
                {roleSamples.map((sample) => (
                  <option key={sample.id} value={sample.id}>
                    {sample.icon} {sample.title}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Agent Name */}
          <Input
            {...register('name')}
            id="agent-name"
            label={t('basicSettings.nameLabel')}
            placeholder={t('basicSettings.namePlaceholder')}
            error={errors.name ? t(errors.name.message as string) : undefined}
            required
            maxLength={255}
          />

          {/* Agent Description (Optional) */}
          <Textarea
            {...register('description')}
            id="agent-description"
            label={t('basicSettings.descriptionLabel')}
            placeholder={t('basicSettings.descriptionPlaceholder')}
            error={errors.description ? t(errors.description.message as string) : undefined}
            maxLength={400}
            rows={3}
            showCharCount
            value={descriptionValue}
          />
        </>
      )}

      {/* Action Buttons */}
      <div className="flex items-center justify-end pt-4 border-t">
        <Button
          type="submit"
          variant="default"
          disabled={isEditMode ? (Object.keys(errors).length > 0 || isSubmitting) : (!isValid || isSubmitting)}
        >
          {isSubmitting ? '저장 중...' : t('buttons.next')}
        </Button>
      </div>
    </form>
  )
}
