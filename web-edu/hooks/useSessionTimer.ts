'use client'

// Session Timer Hook
// Auto-logout after 30 minutes of inactivity (PERF-002 risk mitigation with debounce)

import { useEffect, useRef } from 'react'
import { debounce } from 'lodash'
import { useTranslation } from 'react-i18next'
import { useAuth } from './useAuth'

const TIMEOUT_DURATION = 30 * 60 * 1000 // 30분 (밀리초)

export function useSessionTimer() {
  const { t } = useTranslation()
  const { signOut, isAuthenticated } = useAuth()
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)

  const resetTimer = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
    }

    if (isAuthenticated) {
      timeoutRef.current = setTimeout(() => {
        signOut()
        alert(t('auth:session_expired'))
      }, TIMEOUT_DURATION)
    }
  }

  // Debounce 적용: 1초 내 여러 이벤트는 한 번만 처리 (PERF-002 완화)
  const debouncedResetTimer = useRef(debounce(resetTimer, 1000)).current

  useEffect(() => {
    if (!isAuthenticated)
      return

    // 사용자 활동 감지 이벤트 (scroll 제거로 이벤트 수 감소)
    const events = ['mousedown', 'keydown', 'touchstart']

    events.forEach((event) => {
      window.addEventListener(event, debouncedResetTimer)
    })

    // 초기 타이머 시작
    resetTimer()

    // 클린업
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
      events.forEach((event) => {
        window.removeEventListener(event, debouncedResetTimer)
      })
      debouncedResetTimer.cancel() // Debounce 취소
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, debouncedResetTimer, t])
}
