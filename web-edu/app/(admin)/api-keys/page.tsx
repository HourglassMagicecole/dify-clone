/**
 * API Key Management Page (Story 1.8 - Task 9)
 *
 * Administrator interface for managing LLM and external API keys
 */

'use client'

import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { APIKeyConfig, ProviderType } from '@/types/api-key'
import { PROVIDER_METADATA, SUPPORTED_PROVIDERS } from '@/types/api-key'
import { useAPIKeyManagement } from '@/hooks/use-api-keys'
import { Button } from '@/components/common/Button'
import { APIKeyTable } from '@/components/api-keys/APIKeyTable'
import { AddAPIKeyModal } from '@/components/api-keys/AddAPIKeyModal'
import { EditAPIKeyModal } from '@/components/api-keys/EditAPIKeyModal'
import { DeleteAPIKeyModal } from '@/components/api-keys/DeleteAPIKeyModal'
import { HelpModal } from '@/components/api-keys/HelpModal'

// Provider 탭 컴포넌트 (Subtask 9.2)
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

// API Key 관리 페이지 (Subtask 9.1)
export default function APIKeysPage() {
  const { t } = useTranslation('api-keys')
  const [selectedProvider, setSelectedProvider] = useState<ProviderType | undefined>()
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)
  const [isHelpModalOpen, setIsHelpModalOpen] = useState(false)
  const [selectedKey, setSelectedKey] = useState<APIKeyConfig | null>(null)

  const {
    apiKeys,
    isLoading,
    isError,
    test,
    refresh,
  } = useAPIKeyManagement(selectedProvider)

  // 핸들러
  const handleEdit = (apiKey: APIKeyConfig) => {
    setSelectedKey(apiKey)
    setIsEditModalOpen(true)
  }

  const handleDelete = (apiKey: APIKeyConfig) => {
    setSelectedKey(apiKey)
    setIsDeleteModalOpen(true)
  }

  const handleTest = async (apiKey: APIKeyConfig) => {
    try {
      const result = await test(apiKey.id)
      if (result.success) {
        alert(t('test.success'))
      }
      else {
        alert(t('test.failure', { message: result.message }))
      }
    }
    catch {
      alert(t('test.error'))
    }
  }

  return (
    <div className="container mx-auto p-6 max-w-7xl">
      {/* 헤더 */}
      <div className="flex justify-between items-start mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            {t('title')}
          </h1>
          <p className="text-gray-600">
            {t('subtitle')}
          </p>
        </div>
        <div className="flex gap-3">
          <Button
            variant="outline"
            onClick={() => setIsHelpModalOpen(true)}
          >
            {t('helpButton')}
          </Button>
          <Button onClick={() => setIsAddModalOpen(true)}>
            {t('addButton')}
          </Button>
        </div>
      </div>

      {/* Provider 탭 */}
      <ProviderTabs
        selected={selectedProvider}
        onChange={setSelectedProvider}
      />

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
          <Button
            variant="outline"
            size="sm"
            onClick={() => refresh()}
            className="mt-3"
          >
            {t('retryButton')}
          </Button>
        </div>
      )}

      {/* API Key 테이블 (Task 10) */}
      {!isError && (
        <APIKeyTable
          apiKeys={apiKeys}
          isLoading={isLoading}
          onEdit={handleEdit}
          onDelete={handleDelete}
          onTest={handleTest}
        />
      )}

      {/* Add API Key 모달 (Task 11) */}
      <AddAPIKeyModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onSuccess={() => {
          setIsAddModalOpen(false)
          refresh()
        }}
      />

      {/* Edit API Key 모달 (Task 12.1) */}
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

      {/* Delete API Key 모달 (Task 12.2) */}
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

      {/* Help 모달 (Task 13) */}
      <HelpModal
        isOpen={isHelpModalOpen}
        onClose={() => setIsHelpModalOpen(false)}
      />
    </div>
  )
}
