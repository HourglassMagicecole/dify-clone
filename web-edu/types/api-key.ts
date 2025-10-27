// API Key Management Types for Story 1.8

// Provider Types (Subtask 1.1)
// Note: Azure OpenAI requires additional configuration (endpoint, deployment)
// and will be supported in a future story
export type ProviderType = 'openai' | 'anthropic' | 'google' | 'cohere'

export const SUPPORTED_PROVIDERS: ProviderType[] = [
  'openai',
  'anthropic',
  'google',
  'cohere',
]

// Priority Types
export type PriorityType = 'primary' | 'secondary' | 'tertiary'

// APIKeyConfig Interface (Subtask 1.2)
export interface APIKeyConfig {
  id: string
  key_name: string
  provider: ProviderType
  api_key_masked: string // 마스킹된 키 (목록 표시용)
  is_active: boolean
  priority: PriorityType
  created_by: string
  created_at: string
  updated_at: string
}

// API Request/Response Types (Subtask 1.3)
export interface CreateAPIKeyRequest {
  key_name: string
  provider: ProviderType
  api_key: string // 평문 (암호화는 백엔드에서)
  priority: PriorityType
}

export interface UpdateAPIKeyRequest {
  key_name?: string
  priority?: PriorityType
  is_active?: boolean
}

export interface TestAPIKeyResponse {
  success: boolean
  message: string
  response_time_ms?: number
  error_code?: string
}

// Provider Metadata (Subtask 1.4)
export interface ProviderMetadata {
  name: string
  guide_url: string
  pricing_url: string
  free_tier: string
  icon: string
}

export const PROVIDER_METADATA: Record<ProviderType, ProviderMetadata> = {
  openai: {
    name: 'OpenAI',
    guide_url: 'https://platform.openai.com/api-keys',
    pricing_url: 'https://openai.com/pricing',
    free_tier: '$5 free credit',
    icon: '/icons/openai.svg',
  },
  anthropic: {
    name: 'Anthropic',
    guide_url: 'https://console.anthropic.com/settings/keys',
    pricing_url: 'https://www.anthropic.com/pricing',
    free_tier: 'No free tier',
    icon: '/icons/anthropic.svg',
  },
  google: {
    name: 'Google AI',
    guide_url: 'https://ai.google.dev/tutorials/setup',
    pricing_url: 'https://ai.google.dev/pricing',
    free_tier: 'Free tier available',
    icon: '/icons/google.svg',
  },
  cohere: {
    name: 'Cohere',
    guide_url: 'https://dashboard.cohere.com/api-keys',
    pricing_url: 'https://cohere.com/pricing',
    free_tier: 'Trial API available',
    icon: '/icons/cohere.svg',
  },
}
