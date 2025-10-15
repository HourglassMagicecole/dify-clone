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
   * @returns 대시보드 데이터
   */
  static async getDashboardData(): Promise<DashboardData> {
    const accessToken = getAccessToken()
    if (!accessToken) {
      throw new Error('No access token available')
    }

    const response = await fetch(`${API_BASE_URL}/console/api/edu/dashboard`, {
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
