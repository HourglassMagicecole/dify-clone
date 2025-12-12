'use client'

import { useCallback, useState } from 'react'
import { modelAPI } from '@/service/model-api'
import type { ModelType, ProviderWithModels } from '@/types/model'

interface UseModelManagementReturn {
  providers: ProviderWithModels[]
  isLoading: boolean
  error: string | null
  selectedModelType: ModelType | 'all'
  setSelectedModelType: (type: ModelType | 'all') => void
  fetchProviders: () => Promise<void>
  toggleModel: (provider: string, model: string, modelType: ModelType, enable: boolean) => Promise<boolean>
  toggleProvider: (provider: string, enable: boolean) => Promise<{ success: number, failed: number }>
}

export function useModelManagement(): UseModelManagementReturn {
  const [providers, setProviders] = useState<ProviderWithModels[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedModelType, setSelectedModelType] = useState<ModelType | 'all'>('all')

  const fetchProviders = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const response = await modelAPI.getProviders()
      if (response.data) {
        // response.data가 { data: ProviderWithModels[] } 형태일 수 있음
        const providerList = Array.isArray(response.data)
          ? response.data
          : (response.data as unknown as { data: ProviderWithModels[] }).data || []
        setProviders(providerList)
      }
    }
    catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch providers')
    }
    finally {
      setIsLoading(false)
    }
  }, [])

  const toggleModel = useCallback(async (
    provider: string,
    model: string,
    modelType: ModelType,
    enable: boolean,
  ): Promise<boolean> => {
    try {
      await modelAPI.toggleModel(provider, model, modelType, enable)
      // Update local state
      setProviders(prev => prev.map((p) => {
        if (p.provider !== provider)
          return p
        return {
          ...p,
          models: p.models.map((m) => {
            if (m.model !== model || m.model_type !== modelType)
              return m
            return { ...m, enabled: enable }
          }),
        }
      }))
      return true
    }
    catch {
      return false
    }
  }, [])

  const toggleProvider = useCallback(async (
    provider: string,
    enable: boolean,
  ): Promise<{ success: number, failed: number }> => {
    const providerData = providers.find(p => p.provider === provider)
    if (!providerData)
      return { success: 0, failed: 0 }

    const models = providerData.models.map(m => ({
      model: m.model,
      model_type: m.model_type,
    }))

    const result = await modelAPI.toggleProviderModels(provider, models, enable)

    // Refetch to get accurate state
    await fetchProviders()

    return result
  }, [providers, fetchProviders])

  return {
    providers,
    isLoading,
    error,
    selectedModelType,
    setSelectedModelType,
    fetchProviders,
    toggleModel,
    toggleProvider,
  }
}
