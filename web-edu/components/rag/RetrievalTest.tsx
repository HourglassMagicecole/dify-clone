/**
 * Retrieval Test Component
 * Story 3.4: RAG Search Test Interface
 *
 * Features:
 * - Query input with character counter
 * - Search settings (Top-K, Reranking)
 * - Results list with scores and highlighting
 * - Search time display
 */

'use client'

import React, { useState, useCallback, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { MagnifyingGlassIcon, QuestionMarkCircleIcon } from '@heroicons/react/24/outline'
import { datasetAPI } from '@/service/dataset-api'
import { Button } from '@/components/common/Button'
import { RetrievalResultItem } from './RetrievalResultItem'
import type { HitTestingRecord, SearchMethod } from '@/types/dataset'

const MAX_QUERY_LENGTH = 250
const DEFAULT_TOP_K = 4
const DEFAULT_SEARCH_METHOD: SearchMethod = 'semantic_search'

const SEARCH_METHODS: { value: SearchMethod; labelKey: string; descKey: string }[] = [
  { value: 'semantic_search', labelKey: 'retrievalTest.methods.semantic', descKey: 'retrievalTest.methods.semanticDesc' },
  { value: 'full_text_search', labelKey: 'retrievalTest.methods.fullText', descKey: 'retrievalTest.methods.fullTextDesc' },
  { value: 'hybrid_search', labelKey: 'retrievalTest.methods.hybrid', descKey: 'retrievalTest.methods.hybridDesc' },
]

interface RetrievalTestProps {
  datasetId: string
}

interface SearchSettings {
  searchMethod: SearchMethod
  topK: number
  rerankingEnable: boolean
}

export function RetrievalTest({ datasetId }: RetrievalTestProps): React.ReactElement {
  const { t } = useTranslation('dataset')

  // Query state
  const [query, setQuery] = useState('')

  // Results state
  const [results, setResults] = useState<HitTestingRecord[]>([])
  const [hasSearched, setHasSearched] = useState(false)

  // Store the query and method used for the last search (for displaying results)
  const [lastSearchQuery, setLastSearchQuery] = useState('')
  const [lastSearchMethod, setLastSearchMethod] = useState<SearchMethod>(DEFAULT_SEARCH_METHOD)

  // Loading & timing
  const [isLoading, setIsLoading] = useState(false)
  const [searchTime, setSearchTime] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Settings
  const [settings, setSettings] = useState<SearchSettings>({
    searchMethod: DEFAULT_SEARCH_METHOD,
    topK: DEFAULT_TOP_K,
    rerankingEnable: false,
  })

  // Reranking model availability (AC5)
  const [rerankingAvailable, setRerankingAvailable] = useState(false)

  // Check if reranking model is configured
  useEffect(() => {
    const checkRerankingModel = async () => {
      try {
        const response = await datasetAPI.getModelList('rerank')
        if (response.result === 'success' && response.data) {
          // Check if there's an active rerank provider with models
          const hasActiveReranker = response.data.some(
            provider => provider.status === 'active' && provider.models.length > 0
          )
          setRerankingAvailable(hasActiveReranker)
        }
      } catch {
        setRerankingAvailable(false)
      }
    }
    checkRerankingModel()
  }, [])

  // Search handler
  const handleSearch = useCallback(async () => {
    if (!query.trim() || isLoading) return

    try {
      setIsLoading(true)
      setError(null)
      setHasSearched(true)

      // Store the query and method used for this search
      setLastSearchQuery(query.trim())
      setLastSearchMethod(settings.searchMethod)

      const startTime = performance.now()

      const response = await datasetAPI.hitTesting(datasetId, {
        query: query.trim(),
        retrieval_model: {
          search_method: settings.searchMethod,
          top_k: settings.topK,
          reranking_enable: settings.rerankingEnable,
          reranking_model: {
            reranking_provider_name: '',
            reranking_model_name: '',
          },
          score_threshold_enabled: false,
        },
      })

      const endTime = performance.now()
      setSearchTime(Math.round(endTime - startTime))

      if (response.result === 'success' && response.data) {
        setResults(response.data.records || [])
      } else {
        throw new Error(response.message || 'Search failed')
      }
    } catch (err) {
      console.error('Search failed:', err)
      setError(t('retrievalTest.errors.searchFailed'))
      setResults([])
    } finally {
      setIsLoading(false)
    }
  }, [datasetId, query, settings, isLoading, t])

  // Handle Enter key
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSearch()
    }
  }

  return (
    <div className="space-y-6">
      {/* Title & Description */}
      <div>
        <h3 className="text-lg font-medium text-gray-900 dark:text-white">
          {t('retrievalTest.title')}
        </h3>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          {t('retrievalTest.description')}
        </p>
      </div>

      {/* Query Input Section */}
      <div className="space-y-2">
        <label
          htmlFor="search-query"
          className="block text-sm font-medium text-gray-700 dark:text-gray-300"
        >
          {t('retrievalTest.queryLabel')}
        </label>
        <div className="relative">
          <textarea
            id="search-query"
            value={query}
            onChange={(e) => setQuery(e.target.value.slice(0, MAX_QUERY_LENGTH))}
            onKeyDown={handleKeyDown}
            placeholder={t('retrievalTest.queryPlaceholder')}
            rows={3}
            className="
              w-full px-4 py-3 border border-gray-300 rounded-lg
              focus:ring-2 focus:ring-blue-500 focus:border-blue-500
              dark:bg-gray-700 dark:border-gray-600 dark:text-white
              dark:placeholder-gray-400
              resize-none
            "
          />
          <div className="absolute bottom-2 right-2 text-xs text-gray-400">
            {query.length}/{MAX_QUERY_LENGTH}
          </div>
        </div>
      </div>

      {/* Search Method Selection */}
      <div className="space-y-2">
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
          {t('retrievalTest.searchMethod')}
        </label>
        <div className="flex flex-wrap gap-4">
          {SEARCH_METHODS.map((method) => (
            <label
              key={method.value}
              className={`
                flex items-center gap-2 px-4 py-2 rounded-lg border cursor-pointer transition-colors
                ${settings.searchMethod === method.value
                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                  : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                }
              `}
            >
              <input
                type="radio"
                name="searchMethod"
                value={method.value}
                checked={settings.searchMethod === method.value}
                onChange={(e) => setSettings(prev => ({
                  ...prev,
                  searchMethod: e.target.value as SearchMethod
                }))}
                className="text-blue-600 focus:ring-blue-500"
              />
              <div>
                <span className="text-sm font-medium text-gray-900 dark:text-white">
                  {t(method.labelKey)}
                </span>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {t(method.descKey)}
                </p>
              </div>
            </label>
          ))}
        </div>
      </div>

      {/* Search Settings */}
      <div className="flex flex-wrap items-center gap-6">
        {/* Top-K Slider */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1">
            <label className="text-sm text-gray-600 dark:text-gray-400">
              {t('retrievalTest.topK')}
            </label>
            <div className="relative group">
              <QuestionMarkCircleIcon className="h-4 w-4 text-gray-400 cursor-help" />
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 text-white text-xs rounded-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 w-64 z-10">
                {t('retrievalTest.topKTooltip')}
                <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-900" />
              </div>
            </div>
          </div>
          <input
            type="range"
            min={1}
            max={10}
            value={settings.topK}
            onChange={(e) => setSettings(prev => ({
              ...prev,
              topK: parseInt(e.target.value, 10)
            }))}
            className="w-24 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700"
          />
          <span className="text-sm font-medium text-gray-900 dark:text-white w-6">
            {settings.topK}
          </span>
        </div>

        {/* Reranking Toggle - AC5: disabled when reranking model not configured */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1">
            <label className="text-sm text-gray-600 dark:text-gray-400">
              {t('retrievalTest.reranking')}
            </label>
            <div className="relative group">
              <QuestionMarkCircleIcon className="h-4 w-4 text-gray-400 cursor-help" />
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 text-white text-xs rounded-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 w-64 z-10">
                {t('retrievalTest.rerankingTooltip')}
                <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-900" />
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={() => rerankingAvailable && setSettings(prev => ({
              ...prev,
              rerankingEnable: !prev.rerankingEnable
            }))}
            disabled={!rerankingAvailable}
            className={`
              relative inline-flex h-6 w-11 items-center rounded-full transition-colors
              ${!rerankingAvailable
                ? 'bg-gray-100 dark:bg-gray-800 cursor-not-allowed opacity-50'
                : settings.rerankingEnable
                  ? 'bg-blue-600'
                  : 'bg-gray-200 dark:bg-gray-700'
              }
            `}
            role="switch"
            aria-checked={settings.rerankingEnable}
            aria-disabled={!rerankingAvailable}
          >
            <span
              className={`
                inline-block h-4 w-4 transform rounded-full bg-white transition-transform
                ${settings.rerankingEnable ? 'translate-x-6' : 'translate-x-1'}
              `}
            />
          </button>
          {/* AC5: Show hint when reranking model not configured */}
          {!rerankingAvailable && (
            <span className="text-xs text-gray-400 dark:text-gray-500">
              {t('retrievalTest.rerankingNotConfigured')}
            </span>
          )}
        </div>

        {/* Search Button */}
        <Button
          onClick={handleSearch}
          disabled={!query.trim() || isLoading}
          className="ml-auto"
        >
          {isLoading ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
              {t('retrievalTest.searching')}
            </>
          ) : (
            <>
              <MagnifyingGlassIcon className="h-4 w-4 mr-2" />
              {t('retrievalTest.search')}
            </>
          )}
        </Button>
      </div>

      {/* Results Section */}
      {hasSearched && (
        <div className="mt-6 space-y-4">
          {/* Search Time & Result Count */}
          {searchTime !== null && !error && (
            <div className="flex items-center justify-between text-sm text-gray-500 dark:text-gray-400">
              <span>
                {t('retrievalTest.resultCount', { count: results.length })}
              </span>
              <span>
                {t('retrievalTest.searchTime', { time: searchTime })}
              </span>
            </div>
          )}

          {/* Error State */}
          {error && (
            <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
              <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
            </div>
          )}

          {/* Empty State */}
          {!error && results.length === 0 && (
            <div className="p-8 text-center">
              <MagnifyingGlassIcon className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">
                {t('retrievalTest.noResults')}
              </h3>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                {t('retrievalTest.noResultsHint')}
              </p>
            </div>
          )}

          {/* Results List */}
          {!error && results.length > 0 && (
            <div className="space-y-3">
              {results.map((record, index) => (
                <RetrievalResultItem
                  key={`${record.segment.id}-${index}`}
                  record={record}
                  rank={index + 1}
                  query={lastSearchQuery}
                  searchMethod={lastSearchMethod}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
