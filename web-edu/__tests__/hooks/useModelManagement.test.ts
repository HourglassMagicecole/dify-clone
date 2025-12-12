import { act, renderHook, waitFor } from '@testing-library/react'
import { useModelManagement } from '@/hooks/useModelManagement'
import { modelAPI } from '@/service/model-api'
import type { ProviderWithModels } from '@/types/model'

// Mock the model API
jest.mock('@/service/model-api', () => ({
  modelAPI: {
    getProviders: jest.fn(),
    toggleModel: jest.fn(),
    toggleProviderModels: jest.fn(),
  },
}))

const mockProviders: ProviderWithModels[] = [
  {
    provider: 'openai',
    label: { en_US: 'OpenAI' },
    icon_small: { en_US: 'https://example.com/icon.png' },
    icon_large: { en_US: 'https://example.com/icon-large.png' },
    supported_model_types: ['llm'],
    models: [
      {
        model: 'gpt-4',
        label: { en_US: 'GPT-4' },
        model_type: 'llm',
        features: ['agent-thought'],
        fetch_from: 'predefined-model',
        model_properties: {},
        deprecated: false,
        status: 'active',
        enabled: true,
      },
    ],
  },
]

describe('useModelManagement', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should initialize with empty providers and loading false', () => {
    const { result } = renderHook(() => useModelManagement())

    expect(result.current.providers).toEqual([])
    expect(result.current.isLoading).toBe(false)
    expect(result.current.error).toBeNull()
  })

  it('should fetch providers successfully', async () => {
    (modelAPI.getProviders as jest.Mock).mockResolvedValue({
      data: mockProviders,
    })

    const { result } = renderHook(() => useModelManagement())

    await act(async () => {
      await result.current.fetchProviders()
    })

    await waitFor(() => {
      expect(result.current.providers).toEqual(mockProviders)
      expect(result.current.isLoading).toBe(false)
      expect(result.current.error).toBeNull()
    })
  })

  it('should handle fetch providers error', async () => {
    const errorMessage = 'Failed to fetch'
    ;(modelAPI.getProviders as jest.Mock).mockRejectedValue(new Error(errorMessage))

    const { result } = renderHook(() => useModelManagement())

    await act(async () => {
      await result.current.fetchProviders()
    })

    await waitFor(() => {
      expect(result.current.providers).toEqual([])
      expect(result.current.isLoading).toBe(false)
      expect(result.current.error).toBe(errorMessage)
    })
  })

  it('should toggle model successfully', async () => {
    (modelAPI.getProviders as jest.Mock).mockResolvedValue({
      data: mockProviders,
    })
    ;(modelAPI.toggleModel as jest.Mock).mockResolvedValue({ result: 'success' })

    const { result } = renderHook(() => useModelManagement())

    // First fetch providers
    await act(async () => {
      await result.current.fetchProviders()
    })

    // Then toggle model
    let toggleResult: boolean = false
    await act(async () => {
      toggleResult = await result.current.toggleModel('openai', 'gpt-4', 'llm', false)
    })

    expect(toggleResult).toBe(true)
    expect(modelAPI.toggleModel).toHaveBeenCalledWith('openai', 'gpt-4', 'llm', false)
  })

  it('should handle toggle model failure', async () => {
    (modelAPI.getProviders as jest.Mock).mockResolvedValue({
      data: mockProviders,
    })
    ;(modelAPI.toggleModel as jest.Mock).mockRejectedValue(new Error('Toggle failed'))

    const { result } = renderHook(() => useModelManagement())

    // First fetch providers
    await act(async () => {
      await result.current.fetchProviders()
    })

    // Then toggle model
    let toggleResult: boolean = true
    await act(async () => {
      toggleResult = await result.current.toggleModel('openai', 'gpt-4', 'llm', false)
    })

    expect(toggleResult).toBe(false)
  })

  it('should toggle provider models successfully', async () => {
    (modelAPI.getProviders as jest.Mock).mockResolvedValue({
      data: mockProviders,
    })
    ;(modelAPI.toggleProviderModels as jest.Mock).mockResolvedValue({
      success: 1,
      failed: 0,
    })

    const { result } = renderHook(() => useModelManagement())

    // First fetch providers
    await act(async () => {
      await result.current.fetchProviders()
    })

    // Then toggle provider
    let providerResult: { success: number, failed: number } = { success: 0, failed: 0 }
    await act(async () => {
      providerResult = await result.current.toggleProvider('openai', true)
    })

    expect(providerResult.success).toBe(1)
    expect(providerResult.failed).toBe(0)
  })

  it('should set and get selected model type', () => {
    const { result } = renderHook(() => useModelManagement())

    expect(result.current.selectedModelType).toBe('all')

    act(() => {
      result.current.setSelectedModelType('llm')
    })

    expect(result.current.selectedModelType).toBe('llm')
  })

  it('should handle providers with nested data structure', async () => {
    (modelAPI.getProviders as jest.Mock).mockResolvedValue({
      data: { data: mockProviders },
    })

    const { result } = renderHook(() => useModelManagement())

    await act(async () => {
      await result.current.fetchProviders()
    })

    await waitFor(() => {
      expect(result.current.providers).toEqual(mockProviders)
    })
  })

  it('should return empty result when toggling non-existent provider', async () => {
    (modelAPI.getProviders as jest.Mock).mockResolvedValue({
      data: mockProviders,
    })

    const { result } = renderHook(() => useModelManagement())

    // First fetch providers
    await act(async () => {
      await result.current.fetchProviders()
    })

    // Try to toggle non-existent provider
    let providerResult: { success: number, failed: number } = { success: 1, failed: 1 }
    await act(async () => {
      providerResult = await result.current.toggleProvider('non-existent', true)
    })

    expect(providerResult).toEqual({ success: 0, failed: 0 })
  })
})
