'use client'

import { useEffect, useState } from 'react'
import {
  listPriceConfigs,
  createPriceConfig,
  updatePriceConfig,
  deletePriceConfig,
  PriceConfig,
  CreatePriceConfigRequest,
  UpdatePriceConfigRequest,
} from '@/service/price-config-api'
import { PriceConfigTable, PriceConfigForm } from '@/components/analytics'

export default function PriceConfigsPage() {
  const [configs, setConfigs] = useState<PriceConfig[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [editConfig, setEditConfig] = useState<PriceConfig | null>(null)

  const loadConfigs = async () => {
    try {
      setLoading(true)
      const response = await listPriceConfigs()
      if (response.result === 'success' && response.data) {
        setConfigs(response.data.items)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load configs')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadConfigs()
  }, [])

  const handleCreate = async (data: CreatePriceConfigRequest | UpdatePriceConfigRequest) => {
    if (editConfig) {
      const response = await updatePriceConfig(editConfig.id, data as UpdatePriceConfigRequest)
      if (response.result !== 'success') {
        throw new Error('Failed to update config')
      }
    } else {
      const response = await createPriceConfig(data as CreatePriceConfigRequest)
      if (response.result !== 'success') {
        throw new Error('Failed to create config')
      }
    }
    await loadConfigs()
  }

  const handleEdit = (config: PriceConfig) => {
    setEditConfig(config)
    setShowForm(true)
  }

  const handleDelete = async (configId: string) => {
    if (!confirm('정말 삭제하시겠습니까?')) return

    try {
      await deletePriceConfig(configId)
      await loadConfigs()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete config')
    }
  }

  const handleCloseForm = () => {
    setShowForm(false)
    setEditConfig(null)
  }

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">가격 설정</h1>
          <p className="text-gray-600">API 사용량에 대한 가격을 수동으로 설정합니다.</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="rounded-md bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
        >
          + 새 가격 설정
        </button>
      </div>

      {error && (
        <div className="mb-4 rounded-md bg-red-50 p-4 text-red-600">
          {error}
          <button onClick={() => setError(null)} className="ml-2 text-red-800 underline">
            닫기
          </button>
        </div>
      )}

      <PriceConfigTable
        configs={configs}
        loading={loading}
        onEdit={handleEdit}
        onDelete={handleDelete}
      />

      <PriceConfigForm
        isOpen={showForm}
        onClose={handleCloseForm}
        onSubmit={handleCreate}
        editConfig={editConfig}
      />
    </div>
  )
}
