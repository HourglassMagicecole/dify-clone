'use client'

import type { FC } from 'react'
import Link from 'next/link'
import { useTranslation } from 'react-i18next'

interface SuggestedNextStepsProps {
  resourceSummary: {
    agents: number
    datasets: number
  }
}

interface NextStep {
  step: string
  title: string
  description: string
  linkUrl: string
  icon: string
}

export const SuggestedNextSteps: FC<SuggestedNextStepsProps> = ({ resourceSummary }) => {
  const { t } = useTranslation('dashboard')

  const getNextStep = (summary: { agents: number; datasets: number }): NextStep => {
    if (summary.agents === 0) {
      return {
        step: 'create-agent',
        title: t('suggestedNextSteps.steps.createAgent.title'),
        description: t('suggestedNextSteps.steps.createAgent.description'),
        linkUrl: '/agents/create',
        icon: '🤖',
      }
    }
    if (summary.datasets === 0) {
      return {
        step: 'create-dataset',
        title: t('suggestedNextSteps.steps.createDataset.title'),
        description: t('suggestedNextSteps.steps.createDataset.description'),
        linkUrl: '/datasets/create',
        icon: '📚',
      }
    }
    return {
      step: 'connect-all',
      title: t('suggestedNextSteps.steps.connectAll.title'),
      description: t('suggestedNextSteps.steps.connectAll.description'),
      linkUrl: '/agents',
      icon: '🔗',
    }
  }

  const nextStep = getNextStep(resourceSummary)

  const steps = [
    { key: 'agent', label: t('suggestedNextSteps.checklist.agent'), completed: resourceSummary.agents > 0 },
    { key: 'dataset', label: t('suggestedNextSteps.checklist.dataset'), completed: resourceSummary.datasets > 0 },
  ]

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h3 className="text-lg font-semibold mb-4">{t('suggestedNextSteps.title')}</h3>

      {/* Checklist */}
      <ul className="space-y-2 mb-6">
        {steps.map(step => (
          <li key={step.key} className="flex items-center gap-2">
            <span className={step.completed ? 'text-green-600' : 'text-gray-400'}>
              {step.completed ? '✅' : '⬜'}
            </span>
            <span className={step.completed ? 'line-through text-gray-500' : 'text-gray-900'}>
              {step.label}
            </span>
          </li>
        ))}
      </ul>

      {/* Next step suggestion card */}
      <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <div className="text-3xl">{nextStep.icon}</div>
          <div className="flex-1">
            <h4 className="font-semibold text-blue-900">{nextStep.title}</h4>
            <p className="text-sm text-blue-700 mt-1">{nextStep.description}</p>
            <Link
              href={nextStep.linkUrl}
              className="inline-block mt-3 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
            >
              {t('suggestedNextSteps.startButton')}
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
