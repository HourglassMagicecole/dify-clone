'use client'

import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { sessionAPI } from '@/service/session-api'
import { AddMemberModal } from './AddMemberModal'
import type { SessionMember } from '@/types/session'

interface SessionMemberTableProps {
  sessionId: string
  members: SessionMember[]
  instructorAccountId: string
  onMembersChange: () => void
}

export const SessionMemberTable: React.FC<SessionMemberTableProps> = ({
  sessionId,
  members,
  instructorAccountId,
  onMembersChange,
}) => {
  const { t } = useTranslation('session')
  const [showAddMemberModal, setShowAddMemberModal] = useState(false)

  const handleRemoveMember = async (accountId: string) => {
    if (!confirm(t('remove_confirm'))) {
      return
    }

    try {
      await sessionAPI.removeSessionMember(sessionId, accountId)
      onMembersChange() // Reload members
    }
    catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to remove member')
    }
  }

  const activeMembers = members.filter(m => m.status === 'active')
  const inactiveMembers = members.filter(m => m.status !== 'active')

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <div className="text-sm text-gray-600">
          {t('members_active')}
          :
          {' '}
          {activeMembers.length}
          {' '}
          /
          {' '}
          {t('members_inactive')}
          :
          {' '}
          {inactiveMembers.length}
        </div>
        <button
          onClick={() => setShowAddMemberModal(true)}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          {t('add_member')}
        </button>
      </div>

      {members.length === 0
        ? (
            <div className="text-center py-8 text-gray-500">{t('no_members')}</div>
          )
        : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-gray-100 border-b">
                    <th className="px-4 py-2 text-left">{t('name')}</th>
                    <th className="px-4 py-2 text-left">{t('email')}</th>
                    <th className="px-4 py-2 text-left">{t('status')}</th>
                    <th className="px-4 py-2 text-left">{t('joined_at')}</th>
                    <th className="px-4 py-2 text-center">{t('actions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {members.map(member => (
                    <tr key={member.account_id} className="border-b hover:bg-gray-50">
                      <td className="px-4 py-2">{member.name}</td>
                      <td className="px-4 py-2">{member.email}</td>
                      <td className="px-4 py-2">
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
                      <td className="px-4 py-2 text-sm text-gray-600">
                        {new Date(member.joined_at).toLocaleString()}
                      </td>
                      <td className="px-4 py-2 text-center">
                        {member.account_id === instructorAccountId
                          ? (
                              <span className="px-3 py-1 text-sm bg-blue-100 text-blue-800 rounded">
                                {t('instructor')}
                              </span>
                            )
                          : (
                              <button
                                onClick={() => handleRemoveMember(member.account_id)}
                                className="px-3 py-1 text-sm bg-red-600 text-white rounded hover:bg-red-700"
                              >
                                {t('remove')}
                              </button>
                            )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

      {showAddMemberModal && (
        <AddMemberModal
          sessionId={sessionId}
          existingMemberIds={members.map(m => m.account_id)}
          onClose={() => {
            setShowAddMemberModal(false)
            onMembersChange()
          }}
        />
      )}
    </div>
  )
}
