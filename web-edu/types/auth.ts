// Authentication Type Definitions
// Based on existing Dify Console API specifications

// 로그인 요청 타입
export interface SignInRequest {
  email: string
  password: string
}

// 로그인 응답 타입 (기존 Dify API 스펙)
export interface SignInResponse {
  result: 'success' | 'fail'
  data: {
    access_token: string
    refresh_token: string
    account: {
      id: string
      name: string
      email: string
      avatar: string | null
    }
  }
}

// 사용자 정보 타입
export interface User {
  id: string
  name: string
  email: string
  avatar: string | null
  role: 'admin' | 'normal'
}

// 계정 프로필 응답 타입 (Dify API)
export interface AccountProfile {
  id: string
  name: string
  email: string
  avatar: string | null
  avatar_url: string | null
  interface_language: string
  interface_theme: string
  timezone: string
  last_login_at: number
  last_login_ip: string
  created_at: number
}

// 인증 컨텍스트 타입
export interface AuthContextType {
  user: User | null
  isAuthenticated: boolean
  isLoading: boolean
  signIn: (email: string, password: string) => Promise<void>
  signOut: () => Promise<void>
}
