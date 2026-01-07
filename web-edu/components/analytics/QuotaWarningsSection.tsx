'use client'

import { useState } from 'react'
import useSWR, { mutate } from 'swr'
import { useTranslation } from 'react-i18next'
import Link from 'next/link'
import { quotaAPI } from '@/service/quota-api'
import type { AllQuotaWarning } from '@/types/quota'

export function QuotaWarningsSection() {
  const { t } = useTranslation('quota')
  const { t: tCommon } = useTranslation('common')

  const [actionError, setActionError] = useState<string | null>(null)
  const [actionSuccess, setActionSuccess] = useState<string | null>(null)

  const { data, isLoading, error } = useSWR(
    'all-quota-warnings',
    () => quotaAPI.getAllQuotaWarnings(),
    { refreshInterval: 30000 },
  )

  const handleUnblock = async (warning: AllQuotaWarning) => {
    try {
      setActionError(null)
      if (warning.type === 'session') {
        await quotaAPI.unblockSessionQuota(warning.session_id, warning.model_provider)
      } else if (warning.account_id) {
        // For user quotas, we need the quota ID, but we only have account_id
        // This requires fetching the session quotas first
        const quotas = await quotaAPI.getSessionQuotas(warning.session_id)
        const userQuota = quotas.user_quotas.find(
          (q) => q.account_id === warning.account_id && q.model_provider === warning.model_provider,
        )
        if (userQuota) {
          await quotaAPI.unblockUser(warning.session_id, userQuota.id)
        }
      }
      await mutate('all-quota-warnings')
      setActionSuccess(t('quota_unblocked'))
    } catch (err) {
      setActionError(err instanceof Error ? err.message : t('unblock_failed'))
    }
  }

  if (isLoading) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold mb-4">{t('quota_warnings_title')}</h2>
        <div className="animate-pulse space-y-3">
          <div className="h-4 bg-gray-200 rounded w-1/2" />
          <div className="h-4 bg-gray-200 rounded w-3/4" />
          <div className="h-4 bg-gray-200 rounded w-2/3" />
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold mb-4">{t('quota_warnings_title')}</h2>
        <div className="text-red-600 text-sm">{t('load_failed')}</div>
      </div>
    )
  }

  const warnings = data?.warnings || []
  const totalBlocked = data?.total_blocked || 0
  const totalWarning = data?.total_warning || 0

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold">{t('quota_warnings_title')}</h2>
        <div className="flex gap-4 text-sm">
          {totalBlocked > 0 && (
            <span className="px-3 py-1 bg-red-100 text-red-700 rounded-full font-medium">
              {t('blocked_count', { count: totalBlocked })}
            </span>
          )}
          {totalWarning > 0 && (
            <span className="px-3 py-1 bg-yellow-100 text-yellow-700 rounded-full font-medium">
              {t('warning_count', { count: totalWarning })}
            </span>
          )}
        </div>
      </div>

      {/* Status Messages */}
      {actionError && (
        <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-2 rounded text-sm">
          {actionError}
          <button onClick={() => setActionError(null)} className="ml-2 underline">{tCommon('close')}</button>
        </div>
      )}
      {actionSuccess && (
        <div className="mb-4 bg-green-50 border border-green-200 text-green-700 px-4 py-2 rounded text-sm">
          {actionSuccess}
          <button onClick={() => setActionSuccess(null)} className="ml-2 underline">{tCommon('close')}</button>
        </div>
      )}

      {warnings.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          <svg className="w-12 h-12 mx-auto mb-3 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p>{t('no_warnings')}</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {t('type')}
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {t('session')}
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {t('user')}
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {t('provider')}
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {t('usage')}
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {t('status')}
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {t('actions')}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {warnings.map((warning: AllQuotaWarning, index: number) => (
                <tr key={`${warning.session_id}-${warning.account_id || 'session'}-${warning.model_provider}-${index}`}>
                  <td className="px-4 py-3 text-sm">
                    <span className={`px-2 py-1 rounded text-xs font-medium ${
                      warning.type === 'session' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'
                    }`}>
                      {warning.type === 'session' ? t('type_session') : t('type_user')}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm">
                    <Link
                      href={`/admin/sessions/${warning.session_id}`}
                      className="text-blue-600 hover:underline"
                    >
                      {warning.session_name}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {warning.account_name || '-'}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {warning.model_provider}
                  </td>
                  <td className="px-4 py-3 text-sm">
                    <div className="flex items-center gap-2">
                      <div className="w-16 h-2 bg-gray-200 rounded-full overflow-hidden">
                        <div
                          className={`h-full ${
                            warning.is_blocked ? 'bg-red-500' : 'bg-yellow-500'
                          }`}
                          style={{ width: `${Math.min(warning.usage_percentage, 100)}%` }}
                        />
                      </div>
                      <span className="text-xs text-gray-500">
                        ${warning.current_usage}/${warning.quota_limit}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm">
                    {warning.is_blocked ? (
                      <span className="px-2 py-1 bg-red-100 text-red-700 rounded text-xs font-medium">
                        {t('blocked')}
                      </span>
                    ) : (
                      <span className="px-2 py-1 bg-yellow-100 text-yellow-700 rounded text-xs font-medium">
                        {t('warning')}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm">
                    {warning.is_blocked && (
                      <button
                        onClick={() => handleUnblock(warning)}
                        className="text-blue-600 hover:underline text-xs"
                      >
                        {t('unblock')}
                      </button>
                    )}
                    <Link
                      href={`/admin/sessions/${warning.session_id}?tab=quotas`}
                      className="ml-2 text-gray-500 hover:underline text-xs"
                    >
                      {t('manage')}
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
