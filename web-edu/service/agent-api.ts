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
  UpdateAgentRequest,
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
   * Uses Dify's GET /console/api/apps endpoint with server-side pagination
   */
  async getAgents(filters?: {
    page?: number
    limit?: number
    session_id?: string
    admin_id?: string
  }): Promise<GetAgentsResponse> {
    const params = new URLSearchParams()
    // Default pagination values
    params.append('page', String(filters?.page || 1))
    params.append('limit', String(filters?.limit || 20))

    if (filters?.session_id) {
      params.append('session_id', filters.session_id)
    }
    if (filters?.admin_id) {
      params.append('admin_id', filters.admin_id)
    }

    const endpoint = `/console/api/apps?${params.toString()}`

    // Backend returns paginated response: {data, total, page, limit, has_more}
    const response = await apiClient.getDifyNative<GetAgentsResponse>(endpoint)

    if (response.result !== 'success' || !response.data) {
      throw new Error(response.message || 'Failed to fetch agents')
    }

    // getDifyNative wraps the response, so response.data is already GetAgentsResponse
    // Check if response.data has the pagination structure
    if ('data' in response.data && Array.isArray(response.data.data)) {
      // Backend pagination response
      return response.data as GetAgentsResponse
    }

    // Fallback for old format (shouldn't happen)
    return {
      data: Array.isArray(response.data) ? response.data : [],
      total: Array.isArray(response.data) ? response.data.length : 0,
      page: 1,
      limit: 20,
      has_more: false,
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
   * Update Agent basic info (name, description, icon)
   * Uses Dify's PUT /console/api/apps/{id} endpoint
   */
  async updateAgent(id: string, updates: UpdateAgentRequest): Promise<Agent> {
    const response = await apiClient.putDifyNative<Agent>(`/console/api/apps/${id}`, updates)

    if (response.result !== 'success' || !response.data) {
      throw new Error(response.message || 'Failed to update agent')
    }

    return response.data
  }

  /**
   * Update Agent model configuration (LLM settings, prompts, tools)
   * Uses Dify's POST /console/api/apps/{id}/model-config endpoint
   */
  async updateModelConfig(id: string, modelConfig: Record<string, unknown>): Promise<void> {
    const response = await apiClient.post<void>(`/console/api/apps/${id}/model-config`, modelConfig)

    if (response.result !== 'success') {
      throw new Error(response.message || 'Failed to update model config')
    }
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

  /**
   * Copy (Duplicate) Agent
   * Uses Dify's POST /console/api/apps/{app_id}/copy endpoint
   */
  async copyAgent(id: string, name?: string): Promise<Agent> {
    const payload: { name?: string } = {}
    if (name) {
      payload.name = name
    }

    const response = await apiClient.postDifyNative<Agent>(
      `/console/api/apps/${id}/copy`,
      payload
    )

    if (response.result !== 'success' || !response.data) {
      throw new Error(response.message || 'Failed to copy agent')
    }

    return response.data
  }
}

/**
 * Singleton instance
 */
export const agentAPI = new AgentAPIService()
