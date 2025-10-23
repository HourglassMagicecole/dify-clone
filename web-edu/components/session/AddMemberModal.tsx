'use client'

import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { sessionAPI } from '@/service/session-api'
import { UserManagementAPI } from '@/service/user-management-api'
import type { UserAccount } from '@/types/user-management'

interface AddMemberModalProps {
  sessionId: string
  existingMemberIds: string[] // Already in session
  onClose: () => void
}

export const AddMemberModal: React.FC<AddMemberModalProps> = ({ sessionId, existingMemberIds, onClose }) => {
  const { t } = useTranslation()
  const [users, setUsers] = useState<UserAccount[]>([])
  const [selectedUserId, setSelectedUserId] = useState<string>('')
  const [searchQuery, setSearchQuery] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const loadUsers = async () => {
      try {
        setIsLoading(true)
        const data = await UserManagementAPI.listUsers() // Load all users

        // Filter out users already in session
        const availableUsers = data.users.filter(u => !existingMemberIds.includes(u.id))
        setUsers(availableUsers)
      }
      catch (err) {
        setError(err instanceof Error ? err.message : t('session:failed_to_add_member'))
      }
      finally {
        setIsLoading(false)
      }
    }

    loadUsers()
  }, [existingMemberIds])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!selectedUserId) {
      alert(t('session:please_select_user'))
      return
    }

    setIsSubmitting(true)
    setError(null)

    try {
      await sessionAPI.addSessionMember(sessionId, selectedUserId)
      onClose()
    }
    catch (err) {
      setError(err instanceof Error ? err.message : t('session:failed_to_add_member'))
    }
    finally {
      setIsSubmitting(false)
    }
  }

  const filteredUsers = users.filter(
    user =>
      user.name.toLowerCase().includes(searchQuery.toLowerCase())
      || user.email.toLowerCase().includes(searchQuery.toLowerCase()),
  )

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md">
        <h2 className="text-xl font-bold mb-4">{t('session:add_member_to_session')}</h2>

        {error && <div className="mb-4 p-3 bg-red-100 text-red-700 rounded">{error}</div>}

        {isLoading
          ? (
              <div className="text-center py-4">{t('session:loading_users')}</div>
            )
          : users.length === 0
            ? (
                <>
                  <div className="text-center py-4 text-gray-500">{t('session:no_available_users')}</div>
                  <div className="flex justify-end gap-2 mt-4">
                    <button
                      type="button"
                      onClick={onClose}
                      className="px-4 py-2 text-gray-700 border border-gray-300 rounded hover:bg-gray-50"
                    >
                      {t('session:close')}
                    </button>
                  </div>
                </>
              )
            : (
                <form onSubmit={handleSubmit}>
                  <div className="mb-4">
                    <label className="block text-sm font-medium mb-1">{t('session:search_users')}</label>
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={e => setSearchQuery(e.target.value)}
                      placeholder={t('session:search_placeholder')}
                      className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div className="mb-4">
                    <label className="block text-sm font-medium mb-1">
                      {t('session:select_user_label')}
                      {' '}
                      <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={selectedUserId}
                      onChange={e => setSelectedUserId(e.target.value)}
                      required
                      className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                      size={Math.min(filteredUsers.length + 1, 10)}
                    >
                      <option value="">{t('session:select_user_placeholder')}</option>
                      {filteredUsers.map(user => (
                        <option key={user.id} value={user.id}>
                          {user.name}
                          {' '}
                          (
                          {user.email}
                          )
                        </option>
                      ))}
                    </select>
                    <p className="text-xs text-gray-500 mt-1">
                      {t('session:available_users_count')}
                      :
                      {' '}
                      {filteredUsers.length}
                      {' '}
                      /
                      {' '}
                      {users.length}
                    </p>
                  </div>

                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={onClose}
                      className="px-4 py-2 text-gray-700 border border-gray-300 rounded hover:bg-gray-50"
                      disabled={isSubmitting}
                    >
                      {t('session:cancel')}
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                      disabled={isSubmitting || !selectedUserId}
                    >
                      {isSubmitting ? t('session:adding_member') : t('session:add_member')}
                    </button>
                  </div>
                </form>
              )}
      </div>
    </div>
  )
}
