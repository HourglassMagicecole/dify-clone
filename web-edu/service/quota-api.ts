/**
 * Quota API client for usage quota management
 */

import { apiClient, type ApiResponse } from './base-api'
import type {
  AllQuotaWarningsResponse,
  DefaultQuotaConfig,
  DeleteUserQuotasByProviderResponse,
  MyQuotaStatus,
  QuotaWarnings,
  SessionQuota,
  SessionQuotasResponse,
  SetDefaultQuotaConfigRequest,
  SetDefaultQuotaConfigResponse,
  SetDefaultUserQuotaRequest,
  SetDefaultUserQuotaResponse,
  SetSessionQuotaRequest,
  SetUserQuotaRequest,
  UserQuota,
} from '@/types/quota'

export class QuotaAPI {
  // ============================================================================
  // Session Quota Management (Admin/Owner)
  // ============================================================================

  /**
   * Get all quotas for a session (both session-wide and user quotas)
   */
  async getSessionQuotas(sessionId: string): Promise<SessionQuotasResponse> {
    const response: ApiResponse<SessionQuotasResponse> = await apiClient.get(
      `/console/api/edu/sessions/${sessionId}/quotas`,
    )

    if (response.result !== 'success' || !response.data) {
      throw new Error(response.message || 'Failed to get session quotas')
    }

    return response.data
  }

  /**
   * Set session-wide quota for a provider
   */
  async setSessionQuota(sessionId: string, data: SetSessionQuotaRequest): Promise<SessionQuota> {
    const response: ApiResponse<SessionQuota> = await apiClient.put(
      `/console/api/edu/sessions/${sessionId}/quotas/session`,
      data,
    )

    if (response.result !== 'success' || !response.data) {
      throw new Error(response.message || 'Failed to set session quota')
    }

    return response.data
  }

  /**
   * Delete session-wide quota for a provider
   */
  async deleteSessionQuota(sessionId: string, provider: string): Promise<void> {
    const response: ApiResponse<void> = await apiClient.delete(
      `/console/api/edu/sessions/${sessionId}/quotas/session/${provider}`,
    )

    if (response.result !== 'success') {
      throw new Error(response.message || 'Failed to delete session quota')
    }
  }

  /**
   * Unblock session quota for a provider
   */
  async unblockSessionQuota(sessionId: string, provider: string): Promise<void> {
    const response: ApiResponse<void> = await apiClient.post(
      `/console/api/edu/sessions/${sessionId}/quotas/session/${provider}/unblock`,
      {},
    )

    if (response.result !== 'success') {
      throw new Error(response.message || 'Failed to unblock session quota')
    }
  }

  // ============================================================================
  // User Quota Management (Admin/Owner)
  // ============================================================================

  /**
   * Set default user quota for ALL members in a session (bulk apply)
   * This applies the same quota limit to every member for fair resource distribution.
   */
  async setDefaultUserQuota(sessionId: string, data: SetDefaultUserQuotaRequest): Promise<SetDefaultUserQuotaResponse> {
    const response: ApiResponse<SetDefaultUserQuotaResponse> = await apiClient.put(
      `/console/api/edu/sessions/${sessionId}/quotas/user-default`,
      data,
    )

    if (response.result !== 'success' || !response.data) {
      throw new Error(response.message || 'Failed to set default user quota')
    }

    return response.data
  }

  // ============================================================================
  // Default Quota Config (Auto-apply to new members)
  // ============================================================================

  /**
   * Get default quota configs for a session (auto-applied to new members)
   */
  async getDefaultQuotaConfigs(sessionId: string): Promise<DefaultQuotaConfig[]> {
    const response: ApiResponse<{ configs: DefaultQuotaConfig[] }> = await apiClient.get(
      `/console/api/edu/sessions/${sessionId}/quotas/default-config`,
    )

    if (response.result !== 'success' || !response.data) {
      throw new Error(response.message || 'Failed to get default quota configs')
    }

    return response.data.configs
  }

  /**
   * Save default quota config (auto-applied to new members)
   */
  async setDefaultQuotaConfig(
    sessionId: string,
    data: SetDefaultQuotaConfigRequest,
  ): Promise<SetDefaultQuotaConfigResponse> {
    const response: ApiResponse<SetDefaultQuotaConfigResponse> = await apiClient.put(
      `/console/api/edu/sessions/${sessionId}/quotas/default-config`,
      data,
    )

    if (response.result !== 'success' || !response.data) {
      throw new Error(response.message || 'Failed to save default quota config')
    }

    return response.data
  }

  /**
   * Delete default quota config
   */
  async deleteDefaultQuotaConfig(sessionId: string, provider: string): Promise<void> {
    const response: ApiResponse<void> = await apiClient.delete(
      `/console/api/edu/sessions/${sessionId}/quotas/default-config/${provider}`,
    )

    if (response.result !== 'success') {
      throw new Error(response.message || 'Failed to delete default quota config')
    }
  }

  /**
   * Delete all user quotas for a provider (including default config)
   */
  async deleteUserQuotasByProvider(
    sessionId: string,
    provider: string,
  ): Promise<DeleteUserQuotasByProviderResponse> {
    const response: ApiResponse<DeleteUserQuotasByProviderResponse> = await apiClient.delete(
      `/console/api/edu/sessions/${sessionId}/quotas/user-default/${provider}`,
    )

    if (response.result !== 'success' || !response.data) {
      throw new Error(response.message || 'Failed to delete user quotas')
    }

    return response.data
  }

  /**
   * Set user quota for a specific user and provider (individual adjustment)
   */
  async setUserQuota(sessionId: string, data: SetUserQuotaRequest): Promise<UserQuota> {
    const response: ApiResponse<UserQuota> = await apiClient.put(
      `/console/api/edu/sessions/${sessionId}/quotas/user`,
      data,
    )

    if (response.result !== 'success' || !response.data) {
      throw new Error(response.message || 'Failed to set user quota')
    }

    return response.data
  }

  /**
   * Unblock a user quota
   */
  async unblockUser(sessionId: string, quotaId: string): Promise<void> {
    const response: ApiResponse<void> = await apiClient.post(
      `/console/api/edu/sessions/${sessionId}/quotas/user/${quotaId}/unblock`,
      {},
    )

    if (response.result !== 'success') {
      throw new Error(response.message || 'Failed to unblock user')
    }
  }

  /**
   * Delete a user quota
   */
  async deleteUserQuota(sessionId: string, quotaId: string): Promise<void> {
    const response: ApiResponse<void> = await apiClient.delete(
      `/console/api/edu/sessions/${sessionId}/quotas/user/${quotaId}`,
    )

    if (response.result !== 'success') {
      throw new Error(response.message || 'Failed to delete user quota')
    }
  }

  // ============================================================================
  // Quota Warnings (Admin/Owner)
  // ============================================================================

  /**
   * Get quota warning summary for a session dashboard banner
   */
  async getQuotaWarnings(sessionId: string): Promise<QuotaWarnings> {
    const response: ApiResponse<QuotaWarnings> = await apiClient.get(
      `/console/api/edu/sessions/${sessionId}/quotas/warnings`,
    )

    if (response.result !== 'success' || !response.data) {
      throw new Error(response.message || 'Failed to get quota warnings')
    }

    return response.data
  }

  /**
   * Get all quota warnings across all sessions (Owner only)
   */
  async getAllQuotaWarnings(): Promise<AllQuotaWarningsResponse> {
    const response: ApiResponse<AllQuotaWarningsResponse> = await apiClient.get(
      '/console/api/edu/usage-analytics/system/quota-warnings',
    )

    if (response.result !== 'success' || !response.data) {
      throw new Error(response.message || 'Failed to get all quota warnings')
    }

    return response.data
  }

  // ============================================================================
  // My Quota Status (Student)
  // ============================================================================

  /**
   * Get current user's quota status
   */
  async getMyQuotas(sessionId?: string): Promise<MyQuotaStatus[]> {
    const params = sessionId ? `?session_id=${sessionId}` : ''
    const response: ApiResponse<{ quotas: MyQuotaStatus[] }> = await apiClient.get(
      `/console/api/edu/usage-analytics/my-usage/quotas${params}`,
    )

    if (response.result !== 'success' || !response.data) {
      throw new Error(response.message || 'Failed to get my quotas')
    }

    return response.data.quotas
  }
}

export const quotaAPI = new QuotaAPI()
