'use client'

import type { Session } from '@/types/session'

interface SessionTabsProps {
  sessions: Session[]
  activeSessionId: string
  onSessionChange: (sessionId: string) => void
}

export const SessionTabs: React.FC<SessionTabsProps> = ({
  sessions,
  activeSessionId,
  onSessionChange,
}) => {
  if (sessions.length <= 1) {
    // 세션이 1개 이하면 탭을 표시하지 않음
    return null
  }

  return (
    <div className="border-b border-gray-200 mb-6">
      <nav className="-mb-px flex space-x-4 overflow-x-auto" aria-label="Tabs">
        {sessions.map((session) => {
          const isActive = session.id === activeSessionId

          return (
            <button
              key={session.id}
              onClick={() => onSessionChange(session.id)}
              className={`
                whitespace-nowrap py-3 px-4 border-b-2 font-medium text-sm transition-colors
                ${
                  isActive
                    ? 'border-indigo-500 text-indigo-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }
              `}
              aria-current={isActive ? 'page' : undefined}
            >
              <div className="flex items-center gap-2">
                <span>{session.session_name}</span>
                {isActive && (
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path
                      fillRule="evenodd"
                      d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                      clipRule="evenodd"
                    />
                  </svg>
                )}
              </div>
            </button>
          )
        })}
      </nav>
    </div>
  )
}
