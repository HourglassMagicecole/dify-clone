'use client'

import { useTranslation } from 'react-i18next'
import { ProtectedRoute } from '@/components/auth/ProtectedRoute'

export default function AdminPage() {
  const { t } = useTranslation('common')

  return (
    <ProtectedRoute requireAdmin={true}>
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-4xl font-bold text-gray-900">{t('admin_page_title')}</h1>
          <p className="mt-2 text-gray-600">
            {t('admin_page_description')}
          </p>
        </div>
      </div>
    </ProtectedRoute>
  )
}
