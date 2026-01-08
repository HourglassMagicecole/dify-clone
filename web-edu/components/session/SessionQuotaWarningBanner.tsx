'use client'

import useSWR from 'swr'
import { useTranslation } from 'react-i18next'
import { quotaAPI } from '@/service/quota-api'

interface SessionQuotaWarningBannerProps {
  sessionId: string
  onNavigateToQuotas?: () => void
}

export function SessionQuotaWarningBanner({ sessionId, onNavigateToQuotas }: SessionQuotaWarningBannerProps) {
  const { t } = useTranslation('quota')

  const { data: warnings } = useSWR(
    ['quota-warnings', sessionId],
    () => quotaAPI.getQuotaWarnings(sessionId),
    { revalidateOnFocus: true },
  )

  // Don't show if no warnings
  if (!warnings) return null
  if (warnings.user_warning_count === 0 && warnings.user_blocked_count === 0 && !warnings.session_blocked) {
    return null
  }

  const isBlocked = warnings.session_blocked || warnings.user_blocked_count > 0
  const hasWarnings = warnings.user_warning_count > 0 || warnings.session_warning_count > 0

  return (
    <div
      className={`mb-4 rounded-lg px-4 py-3 flex items-center justify-between ${
        isBlocked
          ? 'bg-red-50 border border-red-200'
          : 'bg-yellow-50 border border-yellow-200'
      }`}
    >
      <div className="flex items-center gap-3">
        {/* Icon */}
        <div className={`flex-shrink-0 ${isBlocked ? 'text-red-500' : 'text-yellow-500'}`}>
          {isBlocked ? (
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                clipRule="evenodd"
              />
            </svg>
          ) : (
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                clipRule="evenodd"
              />
            </svg>
          )}
        </div>

        {/* Message */}
        <div className={`text-sm font-medium ${isBlocked ? 'text-red-800' : 'text-yellow-800'}`}>
          {warnings.session_blocked ? (
            <span>
              {t('session_blocked_banner')}
              {warnings.session_blocked_providers.length > 0 && (
                <span className="ml-1">
                  ({warnings.session_blocked_providers.join(', ')})
                </span>
              )}
            </span>
          ) : warnings.user_blocked_count > 0 ? (
            <span>
              {t('users_blocked_banner', { count: warnings.user_blocked_count })}
            </span>
          ) : hasWarnings ? (
            <span>
              {t('users_warning_banner', { count: warnings.user_warning_count })}
            </span>
          ) : null}
        </div>
      </div>

      {/* Action */}
      {onNavigateToQuotas && (
        <button
          onClick={onNavigateToQuotas}
          className={`text-sm font-medium underline hover:no-underline ${
            isBlocked ? 'text-red-700' : 'text-yellow-700'
          }`}
        >
          {t('view_details')}
        </button>
      )}
    </div>
  )
}
