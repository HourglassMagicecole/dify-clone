'use client'

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { sessionAPI } from '@/service/session-api'
import type { Session } from '@/types/session'

interface SessionContextType {
  currentSession: Session | null
  sessions: Session[]
  filteredSessions: Session[]
  isLoading: boolean
  error: string | null
  selectedAdminId: string | null
  selectSession: (sessionId: string | null) => void
  selectAdmin: (adminId: string | null) => void
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
  const [selectedAdminId, setSelectedAdminId] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Admin 필터링된 세션 목록 (Owner 전용)
  const filteredSessions = React.useMemo(() => {
    if (!selectedAdminId) return sessions // 전체 관리자
    return sessions.filter((s) => s.instructor_account_id === selectedAdminId)
  }, [sessions, selectedAdminId])

  // 세션 목록 로드
  const refreshSessions = useCallback(async () => {
    try {
      setIsLoading(true)
      setError(null)

      const data = await sessionAPI.listSessions(true) // 활성 세션만
      setSessions(data.sessions)

      // currentSession 설정은 별도 useEffect에서 처리 (역할별 로직 분리)
    }
    catch (err) {
      console.error('Failed to load sessions:', err)
      setError(err instanceof Error ? err.message : 'Failed to load sessions')
    }
    finally {
      setIsLoading(false)
    }
  }, [])

  // 세션 선택 (null: 세션 해제)
  const selectSession = useCallback(
    (sessionId: string | null) => {
      if (sessionId === null) {
        setCurrentSession(null)
        localStorage.removeItem('lastSessionId')
        return
      }

      const session = sessions.find((s) => s.id === sessionId)
      if (session) {
        setCurrentSession(session)
        localStorage.setItem('lastSessionId', sessionId)
      }
    },
    [sessions],
  )

  // Admin 선택 (Owner 전용, null: 전체 Admin)
  const selectAdmin = useCallback(
    (adminId: string | null) => {
      setSelectedAdminId(adminId)
      // Admin 변경 시 currentSession 초기화 (해당 Admin의 첫 번째 세션 선택)
      const targetSessions = adminId
        ? sessions.filter((s) => s.instructor_account_id === adminId)
        : sessions

      if (targetSessions.length > 0) {
        setCurrentSession(targetSessions[0]!)
        localStorage.setItem('lastSessionId', targetSessions[0]!.id)
      } else {
        setCurrentSession(null)
        localStorage.removeItem('lastSessionId')
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
      // 비로그인 상태면 상태 초기화
      setCurrentSession(null)
      setSelectedAdminId(null)
      setSessions([])
      setIsLoading(false)
    }
  }, [authLoading, user, refreshSessions])

  // filteredSessions가 변경될 때 currentSession 재설정 (Owner용)
  useEffect(() => {
    if (sessions.length === 0 || user?.actualRole !== 'owner') return

    // filteredSessions에 세션이 있는데 currentSession이 없거나 목록에 없으면 첫 번째 선택
    if (filteredSessions.length > 0) {
      setCurrentSession(prev => {
        if (!prev || !filteredSessions.find(s => s.id === prev.id)) {
          localStorage.setItem('lastSessionId', filteredSessions[0]!.id)
          return filteredSessions[0]!
        }
        return prev
      })
    } else {
      setCurrentSession(prev => {
        if (prev) {
          localStorage.removeItem('lastSessionId')
          return null
        }
        return prev
      })
    }
  }, [sessions.length, filteredSessions, selectedAdminId, user?.actualRole])

  // 세션 초기화: 역할별 초기 세션 선택
  useEffect(() => {
    if (!authLoading && user && sessions.length > 0) {
      if (user.actualRole === 'owner') {
        // Owner: 2-tier selection - 자신을 기본 Admin으로 선택
        if (!selectedAdminId) {
          setSelectedAdminId(user.id)
        }
        // currentSession이 없을 때만 첫 번째 세션 선택
        if (!currentSession) {
          const ownerSessions = sessions.filter((s) => s.instructor_account_id === user.id)
          if (ownerSessions.length > 0) {
            setCurrentSession(ownerSessions[0]!)
            localStorage.setItem('lastSessionId', ownerSessions[0]!.id)
          }
        }
      }
      else if (user.actualRole === 'admin' && !currentSession) {
        // Admin: 자신의 첫 번째 세션 선택
        const adminSessions = sessions.filter((s) => s.instructor_account_id === user.id)
        if (adminSessions.length > 0) {
          setCurrentSession(adminSessions[0]!)
          localStorage.setItem('lastSessionId', adminSessions[0]!.id)
        }
      }
      else if (!currentSession) {
        // Student: localStorage 복원 또는 첫 번째 세션
        const lastSessionId = localStorage.getItem('lastSessionId')
        if (lastSessionId && sessions.find((s) => s.id === lastSessionId)) {
          setCurrentSession(sessions.find((s) => s.id === lastSessionId)!)
        }
        else if (sessions.length > 0) {
          setCurrentSession(sessions[0]!)
          localStorage.setItem('lastSessionId', sessions[0]!.id)
        }
      }
    }
  }, [authLoading, user, sessions, currentSession, selectedAdminId])

  const value: SessionContextType = {
    currentSession,
    sessions,
    filteredSessions,
    isLoading,
    error,
    selectedAdminId,
    selectSession,
    selectAdmin,
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
