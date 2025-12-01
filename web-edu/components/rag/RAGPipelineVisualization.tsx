/**
 * RAG Pipeline Visualization Component
 * Displays 4-step pipeline: Load -> Split -> Embed -> Store
 * Story 3.1: RAG Creation Wizard - Load & Split
 *
 * Reuses existing StepIndicator component from components/common/
 */

'use client'

import React, { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { StepIndicator, type Step } from '@/components/common/StepIndicator'
import { RAGWizardStep } from '@/types/dataset'

interface RAGPipelineVisualizationProps {
  currentStep: RAGWizardStep
  onStepClick?: (step: RAGWizardStep) => void
}

/**
 * Pipeline step definitions
 */
const PIPELINE_STEPS = [
  { step: RAGWizardStep.LOAD, titleKey: 'pipeline.load', icon: '📄' },
  { step: RAGWizardStep.SPLIT, titleKey: 'pipeline.split', icon: '✂️' },
  { step: RAGWizardStep.EMBED, titleKey: 'pipeline.embed', icon: '🔢' },
  { step: RAGWizardStep.STORE, titleKey: 'pipeline.store', icon: '💾' },
]

export function RAGPipelineVisualization({
  currentStep,
  onStepClick,
}: RAGPipelineVisualizationProps): React.ReactElement {
  const { t } = useTranslation('dataset')

  /**
   * Convert pipeline steps to StepIndicator format
   */
  const steps: Step[] = useMemo(() => {
    return PIPELINE_STEPS.map(({ step, titleKey, icon }) => ({
      number: step,
      title: `${icon} ${t(titleKey)}`,
      isCompleted: step < currentStep,
      isCurrent: step === currentStep,
    }))
  }, [currentStep, t])

  /**
   * Handle step click - only allow clicking completed steps
   */
  const handleStepClick = (stepNumber: number) => {
    if (onStepClick && stepNumber < currentStep) {
      onStepClick(stepNumber as RAGWizardStep)
    }
  }

  return (
    <div className="w-full py-4">
      <StepIndicator
        steps={steps}
        currentStep={currentStep}
        onStepClick={handleStepClick}
      />
    </div>
  )
}
