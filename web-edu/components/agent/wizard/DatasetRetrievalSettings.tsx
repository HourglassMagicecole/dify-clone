/**
 * Dataset Retrieval Settings Component
 * Story 3.5: Connect RAG to Agent
 *
 * Features:
 * - Top-K slider (1-10)
 * - Score threshold toggle and slider
 * - Reranking toggle
 */

'use client'

import React, { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { InformationCircleIcon } from '@heroicons/react/24/outline'
import { datasetAPI } from '@/service/dataset-api'
import type { DatasetRetrievalConfig } from '@/types/agent'

interface DatasetRetrievalSettingsProps {
  settings: DatasetRetrievalConfig
  onSettingsChange: (settings: DatasetRetrievalConfig) => void
  disabled?: boolean
  readOnly?: boolean
}

export const DEFAULT_RETRIEVAL_SETTINGS: DatasetRetrievalConfig = {
  search_method: 'semantic_search',
  reranking_enable: false,
  top_k: 4,
  score_threshold_enabled: false,
  score_threshold: 0.5,
}

export function DatasetRetrievalSettings({
  settings,
  onSettingsChange,
  disabled = false,
  readOnly = false,
}: DatasetRetrievalSettingsProps): React.ReactElement {
  const { t } = useTranslation('agent')
  const [rerankingAvailable, setRerankingAvailable] = useState(false)

  // Check if reranking model is configured (only when not readOnly)
  useEffect(() => {
    if (readOnly) return

    const checkRerankingModel = async () => {
      try {
        const response = await datasetAPI.getModelList('rerank')
        if (response.result === 'success' && response.data) {
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
  }, [readOnly])

  // Tooltip component for reuse
  const Tooltip = ({ text }: { text: string }) => (
    <span className="relative group">
      <InformationCircleIcon className="h-4 w-4 text-gray-400 cursor-help" />
      <span className="absolute hidden group-hover:block bg-gray-800 text-white text-xs rounded p-2 bottom-full left-1/2 -translate-x-1/2 mb-1 w-56 z-10 shadow-lg">
        {text}
      </span>
    </span>
  )

  // Read-only display mode
  if (readOnly) {
    return (
      <div className="p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
        <div className="flex flex-wrap items-center gap-6 text-sm">
          {/* Top-K */}
          <div className="flex items-center gap-2">
            <span className="text-gray-500 dark:text-gray-400">
              {t('retrievalSettings.topK', '상위 결과')}:
            </span>
            <span className="font-medium text-gray-900 dark:text-white">
              {settings.top_k}
            </span>
          </div>

          {/* Score Threshold */}
          <div className="flex items-center gap-2">
            <span className="text-gray-500 dark:text-gray-400">
              {t('retrievalSettings.scoreThreshold', '유사도 기준')}:
            </span>
            <span className="font-medium text-gray-900 dark:text-white">
              {settings.score_threshold_enabled
                ? (settings.score_threshold ?? 0.5).toFixed(1)
                : 'OFF'}
            </span>
          </div>

          {/* Reranking */}
          <div className="flex items-center gap-2">
            <span className="text-gray-500 dark:text-gray-400">
              {t('retrievalSettings.reranking', '리랭킹')}:
            </span>
            <span className={`font-medium ${settings.reranking_enable ? 'text-blue-600 dark:text-blue-400' : 'text-gray-900 dark:text-white'}`}>
              {settings.reranking_enable ? 'ON' : 'OFF'}
            </span>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
      <div className="flex flex-wrap items-center gap-8">
        {/* Top-K */}
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-1.5 text-sm text-gray-700 dark:text-gray-300">
            {t('retrievalSettings.topK', '상위 결과')}
            <Tooltip text={t('retrievalSettings.topKTooltip', '검색할 상위 청크 개수입니다. 값이 클수록 더 많은 결과를 반환합니다.')} />
          </label>
          <select
            value={settings.top_k}
            onChange={(e) => onSettingsChange({
              ...settings,
              top_k: parseInt(e.target.value, 10)
            })}
            disabled={disabled}
            className="w-16 px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(n => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
        </div>

        {/* Score Threshold */}
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-1.5 text-sm text-gray-700 dark:text-gray-300">
            {t('retrievalSettings.scoreThreshold', '유사도 기준')}
            <Tooltip text={t('retrievalSettings.scoreThresholdTooltip', '최소 유사도 점수입니다. 이 값보다 낮은 결과는 제외됩니다.')} />
          </label>
          <select
            value={settings.score_threshold_enabled ? (settings.score_threshold ?? 0.5).toString() : 'off'}
            onChange={(e) => {
              if (e.target.value === 'off') {
                onSettingsChange({ ...settings, score_threshold_enabled: false })
              } else {
                onSettingsChange({
                  ...settings,
                  score_threshold_enabled: true,
                  score_threshold: parseFloat(e.target.value)
                })
              }
            }}
            disabled={disabled}
            className="w-20 px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <option value="off">OFF</option>
            {[0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9].map(n => (
              <option key={n} value={n}>{n.toFixed(1)}</option>
            ))}
          </select>
        </div>

        {/* Reranking */}
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-1.5 text-sm text-gray-700 dark:text-gray-300">
            {t('retrievalSettings.reranking', '리랭킹')}
            <Tooltip text={t('retrievalSettings.rerankingTooltip', 'AI 모델을 사용해 검색 결과의 순위를 재평가합니다.')} />
          </label>
          <button
            type="button"
            onClick={() => !(disabled || !rerankingAvailable) && onSettingsChange({
              ...settings,
              reranking_enable: !settings.reranking_enable
            })}
            disabled={disabled || !rerankingAvailable}
            className={`
              w-14 px-2 py-1 text-sm rounded border transition-colors
              ${settings.reranking_enable
                ? 'bg-blue-600 text-white border-blue-600'
                : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600'
              }
              ${(disabled || !rerankingAvailable) ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:border-blue-500'}
            `}
            title={!rerankingAvailable ? t('retrievalSettings.rerankingNotConfigured', '리랭킹 모델이 설정되지 않음') : undefined}
          >
            {settings.reranking_enable ? 'ON' : 'OFF'}
          </button>
        </div>
      </div>
    </div>
  )
}
