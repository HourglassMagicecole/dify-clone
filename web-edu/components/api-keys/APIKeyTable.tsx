/**
 * API Key Table Component (Story 1.8 - Task 10.1)
 *
 * Main table component for displaying API keys
 */

'use client'

import React from 'react'
import { useTranslation } from 'react-i18next'
import type { APIKeyConfig } from '@/types/api-key'
import { APIKeyRow } from './APIKeyRow'

interface APIKeyTableProps {
  apiKeys: APIKeyConfig[] | undefined
  isLoading: boolean
  onEdit: (apiKey: APIKeyConfig) => void
  onDelete: (apiKey: APIKeyConfig) => void
  onModelManage: (apiKey: APIKeyConfig) => void
}

export function APIKeyTable({
  apiKeys,
  isLoading,
  onEdit,
  onDelete,
  onModelManage,
}: APIKeyTableProps) {
  const { t } = useTranslation('api-keys')

  if (isLoading) {
    return (
      <div className="bg-white rounded-lg shadow p-12 text-center">
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
        <p className="mt-4 text-gray-600">{t('table.loading')}</p>
      </div>
    )
  }

  if (!apiKeys || apiKeys.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow p-12 text-center">
        <svg
          className="mx-auto h-12 w-12 text-gray-400"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z"
          />
        </svg>
        <h3 className="mt-4 text-lg font-medium text-gray-900">
          {t('table.noKeys')}
        </h3>
        <p className="mt-2 text-sm text-gray-500">
          {t('table.noKeysDescription')}
        </p>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-lg shadow overflow-hidden">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th
                scope="col"
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
              >
                {t('table.name')}
              </th>
              <th
                scope="col"
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
              >
                {t('table.provider')}
              </th>
              <th
                scope="col"
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
              >
                {t('table.status')}
              </th>
              <th
                scope="col"
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
              >
                {t('table.priority')}
              </th>
              <th
                scope="col"
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
              >
                {t('table.maskedKey')}
              </th>
              <th
                scope="col"
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
              >
                {t('table.createdAt')}
              </th>
              <th
                scope="col"
                className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider"
              >
                {t('table.actions')}
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {apiKeys.map(apiKey => (
              <APIKeyRow
                key={apiKey.id}
                apiKey={apiKey}
                onEdit={onEdit}
                onDelete={onDelete}
                onModelManage={onModelManage}
              />
            ))}
          </tbody>
        </table>
      </div>

      {/* 하단 요약 정보 */}
      <div className="bg-gray-50 px-6 py-3 border-t border-gray-200">
        <p className="text-sm text-gray-700">
          {t('table.totalKeys', { count: apiKeys.length })}
        </p>
      </div>
    </div>
  )
}
