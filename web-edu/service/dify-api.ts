import { apiClient, type ApiResponse } from './base-api'
import type { ModelProvider, CreateAppRequest, DifyApp } from '@/types/agent'

export interface App {
  id: string
  name: string
  mode: string
  icon: string
  icon_background: string
  created_at: number
  updated_at: number
}

export class DifyAPI {
  // App (Agent) 관련 API
  async getApps(sessionId?: string): Promise<ApiResponse<App[]>> {
    const params = sessionId ? `?session_id=${sessionId}` : ''
    return apiClient.getDifyNative(`/console/api/apps${params}`)
  }

  async createApp(data: { name: string; mode: string; icon: string }): Promise<ApiResponse<App>> {
    return apiClient.post('/console/api/apps', data)
  }

  /**
   * Create Agent with full configuration (for Agent Wizard)
   * @param data Full agent configuration including prompts, model, and tools
   * @returns Created agent data
   */
  async createAppWithConfig(data: CreateAppRequest): Promise<ApiResponse<DifyApp>> {
    return apiClient.postDifyNative('/console/api/apps', data)
  }

  async getApp(appId: string): Promise<ApiResponse<App>> {
    return apiClient.get(`/console/api/apps/${appId}`)
  }

  async getDifyApp(appId: string): Promise<ApiResponse<DifyApp>> {
    return apiClient.getDifyNative(`/console/api/apps/${appId}`)
  }

  async updateApp(appId: string, data: Partial<App>): Promise<ApiResponse<App>> {
    return apiClient.put(`/console/api/apps/${appId}`, data)
  }

  async deleteApp(appId: string): Promise<ApiResponse<void>> {
    return apiClient.delete(`/console/api/apps/${appId}`)
  }

  // Model Provider 관련 API
  async getModelProviders(): Promise<ApiResponse<ModelProvider[]>> {
    return apiClient.getDifyNative('/console/api/workspaces/current/model-providers')
  }

  // Get models list for a specific provider
  async getProviderModels(provider: string): Promise<ApiResponse<ModelProvider>> {
    return apiClient.getDifyNative(`/console/api/workspaces/current/model-providers/${provider}/models`)
  }

  // Get parameter rules for a specific model
  async getModelParameterRules(provider: string, model: string): Promise<ApiResponse<unknown>> {
    return apiClient.getDifyNative(`/console/api/workspaces/current/model-providers/${provider}/models/parameter-rules?model=${encodeURIComponent(model)}`)
  }

  // 추후 Dataset, Workflow API 추가 예정
}

export const difyAPI = new DifyAPI()
