'use client'

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { sessionAPI } from '@/service/session-api'
import type { Session } from '@/types/session'

interface SessionContextType {
  currentSession: Session | null
  sessions: Session[]
  isLoading: boolean
  error: string | null
  selectSession: (sessionId: string) => void
  refreshSessions: () => Promise<void>
}

const SessionContext = createContext<SessionContextType | undefined>(undefined)

interface SessionProviderProps {
  children: React.ReactNode
}

export const SessionProvider: React.FC<SessionProviderProps> = ({ children }) => {
  const { user, isLoading: authLoading } = useAuth()
  const [currentSession, setCurrentSession] = useState<Session | null>(null)
  const [sessions, setSessions] = useState<Session[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // 세션 목록 로드
  const refreshSessions = useCallback(async () => {
    try {
      setIsLoading(true)
      setError(null)

      const data = await sessionAPI.listSessions(true) // 활성 세션만
      setSessions(data.sessions)

      // localStorage에서 마지막 선택 세션 복원
      const lastSessionId = localStorage.getItem('lastSessionId')
      if (lastSessionId && data.sessions.find((s) => s.id === lastSessionId)) {
        setCurrentSession(data.sessions.find((s) => s.id === lastSessionId)!)
      }
      else if (data.sessions.length > 0) {
        // 기본값: 첫 번째 세션
        setCurrentSession(data.sessions[0]!)
        localStorage.setItem('lastSessionId', data.sessions[0]!.id)
      }
    }
    catch (err) {
      console.error('Failed to load sessions:', err)
      setError(err instanceof Error ? err.message : 'Failed to load sessions')
    }
    finally {
      setIsLoading(false)
    }
  }, [])

  // 세션 선택
  const selectSession = useCallback(
    (sessionId: string) => {
      const session = sessions.find((s) => s.id === sessionId)
      if (session) {
        setCurrentSession(session)
        localStorage.setItem('lastSessionId', sessionId)
      }
    },
    [sessions],
  )

  // 초기 로드 (로그인된 사용자만)
  useEffect(() => {
    // 인증 로딩이 완료되고, 로그인된 사용자만 세션 로드
    if (!authLoading && user) {
      refreshSessions()
    }
    else if (!authLoading && !user) {
      // 비로그인 상태면 로딩만 종료
      setIsLoading(false)
    }
  }, [authLoading, user, refreshSessions])

  const value: SessionContextType = {
    currentSession,
    sessions,
    isLoading,
    error,
    selectSession,
    refreshSessions,
  }

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
}

export const useSession = (): SessionContextType => {
  const context = useContext(SessionContext)
  if (!context) {
    throw new Error('useSession must be used within SessionProvider')
  }
  return context
}
