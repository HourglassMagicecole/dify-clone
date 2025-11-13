/**
 * Agent Wizard Edit Content Component
 * Reuses Agent Creation Wizard components in edit mode
 */

'use client'

import React from 'react'
import { useRouter } from 'next/navigation'
import { useTranslation } from 'react-i18next'
import { ArrowPathIcon, ExclamationCircleIcon } from '@heroicons/react/24/outline'
import { useAgentWizard } from '@/context/AgentWizardContext'
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
 * Wizard content component for editing (must be inside Provider)
 */
export default function AgentWizardEditContent(): React.ReactElement {
  const { t } = useTranslation('agent')
  const router = useRouter()
  const { currentSession, isLoading: sessionLoading } = useSession()
  const {
    currentStep,
    resetWizard,
    goToStep,
    isInitializing,
    isLoading,
    error,
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
    const confirmed = window.confirm(
      '변경사항이 저장되지 않을 수 있습니다. 정말 취소하시겠습니까?'
    )

    if (confirmed) {
      resetWizard()
      router.push('/agents')
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
          <p className="mt-4 text-gray-600">Agent를 불러오는 중...</p>
        </div>
      </div>
    )
  }

  // Show warning if no active session (should not happen in edit mode)
  if (!currentSession) {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="mx-auto max-w-2xl px-4 sm:px-6 lg:px-8">
          <div className="bg-white rounded-lg shadow p-8">
            <div className="text-center">
              <ExclamationCircleIcon className="h-16 w-16 text-yellow-500 mx-auto mb-4" />
              <h2 className="text-2xl font-bold text-gray-900 mb-2">
                세션이 필요합니다
              </h2>
              <p className="text-gray-600 mb-6">
                Agent를 편집하려면 먼저 활성화된 교육 세션에 속해있어야 합니다.
                <br />
                관리자에게 문의하여 세션에 등록해주세요.
              </p>
              <Button
                variant="default"
                onClick={() => router.push('/dashboard')}
              >
                대시보드로 돌아가기
              </Button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      {/* Global Loading Overlay */}
      {isLoading && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 flex items-center gap-4">
            <ArrowPathIcon className="h-6 w-6 animate-spin text-blue-600 dark:text-blue-400" />
            <span className="text-sm font-medium text-gray-900 dark:text-white">
              Agent 업데이트 중...
            </span>
          </div>
        </div>
      )}

      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Agent 편집
          </h1>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
            5단계로 구성된 마법사를 통해 Agent를 수정하세요
          </p>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="mb-6 flex items-start gap-3 p-4 border border-red-300 rounded-lg bg-red-50 dark:bg-red-900/20 dark:border-red-800">
            <ExclamationCircleIcon className="h-5 w-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <h3 className="text-sm font-medium text-red-800 dark:text-red-200">오류가 발생했습니다</h3>
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
