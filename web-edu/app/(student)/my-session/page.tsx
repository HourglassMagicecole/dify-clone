'use client'

import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { sessionAPI } from '@/service/session-api'
import { SessionTabs } from '@/components/session/SessionTabs'
import { SessionDetailView } from '@/components/session/SessionDetailView'
import type { Session } from '@/types/session'

export default function MySessionPage() {
  const { t } = useTranslation('session')
  const { t: tCommon } = useTranslation('common')
  const [sessions, setSessions] = useState<Session[]>([])
  const [selectedSessionId, setSelectedSessionId] = useState<string>('')
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    loadSessions()
  }, [])

  const loadSessions = async () => {
    try {
      setIsLoading(true)
      setError(null)
      const data = await sessionAPI.listSessions()
      setSessions(data.sessions || [])

      // Auto-select first session
      if (data.sessions && data.sessions.length > 0 && data.sessions[0]) {
        setSelectedSessionId(data.sessions[0].id)
      }
    }
    catch (err) {
      setError(err instanceof Error ? err.message : t('loading_failed'))
    }
    finally {
      setIsLoading(false)
    }
  }

  const selectedSession = sessions.find(s => s.id === selectedSessionId)

  // Loading state
  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
            <p className="text-gray-600">{t('loading')}</p>
          </div>
        </div>
      </div>
    )
  }

  // Error state
  if (error) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6">
          <div className="flex items-center gap-3">
            <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <div>
              <h3 className="text-red-800 font-medium">{t('error_loading_sessions')}</h3>
              <p className="text-red-600 text-sm mt-1">{error}</p>
            </div>
          </div>
          <button
            onClick={loadSessions}
            className="mt-4 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
          >
            {t('retry')}
          </button>
        </div>
      </div>
    )
  }

  // Empty state - no sessions
  if (sessions.length === 0) {
    return (
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold mb-6">{tCommon('nav.my_session')}</h1>
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center max-w-md">
            <div className="text-6xl mb-4">📚</div>
            <h2 className="text-xl font-semibold text-gray-700 mb-2">
              {t('no_sessions_yet')}
            </h2>
            <p className="text-gray-500">
              {t('no_sessions_description')}
            </p>
          </div>
        </div>
      </div>
    )
  }

  // Page title: singular or plural based on session count
  const pageTitle = sessions.length === 1 ? tCommon('nav.my_session') : tCommon('nav.my_sessions')

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-6">{pageTitle}</h1>

      {/* Session Tabs (only shown if multiple sessions) */}
      <SessionTabs
        sessions={sessions}
        activeSessionId={selectedSessionId}
        onSessionChange={setSelectedSessionId}
      />

      {/* Session Detail */}
      {selectedSession
        ? (
            <SessionDetailView session={selectedSession} showMembers={false} />
          )
        : (
            <div className="text-center py-8 text-gray-500">
              {t('session_not_found')}
            </div>
          )}
    </div>
  )
}
