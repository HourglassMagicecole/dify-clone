/**
 * Education session API client
 */

import { apiClient, type ApiResponse } from './base-api'
import type {
  CreateSessionRequest,
  Session,
  SessionListResponse,
  SessionMember,
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
   * Delete a session
   */
  async deleteSession(id: string): Promise<void> {
    const response: ApiResponse<void> = await apiClient.delete(`/console/api/edu/sessions/${id}`)

    if (response.result !== 'success') {
      throw new Error(response.message || 'Failed to delete session')
    }
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
   * Remove a member from session
   */
  async removeSessionMember(sessionId: string, accountId: string): Promise<void> {
    const response: ApiResponse<void> = await apiClient.delete(
      `/console/api/edu/sessions/${sessionId}/members/${accountId}`,
    )

    if (response.result !== 'success') {
      throw new Error(response.message || 'Failed to remove member')
    }
  }
}

export const sessionAPI = new SessionAPI()
