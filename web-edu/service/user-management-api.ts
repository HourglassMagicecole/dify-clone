import type {
  AssignAdminRoleRequest,
  BulkCreateStatus,
  CreateUserRequest,
  UpdateUserRequest,
  UserAccount,
  UserListResponse,
} from '@/types/user-management'
import { getAccessToken } from '@/utils/storage'

/**
 * API 에러 클래스 (error code 포함)
 */
export class APIError extends Error {
  code: string

  constructor(message: string, code: string = 'UNKNOWN_ERROR') {
    super(message)
    this.name = 'APIError'
    this.code = code
  }
}

const BASE_URL = '/console/api/edu/users'

/**
 * 공통 헤더 생성 함수
 */
function getHeaders(includeContentType = true): HeadersInit {
  const headers: HeadersInit = {}
  const token = getAccessToken()

  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }

  if (includeContentType) {
    headers['Content-Type'] = 'application/json'
  }

  return headers
}

export class UserManagementAPI {
  /**
   * 사용자 목록 조회
   */
  static async listUsers(page: number = 1, limit: number = 20): Promise<UserListResponse> {
    const response = await fetch(`${BASE_URL}?page=${page}&limit=${limit}`, {
      credentials: 'include',
      headers: getHeaders(false),
    })
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(`Failed to fetch users (${response.status}): ${errorData.message || response.statusText}`)
    }

    const data = await response.json()
    return data.data
  }

  /**
   * 사용자 생성
   */
  static async createUser(data: CreateUserRequest): Promise<UserAccount> {
    const response = await fetch(BASE_URL, {
      method: 'POST',
      headers: getHeaders(),
      credentials: 'include',
      body: JSON.stringify(data),
    })
    if (!response.ok) {
      const error = await response.json()
      throw new APIError(error.message || 'Failed to create user', error.code || 'UNKNOWN_ERROR')
    }
    const result = await response.json()
    return result.data
  }

  /**
   * 사용자 수정
   */
  static async updateUser(userId: string, data: UpdateUserRequest): Promise<UserAccount> {
    const response = await fetch(`${BASE_URL}/${userId}`, {
      method: 'PUT',
      headers: getHeaders(),
      credentials: 'include',
      body: JSON.stringify(data),
    })
    if (!response.ok) {
      const error = await response.json()
      throw new APIError(error.message || 'Failed to update user', error.code || 'UNKNOWN_ERROR')
    }
    const result = await response.json()
    return result.data
  }

  /**
   * 사용자 삭제
   */
  static async deleteUser(userId: string, deleteResources: boolean = true): Promise<void> {
    const response = await fetch(`${BASE_URL}/${userId}?delete_resources=${deleteResources}`, {
      method: 'DELETE',
      headers: getHeaders(false),
      credentials: 'include',
    })
    if (!response.ok) {
      const error = await response.json()
      throw new APIError(error.message || 'Failed to delete user', error.code || 'UNKNOWN_ERROR')
    }
  }

  /**
   * CSV 일괄 생성
   */
  static async bulkCreateUsers(file: File, sessionId?: string): Promise<string> {
    const formData = new FormData()
    formData.append('file', file)
    if (sessionId)
      formData.append('session_id', sessionId)

    const response = await fetch(`${BASE_URL}/bulk`, {
      method: 'POST',
      headers: getHeaders(false), // FormData는 Content-Type 자동 설정
      credentials: 'include',
      body: formData,
    })
    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.message || 'Failed to start bulk create')
    }
    const result = await response.json()
    return result.data.task_id
  }

  /**
   * 일괄 생성 상태 조회
   */
  static async getBulkCreateStatus(taskId: string): Promise<BulkCreateStatus> {
    const response = await fetch(`${BASE_URL}/bulk/${taskId}`, {
      headers: getHeaders(false),
      credentials: 'include',
    })
    if (!response.ok)
      throw new Error('Failed to fetch bulk create status')

    const data = await response.json()
    return data.data
  }

  /**
   * 역할 할당
   */
  static async assignRole(data: AssignAdminRoleRequest): Promise<void> {
    const response = await fetch(`${BASE_URL}/role/assign`, {
      method: 'POST',
      headers: getHeaders(),
      credentials: 'include',
      body: JSON.stringify(data),
    })
    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.message || 'Failed to assign role')
    }
  }

  /**
   * CSV 템플릿 다운로드
   */
  static async downloadTemplate(): Promise<void> {
    const response = await fetch(`${BASE_URL}/bulk/template`, {
      headers: getHeaders(false),
      credentials: 'include',
    })
    if (!response.ok)
      throw new Error('Failed to download CSV template')

    // Blob으로 변환
    const blob = await response.blob()

    // 다운로드 링크 생성
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'user_bulk_create_template.csv'
    document.body.appendChild(a)
    a.click()

    // 정리
    window.URL.revokeObjectURL(url)
    document.body.removeChild(a)
  }
}
