/**
 * Status Badge Component for API Keys (Story 1.8 - Task 10.3)
 *
 * Displays active/inactive status indicator
 */

'use client'

import React from 'react'
import { useTranslation } from 'react-i18next'

interface StatusBadgeProps {
  isActive: boolean
}

export function StatusBadge({ isActive }: StatusBadgeProps) {
  const { t } = useTranslation('api-keys')

  return (
    <span
      className={`
        inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium
        ${isActive
          ? 'bg-green-100 text-green-800'
          : 'bg-gray-100 text-gray-800'
        }
      `}
    >
      <span
        className={`
          w-1.5 h-1.5 rounded-full mr-1.5
          ${isActive ? 'bg-green-400' : 'bg-gray-400'}
        `}
      />
      {isActive ? t('status.active') : t('status.inactive')}
    </span>
  )
}
