'use client'

// Authentication Context Provider
// Manages global authentication state using React Context API

import { createContext, useState, useEffect, useCallback, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import type { AuthContextType, User } from '@/types/auth'
import * as authAPI from '@/service/auth'
import { setTokens, getAccessToken, getRefreshToken, clearTokens, isTokenExpired } from '@/utils/storage'

export const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const router = useRouter()

  // 초기 로드 시 토큰 검증 및 사용자 정보 조회 (AC5)
  useEffect(() => {
    const initAuth = async () => {
      const token = getAccessToken()

      // 토큰이 없거나 만료된 경우 정리
      if (!token || isTokenExpired(token)) {
        clearTokens()
        setIsLoading(false)
        return
      }

      // 유효한 토큰이 있으면 사용자 정보 조회
      try {
        const account = await authAPI.getCurrentUser(token)

        // 시스템 역할 조회 (TenantAccountJoin.role from user management API)
        let userRole: 'admin' | 'normal' = 'normal' // 기본값
        let actualRole: 'owner' | 'admin' | 'student' = 'student' // 실제 역할
        try {
          const response = await fetch(`/console/api/edu/users/${account.id}`, {
            headers: { Authorization: `Bearer ${token}` },
          })
          if (response.ok) {
            const data = await response.json()
            // data.data.role은 'admin', 'owner', 또는 'student'
            actualRole = data.data.role || 'student'
            // owner와 admin 모두 관리자 권한으로 처리 (Dify 호환성)
            userRole = (actualRole === 'admin' || actualRole === 'owner') ? 'admin' : 'normal'
          }
        }
        catch (error) {
          console.warn('[AUTH] Failed to fetch user role on init, defaulting to "normal":', error)
        }

        setUser({
          id: account.id,
          name: account.name,
          email: account.email,
          avatar: account.avatar,
          role: userRole, // 시스템 역할 (TenantAccountJoin.role) - Dify 호환
          actualRole, // 실제 역할 ('owner' | 'admin' | 'student')
        })

        // 역할별 리다이렉트 제거 (Story 2.2B - 공용 /dashboard로 통합)
        // 모든 역할이 이제 /dashboard를 사용하므로 리다이렉트 불필요
      }
      catch (error) {
        console.error('[AUTH] Failed to get user info, clearing tokens:', error)
        clearTokens()
      }

      setIsLoading(false)
    }
    initAuth()
  }, [router])

  // 로그인 함수 (AC5)
  const signIn = useCallback(async (email: string, password: string) => {
    // 1. 로그인해서 토큰 받기
    const response = await authAPI.signIn({ email, password })
    setTokens(response.data.access_token, response.data.refresh_token)

    // 2. 토큰으로 사용자 정보 조회
    const account = await authAPI.getCurrentUser(response.data.access_token)

    // 3. 시스템 역할 조회 (TenantAccountJoin.role from user management API)
    let userRole: 'admin' | 'normal' = 'normal' // 기본값
    let actualRole: 'owner' | 'admin' | 'student' = 'student' // 실제 역할
    try {
      const roleResponse = await fetch(`/console/api/edu/users/${account.id}`, {
        headers: { Authorization: `Bearer ${response.data.access_token}` },
      })
      if (roleResponse.ok) {
        const data = await roleResponse.json()
        // data.data.role은 'admin', 'owner', 또는 'student'
        actualRole = data.data.role || 'student'
        // owner와 admin 모두 관리자 권한으로 처리 (Dify 호환성)
        userRole = (actualRole === 'admin' || actualRole === 'owner') ? 'admin' : 'normal'
      }
    }
    catch (error) {
      console.warn('[AUTH] Failed to fetch user role, defaulting to "normal":', error)
    }

    setUser({
      id: account.id,
      name: account.name,
      email: account.email,
      avatar: account.avatar,
      role: userRole, // 시스템 역할 (TenantAccountJoin.role) - Dify 호환
      actualRole, // 실제 역할 ('owner' | 'admin' | 'student')
    })

    // 리다이렉트는 SignIn 페이지의 useEffect에서 처리
    // (isAuthenticated 상태 변경 감지 → router.replace('/dashboard'))
  }, [])

  // 로그아웃 함수
  const signOut = useCallback(async () => {
    const token = getAccessToken()
    if (token) {
      try {
        await authAPI.signOut(token)
      }
      catch (error) {
        console.error('Logout API failed', error)
      }
    }
    clearTokens()
    setUser(null)
    router.push('/signin')
  }, [router])

  // 토큰 자동 갱신 로직 (DATA-002 리스크 완화)
  useEffect(() => {
    if (!user)
      return

    const checkAndRefreshToken = async () => {
      const token = getAccessToken()
      const refreshToken = getRefreshToken()

      if (!token || !refreshToken) {
        signOut()
        return
      }

      // 토큰이 5분 내 만료될 예정이면 갱신
      try {
        const parts = token.split('.')
        if (parts.length === 3 && parts[1]) {
          const payload = JSON.parse(atob(parts[1]))
          const expiresIn = (payload.exp * 1000) - Date.now()

          if (expiresIn < 5 * 60 * 1000) { // 5분 미만
            const response = await authAPI.refreshAccessToken(refreshToken)
            setTokens(response.data.access_token, response.data.refresh_token)
          }
        }
      }
      catch (error) {
        console.error('[AUTH] Token refresh failed:', error)
        // Refresh Token도 만료된 경우 로그아웃
        signOut()
      }
    }

    // 1분마다 토큰 만료 체크
    const interval = setInterval(checkAndRefreshToken, 60 * 1000)

    // 초기 체크
    checkAndRefreshToken()

    return () => clearInterval(interval)
  }, [user, signOut])

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isLoading,
        signIn,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}
