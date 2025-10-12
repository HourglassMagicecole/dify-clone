'use client'

import Link from 'next/link'
import { useTranslation } from 'react-i18next'
import '@/i18n'

export default function HomePage() {
  const { t } = useTranslation('common')

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
          <Link
            href="/dashboard"
            className="rounded-lg border border-indigo-600 px-6 py-3 text-indigo-600 hover:bg-indigo-50"
          >
            {t('dashboard')}
          </Link>
        </div>
      </div>
    </div>
  )
}
