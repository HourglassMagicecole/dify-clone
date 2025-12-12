/**
 * API Key Row Component (Story 1.8 - Task 10.2)
 *
 * Individual row in API Key table with actions
 */

'use client'

import React from 'react'
import { useTranslation } from 'react-i18next'
import type { APIKeyConfig } from '@/types/api-key'
import { PROVIDER_METADATA } from '@/types/api-key'
import { StatusBadge } from './StatusBadge'
import { Button } from '@/components/common/Button'

interface APIKeyRowProps {
  apiKey: APIKeyConfig
  onEdit: (apiKey: APIKeyConfig) => void
  onDelete: (apiKey: APIKeyConfig) => void
  onModelManage: (apiKey: APIKeyConfig) => void
}

export function APIKeyRow({
  apiKey,
  onEdit,
  onDelete,
  onModelManage,
}: APIKeyRowProps) {
  const { t } = useTranslation('api-keys')

  const providerMetadata = PROVIDER_METADATA[apiKey.provider]

  return (
    <tr className="hover:bg-gray-50 transition-colors">
      {/* Key Name */}
      <td className="px-6 py-4 whitespace-nowrap">
        <div className="flex items-center">
          <div className="text-sm font-medium text-gray-900">
            {apiKey.key_name}
          </div>
        </div>
      </td>

      {/* Provider */}
      <td className="px-6 py-4 whitespace-nowrap">
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-900">
            {providerMetadata.name}
          </span>
        </div>
      </td>

      {/* Status */}
      <td className="px-6 py-4 whitespace-nowrap">
        <StatusBadge isActive={apiKey.is_active} />
      </td>

      {/* Priority */}
      <td className="px-6 py-4 whitespace-nowrap">
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 capitalize">
          {apiKey.priority}
        </span>
      </td>

      {/* Masked Key */}
      <td className="px-6 py-4 whitespace-nowrap">
        <code className="text-xs text-gray-600 font-mono bg-gray-50 px-2 py-1 rounded">
          {apiKey.api_key_masked}
        </code>
      </td>

      {/* Created At */}
      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
        {new Date(apiKey.created_at).toLocaleDateString('ko-KR')}
      </td>

      {/* Actions */}
      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
        <div className="flex justify-end gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onModelManage(apiKey)}
          >
            {t('actions.models')}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onEdit(apiKey)}
          >
            {t('actions.edit')}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onDelete(apiKey)}
            className="text-red-600 hover:text-red-700"
          >
            {t('actions.delete')}
          </Button>
        </div>
      </td>
    </tr>
  )
}
