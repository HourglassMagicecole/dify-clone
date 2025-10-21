'use client'

import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Modal } from '@/components/common/Modal'
import type { UserAccount } from '@/types/user-management'

interface DeleteConfirmDialogProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: (userId: string, deleteResources: boolean) => Promise<void>
  user: UserAccount | null
}

export function DeleteConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  user,
}: DeleteConfirmDialogProps) {
  const { t } = useTranslation('user-management')
  const [isDeleting, setIsDeleting] = useState(false)

  const handleConfirm = async () => {
    if (!user)
      return

    setIsDeleting(true)
    try {
      // Always delete resources in education environment
      await onConfirm(user.id, true)
      onClose()
    }
    catch (error) {
      console.error('Failed to delete user:', error)
    }
    finally {
      setIsDeleting(false)
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={t('userManagement.deleteDialog.title')}
      footer={
        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
            disabled={isDeleting}
          >
            {t('userManagement.deleteDialog.cancelButton')}
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700 disabled:opacity-50"
            disabled={isDeleting}
          >
            {isDeleting ? '삭제 중...' : t('userManagement.deleteDialog.confirmButton')}
          </button>
        </div>
      }
    >
      <div className="space-y-4">
        <p className="text-sm text-gray-700">
          {t('userManagement.deleteDialog.message')}
        </p>

        {user && (
          <div className="p-3 bg-gray-50 rounded-md">
            <p className="text-sm font-medium text-gray-900">{user.name}</p>
            <p className="text-sm text-gray-500">{user.email}</p>
          </div>
        )}

        <div className="p-3 bg-red-50 border border-red-200 rounded-md">
          <p className="text-sm font-medium text-red-800">
            {t('userManagement.deleteDialog.warningWithResources')}
          </p>
        </div>
      </div>
    </Modal>
  )
}
