/**
 * Model Management Types for EduAI Studio (Story 3.7)
 *
 * Type definitions for model activation management feature
 * [Source: api/controllers/console/workspace/models.py]
 */

/**
 * Model Type enum (Dify API와 일치)
 */
export type ModelType = 'llm' | 'text-embedding' | 'rerank' | 'speech2text' | 'tts'

/**
 * Model status from provider_model_settings table
 */
export interface ModelStatus {
  model: string
  model_type: ModelType
  enabled: boolean
  load_balancing_enabled: boolean
}

/**
 * Model status values from Dify API
 * [Source: api/core/entities/model_entities.py - ModelStatus]
 */
export type ModelStatusValue = 'active' | 'disabled' | 'no-configure' | 'quota-exceeded' | 'no-permission' | 'credential-removed'

/**
 * Individual model in a provider
 */
export interface ProviderModel {
  model: string
  label: {
    en_US: string
    zh_Hans?: string
  }
  model_type: ModelType
  features?: string[]
  fetch_from: string
  model_properties: Record<string, unknown>
  deprecated: boolean
  status: ModelStatusValue
}

/**
 * Provider with models
 */
export interface ProviderWithModels {
  provider: string
  label: {
    en_US: string
    zh_Hans?: string
  }
  icon_small: {
    en_US: string
  }
  icon_large: {
    en_US: string
  }
  supported_model_types: ModelType[]
  models: ProviderModel[]
  // Dify API: 프로바이더 설정 상태
  custom_configuration?: {
    status: 'active' | 'no-configure'
  }
  // EduAI 확장: 프로바이더 전체 활성화 상태
  all_enabled?: boolean
}

/**
 * API request for model enable/disable
 */
export interface ModelToggleRequest {
  model: string
  model_type: ModelType
}

/**
 * Model filter options
 */
export interface ModelFilterOptions {
  modelType: ModelType | 'all'
  showDisabled: boolean
}
