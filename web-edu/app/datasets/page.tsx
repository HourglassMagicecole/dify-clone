'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslation } from 'react-i18next'
import { PlusIcon, ArrowPathIcon } from '@heroicons/react/24/outline'
import { datasetAPI } from '@/service/dataset-api'
import type { Dataset } from '@/types/dataset'
import { Button } from '@/components/common/Button'
import { EmptyState } from '@/components/common/EmptyState'

/**
 * Dataset List Page
 * Story 3.2: RAG Creation Wizard - Embed & Store
 *
 * Features:
 * - Display all created datasets
 * - Navigate to create new dataset
 * - Show loading and empty states
 */
export default function DatasetsPage() {
  const { t } = useTranslation('dataset')
  const router = useRouter()
  const [datasets, setDatasets] = useState<Dataset[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadDatasets = useCallback(async () => {
    try {
      setIsLoading(true)
      setError(null)
      const response = await datasetAPI.getDatasets({ limit: 100 })
      if (response.result === 'success' && response.data) {
        // getDifyNative unwraps { data: [...] } to just [...], so response.data is already the array
        const datasetsArray = Array.isArray(response.data) ? response.data : response.data.data || []
        setDatasets(datasetsArray)
      }
    } catch (err) {
      console.error('Failed to load datasets:', err)
      setError(err instanceof Error ? err.message : 'Failed to load datasets')
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    loadDatasets()
  }, [loadDatasets])

  const handleCreateDataset = () => {
    router.push('/datasets/create')
  }

  const formatDate = (timestamp: number) => {
    return new Date(timestamp * 1000).toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                {t('list.title')}
              </h1>
              <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                {t('list.description')}
              </p>
            </div>
            <Button onClick={handleCreateDataset}>
              <PlusIcon className="h-5 w-5 mr-2" />
              {t('list.createButton')}
            </Button>
          </div>
        </div>

        {/* Loading State */}
        {isLoading && (
          <div className="flex items-center justify-center py-12">
            <ArrowPathIcon className="h-8 w-8 animate-spin text-gray-400" />
          </div>
        )}

        {/* Error State */}
        {error && !isLoading && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 dark:bg-red-900/20 dark:border-red-800">
            <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
          </div>
        )}

        {/* Empty State */}
        {!isLoading && !error && datasets.length === 0 && (
          <EmptyState
            icon={<PlusIcon className="h-8 w-8 text-gray-400" />}
            title={t('list.emptyTitle')}
            description={t('list.emptyDescription')}
            actionLabel={t('list.createButton')}
            onAction={handleCreateDataset}
          />
        )}

        {/* Dataset List */}
        {!isLoading && !error && datasets.length > 0 && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {datasets.map((dataset) => (
              <div
                key={dataset.id}
                className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 hover:shadow-md transition-shadow cursor-pointer"
                onClick={() => router.push(`/datasets/${dataset.id}`)}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <h3 className="text-lg font-medium text-gray-900 dark:text-white truncate">
                      {dataset.name}
                    </h3>
                  </div>
                </div>

                <div className="mt-4 flex items-center gap-4 text-sm text-gray-500 dark:text-gray-400">
                  <span>{t('list.documents', { count: dataset.document_count })}</span>
                  <span>{t('list.words', { count: dataset.word_count })}</span>
                </div>

                <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-700 flex items-center justify-between text-xs text-gray-400">
                  <span>{formatDate(dataset.created_at)}</span>
                  <span className={`px-2 py-0.5 rounded ${
                    dataset.embedding_available
                      ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                      : 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
                  }`}>
                    {dataset.embedding_available ? t('list.ready') : t('list.processing')}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
