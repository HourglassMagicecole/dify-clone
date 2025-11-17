'use client'

import { useTranslation } from 'react-i18next'
import type { ProcessingStep } from '@/types/chat'

interface ProcessingStepsProps {
  steps: ProcessingStep[]
  isVisible: boolean
}

/**
 * ProcessingSteps Component
 * Displays Agent processing steps in real-time
 */
export function ProcessingSteps({ steps, isVisible }: ProcessingStepsProps) {
  const { t } = useTranslation('chat')

  if (!isVisible) return null

  const getStatusIcon = (status: ProcessingStep['status']) => {
    switch (status) {
      case 'pending':
        return '⏳'
      case 'running':
        return '🔄'
      case 'completed':
        return '✅'
      case 'failed':
        return '❌'
    }
  }

  const getStatusColor = (status: ProcessingStep['status']) => {
    switch (status) {
      case 'pending':
        return 'text-gray-500'
      case 'running':
        return 'text-blue-500 animate-pulse'
      case 'completed':
        return 'text-green-500'
      case 'failed':
        return 'text-red-500'
    }
  }

  return (
    <div
      className="flex-1 bg-gray-50 overflow-y-auto border-t"
      role="complementary"
      aria-label={t('processingStepsAccessible')}
    >
      <div className="p-4 border-b bg-white sticky top-0">
        <h3 className="font-bold text-gray-900">{t('processingSteps')}</h3>
      </div>

      <div className="p-4 space-y-2">
        {steps.length === 0 ? (
          <p className="text-sm text-gray-500">
            {t('processingStepsEmpty')}
          </p>
        ) : (
          steps.map((step) => (
            <div key={step.id} className={`rounded-lg p-2.5 ${step.status === 'running' ? 'bg-blue-50 border-2 border-blue-300' : 'bg-white border border-gray-200'}`}>
              <div className="flex items-center gap-2">
                <span className={getStatusColor(step.status)}>{getStatusIcon(step.status)}</span>
                <span className={`text-sm ${step.status === 'running' ? 'font-semibold text-blue-700' : 'text-gray-600'}`}>
                  {step.name}
                </span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
