/**
 * Edit API Key Modal Component (Story 1.8 - Task 12.1)
 *
 * Modal for editing existing API keys (name, priority, active status only)
 */

'use client'

import React, { useState } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import type { APIKeyConfig, UpdateAPIKeyRequest } from '@/types/api-key'
import { PROVIDER_METADATA } from '@/types/api-key'
import { Modal } from '@/components/common/Modal'
import { Button } from '@/components/common/Button'
import { updateAPIKey } from '@/service/api-key-api'

interface EditAPIKeyModalProps {
  apiKey: APIKeyConfig
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
}

export function EditAPIKeyModal({
  apiKey,
  isOpen,
  onClose,
  onSuccess,
}: EditAPIKeyModalProps) {
  const { t } = useTranslation('api-keys')
  const [isUpdating, setIsUpdating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<UpdateAPIKeyRequest>({
    defaultValues: {
      key_name: apiKey.key_name,
      priority: apiKey.priority,
      is_active: apiKey.is_active,
    },
  })

  const providerMetadata = PROVIDER_METADATA[apiKey.provider]

  const onSubmit = async (data: UpdateAPIKeyRequest) => {
    try {
      setIsUpdating(true)
      setError(null)

      await updateAPIKey(apiKey.id, data)

      onSuccess()
      onClose()
    }
    catch (error: unknown) {
      const message = error instanceof Error ? error.message : t('editModal.errors.updateFailed')
      setError(message)
    }
    finally {
      setIsUpdating(false)
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={t('editModal.title')}
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        {/* Provider 정보 (읽기 전용) */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {t('editModal.fields.provider')}
          </label>
          <div className="px-3 py-2 bg-gray-100 rounded-md text-gray-700">
            {providerMetadata.name}
          </div>
          <p className="mt-1 text-xs text-gray-500">
            {t('editModal.hints.providerReadonly')}
          </p>
        </div>

        {/* API Key (마스킹된 상태로 표시, 읽기 전용) */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {t('editModal.fields.apiKey')}
          </label>
          <div className="px-3 py-2 bg-gray-100 rounded-md font-mono text-sm text-gray-700">
            {apiKey.api_key_masked}
          </div>
          <p className="mt-1 text-xs text-gray-500">
            {t('editModal.hints.apiKeyReadonly')}
          </p>
        </div>

        {/* Key 이름 (수정 가능) */}
        <div>
          <label htmlFor="key_name" className="block text-sm font-medium text-gray-700 mb-1">
            {t('editModal.fields.keyName')} *
          </label>
          <input
            id="key_name"
            type="text"
            {...register('key_name', {
              required: t('editModal.errors.keyNameRequired'),
              minLength: {
                value: 3,
                message: t('editModal.errors.keyNameTooShort'),
              },
            })}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          {errors.key_name && (
            <p className="mt-1 text-sm text-red-600">{errors.key_name.message}</p>
          )}
        </div>

        {/* 우선순위 (수정 가능) */}
        <div>
          <label htmlFor="priority" className="block text-sm font-medium text-gray-700 mb-1">
            {t('editModal.fields.priority')} *
          </label>
          <select
            id="priority"
            {...register('priority', { required: t('editModal.errors.priorityRequired') })}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="primary">{t('editModal.priority.primary')}</option>
            <option value="secondary">{t('editModal.priority.secondary')}</option>
            <option value="tertiary">{t('editModal.priority.tertiary')}</option>
          </select>
          {errors.priority && (
            <p className="mt-1 text-sm text-red-600">{errors.priority.message}</p>
          )}
        </div>

        {/* 활성화 토글 (수정 가능) */}
        <div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              {...register('is_active')}
              className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
            />
            <span className="text-sm font-medium text-gray-700">
              {t('editModal.fields.isActive')}
            </span>
          </label>
          <p className="mt-1 ml-6 text-xs text-gray-500">
            {t('editModal.hints.isActive')}
          </p>
        </div>

        {/* 에러 메시지 */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-md p-3">
            <p className="text-sm text-red-800">{error}</p>
          </div>
        )}

        {/* 버튼 */}
        <div className="flex justify-end gap-3 pt-4">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={isUpdating}
          >
            {t('editModal.actions.cancel')}
          </Button>
          <Button
            type="submit"
            disabled={isUpdating}
          >
            {isUpdating ? t('editModal.actions.saving') : t('editModal.actions.save')}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
