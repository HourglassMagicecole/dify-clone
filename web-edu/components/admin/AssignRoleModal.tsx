'use client'

import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Modal } from '@/components/common/Modal'
import type { AssignAdminRoleRequest, UserAccount } from '@/types/user-management'

interface AssignRoleModalProps {
  isOpen: boolean
  onClose: () => void
  onSubmit: (data: AssignAdminRoleRequest) => Promise<void>
  user: UserAccount | null
  sessionId: string // 현재 선택된 세션 ID
}

export function AssignRoleModal({
  isOpen,
  onClose,
  onSubmit,
  user,
  sessionId,
}: AssignRoleModalProps) {
  const { t } = useTranslation('user-management')
  const [role, setRole] = useState<'admin' | 'student'>('student')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async () => {
    if (!user)
      return

    setIsSubmitting(true)
    try {
      await onSubmit({
        account_id: user.id,
        session_id: sessionId,
        role,
      })
      onClose()
    }
    catch (error) {
      console.error('Failed to assign role:', error)
    }
    finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={t('userManagement.assignRole')}
      footer={
        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
            disabled={isSubmitting}
          >
            {t('userManagement.createModal.cancelButton')}
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            className="px-4 py-2 text-sm font-medium text-white bg-purple-600 rounded-md hover:bg-purple-700 disabled:opacity-50"
            disabled={isSubmitting}
          >
            {isSubmitting ? '할당 중...' : '역할 할당'}
          </button>
        </div>
      }
    >
      <div className="space-y-4">
        {user && (
          <div className="p-3 bg-gray-50 rounded-md">
            <p className="text-sm font-medium text-gray-900">{user.name}</p>
            <p className="text-sm text-gray-500">{user.email}</p>
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {t('userManagement.editModal.roleLabel')}
          </label>
          <select
            value={role}
            onChange={e => setRole(e.target.value as 'admin' | 'student')}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
          >
            <option value="student">{t('userManagement.roles.student')}</option>
            <option value="admin">{t('userManagement.roles.admin')}</option>
          </select>
        </div>

        <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-md">
          <p className="text-sm text-yellow-800">
            Admin 역할이 할당되면 해당 사용자는 세션 내 모든 리소스를 관리할 수 있습니다.
          </p>
        </div>
      </div>
    </Modal>
  )
}
