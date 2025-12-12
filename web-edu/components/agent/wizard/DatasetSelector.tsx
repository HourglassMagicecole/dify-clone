/**
 * Dataset Selector Component
 * Story 3.5: Connect RAG to Agent
 *
 * Features:
 * - List available datasets with search
 * - Multi-select with checkboxes
 * - Selected datasets display with remove option
 * - Role-based filtering: Only show datasets owned by agent owner
 */

'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import Link from 'next/link'
import {
  MagnifyingGlassIcon,
  ArrowPathIcon,
} from '@heroicons/react/24/outline'
import { CircleStackIcon } from '@heroicons/react/24/solid'
import { datasetAPI } from '@/service/dataset-api'
import { useSession } from '@/context/SessionContext'
import type { Dataset } from '@/types/dataset'

export interface SelectedDataset {
  id: string
  name: string
}

interface DatasetSelectorProps {
  selectedDatasetIds: string[]
  onSelectionChange: (datasetIds: string[], selectedDatasets: SelectedDataset[]) => void
  agentOwnerId: string  // Agent 소유자 ID (Create: 현재 사용자, Edit: Agent의 created_by)
  disabled?: boolean
}

export function DatasetSelector({
  selectedDatasetIds,
  onSelectionChange,
  agentOwnerId,
  disabled = false,
}: DatasetSelectorProps): React.ReactElement {
  const { t } = useTranslation('agent')
  const { currentSession } = useSession()

  const [datasets, setDatasets] = useState<Dataset[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')

  // Load datasets - Only agent owner's datasets
  const loadDatasets = useCallback(async () => {
    console.warn('[DatasetSelector] loadDatasets called, agentOwnerId:', agentOwnerId, 'sessionId:', currentSession?.id)

    if (!agentOwnerId) {
      console.warn('[DatasetSelector] agentOwnerId is empty, skipping load')
      setIsLoading(false)
      return
    }

    try {
      setIsLoading(true)
      setError(null)

      // agentOwnerId를 전달하여 Agent 소유자의 RAG만 조회
      console.warn('[DatasetSelector] calling getAvailableDatasets...')
      const response = await datasetAPI.getAvailableDatasets(
        currentSession?.id,
        agentOwnerId
      )
      console.warn('[DatasetSelector] response:', response)

      if (response.result === 'success' && response.data) {
        console.warn('[DatasetSelector] setting datasets, count:', response.data.length)
        setDatasets(response.data)
      } else {
        throw new Error(response.message || 'Failed to load datasets')
      }
    } catch (err) {
      console.error('Failed to load datasets:', err)
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setIsLoading(false)
    }
  }, [currentSession?.id, agentOwnerId])

  useEffect(() => {
    loadDatasets()
  }, [loadDatasets])

  // Filtered datasets based on search query
  const filteredDatasets = datasets.filter(dataset => {
    if (!searchQuery.trim()) return true
    const query = searchQuery.toLowerCase()
    return (
      dataset.name.toLowerCase().includes(query) ||
      (dataset.description?.toLowerCase().includes(query) ?? false)
    )
  })

  // Helper: Get selected datasets info from IDs
  const getSelectedDatasetsInfo = (ids: string[]): SelectedDataset[] => {
    return ids
      .map(id => {
        const dataset = datasets.find(d => d.id === id)
        return dataset ? { id: dataset.id, name: dataset.name } : null
      })
      .filter((d): d is SelectedDataset => d !== null)
  }

  // Toggle dataset selection
  const handleToggleDataset = (datasetId: string) => {
    if (disabled) return

    const isSelected = selectedDatasetIds.includes(datasetId)
    const newIds = isSelected
      ? selectedDatasetIds.filter(id => id !== datasetId)
      : [...selectedDatasetIds, datasetId]

    onSelectionChange(newIds, getSelectedDatasetsInfo(newIds))
  }

  // Loading state
  if (isLoading) {
    return (
      <div className="space-y-3">
        <div className="h-10 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
        <div className="h-32 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
      </div>
    )
  }

  // Error state
  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-900/20 p-4">
        <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        <button
          onClick={loadDatasets}
          className="mt-2 inline-flex items-center gap-1 text-sm text-red-600 hover:text-red-700 dark:text-red-400"
        >
          <ArrowPathIcon className="h-4 w-4" />
          {t('datasetSelector.retry', 'Retry')}
        </button>
      </div>
    )
  }

  // Empty state
  if (datasets.length === 0) {
    return (
      <div className="text-center py-8 border border-dashed border-gray-300 dark:border-gray-600 rounded-lg">
        <CircleStackIcon className="mx-auto h-12 w-12 text-gray-400" />
        <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">
          {t('datasetSelector.noDatasets', 'No knowledge bases available')}
        </h3>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          {t('datasetSelector.createFirst', 'Create a knowledge base first to connect it to your agent.')}
        </p>
        <Link
          href="/rags/create"
          className="mt-4 inline-flex items-center text-sm text-blue-600 hover:text-blue-500 dark:text-blue-400"
        >
          {t('datasetSelector.createLink', 'Create Knowledge Base')}
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Search Input */}
      <div className="relative">
        <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder={t('datasetSelector.searchPlaceholder', 'Search knowledge bases...')}
          disabled={disabled}
          className="w-full pl-9 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed"
        />
      </div>

      {/* Dataset List */}
      <div className="border border-gray-200 dark:border-gray-700 rounded-lg max-h-64 overflow-y-auto">
        {filteredDatasets.length === 0 ? (
          <div className="p-4 text-center text-sm text-gray-500 dark:text-gray-400">
            {t('datasetSelector.noResults', 'No results found')}
          </div>
        ) : (
          <div className="divide-y divide-gray-200 dark:divide-gray-700">
            {filteredDatasets.map(dataset => {
              const isSelected = selectedDatasetIds.includes(dataset.id)
              return (
                <label
                  key={dataset.id}
                  className={`flex items-center gap-3 p-3 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors ${
                    disabled ? 'opacity-50 cursor-not-allowed' : ''
                  } ${isSelected ? 'bg-blue-50 dark:bg-blue-900/10' : ''}`}
                >
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => handleToggleDataset(dataset.id)}
                    disabled={disabled}
                    className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 disabled:cursor-not-allowed"
                  />
                  <CircleStackIcon className={`h-5 w-5 ${isSelected ? 'text-blue-600' : 'text-gray-400'}`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                        {dataset.name}
                      </p>
                      {/* Status badge */}
                      {dataset.embedding_available ? (
                        <span className="px-1.5 py-0.5 text-xs font-medium rounded bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                          {t('datasetSelector.ready', 'Ready')}
                        </span>
                      ) : dataset.embedding_model ? (
                        <span
                          className="px-1.5 py-0.5 text-xs font-medium rounded bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400 cursor-help"
                          title={t('datasetSelector.modelDisabledTooltip', 'Embedding model may be disabled')}
                        >
                          {t('datasetSelector.modelDisabled', 'Model Issue')}
                        </span>
                      ) : (
                        <span className="px-1.5 py-0.5 text-xs font-medium rounded bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400">
                          {t('datasetSelector.processing', 'Processing')}
                        </span>
                      )}
                    </div>
                    {dataset.description && (
                      <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                        {dataset.description}
                      </p>
                    )}
                    <p className="text-xs text-gray-400 dark:text-gray-500">
                      {t('datasetSelector.docCount', '{{count}} documents', { count: dataset.document_count })} ·{' '}
                      {t('datasetSelector.wordCount', '{{count}} words', { count: dataset.word_count })}
                    </p>
                  </div>
                </label>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
