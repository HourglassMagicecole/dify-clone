/**
 * Agent API Client
 * Handles all API calls related to Agent creation and management
 */

import { apiClient } from './base-api'
import {
  Agent,
  CreateAgentRequest,
  GetAgentsResponse,
  AgentBasicSettings,
} from '@/types/agent'

/**
 * Agent API Service
 */
export class AgentAPIService {
  /**
   * Create a new Agent
   * Uses Dify's POST /console/api/apps endpoint
   */
  async createAgent(settings: AgentBasicSettings, sessionId?: string): Promise<Agent> {
    const payload: CreateAgentRequest = {
      name: settings.name,
      description: settings.description,
      mode: settings.mode,
      icon_type: settings.icon_type,
      icon: settings.icon,
      icon_background: settings.icon_background,
      session_id: sessionId, // Add session_id for SessionResourceTag
    }

    const response = await apiClient.postDifyNative<Agent>(
      '/console/api/apps',
      payload
    )

    if (response.result !== 'success' || !response.data) {
      throw new Error(response.message || 'Failed to create agent')
    }

    return response.data
  }

  /**
   * Get list of Agents
   * Uses Dify's GET /console/api/apps endpoint
   */
  async getAgents(filters?: {
    page?: number
    limit?: number
    session_id?: string
  }): Promise<GetAgentsResponse> {
    const params = new URLSearchParams()
    if (filters?.page) {
      params.append('page', String(filters.page))
    }
    if (filters?.limit) {
      params.append('limit', String(filters.limit))
    }
    if (filters?.session_id) {
      params.append('session_id', filters.session_id)
    }

    const queryString = params.toString()
    const endpoint = queryString ? `/console/api/apps?${queryString}` : '/console/api/apps'

    const response = await apiClient.getDifyNative<Agent[]>(endpoint)

    if (response.result !== 'success' || !response.data) {
      throw new Error(response.message || 'Failed to fetch agents')
    }

    // Wrap in GetAgentsResponse format
    return {
      data: response.data,
      total: response.data.length,
    }
  }

  /**
   * Get Agent by ID
   */
  async getAgent(id: string): Promise<Agent> {
    const response = await apiClient.getDifyNative<Agent>(`/console/api/apps/${id}`)

    if (response.result !== 'success' || !response.data) {
      throw new Error(response.message || 'Failed to fetch agent')
    }

    return response.data
  }

  /**
   * Update Agent
   */
  async updateAgent(id: string, updates: Partial<AgentBasicSettings>): Promise<Agent> {
    const response = await apiClient.put<Agent>(`/console/api/apps/${id}`, updates)

    if (response.result !== 'success' || !response.data) {
      throw new Error(response.message || 'Failed to update agent')
    }

    return response.data
  }

  /**
   * Delete Agent
   */
  async deleteAgent(id: string): Promise<void> {
    const response = await apiClient.delete<void>(`/console/api/apps/${id}`)

    if (response.result !== 'success') {
      throw new Error(response.message || 'Failed to delete agent')
    }
  }
}

/**
 * Singleton instance
 */
export const agentAPI = new AgentAPIService()
