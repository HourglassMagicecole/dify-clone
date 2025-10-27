/**
 * Delete API Key Modal Component (Story 1.8 - Task 12.2)
 *
 * Confirmation dialog for deleting API keys with warnings
 */

'use client'

import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { APIKeyConfig } from '@/types/api-key'
import { PROVIDER_METADATA } from '@/types/api-key'
import { Modal } from '@/components/common/Modal'
import { Button } from '@/components/common/Button'
import { deleteAPIKey } from '@/service/api-key-api'

interface DeleteAPIKeyModalProps {
  apiKey: APIKeyConfig
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
}

export function DeleteAPIKeyModal({
  apiKey,
  isOpen,
  onClose,
  onSuccess,
}: DeleteAPIKeyModalProps) {
  const { t } = useTranslation('api-keys')
  const [isDeleting, setIsDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const providerMetadata = PROVIDER_METADATA[apiKey.provider]

  const handleDelete = async () => {
    try {
      setIsDeleting(true)
      setError(null)

      await deleteAPIKey(apiKey.id)

      onSuccess()
      onClose()
    }
    catch (error: unknown) {
      const message = error instanceof Error ? error.message : t('deleteModal.errors.deleteFailed')
      setError(message)
    }
    finally {
      setIsDeleting(false)
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={t('deleteModal.title')}
    >
      <div className="space-y-4">
        {/* 경고 메시지 */}
        <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4">
          <div className="flex gap-3">
            <svg
              className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
            <div>
              <h4 className="text-sm font-medium text-yellow-800">
                {t('deleteModal.warning.title')}
              </h4>
              <p className="mt-1 text-sm text-yellow-700">
                {t('deleteModal.warning.description')}
              </p>
            </div>
          </div>
        </div>

        {/* Primary Key 특별 경고 */}
        {apiKey.priority === 'primary' && apiKey.is_active && (
          <div className="bg-red-50 border border-red-200 rounded-md p-4">
            <div className="flex gap-3">
              <svg
                className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <div>
                <h4 className="text-sm font-medium text-red-800">
                  {t('deleteModal.primaryWarning.title')}
                </h4>
                <p className="mt-1 text-sm text-red-700">
                  {t('deleteModal.primaryWarning.description')}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* API Key 정보 */}
        <div className="bg-gray-50 rounded-md p-4 space-y-2">
          <div className="flex justify-between items-start">
            <span className="text-sm font-medium text-gray-600">
              {t('deleteModal.info.keyName')}:
            </span>
            <span className="text-sm text-gray-900 font-medium">
              {apiKey.key_name}
            </span>
          </div>
          <div className="flex justify-between items-start">
            <span className="text-sm font-medium text-gray-600">
              {t('deleteModal.info.provider')}:
            </span>
            <span className="text-sm text-gray-900">
              {providerMetadata.name}
            </span>
          </div>
          <div className="flex justify-between items-start">
            <span className="text-sm font-medium text-gray-600">
              {t('deleteModal.info.priority')}:
            </span>
            <span className="text-sm text-gray-900 capitalize">
              {apiKey.priority}
            </span>
          </div>
          <div className="flex justify-between items-start">
            <span className="text-sm font-medium text-gray-600">
              {t('deleteModal.info.maskedKey')}:
            </span>
            <code className="text-xs text-gray-600 font-mono bg-white px-2 py-1 rounded">
              {apiKey.api_key_masked}
            </code>
          </div>
        </div>

        {/* 에러 메시지 */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-md p-3">
            <p className="text-sm text-red-800">{error}</p>
          </div>
        )}

        {/* 확인 메시지 */}
        <p className="text-sm text-gray-600">
          {t('deleteModal.confirmMessage')}
        </p>

        {/* 버튼 */}
        <div className="flex justify-end gap-3 pt-4">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={isDeleting}
          >
            {t('deleteModal.actions.cancel')}
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={handleDelete}
            disabled={isDeleting}
          >
            {isDeleting ? t('deleteModal.actions.deleting') : t('deleteModal.actions.delete')}
          </Button>
        </div>
      </div>
    </Modal>
  )
}
