'use client'

import { useState, useEffect } from 'react'
import { Modal } from '@/components/common/Modal'
import {
  PriceConfig,
  CreatePriceConfigRequest,
  UpdatePriceConfigRequest,
  USAGE_TYPES,
  PRICE_UNITS,
} from '@/service/price-config-api'

interface PriceConfigFormProps {
  isOpen: boolean
  onClose: () => void
  onSubmit: (data: CreatePriceConfigRequest | UpdatePriceConfigRequest) => Promise<void>
  editConfig?: PriceConfig | null
}

const initialFormData: CreatePriceConfigRequest = {
  provider: '',
  model_id: '',
  usage_type: 'llm',
  price_unit: 'token',
  unit_scale: 1000000,
  input_price: '',
  output_price: '',
  currency: 'USD',
}

export function PriceConfigForm({ isOpen, onClose, onSubmit, editConfig }: PriceConfigFormProps) {
  const [formData, setFormData] = useState<CreatePriceConfigRequest>(initialFormData)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isEdit = !!editConfig

  useEffect(() => {
    if (editConfig) {
      setFormData({
        provider: editConfig.provider,
        model_id: editConfig.model_id,
        usage_type: editConfig.usage_type,
        price_unit: editConfig.price_unit,
        unit_scale: editConfig.unit_scale,
        input_price: editConfig.input_price || '',
        output_price: editConfig.output_price || '',
        currency: editConfig.currency,
      })
    } else {
      setFormData(initialFormData)
    }
    setError(null)
  }, [editConfig, isOpen])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setIsSubmitting(true)

    try {
      if (isEdit) {
        // Update - only send modifiable fields
        await onSubmit({
          input_price: formData.input_price || undefined,
          output_price: formData.output_price || undefined,
          unit_scale: formData.unit_scale,
          currency: formData.currency,
        })
      } else {
        // Create
        await onSubmit(formData)
      }
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : '저장에 실패했습니다')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={isEdit ? '가격 설정 수정' : '새 가격 설정'}>
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="rounded-md bg-red-50 p-3 text-sm text-red-600">
            {error}
          </div>
        )}

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Provider</label>
            <input
              type="text"
              value={formData.provider}
              onChange={(e) => setFormData({ ...formData, provider: e.target.value })}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 disabled:bg-gray-100"
              placeholder="openai"
              required
              disabled={isEdit}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Model ID</label>
            <input
              type="text"
              value={formData.model_id}
              onChange={(e) => setFormData({ ...formData, model_id: e.target.value })}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 disabled:bg-gray-100"
              placeholder="gpt-4"
              required
              disabled={isEdit}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">사용 타입</label>
            <select
              value={formData.usage_type}
              onChange={(e) => setFormData({ ...formData, usage_type: e.target.value })}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 disabled:bg-gray-100"
              disabled={isEdit}
            >
              {USAGE_TYPES.map((type) => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">가격 단위</label>
            <select
              value={formData.price_unit}
              onChange={(e) => setFormData({ ...formData, price_unit: e.target.value })}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 disabled:bg-gray-100"
              disabled={isEdit}
            >
              {PRICE_UNITS.map((unit) => (
                <option key={unit.value} value={unit.value}>
                  {unit.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">
            단위 스케일 (예: 1000000 = 백만당)
          </label>
          <input
            type="number"
            value={formData.unit_scale}
            onChange={(e) => setFormData({ ...formData, unit_scale: parseInt(e.target.value) || 1 })}
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
            min={1}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">입력 가격 (USD)</label>
            <input
              type="text"
              value={formData.input_price}
              onChange={(e) => setFormData({ ...formData, input_price: e.target.value })}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
              placeholder="0.03"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">출력 가격 (USD)</label>
            <input
              type="text"
              value={formData.output_price}
              onChange={(e) => setFormData({ ...formData, output_price: e.target.value })}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
              placeholder="0.06"
            />
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-gray-300 px-4 py-2 text-gray-700 hover:bg-gray-50"
            disabled={isSubmitting}
          >
            취소
          </button>
          <button
            type="submit"
            className="rounded-md bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:opacity-50"
            disabled={isSubmitting}
          >
            {isSubmitting ? '저장 중...' : isEdit ? '수정' : '생성'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
