'use client'

import React, { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useAuth } from '@/hooks/useAuth'
import { Modal } from '@/components/common/Modal'
import type { UpdateUserRequest, UserAccount } from '@/types/user-management'

// Zod 스키마 정의
const updateUserSchema = z.object({
  name: z.string().min(1, '이름을 입력하세요').max(100, '이름은 100자 이내로 입력하세요'),
  status: z.enum(['active', 'banned']),
  role: z.enum(['owner', 'admin', 'student']),
  password: z.string().min(8, '비밀번호는 최소 8자 이상이어야 합니다').optional().or(z.literal('')),
})

type UpdateUserFormData = z.infer<typeof updateUserSchema>

interface EditUserModalProps {
  isOpen: boolean
  onClose: () => void
  onSubmit: (userId: string, data: UpdateUserRequest) => Promise<void>
  user: UserAccount | null
}

export function EditUserModal({
  isOpen,
  onClose,
  onSubmit,
  user,
}: EditUserModalProps) {
  const { t } = useTranslation('user-management')
  const { user: currentUser } = useAuth()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  // role/status 변경 불가 조건: owner 계정 또는 자기 자신
  const isOwner = user?.role === 'owner'
  const isSelf = currentUser?.id === user?.id

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<UpdateUserFormData>({
    resolver: zodResolver(updateUserSchema),
  })

  // user가 변경될 때 폼 리셋
  useEffect(() => {
    if (user) {
      reset({
        name: user.name,
        status: user.status,
        role: user.role || 'student',
      })
    }
  }, [user, reset])

  const handleFormSubmit = async (data: UpdateUserFormData) => {
    if (!user)
      return

    setIsSubmitting(true)
    try {
      // 비밀번호가 빈 문자열이면 제거 (변경하지 않음)
      const updateData: UpdateUserRequest = { ...data }
      if (!data.password || data.password === '') {
        delete updateData.password
      }

      // Owner 계정 또는 자기 자신 편집 시 role과 status 제거 (백엔드 보호)
      if (user.role === 'owner' || currentUser?.id === user.id) {
        delete updateData.role
        delete updateData.status
      }

      await onSubmit(user.id, updateData)
      onClose()
    }
    catch (error) {
      console.error('Failed to update user:', error)
    }
    finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={t('userManagement.editModal.title')}
      footer={
        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
            disabled={isSubmitting}
          >
            {t('userManagement.editModal.cancelButton')}
          </button>
          <button
            type="submit"
            onClick={handleSubmit(handleFormSubmit)}
            className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 disabled:opacity-50"
            disabled={isSubmitting}
          >
            {isSubmitting ? '저장 중...' : t('userManagement.editModal.submitButton')}
          </button>
        </div>
      }
    >
      <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-4">
        {/* Name */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {t('userManagement.editModal.nameLabel')}
          </label>
          <input
            type="text"
            {...register('name')}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          {errors.name && (
            <p className="mt-1 text-sm text-red-600">{errors.name.message}</p>
          )}
        </div>

        {/* Status */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {t('userManagement.editModal.statusLabel')}
          </label>
          <select
            {...register('status')}
            disabled={isOwner || isSelf}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
          >
            <option value="active">{t('userManagement.status.active')}</option>
            <option value="banned">{t('userManagement.status.banned')}</option>
          </select>
          <p className="mt-1 text-xs text-gray-500">
            {isOwner
              ? t('userManagement.messages.ownerRoleCannotBeChanged')
              : isSelf
                ? t('userManagement.messages.cannotDeleteYourself')
                : t('userManagement.messages.onlyOwnerCanChangeRoleStatus')}
          </p>
        </div>

        {/* Role */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {t('userManagement.editModal.roleLabel')}
          </label>
          <select
            {...register('role')}
            disabled={isOwner || isSelf}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
          >
            {isOwner && <option value="owner">{t('userManagement.roles.owner')}</option>}
            <option value="student">{t('userManagement.roles.student')}</option>
            <option value="admin">{t('userManagement.roles.admin')}</option>
          </select>
          <p className="mt-1 text-xs text-gray-500">
            {isOwner
              ? t('userManagement.messages.ownerRoleCannotBeChanged')
              : isSelf
                ? t('userManagement.messages.cannotDeleteYourself')
                : t('userManagement.messages.onlyOwnerCanChangeRoleStatus')}
          </p>
        </div>

        {/* Password */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {t('userManagement.editModal.passwordLabel')}
          </label>
          <div className="relative">
            <input
              type={showPassword ? 'text' : 'password'}
              {...register('password')}
              placeholder={t('userManagement.editModal.passwordPlaceholder')}
              className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute inset-y-0 right-0 flex items-center px-3 text-gray-400 hover:text-gray-600"
            >
              {showPassword
                ? (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                    </svg>
                  )
                : (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  )}
            </button>
          </div>
          {errors.password && (
            <p className="mt-1 text-sm text-red-600">{errors.password.message}</p>
          )}
          <p className="mt-1 text-xs text-gray-500">
            {t('userManagement.editModal.passwordHelp')}
          </p>
        </div>
      </form>
    </Modal>
  )
}
