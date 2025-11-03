'use client'

// Session Timer Hook
// Auto-logout after 120 minutes of inactivity (PERF-002 risk mitigation with debounce)
// Warning toast shown 2 minutes before logout

import { useEffect, useRef } from 'react'
import { debounce } from 'lodash'
import { useTranslation } from 'react-i18next'
import { useAuth } from './useAuth'
import { useToast } from '@/context/ToastContext'

const TIMEOUT_DURATION = 120 * 60 * 1000 // 120분 (밀리초)
const WARNING_DURATION = 118 * 60 * 1000 // 118분 (만료 2분 전 경고)

export function useSessionTimer() {
  const { t } = useTranslation()
  const { signOut, isAuthenticated } = useAuth()
  const { showToast } = useToast()
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)
  const warningTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  const resetTimer = () => {
    // Clear existing timers
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
    }
    if (warningTimeoutRef.current) {
      clearTimeout(warningTimeoutRef.current)
    }

    if (isAuthenticated) {
      // Set warning timer (2 minutes before logout)
      warningTimeoutRef.current = setTimeout(() => {
        showToast(t('auth:session_warning'), 'warning', 5000)
      }, WARNING_DURATION)

      // Set logout timer
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
      if (warningTimeoutRef.current) {
        clearTimeout(warningTimeoutRef.current)
      }
      events.forEach((event) => {
        window.removeEventListener(event, debouncedResetTimer)
      })
      debouncedResetTimer.cancel() // Debounce 취소
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, debouncedResetTimer, showToast, t])
}
