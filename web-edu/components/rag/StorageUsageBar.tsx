/**
 * StorageUsageBar Component
 * Story 3.3: RAG List and Management - Task 10
 */

'use client'

import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import type { StorageUsage, StorageLimit } from '@/types/dataset'

interface StorageUsageBarProps {
  usage: StorageUsage
  limit?: StorageLimit
  className?: string
}

/**
 * Storage usage display component
 *
 * Features:
 * - Shows total datasets, documents, words count
 * - Optional progress bar when limit is set
 * - Warning banner when over limit
 */
export function StorageUsageBar({
  usage,
  limit,
  className = '',
}: StorageUsageBarProps) {
  const { t } = useTranslation('dataset')

  const formatNumber = (num: number) => {
    if (num >= 1000000) {
      return `${(num / 1000000).toFixed(1)}M`
    }
    if (num >= 1000) {
      return `${(num / 1000).toFixed(1)}K`
    }
    return num.toString()
  }

  // Calculate usage percentages
  const percentages = useMemo(() => {
    if (!limit) return null

    return {
      datasets: limit.maxDatasets ? (usage.totalDatasets / limit.maxDatasets) * 100 : null,
      documents: limit.maxDocuments ? (usage.totalDocuments / limit.maxDocuments) * 100 : null,
      words: limit.maxWords ? (usage.totalWords / limit.maxWords) * 100 : null,
    }
  }, [usage, limit])

  // Check if over limit
  const isOverLimit = useMemo(() => {
    if (!limit) return false

    return (
      (limit.maxDatasets && usage.totalDatasets > limit.maxDatasets) ||
      (limit.maxDocuments && usage.totalDocuments > limit.maxDocuments) ||
      (limit.maxWords && usage.totalWords > limit.maxWords)
    )
  }, [usage, limit])

  return (
    <div className={`bg-white dark:bg-gray-800 rounded-lg shadow p-4 ${className}`}>
      {/* Usage Stats */}
      <div className="flex items-center gap-6 text-sm">
        {/* Datasets */}
        <div className="flex items-center gap-2">
          <span className="text-gray-500 dark:text-gray-400">
            {t('storage.datasets')}:
          </span>
          <span className="font-medium text-gray-900 dark:text-white">
            {usage.totalDatasets}
            {limit?.maxDatasets && (
              <span className="text-gray-400">/{limit.maxDatasets}</span>
            )}
          </span>
        </div>

        {/* Documents */}
        <div className="flex items-center gap-2">
          <span className="text-gray-500 dark:text-gray-400">
            {t('storage.documents')}:
          </span>
          <span className="font-medium text-gray-900 dark:text-white">
            {formatNumber(usage.totalDocuments)}
            {limit?.maxDocuments && (
              <span className="text-gray-400">/{formatNumber(limit.maxDocuments)}</span>
            )}
          </span>
        </div>

        {/* Words */}
        <div className="flex items-center gap-2">
          <span className="text-gray-500 dark:text-gray-400">
            {t('storage.words')}:
          </span>
          <span className="font-medium text-gray-900 dark:text-white">
            {formatNumber(usage.totalWords)}
            {limit?.maxWords && (
              <span className="text-gray-400">/{formatNumber(limit.maxWords)}</span>
            )}
          </span>
        </div>
      </div>

      {/* Progress Bar (if limit is set) */}
      {percentages && (
        <div className="mt-3 space-y-2">
          {percentages.datasets !== null && (
            <div>
              <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${
                    percentages.datasets > 90
                      ? 'bg-red-500'
                      : percentages.datasets > 70
                        ? 'bg-yellow-500'
                        : 'bg-blue-500'
                  }`}
                  style={{ width: `${Math.min(percentages.datasets, 100)}%` }}
                />
              </div>
            </div>
          )}
        </div>
      )}

      {/* Over Limit Warning */}
      {isOverLimit && (
        <div className="mt-3 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
          <p className="text-sm text-red-800 dark:text-red-200">
            {t('storage.overLimitWarning')}
          </p>
        </div>
      )}
    </div>
  )
}
