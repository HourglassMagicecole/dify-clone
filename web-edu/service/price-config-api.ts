/**
 * Price Config API Client
 * API client for managing admin price configurations.
 */

import { apiClient, ApiResponse } from './base-api'

// ============================================================
// Types
// ============================================================

export interface PriceConfig {
  id: string
  tenant_id: string
  provider: string
  model_id: string
  usage_type: string
  input_modality: string | null
  output_modality: string | null
  quality: string | null
  resolution: string | null
  tool_name: string | null
  price_unit: string
  unit_scale: number
  input_price: string | null
  output_price: string | null
  currency: string
  is_active: boolean
  created_at: string
  updated_at: string
  /** Actual model status from provider (active, disabled, etc.) */
  model_status?: string | null
}

export interface PriceConfigListResponse {
  items: PriceConfig[]
  total: number
  page: number
  page_size: number
}

export interface CreatePriceConfigRequest {
  provider: string
  model_id: string
  usage_type: string
  price_unit: string
  unit_scale?: number
  input_price?: string
  output_price?: string
  currency?: string
  input_modality?: string
  output_modality?: string
  quality?: string
  resolution?: string
  tool_name?: string
}

export interface UpdatePriceConfigRequest {
  input_price?: string
  output_price?: string
  unit_scale?: number
  currency?: string
  is_active?: boolean
}

// ============================================================
// API Functions
// ============================================================

/**
 * List price configurations.
 */
export async function listPriceConfigs(
  usageType?: string,
  provider?: string,
  isActive?: boolean,
  page: number = 1,
  pageSize: number = 20,
): Promise<ApiResponse<PriceConfigListResponse>> {
  const params = new URLSearchParams({
    page: page.toString(),
    page_size: pageSize.toString(),
  })

  if (usageType) params.set('usage_type', usageType)
  if (provider) params.set('provider', provider)
  if (isActive !== undefined) params.set('is_active', isActive.toString())

  const endpoint = `/console/api/edu/price-configs?${params.toString()}`

  return apiClient.get<PriceConfigListResponse>(endpoint)
}

/**
 * Get a specific price configuration.
 */
export async function getPriceConfig(configId: string): Promise<ApiResponse<PriceConfig>> {
  return apiClient.get<PriceConfig>(`/console/api/edu/price-configs/${configId}`)
}

/**
 * Create a new price configuration.
 */
export async function createPriceConfig(data: CreatePriceConfigRequest): Promise<ApiResponse<PriceConfig>> {
  return apiClient.post<PriceConfig>('/console/api/edu/price-configs', data)
}

/**
 * Update a price configuration.
 */
export async function updatePriceConfig(
  configId: string,
  data: UpdatePriceConfigRequest,
): Promise<ApiResponse<PriceConfig>> {
  return apiClient.put<PriceConfig>(`/console/api/edu/price-configs/${configId}`, data)
}

/**
 * Delete a price configuration.
 */
export async function deletePriceConfig(configId: string): Promise<ApiResponse<void>> {
  return apiClient.delete<void>(`/console/api/edu/price-configs/${configId}`)
}

// ============================================================
// Constants
// ============================================================

export const USAGE_TYPES = [
  { value: 'llm', label: 'LLM (텍스트 생성)' },
  { value: 'embedding', label: 'Embedding (텍스트 임베딩)' },
  { value: 'rerank', label: 'Rerank (문서 순위 조정)' },
  { value: 'tts', label: 'TTS (텍스트→음성)' },
  { value: 'stt', label: 'STT (음성→텍스트)' },
  { value: 'image_gen', label: 'Image Gen (이미지 생성)' },
  { value: 'tool', label: 'Tool (도구 호출)' },
]

export const PRICE_UNITS = [
  { value: 'token', label: '토큰' },
  { value: 'character', label: '문자' },
  { value: 'image', label: '이미지' },
  { value: 'minute', label: '분' },
  { value: 'call', label: '호출' },
  { value: 'hour', label: '시간' },
]
