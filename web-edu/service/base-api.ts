import { getAccessToken } from '@/utils/storage'

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:5001'

export interface ApiResponse<T> {
  result: 'success' | 'fail'
  data?: T
  message?: string
  code?: string
}

export class ApiClient {
  private baseUrl: string

  constructor(baseUrl: string = API_BASE_URL) {
    this.baseUrl = baseUrl
  }

  /**
   * Get headers with current access token
   * Token is fetched fresh on every request to handle token refresh automatically
   */
  private getHeaders(): HeadersInit {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    }

    const token = getAccessToken()
    if (token) {
      headers['Authorization'] = `Bearer ${token}`
    }

    return headers
  }

  /**
   * @deprecated Use getHeaders() instead. This method is kept for backward compatibility.
   */
  setAuthToken(_token: string) {
    // No-op: Token is now fetched dynamically on each request
    console.warn('ApiClient.setAuthToken() is deprecated and has no effect. Tokens are now fetched automatically.')
  }

  async get<T>(endpoint: string): Promise<ApiResponse<T>> {
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      method: 'GET',
      headers: this.getHeaders(),
    })

    if (!response.ok) {
      throw new Error(`API Error: ${response.status} ${response.statusText}`)
    }

    return response.json()
  }

  async post<T>(endpoint: string, data: unknown): Promise<ApiResponse<T>> {
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(data),
    })

    if (!response.ok) {
      throw new Error(`API Error: ${response.status} ${response.statusText}`)
    }

    return response.json()
  }

  async put<T>(endpoint: string, data: unknown): Promise<ApiResponse<T>> {
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      method: 'PUT',
      headers: this.getHeaders(),
      body: JSON.stringify(data),
    })

    if (!response.ok) {
      throw new Error(`API Error: ${response.status} ${response.statusText}`)
    }

    return response.json()
  }

  async delete<T>(endpoint: string): Promise<ApiResponse<T>> {
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      method: 'DELETE',
      headers: this.getHeaders(),
    })

    if (!response.ok) {
      throw new Error(`API Error: ${response.status} ${response.statusText}`)
    }

    return response.json()
  }
}

export const apiClient = new ApiClient()
