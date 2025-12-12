/**
 * Add API Key Modal Component (Story 1.8 - Task 11)
 *
 * Modal for creating new API keys with validation and testing
 */

'use client'

import React, { useState } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import type { CreateAPIKeyRequest, TestAPIKeyResponse } from '@/types/api-key'
import { PROVIDER_METADATA, SUPPORTED_PROVIDERS } from '@/types/api-key'
import { Modal } from '@/components/common/Modal'
import { Button } from '@/components/common/Button'
import { createAPIKey } from '@/service/api-key-api'

interface AddAPIKeyModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
}

export function AddAPIKeyModal({
  isOpen,
  onClose,
  onSuccess,
}: AddAPIKeyModalProps) {
  const { t } = useTranslation('api-keys')
  const [isTesting, setIsTesting] = useState(false)
  const [testResult, setTestResult] = useState<TestAPIKeyResponse | null>(null)
  const [showApiKey, setShowApiKey] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<CreateAPIKeyRequest>({
    defaultValues: {
      provider: 'openai',
      priority: 'primary',
    },
  })

  const onSubmit = async (data: CreateAPIKeyRequest) => {
    try {
      setIsTesting(true)
      setTestResult(null)

      // API Key 생성 (백엔드에서 자동으로 테스트 후 저장)
      await createAPIKey(data)

      setTestResult({
        success: true,
        message: t('addModal.success.created'),
      })

      // 성공 시 모달 닫고 초기화
      setTimeout(() => {
        onSuccess()
        handleClose()
      }, 1500)
    }
    catch (error: unknown) {
      const message = error instanceof Error ? error.message : t('addModal.errors.createFailed')
      setTestResult({
        success: false,
        message,
      })
    }
    finally {
      setIsTesting(false)
    }
  }

  const handleClose = () => {
    reset()
    setTestResult(null)
    setShowApiKey(false)
    onClose()
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={t('addModal.title')}
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        {/* Provider 선택 */}
        <div>
          <label htmlFor="provider" className="block text-sm font-medium text-gray-700 mb-1">
            {t('addModal.fields.provider')} *
          </label>
          <select
            id="provider"
            {...register('provider', { required: t('addModal.errors.providerRequired') })}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {SUPPORTED_PROVIDERS.map((provider) => {
              const metadata = PROVIDER_METADATA[provider]
              return (
                <option key={provider} value={provider}>
                  {metadata.name}
                </option>
              )
            })}
          </select>
          {errors.provider && (
            <p className="mt-1 text-sm text-red-600">{errors.provider.message}</p>
          )}
        </div>

        {/* Key 이름 */}
        <div>
          <label htmlFor="key_name" className="block text-sm font-medium text-gray-700 mb-1">
            {t('addModal.fields.keyName')} *
          </label>
          <input
            id="key_name"
            type="text"
            {...register('key_name', {
              required: t('addModal.errors.keyNameRequired'),
              minLength: {
                value: 3,
                message: t('addModal.errors.keyNameTooShort'),
              },
            })}
            placeholder={t('addModal.placeholders.keyName')}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          {errors.key_name && (
            <p className="mt-1 text-sm text-red-600">{errors.key_name.message}</p>
          )}
        </div>

        {/* API Key (비밀번호 필드) */}
        <div>
          <label htmlFor="api_key" className="block text-sm font-medium text-gray-700 mb-1">
            {t('addModal.fields.apiKey')} *
          </label>
          <div className="relative">
            <input
              id="api_key"
              type={showApiKey ? 'text' : 'password'}
              {...register('api_key', {
                required: t('addModal.errors.apiKeyRequired'),
                minLength: {
                  value: 10,
                  message: t('addModal.errors.apiKeyTooShort'),
                },
              })}
              placeholder={t('addModal.placeholders.apiKey')}
              className="w-full px-3 py-2 pr-20 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
            />
            <button
              type="button"
              onClick={() => setShowApiKey(!showApiKey)}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-sm text-gray-600 hover:text-gray-800"
            >
              {showApiKey ? t('addModal.actions.hide') : t('addModal.actions.show')}
            </button>
          </div>
          {errors.api_key && (
            <p className="mt-1 text-sm text-red-600">{errors.api_key.message}</p>
          )}
        </div>

        {/* 우선순위 */}
        <div>
          <label htmlFor="priority" className="block text-sm font-medium text-gray-700 mb-1">
            {t('addModal.fields.priority')} *
          </label>
          <select
            id="priority"
            {...register('priority', { required: t('addModal.errors.priorityRequired') })}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="primary">{t('addModal.priority.primary')}</option>
            <option value="secondary">{t('addModal.priority.secondary')}</option>
            <option value="tertiary">{t('addModal.priority.tertiary')}</option>
          </select>
          {errors.priority && (
            <p className="mt-1 text-sm text-red-600">{errors.priority.message}</p>
          )}
        </div>

        {/* 테스트 결과 표시 */}
        {testResult && (
          <div
            className={`
              rounded-md p-3
              ${testResult.success
                ? 'bg-green-50 border border-green-200'
                : 'bg-red-50 border border-red-200'
              }
            `}
          >
            <p
              className={`text-sm ${testResult.success ? 'text-green-800' : 'text-red-800'}`}
            >
              {testResult.message}
            </p>
            {testResult.response_time_ms && (
              <p className="text-xs text-gray-600 mt-1">
                {t('addModal.responseTime', { time: testResult.response_time_ms })}
              </p>
            )}
          </div>
        )}

        {/* 버튼 */}
        <div className="flex justify-end gap-3 pt-4">
          <Button
            type="button"
            variant="outline"
            onClick={handleClose}
            disabled={isTesting}
          >
            {t('addModal.actions.cancel')}
          </Button>
          <Button
            type="submit"
            disabled={isTesting}
          >
            {isTesting ? t('addModal.actions.testing') : t('addModal.actions.testAndSave')}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
