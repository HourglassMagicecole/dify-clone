import { apiClient, type ApiResponse } from './base-api'

export interface App {
  id: string
  name: string
  mode: string
  icon: string
  icon_background: string
  created_at: string
  updated_at: string
}

export class DifyAPI {
  // App (Agent) 관련 API
  async getApps(): Promise<ApiResponse<{ data: App[] }>> {
    return apiClient.get('/console/api/apps')
  }

  async createApp(data: { name: string; mode: string; icon: string }): Promise<ApiResponse<App>> {
    return apiClient.post('/console/api/apps', data)
  }

  async getApp(appId: string): Promise<ApiResponse<App>> {
    return apiClient.get(`/console/api/apps/${appId}`)
  }

  async updateApp(appId: string, data: Partial<App>): Promise<ApiResponse<App>> {
    return apiClient.put(`/console/api/apps/${appId}`, data)
  }

  async deleteApp(appId: string): Promise<ApiResponse<void>> {
    return apiClient.delete(`/console/api/apps/${appId}`)
  }

  // 추후 Dataset, Workflow API 추가 예정
}

export const difyAPI = new DifyAPI()
