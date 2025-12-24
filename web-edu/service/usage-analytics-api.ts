/**
 * Usage Analytics API Client
 * API client for usage analytics and cost reporting.
 */

import { apiClient, ApiResponse } from './base-api'

// ============================================================
// Types
// ============================================================

export interface UsageSummary {
  usage_type: string
  request_count: number
  total_input_tokens: number
  total_output_tokens: number
  total_tokens: number
  total_price: string
  currency: string
}

export interface DailyUsage {
  date: string
  usage_type: string
  request_count: number
  total_tokens: number
  total_price: string
}

export interface UserUsage {
  account_id: string
  account_name: string
  usage_type: string
  request_count: number
  total_tokens: number
  total_price: string
}

export interface ModelUsage {
  model_provider: string
  model_id: string
  usage_type: string
  request_count: number
  total_tokens: number
  total_price: string
}

export interface UsageLogEntry {
  id: string
  created_at: string
  model_provider: string | null
  model_id: string | null
  usage_type: string
  app_name: string | null
  input_tokens: number
  output_tokens: number
  total_tokens: number
  total_price: string
  currency: string
  invoke_source: string | null
}

export interface UsageLogsResponse {
  items: UsageLogEntry[]
  total: number
  limit: number
  offset: number
}

// ============================================================
// Admin APIs (session analytics)
// ============================================================

/**
 * Get usage summary for an education session.
 */
export async function getSessionUsageSummary(
  sessionId: string,
  startDate?: string,
  endDate?: string,
): Promise<ApiResponse<UsageSummary[]>> {
  const params = new URLSearchParams()
  if (startDate) params.set('start_date', startDate)
  if (endDate) params.set('end_date', endDate)

  const queryString = params.toString()
  const endpoint = `/console/api/edu/usage-analytics/sessions/${sessionId}/summary${queryString ? `?${queryString}` : ''}`

  return apiClient.get<UsageSummary[]>(endpoint)
}

/**
 * Get daily usage trend for an education session.
 */
export async function getSessionDailyTrend(
  sessionId: string,
  startDate: string,
  endDate: string,
  usageType?: string,
): Promise<ApiResponse<DailyUsage[]>> {
  const params = new URLSearchParams({
    start_date: startDate,
    end_date: endDate,
  })
  if (usageType) params.set('usage_type', usageType)

  const endpoint = `/console/api/edu/usage-analytics/sessions/${sessionId}/daily-trend?${params.toString()}`

  return apiClient.get<DailyUsage[]>(endpoint)
}

/**
 * Get per-user usage breakdown for an education session.
 */
export async function getSessionUserBreakdown(
  sessionId: string,
  startDate?: string,
  endDate?: string,
  usageType?: string,
): Promise<ApiResponse<UserUsage[]>> {
  const params = new URLSearchParams()
  if (startDate) params.set('start_date', startDate)
  if (endDate) params.set('end_date', endDate)
  if (usageType) params.set('usage_type', usageType)

  const queryString = params.toString()
  const endpoint = `/console/api/edu/usage-analytics/sessions/${sessionId}/users${queryString ? `?${queryString}` : ''}`

  return apiClient.get<UserUsage[]>(endpoint)
}

/**
 * Get per-model usage breakdown for an education session.
 */
export async function getSessionModelBreakdown(
  sessionId: string,
  startDate?: string,
  endDate?: string,
): Promise<ApiResponse<ModelUsage[]>> {
  const params = new URLSearchParams()
  if (startDate) params.set('start_date', startDate)
  if (endDate) params.set('end_date', endDate)

  const queryString = params.toString()
  const endpoint = `/console/api/edu/usage-analytics/sessions/${sessionId}/models${queryString ? `?${queryString}` : ''}`

  return apiClient.get<ModelUsage[]>(endpoint)
}

/**
 * Get detailed usage logs for a specific user in a session.
 */
export async function getUserUsageLogs(
  sessionId: string,
  accountId: string,
  startDate?: string,
  endDate?: string,
  usageType?: string,
  limit: number = 1000,
  offset: number = 0,
): Promise<ApiResponse<UsageLogsResponse>> {
  const params = new URLSearchParams({
    limit: limit.toString(),
    offset: offset.toString(),
  })
  if (startDate) params.set('start_date', startDate)
  if (endDate) params.set('end_date', endDate)
  if (usageType) params.set('usage_type', usageType)

  const endpoint = `/console/api/edu/usage-analytics/sessions/${sessionId}/users/${accountId}/logs?${params.toString()}`

  return apiClient.get<UsageLogsResponse>(endpoint)
}

// ============================================================
// User Self-Service APIs
// ============================================================

/**
 * Get current user's own usage summary.
 */
export async function getMyUsageSummary(
  sessionId?: string,
  startDate?: string,
  endDate?: string,
): Promise<ApiResponse<UsageSummary[]>> {
  const params = new URLSearchParams()
  if (sessionId) params.set('session_id', sessionId)
  if (startDate) params.set('start_date', startDate)
  if (endDate) params.set('end_date', endDate)

  const queryString = params.toString()
  const endpoint = `/console/api/edu/usage-analytics/my-usage/summary${queryString ? `?${queryString}` : ''}`

  return apiClient.get<UsageSummary[]>(endpoint)
}

/**
 * Get current user's daily usage for the last N days.
 */
export async function getMyDailyUsage(sessionId?: string, days: number = 30): Promise<ApiResponse<DailyUsage[]>> {
  const params = new URLSearchParams({
    days: days.toString(),
  })
  if (sessionId) params.set('session_id', sessionId)

  const endpoint = `/console/api/edu/usage-analytics/my-usage/daily?${params.toString()}`

  return apiClient.get<DailyUsage[]>(endpoint)
}
