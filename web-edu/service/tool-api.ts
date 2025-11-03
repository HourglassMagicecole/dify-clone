import { apiClient, type ApiResponse } from './base-api'
import type { Tool, ToolProvider } from '@/types/tool'

export interface ToolTestResultItem {
  type: string
  message?: string
  blob_base64?: string
  mime_type?: string
  filename?: string
}

export interface ToolTestResult {
  success: boolean
  results: ToolTestResultItem[]
  error?: string
}

export interface UserToolConfig {
  id: string
  user_id: string
  provider: string
  api_key_masked: string
  config_json?: Record<string, unknown>
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface CreateUserToolConfigRequest {
  provider: string
  api_key: string
  config_json?: Record<string, unknown>
}

export interface UpdateUserToolConfigRequest {
  api_key?: string
  config_json?: Record<string, unknown>
  is_active?: boolean
}

/**
 * List all available tool providers and their tools
 */
export const listTools = async (): Promise<ApiResponse<ToolProvider[]>> => {
  return apiClient.get<ToolProvider[]>('/console/api/education/tools')
}

/**
 * Get detailed information about a specific tool
 */
export const getToolDetail = async (
  provider: string,
  toolName: string,
): Promise<ApiResponse<Tool>> => {
  return apiClient.get<Tool>(`/console/api/education/tools/${provider}/${toolName}`)
}

/**
 * Test a tool with provided parameters
 */
export const testTool = async (
  provider: string,
  toolName: string,
  parameters: Record<string, unknown>,
): Promise<ApiResponse<ToolTestResult>> => {
  return apiClient.post<ToolTestResult>(
    `/console/api/education/tools/${provider}/${toolName}/test`,
    { parameters },
  )
}

/**
 * List all user tool configurations
 */
export const listUserToolConfigs = async (
  provider?: string,
): Promise<ApiResponse<UserToolConfig[]>> => {
  const url = provider
    ? `/console/api/education/user-tool-configs?provider=${encodeURIComponent(provider)}`
    : '/console/api/education/user-tool-configs'
  return apiClient.get<UserToolConfig[]>(url)
}

/**
 * Get a specific user tool configuration
 */
export const getUserToolConfig = async (
  configId: string,
): Promise<ApiResponse<UserToolConfig>> => {
  return apiClient.get<UserToolConfig>(`/console/api/education/user-tool-configs/${configId}`)
}

/**
 * Create a new user tool configuration
 */
export const createUserToolConfig = async (
  data: CreateUserToolConfigRequest,
): Promise<ApiResponse<UserToolConfig>> => {
  return apiClient.post<UserToolConfig>('/console/api/education/user-tool-configs', data)
}

/**
 * Update a user tool configuration
 */
export const updateUserToolConfig = async (
  configId: string,
  data: UpdateUserToolConfigRequest,
): Promise<ApiResponse<UserToolConfig>> => {
  return apiClient.put<UserToolConfig>(`/console/api/education/user-tool-configs/${configId}`, data)
}

/**
 * Delete a user tool configuration
 */
export const deleteUserToolConfig = async (
  configId: string,
): Promise<ApiResponse<{ message: string }>> => {
  return apiClient.delete<{ message: string }>(`/console/api/education/user-tool-configs/${configId}`)
}
