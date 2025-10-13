'use client'

// Sign In Page
// Story 1.4: Authentication and Authorization System

import { useTranslation } from 'react-i18next'
import { SignInForm } from '@/components/auth/SignInForm'

export default function SignInPage() {
  const { t } = useTranslation()

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
