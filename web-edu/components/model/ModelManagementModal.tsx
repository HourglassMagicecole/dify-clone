'use client'

import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ConfirmDialog } from '@/components/common/ConfirmDialog'
import { Modal } from '@/components/common/Modal'
import { modelAPI } from '@/service/model-api'
import type { ModelType, ProviderModel } from '@/types/model'
import { ModelToggle } from './ModelToggle'
import { ModelTypeFilter } from './ModelTypeFilter'

interface ModelManagementModalProps {
  isOpen: boolean
  provider: string
  providerLabel: string
  onClose: () => void
}

/**
 * Modal for managing models of a specific provider (Story 3.7)
 * AC: 1 - Model Management Button triggers this modal
 * AC: 2 - Provider's Model List Display
 */
export function ModelManagementModal({
  isOpen,
  provider,
  providerLabel,
  onClose,
}: ModelManagementModalProps) {
  const { t } = useTranslation('api-keys')
  const [models, setModels] = useState<ProviderModel[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [selectedModelType, setSelectedModelType] = useState<ModelType | 'all'>('all')
  const [selectedStatus, setSelectedStatus] = useState<'all' | 'active' | 'disabled'>('all')
  const [showConfirmDialog, setShowConfirmDialog] = useState(false)
  const [pendingToggle, setPendingToggle] = useState<boolean | null>(null)
  const [isTogglingAll, setIsTogglingAll] = useState(false)

  const fetchModels = useCallback(async () => {
    if (!provider)
      return
    setIsLoading(true)
    try {
      const response = await modelAPI.getProviderModels(provider)
      const modelsData = response.data
      setModels(Array.isArray(modelsData) ? modelsData : [])
    }
    catch {
      setModels([])
    }
    finally {
      setIsLoading(false)
    }
  }, [provider])

  useEffect(() => {
    if (isOpen) {
      fetchModels()
      setSelectedModelType('all')
      setSelectedStatus('all')
    }
  }, [isOpen, fetchModels])

  // API returns 'status' field: 'active' | 'disabled' | 'no-configure' etc.
  const isModelEnabled = (m: ProviderModel) => m.status === 'active'

  // Filter by model type and status, sort alphabetically
  const filteredModels = models
    .filter(m => selectedModelType === 'all' || m.model_type === selectedModelType)
    .filter(m => {
      if (selectedStatus === 'all') return true
      if (selectedStatus === 'active') return isModelEnabled(m)
      return !isModelEnabled(m)
    })
    .sort((a, b) => a.label.en_US.localeCompare(b.label.en_US))

  const enabledCount = filteredModels.filter(isModelEnabled).length

  const handleModelToggle = async (model: string, modelType: ModelType, enable: boolean) => {
    try {
      await modelAPI.toggleModel(provider, model, modelType, enable)
      setModels(prev => prev.map(m =>
        m.model === model && m.model_type === modelType
          ? { ...m, status: enable ? 'active' : 'disabled' }
          : m,
      ))
      return true
    }
    catch {
      return false
    }
  }

  const handleBulkToggle = (enable: boolean) => {
    setPendingToggle(enable)
    setShowConfirmDialog(true)
  }

  const confirmBulkToggle = async () => {
    if (pendingToggle === null)
      return
    setShowConfirmDialog(false)
    setIsTogglingAll(true)
    try {
      const modelsToToggle = filteredModels.map(m => ({ model: m.model, model_type: m.model_type }))
      await modelAPI.toggleProviderModels(provider, modelsToToggle, pendingToggle)
      // Update local state instead of refetching (API only returns active models)
      const newStatus = pendingToggle ? 'active' : 'disabled'
      setModels(prev => prev.map(m =>
        modelsToToggle.some(t => t.model === m.model && t.model_type === m.model_type)
          ? { ...m, status: newStatus as ProviderModel['status'] }
          : m,
      ))
    }
    finally {
      setIsTogglingAll(false)
      setPendingToggle(null)
    }
  }

  const cancelBulkToggle = () => {
    setShowConfirmDialog(false)
    setPendingToggle(null)
  }

  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={onClose}
        title={t('models.modal.title', { provider: providerLabel })}
      >
        {isLoading
          ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
              </div>
            )
          : (
              <div className="space-y-4">
                {/* Model Type Filter */}
                <ModelTypeFilter selectedType={selectedModelType} onChange={setSelectedModelType} />

                {/* Status Filter */}
                <div className="flex gap-2">
                  <span className="text-sm text-gray-500 mr-2">{t('models.filter.status')}:</span>
                  {(['all', 'active', 'disabled'] as const).map(status => (
                    <button
                      key={status}
                      type="button"
                      onClick={() => setSelectedStatus(status)}
                      className={`
                        px-3 py-1 text-xs font-medium rounded-full transition-colors
                        ${selectedStatus === status
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}
                      `}
                    >
                      {t(`models.filter.${status}`)}
                    </button>
                  ))}
                </div>

                {/* Bulk Actions */}
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-500">
                    {t('models.provider.modelCount', { enabled: enabledCount, total: filteredModels.length })}
                  </span>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => handleBulkToggle(true)}
                      disabled={enabledCount === filteredModels.length || isTogglingAll}
                      className={`
                      px-3 py-1.5 text-xs font-medium rounded-md transition-colors
                      ${enabledCount === filteredModels.length
                        ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                        : 'bg-green-100 text-green-700 hover:bg-green-200'}
                    `}
                    >
                      {t('models.provider.enableAll')}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleBulkToggle(false)}
                      disabled={enabledCount === 0 || isTogglingAll}
                      className={`
                      px-3 py-1.5 text-xs font-medium rounded-md transition-colors
                      ${enabledCount === 0
                        ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                        : 'bg-red-100 text-red-700 hover:bg-red-200'}
                    `}
                    >
                      {t('models.provider.disableAll')}
                    </button>
                  </div>
                </div>

                {/* Model List */}
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {filteredModels.length === 0
                    ? (
                        <div className="text-center py-8 text-gray-500">
                          {t('models.noProviders')}
                        </div>
                      )
                    : (
                        filteredModels.map(model => (
                          <ModelToggle
                            key={`${model.model}-${model.model_type}`}
                            modelName={model.model}
                            modelLabel={model.label.en_US}
                            modelType={model.model_type}
                            features={model.features}
                            enabled={isModelEnabled(model)}
                            disabled={isTogglingAll}
                            onToggle={enable => handleModelToggle(model.model, model.model_type, enable)}
                          />
                        ))
                      )}
                </div>
              </div>
            )}
      </Modal>

      <ConfirmDialog
        isOpen={showConfirmDialog}
        title={pendingToggle ? t('models.provider.confirmEnable.title') : t('models.provider.confirmDisable.title')}
        message={pendingToggle
          ? t('models.provider.confirmEnable.message', { provider: providerLabel, count: filteredModels.length })
          : t('models.provider.confirmDisable.message', { provider: providerLabel, count: enabledCount })}
        confirmLabel={pendingToggle ? t('models.provider.enableAll') : t('models.provider.disableAll')}
        confirmVariant={pendingToggle ? 'primary' : 'danger'}
        isLoading={isTogglingAll}
        onConfirm={confirmBulkToggle}
        onCancel={cancelBulkToggle}
      />
    </>
  )
}
