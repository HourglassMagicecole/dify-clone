/**
 * Quota types for usage quota management
 */

export interface SessionQuota {
  id: string
  session_id: string
  model_provider: string
  quota_limit: string
  period: 'daily' | 'session' | 'monthly'
  current_usage: string
  usage_percentage: number
  warning_threshold: number
  is_warning: boolean
  is_exceeded: boolean
  is_blocked: boolean
  is_active: boolean
  last_reset_at: string
}

export interface UserQuota {
  id: string
  session_id: string
  account_id: string
  account_name: string
  model_provider: string
  quota_limit: string
  period: 'daily' | 'session' | 'monthly'
  current_usage: string
  usage_percentage: number
  warning_threshold: number
  is_warning: boolean
  is_exceeded: boolean
  is_blocked: boolean
  is_active: boolean
  override_until: string | null
  last_reset_at: string
}

export interface QuotaWarnings {
  session_warning_count: number
  session_blocked: boolean
  session_blocked_providers: string[]
  user_warning_count: number
  user_blocked_count: number
  user_warnings: QuotaWarningUser[]
  user_blocked: QuotaWarningUser[]
}

export interface QuotaWarningUser {
  account_id: string
  account_name: string
  provider: string
  usage_percentage: number
}

export interface AllQuotaWarning {
  type: 'session' | 'user'
  session_id: string
  session_name: string
  account_id: string | null
  account_name: string | null
  model_provider: string
  current_usage: string
  quota_limit: string
  usage_percentage: number
  is_blocked: boolean
  is_warning: boolean
}

export interface AllQuotaWarningsResponse {
  warnings: AllQuotaWarning[]
  total_blocked: number
  total_warning: number
}

export interface SessionQuotasResponse {
  session_quotas: SessionQuota[]
  user_quotas: UserQuota[]
}

export interface SetSessionQuotaRequest {
  model_provider: string
  quota_limit: string
  period: 'daily' | 'session' | 'monthly'
  warning_threshold?: number
}

export interface SetUserQuotaRequest {
  account_id: string
  model_provider: string
  quota_limit: string
  period: 'daily' | 'session' | 'monthly'
  warning_threshold?: number
}

export interface SetDefaultUserQuotaRequest {
  model_provider: string
  quota_limit: string
  period: 'daily' | 'session' | 'monthly'
  warning_threshold?: number
}

export interface SetDefaultUserQuotaResponse {
  applied_count: number
  model_provider: string
  quota_limit: string
  period: string
  warning_threshold: number
  quotas: Array<{
    id: string
    account_id: string
    account_name: string
    model_provider: string
    quota_limit: string
    period: string
    current_usage: string
    usage_percentage: number
  }>
}

export interface MyQuotaStatus {
  model_provider: string
  current_usage: string
  quota_limit: string
  usage_percentage: number
  is_warning: boolean
  is_blocked: boolean
  period: string
  reset_at: string | null
}

// Default quota config (auto-apply to new members)
export interface DefaultQuotaConfig {
  id: string
  session_id: string
  model_provider: string
  quota_limit: string
  warning_threshold: number
  created_at: string | null
  updated_at: string | null
}

export interface SetDefaultQuotaConfigRequest {
  model_provider: string
  quota_limit: string
  warning_threshold?: number
  apply_to_existing?: boolean
}

export interface SetDefaultQuotaConfigResponse {
  id: string
  session_id: string
  model_provider: string
  quota_limit: string
  warning_threshold: number
  applied_count: number
}

export interface DeleteUserQuotasByProviderResponse {
  deleted_user_quotas: number
  deleted_default_config: boolean
}
