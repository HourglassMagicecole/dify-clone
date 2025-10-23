'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslation } from 'react-i18next'
import { useAuth } from '@/hooks/useAuth'

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { t } = useTranslation('common')
  const router = useRouter()
  const { user, isLoading } = useAuth()

  useEffect(() => {
    // 로딩 완료 후 권한 체크
    if (!isLoading) {
      // 비로그인 사용자 -> 로그인 페이지로
      if (!user) {
        router.push('/signin')
        return
      }

      // 일반 사용자 -> 대시보드로 리다이렉트
      if (user.role !== 'admin') {
        router.push('/dashboard')
      }
    }
  }, [user, isLoading, router])

  // 로딩 중이거나 권한이 없는 경우
  if (isLoading || !user || user.role !== 'admin') {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <div className="mb-4 h-12 w-12 animate-spin rounded-full border-b-2 border-edu-primary-600"></div>
          <p className="text-gray-600">{t('loading')}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="bg-edu-primary-700 py-4">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <h1 className="text-2xl font-semibold text-white">{t('admin_dashboard_title')}</h1>
        </div>
      </div>
      <main className="py-10">
        <div className="mx-auto max-w-7xl sm:px-6 lg:px-8">
          {children}
        </div>
      </main>
    </div>
  )
}
