/**
 * Dashboard API Client
 * 대시보드 데이터를 조회하는 API 클라이언트
 */

import type { DashboardData } from '../types/dashboard'
import { getAccessToken } from '../utils/storage'

// Use empty string to leverage Next.js rewrites (CORS bypass)
const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || ''

/**
 * 대시보드 API 클라이언트
 */
export class DashboardAPI {
  /**
   * 사용자 대시보드 데이터 조회
   * @param sessionId - 세션 ID (Admin/Student용)
   * @param adminId - 관리자 ID (Owner 전용, 특정 관리자의 리소스만 필터링)
   * @returns 대시보드 데이터
   */
  static async getDashboardData(sessionId?: string, adminId?: string): Promise<DashboardData> {
    const accessToken = getAccessToken()
    if (!accessToken) {
      throw new Error('No access token available')
    }

    // Build URL with optional query parameters
    const url = new URL(`${API_BASE_URL}/console/api/edu/dashboard`, window.location.origin)
    if (sessionId) {
      url.searchParams.append('session_id', sessionId)
    }
    if (adminId) {
      url.searchParams.append('admin_id', adminId)
    }

    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    })

    if (!response.ok) {
      throw new Error(`Failed to fetch dashboard data: ${response.status} ${response.statusText}`)
    }

    const result = await response.json()

    if (result.result !== 'success' || !result.data) {
      throw new Error('Failed to fetch dashboard data')
    }

    return result.data
  }
}
