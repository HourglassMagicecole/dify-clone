'use client'

import React, { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Modal } from '@/components/common/Modal'
import { sessionAPI } from '@/service/session-api'
import { useAuth } from '@/hooks/useAuth'
import type { CreateUserRequest } from '@/types/user-management'
import type { Session } from '@/types/session'

// Zod 스키마 정의
const createUserSchema = z.object({
  email: z.string().email('유효한 이메일을 입력하세요'),
  name: z.string().min(1, '이름을 입력하세요').max(100, '이름은 100자 이내로 입력하세요'),
  password: z.string()
    .min(8, '비밀번호는 최소 8자 이상이어야 합니다')
    .regex(/^(?=.*[A-Za-z])(?=.*\d)/, '비밀번호는 영문과 숫자를 포함해야 합니다'),
  role: z.enum(['admin', 'student']),
})

type CreateUserFormData = z.infer<typeof createUserSchema>

interface CreateUserModalProps {
  isOpen: boolean
  onClose: () => void
  onSubmit: (data: CreateUserRequest) => Promise<void>
}

export function CreateUserModal({
  isOpen,
  onClose,
  onSubmit,
}: CreateUserModalProps) {
  const { t } = useTranslation('user-management')
  const { user: currentUser } = useAuth()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [sessions, setSessions] = useState<Session[]>([])
  const [selectedSessionId, setSelectedSessionId] = useState<string>('')
  const [error, setError] = useState<string | null>(null)

  // Admin은 student만 생성 가능
  const isOwner = currentUser?.actualRole === 'owner'

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<CreateUserFormData>({
    resolver: zodResolver(createUserSchema),
    defaultValues: {
      role: 'student',
    },
  })

  // Load active sessions
  useEffect(() => {
    const loadSessions = async () => {
      try {
        const data = await sessionAPI.listSessions(true) // Active sessions only
        setSessions(data.sessions)
      }
      catch (err) {
        console.error('Failed to load sessions:', err)
      }
    }
    if (isOpen) {
      loadSessions()
    }
  }, [isOpen])

  const handleFormSubmit = async (data: CreateUserFormData) => {
    setIsSubmitting(true)
    setError(null) // 이전 에러 초기화
    try {
      const requestData: CreateUserRequest = {
        ...data,
        session_id: selectedSessionId || undefined, // Include session_id if selected
      }
      await onSubmit(requestData)
      reset()
      setSelectedSessionId('')
      onClose()
    }
    catch (err) {
      console.error('Failed to create user:', err)
      // API 에러 메시지 추출
      const error = err as { response?: { data?: { message?: string } }; message?: string }
      if (error?.response?.data?.message) {
        setError(error.response.data.message)
      }
      else if (error?.message) {
        setError(error.message)
      }
      else {
        setError(t('userManagement.createModal.errorDefault'))
      }
    }
    finally {
      setIsSubmitting(false)
    }
  }

  const handleClose = () => {
    reset()
    setSelectedSessionId('')
    setError(null) // 에러 초기화
    onClose()
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={t('userManagement.createModal.title')}
      footer={
        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={handleClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
            disabled={isSubmitting}
          >
            {t('userManagement.createModal.cancelButton')}
          </button>
          <button
            type="submit"
            onClick={handleSubmit(handleFormSubmit)}
            className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 disabled:opacity-50"
            disabled={isSubmitting}
          >
            {isSubmitting ? '생성 중...' : t('userManagement.createModal.submitButton')}
          </button>
        </div>
      }
    >
      <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-4">
        {/* Error Message */}
        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-md">
            <p className="text-sm text-red-800">{error}</p>
          </div>
        )}

        {/* Email */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {t('userManagement.createModal.emailLabel')}
          </label>
          <input
            type="email"
            {...register('email')}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
            placeholder={t('userManagement.createModal.emailPlaceholder')}
          />
          {errors.email && (
            <p className="mt-1 text-sm text-red-600">{errors.email.message}</p>
          )}
        </div>

        {/* Name */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {t('userManagement.createModal.nameLabel')}
          </label>
          <input
            type="text"
            {...register('name')}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
            placeholder={t('userManagement.createModal.namePlaceholder')}
          />
          {errors.name && (
            <p className="mt-1 text-sm text-red-600">{errors.name.message}</p>
          )}
        </div>

        {/* Password */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {t('userManagement.createModal.passwordLabel')}
          </label>
          <div className="relative">
            <input
              type={showPassword ? 'text' : 'password'}
              {...register('password')}
              className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder={t('userManagement.createModal.passwordPlaceholder')}
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
        </div>

        {/* Role */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {t('userManagement.createModal.roleLabel')}
          </label>
          <select
            {...register('role')}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="student">{t('userManagement.roles.student')}</option>
            {isOwner && <option value="admin">{t('userManagement.roles.admin')}</option>}
          </select>
          {errors.role && (
            <p className="mt-1 text-sm text-red-600">{errors.role.message}</p>
          )}
          {!isOwner && (
            <p className="mt-1 text-xs text-gray-500">
              {t('userManagement.createModal.adminOnlyStudentHint')}
            </p>
          )}
        </div>

        {/* Session Assignment */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {t('userManagement.createModal.sessionLabel')}
          </label>
          <select
            value={selectedSessionId}
            onChange={e => setSelectedSessionId(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="">{t('userManagement.createModal.sessionPlaceholder')}</option>
            {sessions.map(session => (
              <option key={session.id} value={session.id}>
                {session.session_name}
              </option>
            ))}
          </select>
          <p className="mt-1 text-xs text-gray-500">
            {t('userManagement.createModal.sessionHelp')}
          </p>
        </div>
      </form>
    </Modal>
  )
}
