import { getAccessToken } from '@/utils/storage'

const API_BASE_URL = (() => {
  const envUrl = process.env.NEXT_PUBLIC_API_BASE_URL

  // 환경 변수가 명시적으로 설정된 경우 (빈 문자열 포함)
  // Docker/Production에서는 빈 문자열로 설정하여 상대 경로 사용
  if (envUrl !== undefined) {
    return envUrl
  }

  // 환경 변수가 없으면 로컬 개발 기본값
  return 'http://localhost:5001'
})()

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

    // 204 No Content는 body가 없으므로 빈 객체 반환
    if (response.status === 204) {
      return { result: 'success' } as ApiResponse<T>
    }

    return response.json()
  }

  /**
   * GET request for Dify native API (returns data directly without result wrapper)
   * Use this for endpoints that return { data: ... } instead of { result: 'success', data: ... }
   * Note: This unwraps json.data, so pagination metadata (total, page, etc.) is lost.
   * Use getDifyNativeFull() for paginated responses.
   */
  async getDifyNative<T>(endpoint: string): Promise<ApiResponse<T>> {
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      method: 'GET',
      headers: this.getHeaders(),
    })

    if (!response.ok) {
      throw new Error(`API Error: ${response.status} ${response.statusText}`)
    }

    const json = await response.json()

    // Wrap native Dify response in our standard format
    return {
      result: 'success',
      data: json.data || json,
    }
  }

  /**
   * GET request for Dify native API that preserves the full response
   * Use this for paginated endpoints that return { data: [...], total, page, limit, has_more }
   */
  async getDifyNativeFull<T>(endpoint: string): Promise<ApiResponse<T>> {
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      method: 'GET',
      headers: this.getHeaders(),
    })

    if (!response.ok) {
      throw new Error(`API Error: ${response.status} ${response.statusText}`)
    }

    const json = await response.json()

    // Return the full response without unwrapping
    return {
      result: 'success',
      data: json,
    }
  }

  /**
   * POST request for Dify native API (returns data directly without result wrapper)
   * Use this for endpoints that return app object directly instead of { result: 'success', data: ... }
   */
  async postDifyNative<T>(endpoint: string, data: unknown): Promise<ApiResponse<T>> {
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(data),
    })

    if (!response.ok) {
      throw new Error(`API Error: ${response.status} ${response.statusText}`)
    }

    const json = await response.json()

    // Wrap native Dify response in our standard format
    return {
      result: 'success',
      data: json.data || json,
    }
  }

  /**
   * PUT request for Dify native API (returns data directly without result wrapper)
   * Use this for endpoints that return app object directly instead of { result: 'success', data: ... }
   */
  async putDifyNative<T>(endpoint: string, data: unknown): Promise<ApiResponse<T>> {
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      method: 'PUT',
      headers: this.getHeaders(),
      body: JSON.stringify(data),
    })

    if (!response.ok) {
      throw new Error(`API Error: ${response.status} ${response.statusText}`)
    }

    const json = await response.json()

    // Wrap native Dify response in our standard format
    return {
      result: 'success',
      data: json.data || json,
    }
  }

  /**
   * DELETE request for Dify native API
   */
  async deleteDifyNative<T>(endpoint: string): Promise<ApiResponse<T>> {
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      method: 'DELETE',
      headers: this.getHeaders(),
    })

    if (!response.ok) {
      throw new Error(`API Error: ${response.status} ${response.statusText}`)
    }

    // DELETE often returns empty body or 204
    if (response.status === 204 || response.headers.get('content-length') === '0') {
      return { result: 'success' } as ApiResponse<T>
    }

    const json = await response.json()
    return {
      result: 'success',
      data: json.data || json,
    }
  }
}

export const apiClient = new ApiClient()
