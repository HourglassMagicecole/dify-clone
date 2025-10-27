/**
 * API Key Management API Client for Story 1.8
 */

import { apiClient, type ApiResponse } from './base-api'
import type {
  APIKeyConfig,
  CreateAPIKeyRequest,
  ProviderType,
  TestAPIKeyResponse,
  UpdateAPIKeyRequest,
} from '@/types/api-key'

const BASE_URL = '/console/api/edu/api-keys'

/**
 * API Key 목록 조회
 */
export async function listAPIKeys(
  provider?: ProviderType,
  isActive?: boolean,
): Promise<APIKeyConfig[]> {
  const params = new URLSearchParams()
  if (provider)
    params.append('provider', provider)
  if (isActive !== undefined)
    params.append('is_active', String(isActive))

  const url = params.toString() ? `${BASE_URL}?${params}` : BASE_URL

  const response: ApiResponse<APIKeyConfig[]> = await apiClient.get(url)

  if (response.result !== 'success' || !response.data) {
    throw new Error(response.message || 'Failed to fetch API keys')
  }

  return response.data
}

/**
 * API Key 생성 (테스트 후 저장)
 */
export async function createAPIKey(
  request: CreateAPIKeyRequest,
): Promise<APIKeyConfig> {
  const response: ApiResponse<APIKeyConfig> = await apiClient.post(BASE_URL, request)

  if (response.result !== 'success' || !response.data) {
    throw new Error(response.message || 'Failed to create API key')
  }

  return response.data
}

/**
 * API Key 수정
 */
export async function updateAPIKey(
  keyId: string,
  request: UpdateAPIKeyRequest,
): Promise<APIKeyConfig> {
  const response: ApiResponse<APIKeyConfig> = await apiClient.put(`${BASE_URL}/${keyId}`, request)

  if (response.result !== 'success' || !response.data) {
    throw new Error(response.message || 'Failed to update API key')
  }

  return response.data
}

/**
 * API Key 삭제
 */
export async function deleteAPIKey(keyId: string): Promise<void> {
  const response: ApiResponse<void> = await apiClient.delete(`${BASE_URL}/${keyId}`)

  if (response.result !== 'success') {
    throw new Error(response.message || 'Failed to delete API key')
  }
}

/**
 * API Key 테스트
 */
export async function testAPIKey(keyId: string): Promise<TestAPIKeyResponse> {
  const response: ApiResponse<TestAPIKeyResponse> = await apiClient.post(`${BASE_URL}/${keyId}/test`, {})

  // 테스트 실패도 정상 응답으로 처리 (data에 success: false 포함)
  if (!response.data) {
    throw new Error(response.message || 'Failed to test API key')
  }

  return response.data
}
