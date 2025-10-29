/**
 * Agent Creation Wizard Page
 * Multi-step wizard for creating a new Agent
 */

'use client'

import React from 'react'
import { useRouter } from 'next/navigation'
import { useTranslation } from 'react-i18next'
import { AgentWizardProvider, useAgentWizard } from '@/context/AgentWizardContext'
import { StepIndicator, Step } from '@/components/common/StepIndicator'
import { AgentWizardStep } from '@/types/agent'
import { Button } from '@/components/common/Button'
import { Step1BasicSettings } from '@/components/agent/wizard/Step1BasicSettings'

/**
 * Wizard content component (must be inside Provider)
 */
function AgentWizardContent(): React.ReactElement {
  const { t } = useTranslation('agent')
  const router = useRouter()
  const { currentStep, resetWizard, goToStep, previousStep, isInitializing, isDraft } = useAgentWizard()

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
    const confirmed = window.confirm(
      '변경사항이 저장되지 않을 수 있습니다. 정말 취소하시겠습니까?'
    )

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
        return (
          <div className="text-center py-12">
            <p className="text-gray-500">Step 2: Prompt Configuration</p>
            <p className="text-sm text-gray-400 mt-2">
              (To be implemented in Story 2.2)
            </p>
          </div>
        )

      case AgentWizardStep.MODEL:
        return (
          <div className="text-center py-12">
            <p className="text-gray-500">Step 3: LLM Settings</p>
            <p className="text-sm text-gray-400 mt-2">
              (To be implemented in Story 2.2)
            </p>
          </div>
        )

      case AgentWizardStep.TOOLS:
        return (
          <div className="text-center py-12">
            <p className="text-gray-500">Step 4: Tools Configuration</p>
            <p className="text-sm text-gray-400 mt-2">
              (To be implemented in Story 2.3)
            </p>
          </div>
        )

      case AgentWizardStep.REVIEW:
        return (
          <div className="text-center py-12">
            <p className="text-gray-500">Step 5: Review & Test</p>
            <p className="text-sm text-gray-400 mt-2">
              (To be implemented in Story 2.4)
            </p>
          </div>
        )

      default:
        return <div>Unknown step</div>
    }
  }

  // Show loading state while initializing
  if (isInitializing) {
    return (
      <div className="min-h-screen bg-gray-50 py-8 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">불러오는 중...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">
            {t('wizard.title')}
          </h1>
          <p className="mt-2 text-sm text-gray-600">
            5단계로 구성된 마법사를 통해 새로운 Agent를 생성하세요
          </p>
        </div>

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

            {/* Previous button - show on steps 2-5 */}
            {currentStep > AgentWizardStep.BASIC && (
              <Button
                variant="outline"
                onClick={previousStep}
              >
                {t('buttons.previous')}
              </Button>
            )}
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
