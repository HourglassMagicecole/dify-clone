'use client'

import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { AddMemberModal } from './AddMemberModal'
import { MemberRemoveDialog } from './MemberRemoveDialog'
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
  const [memberToRemove, setMemberToRemove] = useState<SessionMember | null>(null)
  const [searchQuery, setSearchQuery] = useState('')

  const handleRemoveMember = (member: SessionMember) => {
    setMemberToRemove(member)
  }

  const handleRemoveComplete = () => {
    setMemberToRemove(null)
    onMembersChange()
  }

  // Filter members by search query
  const filteredMembers = useMemo(() => {
    if (!searchQuery.trim())
      return members
    const query = searchQuery.toLowerCase()
    return members.filter(
      member =>
        member.name.toLowerCase().includes(query)
        || member.email.toLowerCase().includes(query),
    )
  }, [members, searchQuery])

  const activeMembers = members.filter(m => m.status === 'active')
  const inactiveMembers = members.filter(m => m.status !== 'active')

  return (
    <div>
      {/* Header: Search + Stats + Add Button */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
        <div className="flex items-center gap-4">
          {/* Search Input */}
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder={t('search_members_placeholder')}
            className="border rounded px-3 py-2 text-sm w-64"
          />
          {/* Stats */}
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
            {searchQuery && (
              <span className="ml-2 text-blue-600">
                ({t('showing')} {filteredMembers.length})
              </span>
            )}
          </div>
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
        : filteredMembers.length === 0
          ? (
              <div className="text-center py-8 text-gray-500">{t('no_results')}</div>
            )
          : (
              <div className="border rounded-lg overflow-hidden">
                {/* Fixed height scrollable table */}
                <div className="max-h-96 overflow-y-auto">
                  <table className="w-full border-collapse">
                    <thead className="bg-gray-100 sticky top-0">
                      <tr>
                        <th className="px-4 py-2 text-left text-sm font-medium text-gray-600">{t('name')}</th>
                        <th className="px-4 py-2 text-left text-sm font-medium text-gray-600">{t('email')}</th>
                        <th className="px-4 py-2 text-left text-sm font-medium text-gray-600">{t('status')}</th>
                        <th className="px-4 py-2 text-left text-sm font-medium text-gray-600">{t('joined_at')}</th>
                        <th className="px-4 py-2 text-center text-sm font-medium text-gray-600">{t('actions')}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {filteredMembers.map(member => (
                        <tr key={member.account_id} className="hover:bg-gray-50">
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
                                    onClick={() => handleRemoveMember(member)}
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

      {memberToRemove && (
        <MemberRemoveDialog
          isOpen={!!memberToRemove}
          sessionId={sessionId}
          member={memberToRemove}
          onClose={() => setMemberToRemove(null)}
          onRemoveComplete={handleRemoveComplete}
        />
      )}
    </div>
  )
}
