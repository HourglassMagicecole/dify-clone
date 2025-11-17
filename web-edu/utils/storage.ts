// Cookie-based JWT Token Storage Utilities
// Mitigates TECH-001 risk (XSS defense with cookies instead of LocalStorage)

import Cookies from 'js-cookie'

const ACCESS_TOKEN_KEY = 'edu_access_token'
const REFRESH_TOKEN_KEY = 'edu_refresh_token'

/**
 * 토큰 저장 (쿠키에 저장)
 *
 * @param accessToken - Access token to store
 * @param refreshToken - Refresh token to store
 */
export function setTokens(accessToken: string, refreshToken: string): void {
  // 쿠키 옵션: Secure (HTTPS only in production), SameSite (CSRF 방지)
  const cookieOptions: Cookies.CookieAttributes = {
    path: '/', // 명시적으로 path 지정
    expires: 7, // 7일
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
  }

  Cookies.set(ACCESS_TOKEN_KEY, accessToken, cookieOptions)
  Cookies.set(REFRESH_TOKEN_KEY, refreshToken, {
    ...cookieOptions,
    expires: 30, // Refresh Token은 30일
  })
}

/**
 * Access Token 조회
 *
 * @returns Access token or undefined if not found
 */
export function getAccessToken(): string | undefined {
  return Cookies.get(ACCESS_TOKEN_KEY)
}

/**
 * Refresh Token 조회
 *
 * @returns Refresh token or undefined if not found
 */
export function getRefreshToken(): string | undefined {
  return Cookies.get(REFRESH_TOKEN_KEY)
}

/**
 * 토큰 삭제 및 세션 데이터 정리
 */
export function clearTokens(): void {
  // Cookie 삭제 시 저장 시 사용한 path 옵션을 명시해야 제대로 삭제됨
  Cookies.remove(ACCESS_TOKEN_KEY, { path: '/' })
  Cookies.remove(REFRESH_TOKEN_KEY, { path: '/' })

  // localStorage 세션 데이터 정리
  localStorage.removeItem('lastSessionId')

  // Agent Wizard draft 정리 (모든 사용자의 draft)
  const keysToRemove: string[] = []
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i)
    if (key && key.startsWith('agent-wizard-draft-')) {
      keysToRemove.push(key)
    }
  }
  keysToRemove.forEach(key => localStorage.removeItem(key))
}

/**
 * JWT 토큰 만료 여부 확인
 *
 * @param token - JWT token to check
 * @returns true if token is expired, false otherwise
 */
export function isTokenExpired(token: string): boolean {
  try {
    const parts = token.split('.')
    if (parts.length !== 3 || !parts[1]) {
      return true
    }
    const payload = JSON.parse(atob(parts[1]))
    return payload.exp * 1000 < Date.now()
  }
  catch {
    return true
  }
}
