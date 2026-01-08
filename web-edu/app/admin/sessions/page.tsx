'use client'

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslation } from 'react-i18next'
import { sessionAPI } from '@/service/session-api'
import { CreateSessionModal } from '@/components/session/CreateSessionModal'
import { useSession } from '@/context/SessionContext'
import { useAuth } from '@/hooks/useAuth'
import type { Session } from '@/types/session'

export default function SessionsPage() {
  const router = useRouter()
  const { t } = useTranslation('session')
  const { user: currentUser } = useAuth()
  const { refreshSessions: refreshSessionContext } = useSession()
  const [sessions, setSessions] = useState<Session[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showCreateModal, setShowCreateModal] = useState(false)

  // 필터 상태 (Owner만 사용)
  const [creatorFilter, setCreatorFilter] = useState<string>('all')
  const isOwner = currentUser?.actualRole === 'owner'

  const loadSessions = async () => {
    try {
      setIsLoading(true)
      setError(null)
      const data = await sessionAPI.listSessions()
      setSessions(data.sessions)
    }
    catch (err) {
      setError(err instanceof Error ? err.message : t('loading'))
    }
    finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadSessions()

    // 페이지가 다시 표시될 때 데이터 새로고침
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        loadSessions()
      }
    }
    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 필터링된 세션 목록 (early return 이전에 useMemo 호출 - React Hooks 규칙)
  const filteredSessions = React.useMemo(() => {
    if (creatorFilter === 'all') {
      return sessions
    }
    return sessions.filter(session => session.instructor_account_id === creatorFilter)
  }, [sessions, creatorFilter])

  // 고유 생성자 목록 추출 (early return 이전에 useMemo 호출 - React Hooks 규칙)
  const creators = React.useMemo(() => {
    const creatorMap = new Map<string, { id: string; name: string }>()
    sessions.forEach((session) => {
      if (session.instructor_account_id && session.instructor_name) {
        creatorMap.set(session.instructor_account_id, {
          id: session.instructor_account_id,
          name: session.instructor_name,
        })
      }
    })
    return Array.from(creatorMap.values())
  }, [sessions])

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">{t('loading')}</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-red-600">
          {t('error_prefix')}
          {' '}
          {error}
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">{t('page_title')}</h1>
        <button
          onClick={() => setShowCreateModal(true)}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          {t('create_session')}
        </button>
      </div>

      {/* 필터 (Owner만 표시) */}
      {isOwner && creators.length > 0 && (
        <div className="mb-4 flex items-center gap-2">
          <label className="text-sm font-medium text-gray-700">
            {t('filter_by_creator')}:
          </label>
          <select
            value={creatorFilter}
            onChange={(e) => setCreatorFilter(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">{t('filter_all')}</option>
            {creators.map((creator) => (
              <option key={creator.id} value={creator.id}>
                {creator.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {filteredSessions.length === 0
        ? (
            <div className="text-center py-8 text-gray-500">
              {t('no_sessions')}
            </div>
          )
        : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredSessions.map(session => (
                <div key={session.id} className="border border-gray-300 rounded-lg p-4 hover:shadow-lg transition flex flex-col">
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="font-bold text-lg">{session.session_name}</h3>
                    <span
                      className={`px-2 py-1 text-xs rounded ${
                        session.is_currently_active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                      }`}
                    >
                      {session.is_currently_active ? t('active') : t('inactive')}
                    </span>
                  </div>

                  <div className="text-sm text-gray-600 mb-2">
                    {session.instructor_name && (
                      <div className="mb-1">
                        <span className="font-medium text-gray-700">
                          {t('created_by')}
                          :
                        </span>
                        {' '}
                        {session.instructor_name}
                      </div>
                    )}
                    <div>
                      {t('tag')}
                      :
                      {' '}
                      <code className="bg-gray-100 px-1 rounded">{session.session_tag}</code>
                    </div>
                    <div>
                      {t('start')}
                      :
                      {' '}
                      {new Date(session.start_date).toLocaleDateString()}
                    </div>
                    {session.end_date && (
                      <div>
                        {t('end')}
                        :
                        {' '}
                        {new Date(session.end_date).toLocaleDateString()}
                      </div>
                    )}
                    <div>
                      {t('students')}
                      :
                      {' '}
                      {session.member_count ?? 0}
                      {' / '}
                      {session.max_students}
                    </div>
                  </div>

                  {session.description && (
                    <p className="text-sm text-gray-700 mb-3 line-clamp-2">{session.description}</p>
                  )}

                  <div className="mt-auto">
                    <button
                      onClick={() => router.push(`/admin/sessions/${session.id}`)}
                      className="w-full px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
                    >
                      {t('view_details')}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

      {showCreateModal && (
        <CreateSessionModal
          onClose={() => setShowCreateModal(false)}
          onSuccess={async () => {
            await Promise.all([loadSessions(), refreshSessionContext()])
          }}
        />
      )}
    </div>
  )
}
