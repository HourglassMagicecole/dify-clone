'use client'

// Sign In Page
// Story 1.4: Authentication and Authorization System

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslation } from 'react-i18next'
import { SignInForm } from '@/components/auth/SignInForm'
import { useAuth } from '@/hooks/useAuth'

export default function SignInPage() {
  const { t } = useTranslation('auth')
  const { isAuthenticated, isLoading } = useAuth()
  const router = useRouter()

  // Redirect to dashboard if already authenticated
  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      router.replace('/dashboard')
    }
  }, [isAuthenticated, isLoading, router])

  // Show loading while checking auth status
  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="text-gray-500">Loading...</div>
      </div>
    )
  }

  // Don't render login form if already authenticated (will redirect)
  if (isAuthenticated) {
    return null
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4 py-12 sm:px-6 lg:px-8">
      <div className="w-full max-w-md space-y-8">
        <div>
          <h2 className="mt-6 text-center text-3xl font-bold tracking-tight text-gray-900">
            {t('signin.title')}
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            {t('signin.subtitle')}
          </p>
        </div>
        <SignInForm />
      </div>
    </div>
  )
}
