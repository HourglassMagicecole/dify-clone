'use client'

import { useTranslation } from 'react-i18next'
import { CheckCircleIcon, XCircleIcon, ArrowPathIcon } from '@heroicons/react/24/outline'
import type { ExecutionStatus } from '@/types/agent'

interface ExecutionStatusIndicatorProps {
  status: ExecutionStatus
}

/**
 * ExecutionStatusIndicator Component
 *
 * Displays the current execution status with appropriate icon and color
 */
export function ExecutionStatusIndicator({ status }: ExecutionStatusIndicatorProps) {
  const { t } = useTranslation('agent')

  const getStatusConfig = () => {
    switch (status) {
      case 'idle':
        return {
          label: t('execute.status.idle'),
          icon: null,
          bgColor: 'bg-gray-100 dark:bg-gray-800',
          textColor: 'text-gray-700 dark:text-gray-300',
          borderColor: 'border-gray-300 dark:border-gray-600',
        }
      case 'running':
        return {
          label: t('execute.status.running'),
          icon: <ArrowPathIcon className="h-5 w-5 animate-spin" />,
          bgColor: 'bg-blue-50 dark:bg-blue-900/20',
          textColor: 'text-blue-700 dark:text-blue-300',
          borderColor: 'border-blue-300 dark:border-blue-700',
        }
      case 'success':
        return {
          label: t('execute.status.success'),
          icon: <CheckCircleIcon className="h-5 w-5" />,
          bgColor: 'bg-green-50 dark:bg-green-900/20',
          textColor: 'text-green-700 dark:text-green-300',
          borderColor: 'border-green-300 dark:border-green-700',
        }
      case 'failed':
        return {
          label: t('execute.status.failed'),
          icon: <XCircleIcon className="h-5 w-5" />,
          bgColor: 'bg-red-50 dark:bg-red-900/20',
          textColor: 'text-red-700 dark:text-red-300',
          borderColor: 'border-red-300 dark:border-red-700',
        }
      default:
        return {
          label: 'Unknown',
          icon: null,
          bgColor: 'bg-gray-100',
          textColor: 'text-gray-700',
          borderColor: 'border-gray-300',
        }
    }
  }

  const config = getStatusConfig()

  return (
    <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg border ${config.bgColor} ${config.textColor} ${config.borderColor}`}>
      {config.icon}
      <span className="text-sm font-medium">{config.label}</span>
    </div>
  )
}
