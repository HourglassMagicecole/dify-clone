/**
 * Custom SWR hook for API Key management (Story 1.8 - Task 8.2)
 *
 * Provides data fetching and mutation functions for API Key CRUD operations
 */

'use client'

import { useCallback } from 'react'
import useSWR from 'swr'
import type { SWRConfiguration } from 'swr'
import type {
  APIKeyConfig,
  CreateAPIKeyRequest,
  ProviderType,
  TestAPIKeyResponse,
  UpdateAPIKeyRequest,
} from '@/types/api-key'
import {
  createAPIKey,
  deleteAPIKey,
  listAPIKeys,
  testAPIKey,
  updateAPIKey,
} from '@/service/api-key-api'

/**
 * SWR 키 생성 함수
 */
function getAPIKeysKey(provider?: ProviderType, isActive?: boolean) {
  return ['api-keys', provider, isActive]
}

/**
 * API Key 목록 조회 훅
 *
 * @param provider - 필터링할 Provider (선택)
 * @param isActive - 활성 상태 필터 (선택)
 * @param config - SWR 설정
 * @returns API Key 목록, 로딩 상태, 에러, mutate 함수
 */
export function useAPIKeys(
  provider?: ProviderType,
  isActive?: boolean,
  config?: SWRConfiguration,
) {
  const { data, error, mutate, isLoading } = useSWR(
    getAPIKeysKey(provider, isActive),
    () => listAPIKeys(provider, isActive),
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: true,
      ...config,
    },
  )

  return {
    apiKeys: data,
    isLoading,
    isError: error,
    mutate,
  }
}

/**
 * API Key 생성 mutation 훅
 */
export function useCreateAPIKey() {
  const create = useCallback(
    async (request: CreateAPIKeyRequest): Promise<APIKeyConfig> => {
      try {
        const newKey = await createAPIKey(request)
        return newKey
      }
      catch (error) {
        throw error
      }
    },
    [],
  )

  return { create }
}

/**
 * API Key 수정 mutation 훅
 */
export function useUpdateAPIKey() {
  const update = useCallback(
    async (keyId: string, request: UpdateAPIKeyRequest): Promise<APIKeyConfig> => {
      try {
        const updatedKey = await updateAPIKey(keyId, request)
        return updatedKey
      }
      catch (error) {
        throw error
      }
    },
    [],
  )

  return { update }
}

/**
 * API Key 삭제 mutation 훅
 */
export function useDeleteAPIKey() {
  const deleteKey = useCallback(
    async (keyId: string): Promise<void> => {
      try {
        await deleteAPIKey(keyId)
      }
      catch (error) {
        throw error
      }
    },
    [],
  )

  return { deleteKey }
}

/**
 * API Key 테스트 mutation 훅
 */
export function useTestAPIKey() {
  const test = useCallback(
    async (keyId: string): Promise<TestAPIKeyResponse> => {
      try {
        const result = await testAPIKey(keyId)
        return result
      }
      catch (error) {
        throw error
      }
    },
    [],
  )

  return { test }
}

/**
 * 통합 API Key 관리 훅 (모든 CRUD 작업 포함)
 *
 * @param provider - 필터링할 Provider (선택)
 * @param isActive - 활성 상태 필터 (선택)
 * @returns API Key 목록 + CRUD 작업 함수들
 */
export function useAPIKeyManagement(
  provider?: ProviderType,
  isActive?: boolean,
) {
  const { apiKeys, isLoading, isError, mutate } = useAPIKeys(provider, isActive)
  const { create } = useCreateAPIKey()
  const { update } = useUpdateAPIKey()
  const { deleteKey } = useDeleteAPIKey()
  const { test } = useTestAPIKey()

  // Create 후 mutate
  const createAndRefresh = useCallback(
    async (request: CreateAPIKeyRequest): Promise<APIKeyConfig> => {
      const newKey = await create(request)
      await mutate() // 목록 갱신
      return newKey
    },
    [create, mutate],
  )

  // Update 후 mutate
  const updateAndRefresh = useCallback(
    async (keyId: string, request: UpdateAPIKeyRequest): Promise<APIKeyConfig> => {
      const updatedKey = await update(keyId, request)
      await mutate() // 목록 갱신
      return updatedKey
    },
    [update, mutate],
  )

  // Delete 후 mutate
  const deleteAndRefresh = useCallback(
    async (keyId: string): Promise<void> => {
      await deleteKey(keyId)
      await mutate() // 목록 갱신
    },
    [deleteKey, mutate],
  )

  // Test 후 mutate (상태 업데이트 반영)
  const testAndRefresh = useCallback(
    async (keyId: string): Promise<TestAPIKeyResponse> => {
      const result = await test(keyId)
      await mutate() // 목록 갱신 (테스트 결과가 상태에 영향)
      return result
    },
    [test, mutate],
  )

  return {
    // Data
    apiKeys,
    isLoading,
    isError,

    // CRUD Operations (auto-refresh)
    create: createAndRefresh,
    update: updateAndRefresh,
    deleteKey: deleteAndRefresh,
    test: testAndRefresh,

    // Manual refresh
    refresh: mutate,
  }
}
