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
      if (token && !isTokenExpired(token)) {
        try {
          const account = await authAPI.getCurrentUser(token)

          // 역할 조회 (AC5: DB에서 실제 role 값 가져오기)
          let userRole: 'admin' | 'normal' = 'normal' // 기본값
          try {
            // TODO: 실제 세션 ID는 추후 세션 관리 시스템에서 가져와야 함
            // 임시로 환경 변수 또는 하드코딩된 세션 ID 사용
            const sessionId = process.env.NEXT_PUBLIC_DEFAULT_SESSION_ID || 'default-session'
            const roleData = await authAPI.getUserRole(token, sessionId)
            userRole = roleData.role
          }
          catch (error) {
            console.warn('[AUTH] Failed to fetch user role on init, defaulting to "normal":', error)
          }

          setUser({
            id: account.id,
            name: account.name,
            email: account.email,
            avatar: account.avatar,
            role: userRole, // DB에서 가져온 실제 role 사용
          })
        }
        catch {
          clearTokens()
        }
      }
      setIsLoading(false)
    }
    initAuth()
  }, [])

  // 로그인 함수 (AC5)
  const signIn = useCallback(async (email: string, password: string) => {
    // 1. 로그인해서 토큰 받기
    const response = await authAPI.signIn({ email, password })
    setTokens(response.data.access_token, response.data.refresh_token)

    // 2. 토큰으로 사용자 정보 조회
    const account = await authAPI.getCurrentUser(response.data.access_token)

    // 3. 역할 조회 (CRITICAL: DB에서 실제 role 값 가져오기)
    let userRole: 'admin' | 'normal' = 'normal' // 기본값
    try {
      // TODO: 실제 세션 ID는 추후 세션 관리 시스템에서 가져와야 함
      // 임시로 환경 변수 또는 하드코딩된 세션 ID 사용
      const sessionId = process.env.NEXT_PUBLIC_DEFAULT_SESSION_ID || 'default-session'
      const roleData = await authAPI.getUserRole(response.data.access_token, sessionId)
      userRole = roleData.role
    }
    catch (error) {
      console.warn('[AUTH] Failed to fetch user role, defaulting to "normal":', error)
    }

    setUser({
      id: account.id,
      name: account.name,
      email: account.email,
      avatar: account.avatar,
      role: userRole, // DB에서 가져온 실제 role 사용
    })
    router.push('/dashboard')
  }, [router])

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
            // console.log('[AUTH] Access Token expiring soon, refreshing...')
            const response = await authAPI.refreshAccessToken(refreshToken)
            setTokens(response.data.access_token, response.data.refresh_token)
            // console.log('[AUTH] Access Token refreshed successfully')
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
