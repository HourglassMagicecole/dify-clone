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
  const { basicSettings, setBasicSettings, nextStep } = useAgentWizard()

  /**
   * Configuration mode state (Auto or Manual)
   */
  const [configMode, setConfigMode] = useState<ConfigMode>(ConfigMode.MANUAL)

  /**
   * Flag to prevent auto-save during programmatic form reset
   */
  const isResettingRef = React.useRef(false)

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
  } = useForm<BasicSettingsFormData>({
    resolver: zodResolver(basicSettingsSchema),
    mode: 'onChange',
    defaultValues: basicSettings || {
      name: '',
      description: '',
      mode: AgentType.CHAT,
      role: '',
      tool_enabled: false,
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
   * Watch values for character count and mode
   */
  const descriptionValue = watch('description') || ''
  const roleValue = watch('role') || ''
  const currentMode = watch('mode')

  /**
   * Sync form with basicSettings from context
   * - When user clicks "Previous" button, form should be filled with saved data
   * - When user clicks "Start Fresh", form should be reset
   */
  React.useEffect(() => {
    isResettingRef.current = true

    if (basicSettings === null) {
      // Reset to initial values when starting fresh
      reset({
        name: '',
        description: '',
        mode: AgentType.CHAT,
        role: '',
        tool_enabled: false,
        icon_type: 'emoji',
        icon: '🤖',
        icon_background: '#3B82F6',
      })
      setConfigMode(ConfigMode.MANUAL)
    } else {
      // Update form with saved data when navigating back
      reset(basicSettings)
    }

    // Re-enable auto-save after reset completes
    setTimeout(() => {
      isResettingRef.current = false
    }, 0)
  }, [basicSettings, reset])

  /**
   * Auto-save form changes to context (for localStorage auto-save)
   * Watch all form values and update context when they change
   * This enables real-time localStorage sync as user types
   */
  React.useEffect(() => {
    const subscription = watch((formData) => {
      // Skip auto-save during programmatic form reset to prevent infinite loop
      if (isResettingRef.current) {
        return
      }

      // Only auto-save if essential fields are present to avoid saving incomplete data
      if (formData.name && formData.role && formData.mode) {
        setBasicSettings(formData as BasicSettingsFormData)
      }
    })
    return () => subscription.unsubscribe()
  }, [watch, setBasicSettings])

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
      // Switch to manual mode after selection to allow editing
      setConfigMode(ConfigMode.MANUAL)
    }
  }

  /**
   * Handle role sample selection (Manual mode dropdown)
   */
  const handleRoleSampleSelect = (sampleId: string): void => {
    const sample = allRoleSamples.find((s) => s.id === sampleId)
    if (sample) {
      setValue('role', sample.content, { shouldValidate: true })
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
      {/* Configuration Mode Selection */}
      <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
        <h3 className="text-sm font-medium text-gray-900 mb-3">{t('configMode.title')}</h3>
        <RadioGroup
          name="config-mode"
          options={configModeOptions}
          value={configMode}
          onChange={(value) => setConfigMode(value as ConfigMode)}
        />
      </div>

      {/* Auto Mode: Sample Selection Cards */}
      {configMode === ConfigMode.AUTO && (
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
              {roleSamples.map((sample) => (
                <button
                  key={sample.id}
                  type="button"
                  onClick={() => handleSampleSelect(sample.id)}
                  className="text-left p-4 border-2 border-gray-200 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <div className="flex items-start space-x-3">
                    <span className="text-3xl">{sample.icon}</span>
                    <div className="flex-1 min-w-0">
                      <h5 className="font-semibold text-gray-900 text-sm mb-1">{sample.title}</h5>
                      <p className="text-xs text-gray-600 line-clamp-2">{sample.description}</p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Manual Mode: Full Form */}
      {configMode === ConfigMode.MANUAL && (
        <>
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

      {/* Agent Type Selection */}
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

          {/* Agent Role Definition */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label htmlFor="agent-role" className="block text-sm font-medium text-gray-900">
                {t('basicSettings.roleLabel')}
                <span className="text-red-500 ml-1">*</span>
              </label>
              <select
                onChange={(e) => handleRoleSampleSelect(e.target.value)}
                className="text-sm border-gray-300 rounded-md shadow-sm focus:border-blue-500 focus:ring-blue-500"
                defaultValue=""
              >
                <option value="">{t('basicSettings.roleSamplePlaceholder')}</option>
                {roleSamples.map((sample) => (
                  <option key={sample.id} value={sample.id}>
                    {sample.title}
                  </option>
                ))}
              </select>
            </div>
            <Textarea
              {...register('role')}
              id="agent-role"
              placeholder={t('basicSettings.rolePlaceholder')}
              error={errors.role ? t(errors.role.message as string) : undefined}
              helperText={t('basicSettings.roleHelp')}
              required
              maxLength={2000}
              rows={8}
              showCharCount
              value={roleValue}
            />
          </div>
        </>
      )}

      {/* Action Buttons */}
      <div className="flex items-center justify-end pt-4 border-t">
        <Button
          type="submit"
          variant="default"
          disabled={!isValid || isSubmitting}
        >
          {isSubmitting ? '저장 중...' : t('buttons.next')}
        </Button>
      </div>
    </form>
  )
}
