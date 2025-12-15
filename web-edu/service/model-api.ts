import type { ApiResponse } from './base-api'
import { apiClient } from './base-api'
import type { ModelToggleRequest, ProviderModel, ProviderWithModels } from '@/types/model'

/**
 * Model item from provider models API
 * Uses ProviderModel type from @/types/model for consistency
 */
type ProviderModelItem = ProviderModel

/**
 * Model Management API for EduAI Studio (Story 3.7)
 * Wraps Dify's model provider API with Owner-only access
 *
 * [Source: api/controllers/console/workspace/models.py]
 */
export class ModelAPI {
  // Cache for provider full paths
  private providerPathCache: Map<string, string> = new Map()

  /**
   * Get all providers
   * GET /console/api/workspaces/current/model-providers
   */
  async getProviders(): Promise<ApiResponse<ProviderWithModels[]>> {
    return apiClient.getDifyNative('/console/api/workspaces/current/model-providers')
  }

  /**
   * Helper to match provider name (API returns paths like 'langgenius/openai/openai')
   */
  private matchProvider(apiProvider: string, targetProvider: string): boolean {
    return apiProvider === targetProvider
      || apiProvider.endsWith(`/${targetProvider}`)
      || apiProvider.includes(`/${targetProvider}/`)
  }

  /**
   * Get full provider path from short name
   * @param shortName - Short provider name (e.g., 'openai')
   * @returns Full provider path (e.g., 'langgenius/openai/openai')
   */
  async getFullProviderPath(shortName: string): Promise<string> {
    // Check cache first
    if (this.providerPathCache.has(shortName)) {
      return this.providerPathCache.get(shortName)!
    }

    // Fetch provider list to find full path
    const response = await this.getProviders()
    const providers = Array.isArray(response.data) ? response.data : []

    for (const p of providers) {
      if (this.matchProvider(p.provider, shortName)) {
        this.providerPathCache.set(shortName, p.provider)
        return p.provider
      }
    }

    // Fallback to short name if not found
    return shortName
  }

  /**
   * Get models for a specific provider (includes disabled models)
   * Uses /model-providers/{fullPath}/models API
   * @param provider - Provider name (e.g., 'openai')
   */
  async getProviderModels(provider: string): Promise<ApiResponse<ProviderModelItem[]>> {
    // Get full provider path
    const fullPath = await this.getFullProviderPath(provider)

    // Fetch models using full provider path
    const response = await apiClient.getDifyNative<ProviderModelItem[]>(
      `/console/api/workspaces/current/model-providers/${fullPath}/models`,
    )

    return {
      result: 'success',
      data: Array.isArray(response.data) ? response.data : [],
    }
  }

  /**
   * Enable a specific model
   * PATCH /console/api/workspaces/current/model-providers/{provider}/models/enable
   * @param provider - Provider name (short or full path)
   * @param request - Model and model_type
   */
  async enableModel(provider: string, request: ModelToggleRequest): Promise<ApiResponse<{ result: string }>> {
    const fullPath = await this.getFullProviderPath(provider)
    return apiClient.patchDifyNative(
      `/console/api/workspaces/current/model-providers/${fullPath}/models/enable`,
      request,
    )
  }

  /**
   * Disable a specific model
   * PATCH /console/api/workspaces/current/model-providers/{provider}/models/disable
   * @param provider - Provider name (short or full path)
   * @param request - Model and model_type
   */
  async disableModel(provider: string, request: ModelToggleRequest): Promise<ApiResponse<{ result: string }>> {
    const fullPath = await this.getFullProviderPath(provider)
    return apiClient.patchDifyNative(
      `/console/api/workspaces/current/model-providers/${fullPath}/models/disable`,
      request,
    )
  }

  /**
   * Toggle model enabled status
   * Convenience method that calls enable or disable based on current state
   * @param provider - Provider name (short or full path)
   * @param model - Model name
   * @param modelType - Model type
   * @param enable - Whether to enable (true) or disable (false)
   */
  async toggleModel(
    provider: string,
    model: string,
    modelType: string,
    enable: boolean,
  ): Promise<ApiResponse<{ result: string }>> {
    const request: ModelToggleRequest = {
      model,
      model_type: modelType as ModelToggleRequest['model_type'],
    }
    return enable ? this.enableModel(provider, request) : this.disableModel(provider, request)
  }

  /**
   * Toggle all models for a provider
   * @param provider - Provider name
   * @param models - Array of models to toggle
   * @param enable - Whether to enable or disable all
   */
  async toggleProviderModels(
    provider: string,
    models: Array<{ model: string, model_type: string }>,
    enable: boolean,
  ): Promise<{ success: number, failed: number }> {
    let success = 0
    let failed = 0

    for (const { model, model_type } of models) {
      try {
        await this.toggleModel(provider, model, model_type, enable)
        success++
      }
      catch {
        failed++
      }
    }

    return { success, failed }
  }
}

export const modelAPI = new ModelAPI()
