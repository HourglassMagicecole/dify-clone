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
 * 토큰 삭제
 */
export function clearTokens(): void {
  Cookies.remove(ACCESS_TOKEN_KEY)
  Cookies.remove(REFRESH_TOKEN_KEY)
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
