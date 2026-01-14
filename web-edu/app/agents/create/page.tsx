/**
 * Agent Creation Wizard Page
 * Multi-step wizard for creating a new Agent
 */

'use client'

import React from 'react'
import { useRouter } from 'next/navigation'
import { useTranslation } from 'react-i18next'
import { ArrowPathIcon, ExclamationCircleIcon } from '@heroicons/react/24/outline'
import { AgentWizardProvider, useAgentWizard } from '@/context/AgentWizardContext'
import { useSession } from '@/context/SessionContext'
import { StepIndicator, Step } from '@/components/common/StepIndicator'
import { AgentWizardStep } from '@/types/agent'
import { Button } from '@/components/common/Button'
import { Step1BasicSettings } from '@/components/agent/wizard/Step1BasicSettings'
import Step2PromptSettings from '@/components/agent/wizard/Step2PromptSettings'
import Step3ModelConfig from '@/components/agent/wizard/Step3ModelConfig'
import Step4ToolsConfig from '@/components/agent/wizard/Step4ToolsConfig'
import Step5Review from '@/components/agent/wizard/Step5Review'

/**
 * Wizard content component (must be inside Provider)
 */
function AgentWizardContent(): React.ReactElement {
  const { t } = useTranslation('agent')
  const router = useRouter()
  const { currentSession, isLoading: sessionLoading } = useSession()
  const {
    currentStep,
    resetWizard,
    goToStep,
    isInitializing,
    isDraft,
    isLoading,
    error,
    showDraftPrompt,
    restoreDraft,
    discardDraft,
  } = useAgentWizard()

  /**
   * Generate steps for StepIndicator
   */
  const steps: Step[] = [
    {
      number: 1,
      title: t('wizard.step1'),
      isCompleted: currentStep > AgentWizardStep.BASIC,
      isCurrent: currentStep === AgentWizardStep.BASIC,
    },
    {
      number: 2,
      title: t('wizard.step2'),
      isCompleted: currentStep > AgentWizardStep.PROMPT,
      isCurrent: currentStep === AgentWizardStep.PROMPT,
    },
    {
      number: 3,
      title: t('wizard.step3'),
      isCompleted: currentStep > AgentWizardStep.MODEL,
      isCurrent: currentStep === AgentWizardStep.MODEL,
    },
    {
      number: 4,
      title: t('wizard.step4'),
      isCompleted: currentStep > AgentWizardStep.TOOLS,
      isCurrent: currentStep === AgentWizardStep.TOOLS,
    },
    {
      number: 5,
      title: t('wizard.step5'),
      isCompleted: false,
      isCurrent: currentStep === AgentWizardStep.REVIEW,
    },
  ]

  /**
   * Handle cancel button
   */
  const handleCancel = (): void => {
    const confirmed = window.confirm(t('wizard.cancelConfirm'))

    if (confirmed) {
      resetWizard()
      router.push('/agents')
    }
  }

  /**
   * Handle "Start Fresh" button click
   */
  const handleStartFresh = (): void => {
    if (window.confirm(t('draft.confirmReset'))) {
      resetWizard()
    }
  }

  /**
   * Render step content based on current step
   */
  const renderStepContent = (): React.ReactElement => {
    switch (currentStep) {
      case AgentWizardStep.BASIC:
        return <Step1BasicSettings />

      case AgentWizardStep.PROMPT:
        return <Step2PromptSettings />

      case AgentWizardStep.MODEL:
        return <Step3ModelConfig />

      case AgentWizardStep.TOOLS:
        return <Step4ToolsConfig />

      case AgentWizardStep.REVIEW:
        return <Step5Review />

      default:
        return <div>Unknown step</div>
    }
  }

  // Show loading state while initializing
  if (isInitializing || sessionLoading) {
    return (
      <div className="min-h-screen bg-gray-50 py-8 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">{t('wizard.loading')}</p>
        </div>
      </div>
    )
  }

  // Show warning if no active session
  if (!currentSession) {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="mx-auto max-w-2xl px-4 sm:px-6 lg:px-8">
          <div className="bg-white rounded-lg shadow p-8">
            <div className="text-center">
              <ExclamationCircleIcon className="h-16 w-16 text-yellow-500 mx-auto mb-4" />
              <h2 className="text-2xl font-bold text-gray-900 mb-2">
                {t('wizard.sessionRequired')}
              </h2>
              <p className="text-gray-600 mb-6">
                {t('wizard.sessionRequiredCreateMessage')}
                <br />
                {t('wizard.contactAdmin')}
              </p>
              <Button
                variant="default"
                onClick={() => router.push('/dashboard')}
              >
                {t('wizard.backToDashboard')}
              </Button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      {/* Draft Restore Prompt Modal */}
      {showDraftPrompt && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md mx-4 shadow-xl">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              💾 {t('draft.promptTitle') || '저장된 작업 발견'}
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
              {t('draft.promptMessage') || '이전에 작성하던 Agent 초안이 있습니다. 이어서 작성하시겠습니까?'}
            </p>
            <div className="flex gap-3">
              <button
                onClick={discardDraft}
                className="flex-1 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 dark:bg-gray-700 dark:text-gray-200 dark:border-gray-600 dark:hover:bg-gray-600"
              >
                {t('draft.startFresh') || '새로 작성'}
              </button>
              <button
                onClick={restoreDraft}
                className="flex-1 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:bg-blue-500 dark:hover:bg-blue-600"
              >
                {t('draft.continue') || '이어서 작성'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Global Loading Overlay */}
      {isLoading && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 flex items-center gap-4">
            <ArrowPathIcon className="h-6 w-6 animate-spin text-blue-600 dark:text-blue-400" />
            <span className="text-sm font-medium text-gray-900 dark:text-white">
              {t('wizard.creating')}
            </span>
          </div>
        </div>
      )}

      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            {t('wizard.title')}
          </h1>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
            {t('wizard.description')}
          </p>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="mb-6 flex items-start gap-3 p-4 border border-red-300 rounded-lg bg-red-50 dark:bg-red-900/20 dark:border-red-800">
            <ExclamationCircleIcon className="h-5 w-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <h3 className="text-sm font-medium text-red-800 dark:text-red-200">{t('wizard.errorOccurred')}</h3>
              <p className="mt-1 text-sm text-red-700 dark:text-red-300">{error}</p>
            </div>
          </div>
        )}

        {/* Step Indicator */}
        <div className="mb-8">
          <StepIndicator
            steps={steps}
            currentStep={currentStep}
            onStepClick={(stepNumber) => goToStep(stepNumber as AgentWizardStep)}
          />
        </div>

        {/* Draft Badge - Show when continuing from saved work (all steps) */}
        {isDraft && (
          <div className="mb-6 flex items-center justify-between bg-blue-50 border border-blue-200 rounded-lg p-3">
            <div className="flex items-center space-x-2">
              <span className="text-sm font-medium text-blue-800">💾 {t('draft.badge')}</span>
            </div>
            <button
              type="button"
              onClick={handleStartFresh}
              className="text-sm text-blue-600 hover:text-blue-800 font-medium focus:outline-none focus:underline"
            >
              {t('buttons.startFresh')}
            </button>
          </div>
        )}

        {/* Main Content Card */}
        <div className="bg-white rounded-lg shadow">
          <div className="px-6 py-8">
            {renderStepContent()}
          </div>
        </div>

        {/* Footer Buttons */}
        <div className="mt-6 flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Button
              variant="secondary"
              onClick={handleCancel}
            >
              {t('buttons.cancel')}
            </Button>
          </div>

          <div className="flex items-center space-x-4">
            <p className="text-sm text-gray-500">
              Step {currentStep} of {AgentWizardStep.REVIEW}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

/**
 * Main page component with Provider
 */
export default function AgentCreatePage(): React.ReactElement {
  return (
    <AgentWizardProvider>
      <AgentWizardContent />
    </AgentWizardProvider>
  )
}
