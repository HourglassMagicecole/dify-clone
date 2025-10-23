'use client'

import { useState } from 'react'
import { useSession } from '@/context/SessionContext'
import { CreateSessionModal } from './CreateSessionModal'

export const SessionSelector: React.FC = () => {
  const { currentSession, sessions, isLoading, selectSession, refreshSessions } = useSession()
  const [showCreateModal, setShowCreateModal] = useState(false)

  if (isLoading) {
    return <div className="text-sm text-gray-500">Loading sessions...</div>
  }

  if (sessions.length === 0) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-sm text-gray-500">No sessions</span>
        <button
          onClick={() => setShowCreateModal(true)}
          className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          Create Session
        </button>
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
        onChange={(e) => selectSession(e.target.value)}
        className="px-3 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
      >
        {sessions.map((session) => (
          <option key={session.id} value={session.id}>
            {session.session_name}
          </option>
        ))}
      </select>

      <button
        onClick={() => setShowCreateModal(true)}
        className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
      >
        +
      </button>

      {showCreateModal && (
        <CreateSessionModal
          onClose={() => setShowCreateModal(false)}
          onSuccess={refreshSessions}
        />
      )}
    </div>
  )
}
