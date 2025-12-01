/**
 * RAG Dataset Creation Wizard Page
 * Route: /datasets/create
 * Story 3.1: RAG Creation Wizard - Load & Split
 */

'use client'

import React, { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useRouter } from 'next/navigation'
import { RAGWizardProvider, useRAGWizard } from '@/context/RAGWizardContext'
import { RAGPipelineVisualization } from '@/components/rag/RAGPipelineVisualization'
import { Step1Load } from '@/components/rag/wizard/Step1Load'
import { Step2Split } from '@/components/rag/wizard/Step2Split'
import { RAGWizardStep } from '@/types/dataset'
import { Button } from '@/components/common/Button'
import { datasetAPI } from '@/service/dataset-api'

/**
 * Inner component that uses RAG wizard context
 */
const TOTAL_STEPS = 4

function RAGWizardContent(): React.ReactElement {
  const { t } = useTranslation('dataset')
  const router = useRouter()
  const { currentStep, goToStep, error } = useRAGWizard()

  // Check embedding model availability on page load
  const [embeddingModelAvailable, setEmbeddingModelAvailable] = useState<boolean | null>(null)

  useEffect(() => {
    const checkEmbeddingModel = async () => {
      try {
        const isAvailable = await datasetAPI.isEmbeddingModelAvailable()
        setEmbeddingModelAvailable(isAvailable)
      } catch {
        setEmbeddingModelAvailable(false)
      }
    }
    checkEmbeddingModel()
  }, [])

  /**
   * Handle step click from visualization
   */
  const handleStepClick = (step: RAGWizardStep) => {
    // Only allow going back to completed steps
    if (step < currentStep) {
      goToStep(step)
    }
  }

  /**
   * Render current step component
   */
  const renderStepContent = () => {
    switch (currentStep) {
      case RAGWizardStep.LOAD:
        return <Step1Load />
      case RAGWizardStep.SPLIT:
        return <Step2Split />
      case RAGWizardStep.EMBED:
      case RAGWizardStep.STORE:
        // Placeholder for Story 3.2
        return (
          <div className="text-center py-12">
            <div className="text-6xl mb-4">🚧</div>
            <h3 className="text-lg font-medium text-gray-900">
              {t('common.comingSoon')}
            </h3>
            <p className="text-sm text-gray-500 mt-2">
              {t('common.comingSoonDesc')}
            </p>
          </div>
        )
      default:
        return null
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div>
            <h1 className="text-xl font-bold text-gray-900">
              {t('create.title')}
            </h1>
            <p className="text-sm text-gray-500">
              {t('create.subtitle')}
            </p>
          </div>
        </div>
      </header>

      {/* Embedding Model Warning Banner */}
      {embeddingModelAvailable === false && (
        <div className="max-w-4xl mx-auto px-4 pt-6">
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <svg className="w-6 h-6 text-amber-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <div>
                <p className="font-medium text-amber-800">{t('create.embeddingModelWarning')}</p>
                <p className="text-sm text-amber-700 mt-1">{t('create.embeddingModelWarningDesc')}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Pipeline Visualization */}
      <div className="max-w-4xl mx-auto px-4 py-6">
        <RAGPipelineVisualization
          currentStep={currentStep}
          onStepClick={handleStepClick}
        />
      </div>

      {/* Error Display */}
      {error && (
        <div className="max-w-4xl mx-auto px-4 mb-4">
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        </div>
      )}

      {/* Step Content */}
      <main className="max-w-4xl mx-auto px-4 pb-4">
        <div className="bg-white rounded-lg shadow-sm border p-6">
          {renderStepContent()}
        </div>
      </main>

      {/* Footer: Cancel Button & Step Indicator */}
      <footer className="max-w-4xl mx-auto px-4 pb-12">
        <div className="flex items-center justify-between">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.push('/dashboard')}
          >
            {t('common.cancel')}
          </Button>
          <span className="text-sm text-gray-500">
            Step {currentStep} of {TOTAL_STEPS}
          </span>
        </div>
      </footer>
    </div>
  )
}

/**
 * Page component with provider
 */
export default function DatasetCreatePage(): React.ReactElement {
  return (
    <RAGWizardProvider>
      <RAGWizardContent />
    </RAGWizardProvider>
  )
}
