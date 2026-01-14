'use client'

import { useTranslation } from 'react-i18next'
import { useSession } from '@/context/SessionContext'
import { SessionDetailView } from '@/components/session/SessionDetailView'
import { MyUsageSection } from '@/components/session/MyUsageSection'

export default function MySessionPage() {
  const { t } = useTranslation('session')
  const { currentSession, isLoading } = useSession()

  // Loading state
  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
            <p className="text-gray-600">{t('loading')}</p>
          </div>
        </div>
      </div>
    )
  }

  // No session selected
  if (!currentSession) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            {t('my_sessions')}
          </h1>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
            {t('my_sessions_description')}
          </p>
        </div>
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center max-w-md">
            <div className="text-6xl mb-4">📚</div>
            <h2 className="text-xl font-semibold text-gray-700 mb-2">
              {t('no_sessions_yet')}
            </h2>
            <p className="text-gray-500">
              {t('no_sessions_description')}
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
          {t('my_sessions')}
        </h1>
        <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
          {t('my_sessions_description')}
        </p>
      </div>

      <div className="space-y-6">
        <SessionDetailView session={currentSession} showMembers={false} />
        <MyUsageSection sessionId={currentSession.id} />
      </div>
    </div>
  )
}
