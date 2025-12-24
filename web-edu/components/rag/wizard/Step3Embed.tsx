/**
 * Step 3: Embed - Embedding Model Selection Component
 * Story 3.2: RAG Creation Wizard - Embed & Store
 *
 * Features:
 * - Load available embedding models
 * - Display default model
 * - Allow model selection
 * - Show selected model info including context size
 */

'use client'

import React, { useEffect, useState, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { useRAGWizard } from '@/context/RAGWizardContext'
import { datasetAPI } from '@/service/dataset-api'
import { Button } from '@/components/common/Button'
import { getErrorMessage, logError } from '@/utils/error-messages'
import type { EmbeddingModelInfo, EmbeddingModelProvider, ProviderWithModels, SearchMethod } from '@/types/dataset'
import { getProviderIdFromDefault } from '@/types/dataset'

const SEARCH_METHODS: { value: SearchMethod; labelKey: string; descKey: string }[] = [
  { value: 'semantic_search', labelKey: 'step3.semanticSearch', descKey: 'step3.semanticSearchDesc' },
  { value: 'full_text_search', labelKey: 'step3.fullTextSearch', descKey: 'step3.fullTextSearchDesc' },
  { value: 'hybrid_search', labelKey: 'step3.hybridSearch', descKey: 'step3.hybridSearchDesc' },
]

/**
 * Safely get label string from label object or string
 */
function getLabel(label: { en_US: string; zh_Hans?: string } | string | undefined): string {
  if (!label) return 'Unknown'
  if (typeof label === 'string') return label
  return label.en_US || 'Unknown'
}

/**
 * Simplify provider path to short name
 * "langgenius/openai/openai" -> "openai"
 */
function simplifyProvider(provider: string | null): string {
  if (!provider) return ''
  return provider.includes('/') ? provider.split('/').pop() || provider : provider
}

export function Step3Embed(): React.ReactElement {
  const { t } = useTranslation('dataset')
  const {
    embeddingModels,
    selectedEmbeddingModel,
    selectedEmbeddingProvider,
    setEmbeddingModels,
    setSelectedEmbeddingModel,
    retrievalConfig,
    updateRetrievalConfig,
    nextStep,
    prevStep,
    setError,
  } = useRAGWizard()

  const [loadingModels, setLoadingModels] = useState(true)
  const [rerankModels, setRerankModels] = useState<ProviderWithModels[]>([])
  const [loadingRerankModels, setLoadingRerankModels] = useState(false)

  /**
   * Load rerank models from API
   */
  const loadRerankModels = useCallback(async () => {
    try {
      setLoadingRerankModels(true)
      const response = await datasetAPI.getModelList('rerank')
      if (response.result === 'success' && response.data) {
        const activeProviders = response.data.filter(p => p.status === 'active')
        setRerankModels(activeProviders)
      }
    } catch (err) {
      // Silently fail - reranking is optional
      console.error('Failed to load rerank models:', err)
    } finally {
      setLoadingRerankModels(false)
    }
  }, [])

  /**
   * Load embedding models from API
   */
  const loadEmbeddingModels = useCallback(async () => {
    try {
      setLoadingModels(true)

      // Get available embedding models
      const modelsResponse = await datasetAPI.getEmbeddingModels()

      if (modelsResponse.result === 'success' && modelsResponse.data) {
        // Ensure data is an array
        const modelsData = Array.isArray(modelsResponse.data)
          ? modelsResponse.data
          : [modelsResponse.data]
        setEmbeddingModels(modelsData as EmbeddingModelProvider[])

        // Get default model and auto-select only if it's in the active models list
        const defaultResponse = await datasetAPI.getDefaultModel('text-embedding')
        if (defaultResponse.result === 'success' && defaultResponse.data) {
          // Extract provider ID (API returns provider as object or string)
          const providerId = getProviderIdFromDefault(defaultResponse.data.provider)
          const defaultModel = defaultResponse.data.model

          // Check if default model exists in active providers
          const activeProviders = modelsData.filter(
            (p: EmbeddingModelProvider) => p.status === 'active'
          )
          const isModelActive = activeProviders.some(
            (p: EmbeddingModelProvider) =>
              p.provider === providerId &&
              p.models.some(m => m.model === defaultModel)
          )

          // Only auto-select if the model is actually available
          if (isModelActive) {
            setSelectedEmbeddingModel(defaultModel, providerId)
          }
        }
      }
    } catch (err) {
      const errorInfo = getErrorMessage(err, t)
      logError(errorInfo, 'Step3Embed.loadEmbeddingModels')
      setError(`${errorInfo.userMessage} (${errorInfo.code})`)
    } finally {
      setLoadingModels(false)
    }
  }, [setEmbeddingModels, setSelectedEmbeddingModel, setError, t])

  // Load embedding models and rerank models on mount
  useEffect(() => {
    loadEmbeddingModels()
    loadRerankModels()
  }, [loadEmbeddingModels, loadRerankModels])

  /**
   * Handle model selection
   */
  const handleModelSelect = (model: string, provider: string) => {
    setSelectedEmbeddingModel(model, provider)
  }

  /**
   * Get selected model info from embeddingModels array
   */
  const getSelectedModelInfo = (): EmbeddingModelInfo | null => {
    if (!selectedEmbeddingModel || !selectedEmbeddingProvider) return null

    const provider = embeddingModels.find(p => p.provider === selectedEmbeddingProvider)
    if (!provider) return null

    return provider.models.find(m => m.model === selectedEmbeddingModel) || null
  }

  const selectedModelInfo = getSelectedModelInfo()
  const canProceed = selectedEmbeddingModel !== null && selectedEmbeddingProvider !== null
  const activeProviders = embeddingModels.filter(p => p.status === 'active')

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium text-gray-900 mb-2">
          {t('step3.title')}
        </h3>
        <p className="text-sm text-gray-500">
          {t('step3.description')}
        </p>
      </div>

      {loadingModels ? (
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
          <span className="ml-3 text-gray-600">{t('step3.loadingModels')}</span>
        </div>
      ) : (
        <div className="space-y-4">
          {activeProviders.map((provider) => (
            <div key={provider.provider} className="border rounded-lg p-4">
              <div className="flex items-center gap-2 mb-3">
                <span className="font-medium text-gray-900">
                  {getLabel(provider.label)}
                </span>
                <span className="text-xs px-2 py-0.5 bg-green-100 text-green-700 rounded">
                  {t('step3.active')}
                </span>
              </div>

              <div className="space-y-2">
                {provider.models?.map((model) => (
                  <label
                    key={model.model}
                    className={`
                      flex items-center gap-3 p-3 rounded-lg border cursor-pointer
                      ${selectedEmbeddingModel === model.model && selectedEmbeddingProvider === provider.provider
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300'
                      }
                    `}
                  >
                    <input
                      type="radio"
                      name="embedding-model"
                      checked={selectedEmbeddingModel === model.model && selectedEmbeddingProvider === provider.provider}
                      onChange={() => handleModelSelect(model.model, provider.provider)}
                      className="h-4 w-4 text-blue-600"
                    />
                    <div className="flex-1">
                      <p className="font-medium text-gray-900">{getLabel(model.label)}</p>
                      <p className="text-xs text-gray-500">{model.model}</p>
                    </div>
                  </label>
                ))}
              </div>
            </div>
          ))}

          {activeProviders.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              {t('step3.noActiveModels')}
            </div>
          )}
        </div>
      )}

      {/* Selected Model Info */}
      {selectedEmbeddingModel && selectedEmbeddingProvider && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h4 className="font-medium text-blue-900 mb-2">
            {t('step3.selectedModel')}
          </h4>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div>
              <span className="text-blue-700">{t('step3.provider')}:</span>
              <span className="ml-2 text-blue-900 font-medium">{simplifyProvider(selectedEmbeddingProvider)}</span>
            </div>
            <div>
              <span className="text-blue-700">{t('step3.modelId')}:</span>
              <span className="ml-2 text-blue-900 font-medium">{selectedEmbeddingModel}</span>
            </div>
            {selectedModelInfo?.model_properties?.context_size && (
              <div>
                <span className="text-blue-700">{t('step3.contextSize')}:</span>
                <span className="ml-2 text-blue-900 font-medium">
                  {selectedModelInfo.model_properties.context_size.toLocaleString()} tokens
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Retrieval Settings */}
      <div className="border rounded-lg p-4 bg-gray-50">
        <h4 className="font-medium text-gray-900 mb-4">
          {t('step3.retrievalSettings')}
        </h4>

        {/* Search Method */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            {t('step3.searchMethod')}
          </label>
          <div className="flex flex-wrap gap-3">
            {SEARCH_METHODS.map((method) => (
              <label
                key={method.value}
                className={`
                  flex items-center gap-2 px-4 py-2 rounded-lg border cursor-pointer transition-colors
                  ${retrievalConfig.search_method === method.value
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 hover:border-gray-300'
                  }
                `}
              >
                <input
                  type="radio"
                  name="searchMethod"
                  value={method.value}
                  checked={retrievalConfig.search_method === method.value}
                  onChange={(e) => updateRetrievalConfig({ search_method: e.target.value as SearchMethod })}
                  className="text-blue-600 focus:ring-blue-500"
                />
                <div>
                  <span className="text-sm font-medium text-gray-900">
                    {t(method.labelKey)}
                  </span>
                  <p className="text-xs text-gray-500">
                    {t(method.descKey)}
                  </p>
                </div>
              </label>
            ))}
          </div>
        </div>

        {/* Top K */}
        <div className="mb-4 flex items-center gap-4">
          <label className="text-sm font-medium text-gray-700">
            {t('step3.topK')}
            <span className="ml-2 text-gray-500 font-normal">
              ({t('step3.topKDescription')})
            </span>
          </label>
          <input
            type="number"
            min={1}
            max={20}
            value={retrievalConfig.top_k}
            onChange={(e) => {
              const value = Math.max(1, Math.min(20, Number(e.target.value) || 1))
              updateRetrievalConfig({ top_k: value })
            }}
            className="w-20 px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        {/* Score Threshold */}
        <div className="mb-4">
          <div className="flex items-center gap-2 mb-2">
            <input
              type="checkbox"
              id="score-threshold-enabled"
              checked={retrievalConfig.score_threshold_enabled}
              onChange={(e) => updateRetrievalConfig({ score_threshold_enabled: e.target.checked })}
              className="h-4 w-4 text-blue-600 rounded"
            />
            <label htmlFor="score-threshold-enabled" className="text-sm font-medium text-gray-700">
              {t('step3.scoreThreshold')}
              <span className="ml-2 text-gray-500 font-normal">
                ({t('step3.scoreThresholdDescription')})
              </span>
            </label>
          </div>
          {retrievalConfig.score_threshold_enabled && (
            <div className="flex items-center gap-4 ml-6">
              <input
                type="range"
                min={0}
                max={1}
                step={0.1}
                value={retrievalConfig.score_threshold ?? 0.5}
                onChange={(e) => updateRetrievalConfig({ score_threshold: Number(e.target.value) })}
                className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
              />
              <span className="w-12 text-center font-medium text-gray-900">
                {(retrievalConfig.score_threshold ?? 0.5).toFixed(1)}
              </span>
            </div>
          )}
        </div>

        {/* Reranking */}
        <div>
          <div className="flex items-center gap-2 mb-2">
            <input
              type="checkbox"
              id="reranking-enabled"
              checked={retrievalConfig.reranking_enable}
              onChange={(e) => updateRetrievalConfig({ reranking_enable: e.target.checked })}
              className="h-4 w-4 text-blue-600 rounded"
              disabled={rerankModels.length === 0}
            />
            <label htmlFor="reranking-enabled" className="text-sm font-medium text-gray-700">
              {t('step3.reranking')}
              <span className="ml-2 text-gray-500 font-normal">
                ({t('step3.rerankingDescription')})
              </span>
            </label>
            {loadingRerankModels && (
              <span className="text-xs text-gray-400">{t('step3.loadingModels')}</span>
            )}
          </div>
          {retrievalConfig.reranking_enable && rerankModels.length > 0 && (
            <div className="ml-6">
              <select
                value={`${retrievalConfig.reranking_model.reranking_provider_name}:${retrievalConfig.reranking_model.reranking_model_name}`}
                onChange={(e) => {
                  const [provider = '', model = ''] = e.target.value.split(':')
                  updateRetrievalConfig({
                    reranking_model: {
                      reranking_provider_name: provider,
                      reranking_model_name: model,
                    },
                  })
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value=":">{t('step3.selectRerankModel')}</option>
                {rerankModels.map((provider) =>
                  provider.models.map((model) => (
                    <option
                      key={`${provider.provider}:${model.model}`}
                      value={`${provider.provider}:${model.model}`}
                    >
                      {model.model} ({simplifyProvider(provider.provider)})
                    </option>
                  ))
                )}
              </select>
            </div>
          )}
          {rerankModels.length === 0 && !loadingRerankModels && (
            <p className="text-xs text-gray-400 ml-6">{t('step3.noRerankModels')}</p>
          )}
        </div>
      </div>

      {/* Navigation */}
      <div className="flex justify-between pt-4 border-t">
        <Button variant="outline" onClick={prevStep}>
          {t('common.back')}
        </Button>
        <Button
          onClick={nextStep}
          disabled={!canProceed}
        >
          {t('common.next')}
        </Button>
      </div>
    </div>
  )
}
