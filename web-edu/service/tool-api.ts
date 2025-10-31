import { apiClient, type ApiResponse } from './base-api'
import type { Tool, ToolProvider } from '@/types/tool'

export interface ToolTestResult {
  success: boolean
  results: unknown[]
  error?: string
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
