/**
 * DatasetTable Component (Owner/Admin View)
 * Story 3.3: RAG List and Management
 * Pattern: AgentTable 참조
 */

'use client'

import type { FC } from 'react'
import { useTranslation } from 'react-i18next'
import type { Dataset } from '@/types/dataset'

interface DatasetTableProps {
  datasets: Dataset[]
  isLoading?: boolean
  onView?: (dataset: Dataset) => void
  onDelete?: (dataset: Dataset) => void
}

/**
 * DatasetTable Component (Administrator View)
 * Displays datasets in table format with owner information
 *
 * Features:
 * - Table layout for admin/owner view
 * - Columns: Name, Owner, Documents, Status, Created, Actions
 * - Loading skeleton
 * - Empty state
 * - Action buttons per row
 */
export const DatasetTable: FC<DatasetTableProps> = ({
  datasets,
  isLoading = false,
  onView,
  onDelete,
}) => {
  const { t } = useTranslation('dataset')

  if (isLoading) {
    return (
      <div className="bg-white rounded-lg shadow overflow-hidden dark:bg-gray-800">
        <div className="animate-pulse p-4">
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-full mb-2" />
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-full mb-2" />
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-full" />
        </div>
      </div>
    )
  }

  if (datasets.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow p-8 text-center dark:bg-gray-800">
        <div className="text-4xl mb-4">📚</div>
        <p className="text-gray-600 dark:text-gray-400">{t('list.emptyTitle')}</p>
      </div>
    )
  }

  const formatNumber = (num: number) => {
    if (num >= 1000000) {
      return `${(num / 1000000).toFixed(1)}M`
    }
    if (num >= 1000) {
      return `${(num / 1000).toFixed(1)}K`
    }
    return num.toString()
  }

  return (
    <div className="bg-white rounded-lg shadow overflow-hidden dark:bg-gray-800">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead className="bg-gray-50 dark:bg-gray-900">
            <tr>
              <th
                scope="col"
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider"
              >
                {t('table.name')}
              </th>
              <th
                scope="col"
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider"
              >
                {t('table.owner')}
              </th>
              <th
                scope="col"
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider"
              >
                {t('table.documents')}
              </th>
              <th
                scope="col"
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider"
              >
                {t('table.status')}
              </th>
              <th
                scope="col"
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider"
              >
                {t('table.createdAt')}
              </th>
              <th
                scope="col"
                className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider"
              >
                {t('table.actions')}
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200 dark:bg-gray-800 dark:divide-gray-700">
            {datasets.map((dataset) => (
              <tr
                key={dataset.id}
                className="hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center">
                    <div className="h-10 w-10 rounded-lg flex items-center justify-center text-xl flex-shrink-0 bg-purple-100 dark:bg-purple-900/30">
                      📚
                    </div>
                    <div className="ml-4">
                      <div className="text-sm font-medium text-gray-900 dark:text-white">
                        {dataset.name}
                      </div>
                      {dataset.description && (
                        <div className="text-sm text-gray-500 dark:text-gray-400 truncate max-w-xs">
                          {dataset.description}
                        </div>
                      )}
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm text-gray-900 dark:text-gray-200">
                    {dataset.author_name || '-'}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm text-gray-500 dark:text-gray-400">
                    {dataset.document_count}
                    <span className="text-xs text-gray-400 dark:text-gray-500 ml-1">
                      ({formatNumber(dataset.word_count)} {t('table.words')})
                    </span>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span
                    className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                      dataset.embedding_available
                        ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                        : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400'
                    }`}
                  >
                    {dataset.embedding_available ? t('card.ready') : t('card.processing')}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                  {new Date(dataset.created_at * 1000).toLocaleDateString()}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                  <div className="flex items-center justify-end gap-2">
                    {onView && (
                      <button
                        type="button"
                        onClick={() => onView(dataset)}
                        className="text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300 font-semibold"
                      >
                        {t('actions.view')}
                      </button>
                    )}
                    {onDelete && (
                      <button
                        type="button"
                        onClick={() => onDelete(dataset)}
                        className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300"
                      >
                        {t('actions.delete')}
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
