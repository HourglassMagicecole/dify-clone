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
import type { EmbeddingModelInfo, EmbeddingModelProvider } from '@/types/dataset'
import { getProviderIdFromDefault } from '@/types/dataset'

/**
 * Safely get label string from label object or string
 */
function getLabel(label: { en_US: string; zh_Hans?: string } | string | undefined): string {
  if (!label) return 'Unknown'
  if (typeof label === 'string') return label
  return label.en_US || 'Unknown'
}

export function Step3Embed(): React.ReactElement {
  const { t } = useTranslation('dataset')
  const {
    embeddingModels,
    selectedEmbeddingModel,
    selectedEmbeddingProvider,
    setEmbeddingModels,
    setSelectedEmbeddingModel,
    nextStep,
    prevStep,
    setError,
  } = useRAGWizard()

  const [loadingModels, setLoadingModels] = useState(true)

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

        // Get default model and auto-select
        const defaultResponse = await datasetAPI.getDefaultModel('text-embedding')
        if (defaultResponse.result === 'success' && defaultResponse.data) {
          // Extract provider ID (API returns provider as object or string)
          const providerId = getProviderIdFromDefault(defaultResponse.data.provider)
          setSelectedEmbeddingModel(
            defaultResponse.data.model,
            providerId
          )
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

  // Load embedding models on mount
  useEffect(() => {
    loadEmbeddingModels()
  }, [loadEmbeddingModels])

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
              <span className="ml-2 text-blue-900 font-medium">{selectedEmbeddingProvider}</span>
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
