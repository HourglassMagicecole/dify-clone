'use client'

import React from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '@/hooks/useAuth'
import type { UserAccount } from '@/types/user-management'

interface UserTableProps {
  users: UserAccount[]
  onEdit: (user: UserAccount) => void
  onDelete: (user: UserAccount) => void
}

export function UserTable({
  users,
  onEdit,
  onDelete,
}: UserTableProps) {
  const { t } = useTranslation('user-management')
  const { user: currentUser } = useAuth()

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              {t('userManagement.table.email')}
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              {t('userManagement.table.name')}
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              {t('userManagement.table.role')}
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              {t('userManagement.table.status')}
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              {t('userManagement.table.createdAt')}
            </th>
            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
              {t('userManagement.table.actions')}
            </th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {users.map((user) => (
            <tr key={user.id} className="hover:bg-gray-50">
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                {user.email}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                {user.name}
              </td>
              <td className="px-6 py-4 whitespace-nowrap">
                <span className={`px-2 py-1 text-xs rounded-full ${
                  user.role === 'owner'
                    ? 'bg-red-100 text-red-800'
                    : user.role === 'admin'
                      ? 'bg-purple-100 text-purple-800'
                      : 'bg-blue-100 text-blue-800'
                }`}>
                  {t(`userManagement.roles.${user.role || 'student'}`)}
                </span>
              </td>
              <td className="px-6 py-4 whitespace-nowrap">
                <span className={`px-2 py-1 text-xs rounded-full ${
                  user.status === 'active'
                    ? 'bg-green-100 text-green-800'
                    : user.status === 'inactive'
                      ? 'bg-gray-100 text-gray-800'
                      : 'bg-red-100 text-red-800'
                }`}>
                  {t(`userManagement.status.${user.status}`)}
                </span>
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                {new Date(user.created_at).toLocaleDateString()}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                {/* 편집 버튼: owner는 본인만 가능, 나머지는 항상 가능 */}
                <button
                  onClick={() => onEdit(user)}
                  disabled={user.role === 'owner' && currentUser?.id !== user.id}
                  className={`mr-4 ${
                    user.role === 'owner' && currentUser?.id !== user.id
                      ? 'text-gray-400 cursor-not-allowed'
                      : 'text-indigo-600 hover:text-indigo-900'
                  }`}
                  title={user.role === 'owner' && currentUser?.id !== user.id
                    ? t('userManagement.messages.ownerCannotBeEdited')
                    : ''}
                >
                  {t('userManagement.editUser')}
                </button>

                {/* 삭제 버튼: owner와 자기 자신은 비활성화 */}
                <button
                  onClick={() => onDelete(user)}
                  disabled={user.role === 'owner' || currentUser?.id === user.id}
                  className={`${
                    user.role === 'owner' || currentUser?.id === user.id
                      ? 'text-gray-400 cursor-not-allowed'
                      : 'text-red-600 hover:text-red-900'
                  }`}
                  title={user.role === 'owner'
                    ? t('userManagement.messages.ownerCannotBeDeleted')
                    : currentUser?.id === user.id
                      ? t('userManagement.messages.cannotDeleteYourself')
                      : ''}
                >
                  {t('userManagement.deleteUser')}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {users.length === 0 && (
        <div className="text-center py-12 text-gray-500">
          {t('userManagement.messages.noUsers')}
        </div>
      )}
    </div>
  )
}
