// Authentication API Client
// Integrates with existing Dify Console API endpoints

import type { AccountProfile, SignInRequest, SignInResponse } from '@/types/auth'

// Use empty string to leverage Next.js rewrites (CORS bypass)
const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || ''

/**
 * 로그인 API 호출
 *
 * @param data - Sign in credentials
 * @returns Sign in response with tokens and user info
 * @throws Error if login fails
 */
export async function signIn(data: SignInRequest): Promise<SignInResponse> {
  const response = await fetch(`${API_BASE_URL}/console/api/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.message || 'Login failed')
  }

  return response.json()
}

/**
 * 로그아웃 API 호출
 *
 * @param accessToken - Access token for authentication
 * @throws Error if logout fails
 */
export async function signOut(accessToken: string): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/console/api/logout`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
  })

  if (!response.ok) {
    throw new Error('Logout failed')
  }
}

/**
 * 사용자 정보 조회 API 호출
 *
 * @param accessToken - Access token for authentication
 * @returns User account information
 * @throws Error if fetch fails
 */
export async function getCurrentUser(accessToken: string): Promise<AccountProfile> {
  const response = await fetch(`${API_BASE_URL}/console/api/account/profile`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
    },
  })

  if (!response.ok) {
    throw new Error('Failed to fetch user info')
  }

  return response.json()
}

/**
 * Refresh Token으로 새로운 Access Token 발급
 *
 * @param refreshToken - Refresh token
 * @returns New access and refresh tokens
 * @throws Error if token refresh fails
 */
export async function refreshAccessToken(refreshToken: string): Promise<SignInResponse> {
  const response = await fetch(`${API_BASE_URL}/console/api/refresh-token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ refresh_token: refreshToken }),
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.message || 'Token refresh failed')
  }

  return response.json()
}
