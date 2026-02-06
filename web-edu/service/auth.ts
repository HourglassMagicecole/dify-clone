// Authentication API Client
// Integrates with existing Dify Console API endpoints

import type { AccountProfile, SSOLoginResponse, SignInRequest, SignInResponse } from '@/types/auth'

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
    // 백엔드 응답 형식: {"result": "fail", "data": "에러 메시지"} 또는 {"message": "..."}
    throw new Error(error.data || error.message || 'Login failed')
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
    // 백엔드 응답 형식: {"result": "fail", "data": "에러 메시지"}
    throw new Error(error.data || error.message || 'Token refresh failed')
  }

  return response.json()
}

/**
 * SSO 로그인 API 호출 (외부 LMS 연동)
 * 백엔드가 request cookies에서 MOAI_LOGIN_EMAIL, MOAI_LOGIN_NAME을 직접 읽음
 *
 * @returns SSO login response with tokens
 * @throws Error if SSO login fails
 */
export async function ssoLogin(): Promise<SSOLoginResponse> {
  const response = await fetch(`${API_BASE_URL}/console/api/auth/sso-login`, {
    method: 'GET',
    credentials: 'include',
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.data || error.message || 'SSO login failed')
  }

  return response.json()
}

/**
 * 사용자 역할 조회 API 호출 (AC3, AC5)
 *
 * @param accessToken - Access token for authentication
 * @param sessionId - Education session ID
 * @returns User role ('admin' | 'normal')
 * @throws Error if fetch fails
 */
export async function getUserRole(accessToken: string, sessionId: string): Promise<{
  role: 'admin' | 'normal'
  account_id: string
  session_id: string
}> {
  const response = await fetch(
    `${API_BASE_URL}/console/api/edu/user/role?session_id=${sessionId}`,
    {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    },
  )

  if (!response.ok) {
    throw new Error('Failed to fetch user role')
  }

  const result = await response.json()
  return result.data
}
