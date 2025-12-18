/**
 * Education session API client
 */

import { apiClient, type ApiResponse } from './base-api'
import type {
  CreateSessionRequest,
  DeleteResourcesResponse,
  DeleteSessionResponse,
  DeleteStatus,
  MemberRemoveStatus,
  RemoveMemberResponse,
  ResourceAccount,
  Session,
  SessionDeleteStatus,
  SessionListResponse,
  SessionMember,
  SessionResourcesResponse,
  UpdateSessionRequest,
} from '@/types/session'

export class SessionAPI {
  /**
   * Create a new session
   */
  async createSession(data: CreateSessionRequest): Promise<Session> {
    const response: ApiResponse<Session> = await apiClient.post('/console/api/edu/sessions', data)

    if (response.result !== 'success' || !response.data) {
      throw new Error(response.message || 'Failed to create session')
    }

    return response.data
  }

  /**
   * List sessions with pagination
   */
  async listSessions(isActive?: boolean, page = 1, limit = 20): Promise<SessionListResponse> {
    const params = new URLSearchParams()
    if (isActive !== undefined)
      params.append('is_active', String(isActive))
    params.append('page', String(page))
    params.append('limit', String(limit))

    const response: ApiResponse<SessionListResponse> = await apiClient.get(`/console/api/edu/sessions?${params}`)

    if (response.result !== 'success' || !response.data) {
      throw new Error(response.message || 'Failed to list sessions')
    }

    return response.data
  }

  /**
   * Get session by ID
   */
  async getSession(id: string): Promise<Session> {
    const response: ApiResponse<Session> = await apiClient.get(`/console/api/edu/sessions/${id}`)

    if (response.result !== 'success' || !response.data) {
      throw new Error(response.message || 'Failed to get session')
    }

    return response.data
  }

  /**
   * Update a session
   */
  async updateSession(id: string, data: UpdateSessionRequest): Promise<Session> {
    const response: ApiResponse<Session> = await apiClient.put(`/console/api/edu/sessions/${id}`, data)

    if (response.result !== 'success' || !response.data) {
      throw new Error(response.message || 'Failed to update session')
    }

    return response.data
  }

  /**
   * Delete a session (async task)
   * Also deletes all resources created by members
   */
  async deleteSession(id: string): Promise<DeleteSessionResponse> {
    const response: ApiResponse<DeleteSessionResponse> = await apiClient.delete(`/console/api/edu/sessions/${id}`)

    if (response.result !== 'success' || !response.data) {
      throw new Error(response.message || 'Failed to start session deletion')
    }

    return response.data
  }

  /**
   * Get session deletion task status
   */
  async getSessionDeleteStatus(sessionId: string, taskId: string): Promise<SessionDeleteStatus> {
    const response: ApiResponse<SessionDeleteStatus> = await apiClient.get(
      `/console/api/edu/sessions/${sessionId}/delete-status/${taskId}`,
    )

    if (response.result !== 'success' || !response.data) {
      throw new Error(response.message || 'Failed to get deletion status')
    }

    return response.data
  }

  /**
   * Get session members
   */
  async getSessionMembers(sessionId: string): Promise<SessionMember[]> {
    const response: ApiResponse<SessionMember[]> = await apiClient.get(`/console/api/edu/sessions/${sessionId}/members`)

    if (response.result !== 'success' || !response.data) {
      throw new Error(response.message || 'Failed to get session members')
    }

    return response.data
  }

  /**
   * Add a member to session
   */
  async addSessionMember(sessionId: string, accountId: string): Promise<void> {
    const response: ApiResponse<void> = await apiClient.post(
      `/console/api/edu/sessions/${sessionId}/members`,
      { account_id: accountId },
    )

    if (response.result !== 'success') {
      throw new Error(response.message || 'Failed to add member')
    }
  }

  /**
   * Remove a member from session (async task)
   * Also removes all resources created by the member
   */
  async removeSessionMember(sessionId: string, accountId: string): Promise<RemoveMemberResponse> {
    const response: ApiResponse<RemoveMemberResponse> = await apiClient.delete(
      `/console/api/edu/sessions/${sessionId}/members/${accountId}`,
    )

    if (response.result !== 'success' || !response.data) {
      throw new Error(response.message || 'Failed to start member removal')
    }

    return response.data
  }

  /**
   * Get member removal task status
   */
  async getMemberRemoveStatus(
    sessionId: string,
    accountId: string,
    taskId: string,
  ): Promise<MemberRemoveStatus> {
    const response: ApiResponse<MemberRemoveStatus> = await apiClient.get(
      `/console/api/edu/sessions/${sessionId}/members/${accountId}/remove-status/${taskId}`,
    )

    if (response.result !== 'success' || !response.data) {
      throw new Error(response.message || 'Failed to get removal status')
    }

    return response.data
  }

  // ============================================================================
  // Session Resource Management
  // ============================================================================

  /**
   * Get session resources (apps and datasets)
   */
  async getSessionResources(
    sessionId: string,
    params?: { resource_type?: string, account_id?: string },
  ): Promise<SessionResourcesResponse> {
    const searchParams = new URLSearchParams()
    if (params?.resource_type)
      searchParams.append('resource_type', params.resource_type)
    if (params?.account_id)
      searchParams.append('account_id', params.account_id)

    const query = searchParams.toString()
    const url = `/console/api/edu/sessions/${sessionId}/resources${query ? `?${query}` : ''}`

    const response: ApiResponse<SessionResourcesResponse> = await apiClient.get(url)

    if (response.result !== 'success' || !response.data) {
      throw new Error(response.message || 'Failed to get session resources')
    }

    return response.data
  }

  /**
   * Get accounts that have resources in a session
   */
  async getResourceAccounts(sessionId: string): Promise<ResourceAccount[]> {
    const response: ApiResponse<ResourceAccount[]> = await apiClient.get(
      `/console/api/edu/sessions/${sessionId}/resources/accounts`,
    )

    if (response.result !== 'success' || !response.data) {
      throw new Error(response.message || 'Failed to get resource accounts')
    }

    return response.data
  }

  /**
   * Delete session resources (async task)
   */
  async deleteSessionResources(
    sessionId: string,
    accountId?: string,
  ): Promise<DeleteResourcesResponse> {
    // Use query param for account_id filter instead of body
    const params = new URLSearchParams()
    if (accountId)
      params.append('account_id', accountId)

    const query = params.toString()
    const url = `/console/api/edu/sessions/${sessionId}/resources${query ? `?${query}` : ''}`

    const response: ApiResponse<DeleteResourcesResponse> = await apiClient.delete(url)

    if (response.result !== 'success' || !response.data) {
      throw new Error(response.message || 'Failed to start resource deletion')
    }

    return response.data
  }

  /**
   * Get delete task status
   */
  async getDeleteStatus(sessionId: string, taskId: string): Promise<DeleteStatus> {
    const response: ApiResponse<DeleteStatus> = await apiClient.get(
      `/console/api/edu/sessions/${sessionId}/resources/delete-status/${taskId}`,
    )

    if (response.result !== 'success' || !response.data) {
      throw new Error(response.message || 'Failed to get delete status')
    }

    return response.data
  }
}

export const sessionAPI = new SessionAPI()
