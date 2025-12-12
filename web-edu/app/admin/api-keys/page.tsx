/**
 * API Key Management Page (Story 1.8 + Story 3.7)
 *
 * API Key management with model activation modal
 */

'use client'

import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { AddAPIKeyModal } from '@/components/api-keys/AddAPIKeyModal'
import { APIKeyTable } from '@/components/api-keys/APIKeyTable'
import { DeleteAPIKeyModal } from '@/components/api-keys/DeleteAPIKeyModal'
import { EditAPIKeyModal } from '@/components/api-keys/EditAPIKeyModal'
import { Button } from '@/components/common/Button'
import { ModelManagementModal } from '@/components/model/ModelManagementModal'
import { useAPIKeyManagement } from '@/hooks/use-api-keys'
import type { APIKeyConfig, ProviderType } from '@/types/api-key'
import { PROVIDER_METADATA, SUPPORTED_PROVIDERS } from '@/types/api-key'

// Provider 탭 컴포넌트
interface ProviderTabsProps {
  selected: ProviderType | undefined
  onChange: (provider: ProviderType | undefined) => void
}

function ProviderTabs({ selected, onChange }: ProviderTabsProps) {
  const { t } = useTranslation('api-keys')

  return (
    <div className="flex gap-2 mb-6 overflow-x-auto">
      <button
        type="button"
        className={`
          px-4 py-2 rounded-lg font-medium text-sm transition-colors whitespace-nowrap
          ${selected === undefined
            ? 'bg-blue-600 text-white'
            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }
        `}
        onClick={() => onChange(undefined)}
      >
        {t('tabs.all')}
      </button>
      {SUPPORTED_PROVIDERS.map((provider) => {
        const metadata = PROVIDER_METADATA[provider]
        return (
          <button
            type="button"
            key={provider}
            className={`
              px-4 py-2 rounded-lg font-medium text-sm transition-colors whitespace-nowrap
              ${selected === provider
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }
            `}
            onClick={() => onChange(provider)}
          >
            {metadata.name}
          </button>
        )
      })}
    </div>
  )
}

// 메인 페이지 컴포넌트
export default function APIKeyManagementPage() {
  const { t } = useTranslation('api-keys')
  const [selectedProvider, setSelectedProvider] = useState<ProviderType | undefined>()
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)
  const [isModelModalOpen, setIsModelModalOpen] = useState(false)
  const [selectedKey, setSelectedKey] = useState<APIKeyConfig | null>(null)
  const [selectedProviderForModel, setSelectedProviderForModel] = useState<{
    provider: string
    label: string
  } | null>(null)

  const {
    apiKeys,
    isLoading,
    isError,
    refresh,
  } = useAPIKeyManagement(selectedProvider)

  const handleEdit = (apiKey: APIKeyConfig) => {
    setSelectedKey(apiKey)
    setIsEditModalOpen(true)
  }

  const handleDelete = (apiKey: APIKeyConfig) => {
    setSelectedKey(apiKey)
    setIsDeleteModalOpen(true)
  }

  const handleModelManage = (apiKey: APIKeyConfig) => {
    const metadata = PROVIDER_METADATA[apiKey.provider]
    setSelectedProviderForModel({
      provider: apiKey.provider,
      label: metadata.name,
    })
    setIsModelModalOpen(true)
  }

  return (
    <div className="container mx-auto p-6 max-w-7xl">
      {/* 페이지 제목 */}
      <h1 className="text-3xl font-bold text-gray-900 mb-6">
        {t('title')}
      </h1>

      {/* 헤더 */}
      <div className="flex justify-between items-start mb-6">
        <p className="text-gray-600">{t('subtitle')}</p>
        <Button onClick={() => setIsAddModalOpen(true)}>
          {t('addButton')}
        </Button>
      </div>

      {/* Provider 탭 */}
      <ProviderTabs selected={selectedProvider} onChange={setSelectedProvider} />

      {/* 로딩 상태 */}
      {isLoading && (
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
          <p className="mt-4 text-gray-600">{t('loading')}</p>
        </div>
      )}

      {/* 에러 상태 */}
      {isError && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
          <p className="text-red-800 font-medium">{t('error.loadFailed')}</p>
          <Button variant="outline" size="sm" onClick={() => refresh()} className="mt-3">
            {t('retryButton')}
          </Button>
        </div>
      )}

      {/* API Key 테이블 */}
      {!isError && (
        <APIKeyTable
          apiKeys={apiKeys}
          isLoading={isLoading}
          onEdit={handleEdit}
          onDelete={handleDelete}
          onModelManage={handleModelManage}
        />
      )}

      {/* 모달들 */}
      <AddAPIKeyModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onSuccess={() => {
          setIsAddModalOpen(false)
          refresh()
        }}
      />

      {isEditModalOpen && selectedKey && (
        <EditAPIKeyModal
          apiKey={selectedKey}
          isOpen={isEditModalOpen}
          onClose={() => {
            setIsEditModalOpen(false)
            setSelectedKey(null)
          }}
          onSuccess={() => {
            setIsEditModalOpen(false)
            setSelectedKey(null)
            refresh()
          }}
        />
      )}

      {isDeleteModalOpen && selectedKey && (
        <DeleteAPIKeyModal
          apiKey={selectedKey}
          isOpen={isDeleteModalOpen}
          onClose={() => {
            setIsDeleteModalOpen(false)
            setSelectedKey(null)
          }}
          onSuccess={() => {
            setIsDeleteModalOpen(false)
            setSelectedKey(null)
            refresh()
          }}
        />
      )}

      {/* Model Management Modal (Story 3.7) */}
      {isModelModalOpen && selectedProviderForModel && (
        <ModelManagementModal
          isOpen={isModelModalOpen}
          provider={selectedProviderForModel.provider}
          providerLabel={selectedProviderForModel.label}
          onClose={() => {
            setIsModelModalOpen(false)
            setSelectedProviderForModel(null)
          }}
        />
      )}
    </div>
  )
}
