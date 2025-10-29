/**
 * Agent API Client
 * Handles all API calls related to Agent creation and management
 */

import { apiClient } from './base-api'
import {
  Agent,
  CreateAgentRequest,
  CreateAgentResponse,
  GetAgentsResponse,
  AgentBasicSettings,
} from '@/types/agent'

/**
 * Agent API Service
 */
export class AgentAPIService {
  /**
   * Create a new Agent
   * Uses Dify's POST /console/apps endpoint
   */
  async createAgent(settings: AgentBasicSettings): Promise<Agent> {
    const payload: CreateAgentRequest = {
      name: settings.name,
      description: settings.description,
      mode: settings.mode,
      icon_type: settings.icon_type,
      icon: settings.icon,
      icon_background: settings.icon_background,
    }

    const response = await apiClient.post<CreateAgentResponse['data']>(
      '/console/apps',
      payload
    )

    if (response.result !== 'success' || !response.data) {
      throw new Error(response.message || 'Failed to create agent')
    }

    return response.data
  }

  /**
   * Get list of Agents
   * Uses Dify's GET /console/apps endpoint
   */
  async getAgents(filters?: {
    page?: number
    limit?: number
  }): Promise<GetAgentsResponse> {
    const params = new URLSearchParams()
    if (filters?.page) {
      params.append('page', String(filters.page))
    }
    if (filters?.limit) {
      params.append('limit', String(filters.limit))
    }

    const queryString = params.toString()
    const endpoint = queryString ? `/console/apps?${queryString}` : '/console/apps'

    const response = await apiClient.get<{
      data: Agent[]
      total: number
      page?: number
      limit?: number
    }>(endpoint)

    if (response.result !== 'success' || !response.data) {
      throw new Error(response.message || 'Failed to fetch agents')
    }

    return response.data
  }

  /**
   * Get Agent by ID
   */
  async getAgent(id: string): Promise<Agent> {
    const response = await apiClient.get<Agent>(`/console/apps/${id}`)

    if (response.result !== 'success' || !response.data) {
      throw new Error(response.message || 'Failed to fetch agent')
    }

    return response.data
  }

  /**
   * Update Agent
   */
  async updateAgent(id: string, updates: Partial<AgentBasicSettings>): Promise<Agent> {
    const response = await apiClient.put<Agent>(`/console/apps/${id}`, updates)

    if (response.result !== 'success' || !response.data) {
      throw new Error(response.message || 'Failed to update agent')
    }

    return response.data
  }

  /**
   * Delete Agent
   */
  async deleteAgent(id: string): Promise<void> {
    const response = await apiClient.delete<void>(`/console/apps/${id}`)

    if (response.result !== 'success') {
      throw new Error(response.message || 'Failed to delete agent')
    }
  }
}

/**
 * Singleton instance
 */
export const agentAPI = new AgentAPIService()
