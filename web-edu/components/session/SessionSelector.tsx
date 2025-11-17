'use client'

import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useSession } from '@/context/SessionContext'
import { CreateSessionModal } from './CreateSessionModal'

interface SessionSelectorProps {
  userRole?: 'owner' | 'admin' | 'student'
}

export const SessionSelector: React.FC<SessionSelectorProps> = ({ userRole = 'student' }) => {
  const { t } = useTranslation('session')
  const { currentSession, sessions, filteredSessions, isLoading, selectSession, refreshSessions } = useSession()
  const [showCreateModal, setShowCreateModal] = useState(false)

  // Owner와 Admin만 세션 생성 가능
  const canCreateSession = userRole === 'owner' || userRole === 'admin'

  // Owner는 filteredSessions 사용 (admin 필터링), Admin/Student는 sessions 사용
  const displaySessions = userRole === 'owner' ? filteredSessions : sessions

  if (isLoading) {
    return <div className="text-sm text-gray-500">Loading sessions...</div>
  }

  if (displaySessions.length === 0) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-sm text-gray-500">
          {userRole === 'student'
            ? t('noSessionsStudent')
            : t('noSessionsAdmin')}
        </span>
        {canCreateSession && (
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
            type="button"
          >
            +
          </button>
        )}
        {showCreateModal && (
          <CreateSessionModal
            onClose={() => setShowCreateModal(false)}
            onSuccess={refreshSessions}
          />
        )}
      </div>
    )
  }

  return (
    <div className="flex items-center gap-2">
      <select
        value={currentSession?.id || ''}
        onChange={(e) => selectSession(e.target.value || null)}
        className="px-3 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
      >
        {!currentSession && displaySessions.length > 0 && (
          <option value="">{t('selectSession')}</option>
        )}
        {displaySessions.map((session) => (
          <option key={session.id} value={session.id}>
            {session.session_name}
          </option>
        ))}
      </select>

      {canCreateSession && (
        <button
          onClick={() => setShowCreateModal(true)}
          className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
          type="button"
        >
          +
        </button>
      )}

      {showCreateModal && (
        <CreateSessionModal
          onClose={() => setShowCreateModal(false)}
          onSuccess={refreshSessions}
        />
      )}
    </div>
  )
}
