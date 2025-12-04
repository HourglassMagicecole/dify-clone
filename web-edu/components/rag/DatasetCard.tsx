/**
 * DatasetCard Component (Student View)
 * Story 3.3: RAG List and Management
 * Pattern: AgentCard 참조
 */

'use client'

import { useTranslation } from 'react-i18next'
import {
  EyeIcon,
  TrashIcon,
} from '@heroicons/react/24/outline'
import type { Dataset } from '@/types/dataset'

interface DatasetCardProps {
  dataset: Dataset
  onView?: (datasetId: string) => void
  onDelete?: (datasetId: string) => void
}

/**
 * DatasetCard Component
 *
 * Displays individual Dataset (Knowledge Base) information in a card layout.
 * Features:
 * - Dataset icon with purple background
 * - Dataset name, description
 * - Document count, word count
 * - Creation date
 * - Status badge (ready/processing)
 * - Action buttons (view, delete)
 * - Hover effects
 * - Event propagation handling
 */
export function DatasetCard({
  dataset,
  onView,
  onDelete,
}: DatasetCardProps) {
  const { t } = useTranslation('dataset')

  const handleClick = () => {
    if (onView) {
      onView(dataset.id)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.key === 'Enter' || e.key === ' ') && onView) {
      e.preventDefault()
      onView(dataset.id)
    }
  }

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (onDelete) {
      onDelete(dataset.id)
    }
  }

  const formatDate = (timestamp: number) => {
    return new Date(timestamp * 1000).toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })
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
    <div
      className="bg-white border border-gray-200 rounded-lg p-6 hover:shadow-lg transition-shadow dark:bg-gray-800 dark:border-gray-700 cursor-pointer"
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      tabIndex={0}
      role="button"
      aria-label={`${dataset.name} ${t('card.ariaLabel')}`}
    >
      <div className="flex items-start gap-4">
        {/* Dataset Icon */}
        <div
          className="h-12 w-12 rounded-lg flex items-center justify-center text-2xl flex-shrink-0 bg-purple-100 dark:bg-purple-900/30"
          aria-hidden="true"
        >
          📚
        </div>

        {/* Dataset Information */}
        <div className="flex-1 min-w-0">
          <h3 className="text-lg font-medium text-gray-900 dark:text-white truncate">
            {dataset.name}
          </h3>

          {/* Dataset Description */}
          {dataset.description && (
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1 line-clamp-2">
              {dataset.description}
            </p>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="mt-4 flex items-center gap-4 text-sm text-gray-500 dark:text-gray-400">
        <span>
          {t('card.documents', { count: dataset.document_count })}
        </span>
        <span>
          {t('card.words', { count: formatNumber(dataset.word_count) })}
        </span>
      </div>

      {/* Date & Status */}
      <div className="mt-3 flex items-center justify-between text-xs">
        <span className="text-gray-400 dark:text-gray-500">
          {formatDate(dataset.created_at)}
        </span>
        <span
          className={`px-2 py-0.5 rounded ${
            dataset.embedding_available
              ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
              : 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
          }`}
        >
          {dataset.embedding_available ? t('card.ready') : t('card.processing')}
        </span>
      </div>

      {/* Action Buttons */}
      {(onView || onDelete) && (
        <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700 flex items-center gap-2">
          {onView && (
            <button
              type="button"
              onClick={handleClick}
              className="flex-1 inline-flex items-center justify-center gap-1 px-3 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:bg-blue-500 dark:hover:bg-blue-600"
              aria-label={`${dataset.name} ${t('card.viewAriaLabel')}`}
            >
              <EyeIcon className="h-4 w-4" />
              <span>{t('actions.view')}</span>
            </button>
          )}
          {onDelete && (
            <button
              type="button"
              onClick={handleDelete}
              className="flex-1 inline-flex items-center justify-center gap-1 px-3 py-2 text-sm font-medium text-red-700 bg-white border border-red-300 rounded-md hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 dark:bg-gray-700 dark:text-red-400 dark:border-red-600 dark:hover:bg-red-900/20"
              aria-label={`${dataset.name} ${t('card.deleteAriaLabel')}`}
            >
              <TrashIcon className="h-4 w-4" />
              <span>{t('actions.delete')}</span>
            </button>
          )}
        </div>
      )}
    </div>
  )
}
