'use client'

import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { sessionAPI } from '@/service/session-api'
import type { Session, SessionMember } from '@/types/session'

interface SessionDetailViewProps {
  session: Session
  showMembers?: boolean
}

export const SessionDetailView: React.FC<SessionDetailViewProps> = ({
  session,
  showMembers = true,
}) => {
  const { t } = useTranslation('session')
  const [members, setMembers] = useState<SessionMember[]>([])
  const [isLoadingMembers, setIsLoadingMembers] = useState(false)
  const [membersError, setMembersError] = useState<string | null>(null)

  const loadMembers = useCallback(async () => {
    try {
      setIsLoadingMembers(true)
      setMembersError(null)
      const data = await sessionAPI.getSessionMembers(session.id)
      setMembers(data)
    }
    catch (err) {
      setMembersError(err instanceof Error ? err.message : t('failed_to_load_members'))
    }
    finally {
      setIsLoadingMembers(false)
    }
  }, [session.id, t])

  useEffect(() => {
    if (showMembers) {
      loadMembers()
    }
  }, [showMembers, loadMembers])

  const activeMembers = members.filter(m => m.status === 'active')

  return (
    <div className="space-y-6">
      {/* Session Info Card */}
      <div className="rounded-lg border border-gray-300 bg-white p-6">
        <h2 className="mb-4 text-xl font-bold">{session.session_name}</h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <div className="text-sm text-gray-600">{t('session_tag')}</div>
            <div className="font-medium">
              <code className="rounded bg-gray-100 px-2 py-1">{session.session_tag}</code>
            </div>
          </div>

          <div>
            <div className="text-sm text-gray-600">{t('status')}</div>
            <div>
              <span
                className={`rounded px-2 py-1 text-sm ${
                  session.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                }`}
              >
                {session.is_active ? t('active') : t('inactive')}
              </span>
            </div>
          </div>

          {session.instructor_name && (
            <div>
              <div className="text-sm text-gray-600">{t('instructor')}</div>
              <div className="font-medium">{session.instructor_name}</div>
            </div>
          )}

          <div>
            <div className="text-sm text-gray-600">{t('start_date')}</div>
            <div className="font-medium">{new Date(session.start_date).toLocaleDateString()}</div>
          </div>

          {session.end_date && (
            <div>
              <div className="text-sm text-gray-600">{t('end_date')}</div>
              <div className="font-medium">{new Date(session.end_date).toLocaleDateString()}</div>
            </div>
          )}

          <div>
            <div className="text-sm text-gray-600">{t('max_students')}</div>
            <div className="font-medium">{session.max_students}</div>
          </div>

          {showMembers && (
            <div>
              <div className="text-sm text-gray-600">{t('current_members')}</div>
              <div className="font-medium">{activeMembers.length}</div>
            </div>
          )}
        </div>

        {session.description && (
          <div className="mt-4">
            <div className="text-sm text-gray-600 mb-1">{t('description')}</div>
            <div className="text-gray-700">{session.description}</div>
          </div>
        )}
      </div>

      {/* Session Members (Read-only) */}
      {showMembers && (
        <div className="rounded-lg border border-gray-300 bg-white p-6">
          <h2 className="mb-4 text-lg font-bold">
            {t('session_members')} ({activeMembers.length})
          </h2>

          {isLoadingMembers
            ? (
                <div className="text-center py-8 text-gray-500">{t('loading')}</div>
              )
            : membersError
              ? (
                  <div className="text-red-600 py-4">{membersError}</div>
                )
              : members.length === 0
                ? (
                    <div className="text-center py-8 text-gray-500">{t('no_members')}</div>
                  )
                : (
                    <div className="overflow-x-auto">
                      <table className="w-full border-collapse">
                        <thead>
                          <tr className="bg-gray-100 border-b">
                            <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">{t('name')}</th>
                            <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">{t('email')}</th>
                            <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">{t('status')}</th>
                            <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">{t('joined_at')}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {members.map(member => (
                            <tr key={member.account_id} className="border-b hover:bg-gray-50">
                              <td className="px-4 py-3">
                                <div className="flex items-center gap-2">
                                  {member.name}
                                  {member.account_id === session.instructor_account_id && (
                                    <span className="px-2 py-0.5 text-xs bg-blue-100 text-blue-800 rounded">
                                      {t('creator')}
                                    </span>
                                  )}
                                </div>
                              </td>
                              <td className="px-4 py-3 text-sm text-gray-600">{member.email}</td>
                              <td className="px-4 py-3">
                                <span
                                  className={`px-2 py-1 text-xs rounded ${
                                    member.status === 'active'
                                      ? 'bg-green-100 text-green-800'
                                      : member.status === 'inactive'
                                        ? 'bg-yellow-100 text-yellow-800'
                                        : 'bg-gray-100 text-gray-800'
                                  }`}
                                >
                                  {t(member.status)}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-sm text-gray-600">
                                {new Date(member.joined_at).toLocaleDateString()}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
        </div>
      )}
    </div>
  )
}
