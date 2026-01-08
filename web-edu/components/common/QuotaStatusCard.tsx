'use client'

import useSWR from 'swr'
import { useTranslation } from 'react-i18next'
import { quotaAPI } from '@/service/quota-api'
import type { MyQuotaStatus } from '@/types/quota'

interface QuotaStatusCardProps {
  sessionId?: string
}

export function QuotaStatusCard({ sessionId }: QuotaStatusCardProps) {
  const { t } = useTranslation('quota')

  const { data: quotas, isLoading, error } = useSWR(
    ['my-quotas', sessionId],
    () => quotaAPI.getMyQuotas(sessionId),
    { revalidateOnFocus: true },
  )

  if (isLoading) {
    return (
      <div className="bg-white rounded-lg shadow p-4">
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-1/3 mb-3" />
          <div className="h-2 bg-gray-200 rounded w-full mb-2" />
          <div className="h-2 bg-gray-200 rounded w-2/3" />
        </div>
      </div>
    )
  }

  if (error) {
    return null // Silently fail - user may not have quotas
  }

  if (!quotas || quotas.length === 0) {
    return null // No quotas configured
  }

  return (
    <div className="bg-white rounded-lg shadow p-4">
      <h3 className="text-sm font-semibold text-gray-900 mb-3">{t('my_quota_status')}</h3>

      <div className="space-y-3">
        {quotas.map((quota: MyQuotaStatus) => (
          <div key={quota.model_provider} className="space-y-1">
            {/* Provider name and status */}
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-700">
                {quota.model_provider === 'all' ? t('provider_all') : quota.model_provider}
              </span>
              <div className="flex items-center gap-2">
                {quota.is_blocked ? (
                  <span className="px-2 py-0.5 bg-red-100 text-red-700 rounded text-xs font-medium">
                    {t('blocked')}
                  </span>
                ) : quota.is_warning ? (
                  <span className="px-2 py-0.5 bg-yellow-100 text-yellow-700 rounded text-xs font-medium">
                    {t('warning')}
                  </span>
                ) : null}
              </div>
            </div>

            {/* Progress bar */}
            <div className="relative">
              <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className={`h-full transition-all duration-300 ${
                    quota.is_blocked
                      ? 'bg-red-500'
                      : quota.is_warning
                        ? 'bg-yellow-500'
                        : quota.usage_percentage >= 50
                          ? 'bg-yellow-400'
                          : 'bg-green-500'
                  }`}
                  style={{ width: `${Math.min(quota.usage_percentage, 100)}%` }}
                />
              </div>
            </div>

            {/* Usage details */}
            <div className="flex items-center justify-between text-xs text-gray-500">
              <span>
                ${quota.current_usage} / ${quota.quota_limit}
              </span>
              <span>
                {quota.usage_percentage.toFixed(1)}%
              </span>
            </div>

            {/* Reset time */}
            {quota.reset_at && (
              <div className="text-xs text-gray-400">
                {t('resets_at')}: {new Date(quota.reset_at).toLocaleString()}
              </div>
            )}

            {/* Blocked message */}
            {quota.is_blocked && (
              <div className="mt-1 p-2 bg-red-50 border border-red-200 rounded text-xs text-red-700">
                {t('quota_exceeded_message')}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
