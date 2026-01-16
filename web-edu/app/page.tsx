'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useTranslation } from 'react-i18next'
import { useAuth } from '@/hooks/useAuth'
import '@/i18n'

export default function HomePage() {
  const { t } = useTranslation('common')
  const { user, isLoading } = useAuth()
  const router = useRouter()
  const [isMounted, setIsMounted] = useState(false)

  // Prevent hydration mismatch by only rendering i18n after client mount
  useEffect(() => {
    setIsMounted(true)
  }, [])

  // Redirect to dashboard if already logged in
  useEffect(() => {
    if (isMounted && !isLoading && user) {
      router.replace('/dashboard')
    }
  }, [isMounted, isLoading, user, router])

  // Show loading while checking auth or redirecting
  if (!isMounted || isLoading || user) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="text-center">
          <h1 className="mb-4 text-5xl font-bold text-gray-900">
            MAI Studio
          </h1>
          <p className="mb-8 text-xl text-gray-600">
            Loading...
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="text-center">
        <h1 className="mb-4 text-5xl font-bold text-gray-900">
          {t('app_name')}
        </h1>
        <p className="mb-8 text-xl text-gray-600">
          {t('welcome_message')}
        </p>
        <div className="flex gap-4">
          <Link
            href="/signin"
            className="rounded-lg bg-indigo-600 px-6 py-3 text-white hover:bg-indigo-700"
          >
            {t('signin')}
          </Link>
        </div>
      </div>
    </div>
  )
}
