'use client'

import { useState, useEffect, useRef, useMemo } from 'react'
import useSWR, { mutate } from 'swr'
import { useTranslation } from 'react-i18next'
import { quotaAPI } from '@/service/quota-api'
import { modelAPI } from '@/service/model-api'
import type { SessionQuota, UserQuota, SetSessionQuotaRequest, SetDefaultUserQuotaRequest, DefaultQuotaConfig } from '@/types/quota'

interface QuotaSettingsTabProps {
  sessionId: string
}

// Period is fixed to 'session' - no daily/monthly reset needed

export function QuotaSettingsTab({ sessionId }: QuotaSettingsTabProps) {
  const { t } = useTranslation('quota')
  const { t: tCommon } = useTranslation('common')

  // Helper to translate error messages
  const getErrorMessage = (err: unknown): string => {
    const message = err instanceof Error ? err.message : String(err)
    // Check for known error patterns and translate them
    if (message.includes('cannot exceed session quota')) {
      return t('exceeds_session_quota')
    }
    return message || t('save_failed')
  }

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const errorRef = useRef<HTMLDivElement>(null)

  // Scroll to error message when error occurs
  useEffect(() => {
    if (error && errorRef.current) {
      errorRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  }, [error])

  // Session quota form state (period fixed to 'session')
  const [sessionQuotaForm, setSessionQuotaForm] = useState<SetSessionQuotaRequest>({
    model_provider: '',
    quota_limit: '100.00',
    period: 'session',
    warning_threshold: 70,
  })

  // Default user quota form state (for bulk apply to all members, period fixed to 'session')
  const [defaultUserQuotaForm, setDefaultUserQuotaForm] = useState<SetDefaultUserQuotaRequest>({
    model_provider: '',
    quota_limit: '10.00',
    period: 'session',
    warning_threshold: 70,
  })

  // Individual user quota adjustment state
  const [editingQuotaId, setEditingQuotaId] = useState<string | null>(null)
  const [editingQuotaLimit, setEditingQuotaLimit] = useState<string>('')

  // Session quota adjustment state
  const [editingSessionQuotaProvider, setEditingSessionQuotaProvider] = useState<string | null>(null)
  const [editingSessionQuotaLimit, setEditingSessionQuotaLimit] = useState<string>('')

  // Search and pagination state
  const [searchQuery, setSearchQuery] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 10



  // Fetch quotas
  const { data: quotasData, isLoading: quotasLoading } = useSWR(
    ['session-quotas', sessionId],
    () => quotaAPI.getSessionQuotas(sessionId),
  )

  // Fetch default quota configs (for auto-apply to new members)
  const { data: defaultConfigs } = useSWR<DefaultQuotaConfig[]>(
    ['default-quota-configs', sessionId],
    () => quotaAPI.getDefaultQuotaConfigs(sessionId),
  )

  // Fetch providers
  const { data: providersData } = useSWR('providers', () => modelAPI.getProviders())

  // Extract short provider name from full path (e.g., 'langgenius/openai/openai' -> 'openai')
  const getShortProviderName = (provider: string): string => {
    const parts = provider.split('/')
    return parts[parts.length - 1] || provider
  }

  // Memoize provider options to prevent unnecessary re-renders
  const providerOptions = useMemo(() => {
    const enabledProviders = providersData?.data?.filter((p) =>
      p.custom_configuration?.status === 'active',
    ) || []

    return enabledProviders.map((p) => ({
      value: getShortProviderName(p.provider),
      label: p.label?.en_US || getShortProviderName(p.provider),
    }))
  }, [providersData])

  // Get first provider value for auto-selection
  const firstProviderValue = providerOptions[0]?.value

  // Auto-select first provider when options are loaded
  useEffect(() => {
    if (firstProviderValue) {
      setSessionQuotaForm((prev) =>
        prev.model_provider ? prev : { ...prev, model_provider: firstProviderValue },
      )
      setDefaultUserQuotaForm((prev) =>
        prev.model_provider ? prev : { ...prev, model_provider: firstProviderValue },
      )
    }
  }, [firstProviderValue])

  const sessionQuotas = quotasData?.session_quotas || []
  const userQuotas = quotasData?.user_quotas || []

  // Filter and sort user quotas by account name for grouping
  const filteredUserQuotas = userQuotas
    .filter((quota: UserQuota) =>
      quota.account_name.toLowerCase().includes(searchQuery.toLowerCase()),
    )
    .sort((a: UserQuota, b: UserQuota) => a.account_name.localeCompare(b.account_name))

  // Pagination
  const totalPages = Math.ceil(filteredUserQuotas.length / itemsPerPage)
  const paginatedUserQuotas = filteredUserQuotas.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage,
  )

  // Reset to page 1 when search changes
  const handleSearchChange = (value: string) => {
    setSearchQuery(value)
    setCurrentPage(1)
  }

  const handleSaveSessionQuota = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    setError(null)
    setSuccess(null)

    try {
      await quotaAPI.setSessionQuota(sessionId, sessionQuotaForm)
      await mutate(['session-quotas', sessionId])
      setSuccess(t('session_quota_saved'))
    } catch (err) {
      setError(err instanceof Error ? err.message : t('save_failed'))
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleSaveDefaultUserQuota = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    setError(null)
    setSuccess(null)

    try {
      // Save as default config and apply to all existing members
      const result = await quotaAPI.setDefaultQuotaConfig(sessionId, {
        model_provider: defaultUserQuotaForm.model_provider,
        quota_limit: defaultUserQuotaForm.quota_limit,
        warning_threshold: defaultUserQuotaForm.warning_threshold,
        apply_to_existing: true,
      })
      await mutate(['session-quotas', sessionId])
      await mutate(['default-quota-configs', sessionId])
      setSuccess(t('default_user_quota_saved', { count: result.applied_count }))
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleAdjustUserQuota = async (quota: UserQuota, newLimit: string) => {
    setIsSubmitting(true)
    setError(null)
    setSuccess(null)

    try {
      await quotaAPI.setUserQuota(sessionId, {
        account_id: quota.account_id,
        model_provider: quota.model_provider,
        quota_limit: newLimit,
        period: quota.period,
        warning_threshold: quota.warning_threshold,
      })
      await mutate(['session-quotas', sessionId])
      setSuccess(t('user_quota_adjusted'))
      setEditingQuotaId(null)
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleAdjustSessionQuota = async (quota: SessionQuota, newLimit: string) => {
    setIsSubmitting(true)
    setError(null)
    setSuccess(null)

    try {
      await quotaAPI.setSessionQuota(sessionId, {
        model_provider: quota.model_provider,
        quota_limit: newLimit,
        period: quota.period,
        warning_threshold: quota.warning_threshold,
      })
      await mutate(['session-quotas', sessionId])
      setSuccess(t('session_quota_adjusted'))
      setEditingSessionQuotaProvider(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : t('save_failed'))
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDeleteSessionQuota = async (provider: string) => {
    if (!confirm(t('confirm_delete_session_quota'))) return

    try {
      await quotaAPI.deleteSessionQuota(sessionId, provider)
      await mutate(['session-quotas', sessionId])
      setSuccess(t('quota_deleted'))
    } catch (err) {
      setError(err instanceof Error ? err.message : t('delete_failed'))
    }
  }

  const handleDeleteUserQuotasByProvider = async (provider: string) => {
    if (!confirm(t('confirm_delete_user_quotas_by_provider'))) return

    try {
      const result = await quotaAPI.deleteUserQuotasByProvider(sessionId, provider)
      await mutate(['session-quotas', sessionId])
      await mutate(['default-quota-configs', sessionId])
      setSuccess(t('user_quotas_deleted', { count: result.deleted_user_quotas }))
    } catch (err) {
      setError(err instanceof Error ? err.message : t('delete_failed'))
    }
  }

  if (quotasLoading) {
    return <div className="text-center py-8">{tCommon('loading')}</div>
  }

  return (
    <div className="space-y-8">
      {/* Status Messages */}
      {error && (
        <div ref={errorRef} className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          {error}
          <button onClick={() => setError(null)} className="ml-2 underline">{tCommon('close')}</button>
        </div>
      )}
      {success && (
        <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded">
          {success}
          <button onClick={() => setSuccess(null)} className="ml-2 underline">{tCommon('close')}</button>
        </div>
      )}

      {/* Session Quota Section */}
      <section>
        <h3 className="text-lg font-semibold mb-2">{t('session_quota_title')}</h3>
        <p className="text-sm text-gray-600 mb-4">{t('session_quota_desc')}</p>

        {/* Existing Session Quotas */}
        {sessionQuotas.length > 0 && (
          <div className="mb-4 overflow-x-auto">
            <table className="min-w-full border border-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">{t('provider')}</th>
                  <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">{t('limit')}</th>
                  <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">{t('usage')}</th>
                  <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">{t('status')}</th>
                  <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">{t('actions')}</th>
                </tr>
              </thead>
              <tbody>
                {sessionQuotas.map((quota: SessionQuota) => (
                  <tr key={quota.id} className="border-t border-gray-200">
                    <td className="px-4 py-2 text-sm">{quota.model_provider}</td>
                    <td className="px-4 py-2 text-sm">
                      {editingSessionQuotaProvider === quota.model_provider ? (
                        <div className="flex items-center gap-1">
                          <span>$</span>
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={editingSessionQuotaLimit}
                            onChange={(e) => setEditingSessionQuotaLimit(e.target.value)}
                            className="w-20 border border-gray-300 rounded px-2 py-1 text-sm"
                            autoFocus
                          />
                          <button
                            onClick={() => handleAdjustSessionQuota(quota, editingSessionQuotaLimit)}
                            className="text-green-600 hover:underline text-xs"
                            disabled={isSubmitting}
                          >
                            {tCommon('save')}
                          </button>
                          <button
                            onClick={() => setEditingSessionQuotaProvider(null)}
                            className="text-gray-500 hover:underline text-xs"
                          >
                            {tCommon('cancel')}
                          </button>
                        </div>
                      ) : (
                        <span>${quota.quota_limit}</span>
                      )}
                    </td>
                    <td className="px-4 py-2 text-sm">
                      <div className="flex items-center gap-2">
                        <div className="w-24 h-2 bg-gray-200 rounded-full overflow-hidden">
                          <div
                            className={`h-full ${
                              quota.is_blocked ? 'bg-red-500' : quota.is_warning ? 'bg-yellow-500' : 'bg-green-500'
                            }`}
                            style={{ width: `${Math.min(quota.usage_percentage, 100)}%` }}
                          />
                        </div>
                        <span>${quota.current_usage} ({quota.usage_percentage.toFixed(1)}%)</span>
                      </div>
                    </td>
                    <td className="px-4 py-2 text-sm">
                      {quota.is_blocked ? (
                        <span className="px-2 py-1 bg-red-100 text-red-700 rounded text-xs">{t('blocked')}</span>
                      ) : quota.is_warning ? (
                        <span className="px-2 py-1 bg-yellow-100 text-yellow-700 rounded text-xs">{t('warning')}</span>
                      ) : (
                        <span className="px-2 py-1 bg-green-100 text-green-700 rounded text-xs">{t('normal')}</span>
                      )}
                    </td>
                    <td className="px-4 py-2 text-sm space-x-2">
                      <button
                        onClick={() => {
                          setEditingSessionQuotaProvider(quota.model_provider)
                          setEditingSessionQuotaLimit(quota.quota_limit)
                        }}
                        className="text-blue-600 hover:underline"
                      >
                        {t('adjust_limit')}
                      </button>
                      <button
                        onClick={() => handleDeleteSessionQuota(quota.model_provider)}
                        className="text-red-600 hover:underline"
                      >
                        {t('delete')}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Add Session Quota Form */}
        <form onSubmit={handleSaveSessionQuota} className="bg-gray-50 p-4 rounded-lg">
          <h4 className="text-sm font-medium mb-3">{t('add_session_quota')}</h4>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm text-gray-600 mb-1">{t('provider')}</label>
              <select
                value={sessionQuotaForm.model_provider}
                onChange={(e) => setSessionQuotaForm({ ...sessionQuotaForm, model_provider: e.target.value })}
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
              >
                {providerOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">{t('limit_usd')}</label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={sessionQuotaForm.quota_limit}
                onChange={(e) => setSessionQuotaForm({ ...sessionQuotaForm, quota_limit: e.target.value })}
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
              />
            </div>
            <div className="flex items-end">
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full bg-blue-600 text-white px-4 py-2 rounded text-sm hover:bg-blue-700 disabled:bg-gray-400"
              >
                {isSubmitting ? tCommon('saving') : t('save')}
              </button>
            </div>
          </div>
        </form>
      </section>

      {/* User Quota Section */}
      <section>
        <h3 className="text-lg font-semibold mb-2">{t('user_quota_title')}</h3>
        <p className="text-sm text-gray-600 mb-4">{t('user_quota_desc')}</p>

        {/* Default User Quota Form (Bulk Apply) */}
        <form onSubmit={handleSaveDefaultUserQuota} className="bg-blue-50 p-4 rounded-lg mb-4 border border-blue-200">
          <h4 className="text-sm font-medium mb-3 text-blue-800">{t('set_default_user_quota')}</h4>
          <p className="text-xs text-blue-600 mb-3">{t('default_user_quota_hint')}</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm text-gray-600 mb-1">{t('provider')}</label>
              <select
                value={defaultUserQuotaForm.model_provider}
                onChange={(e) => setDefaultUserQuotaForm({ ...defaultUserQuotaForm, model_provider: e.target.value })}
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
              >
                {providerOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">{t('limit_per_user_usd')}</label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={defaultUserQuotaForm.quota_limit}
                onChange={(e) => setDefaultUserQuotaForm({ ...defaultUserQuotaForm, quota_limit: e.target.value })}
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
              />
            </div>
            <div className="flex items-end">
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full bg-blue-600 text-white px-4 py-2 rounded text-sm hover:bg-blue-700 disabled:bg-gray-400"
              >
                {isSubmitting ? tCommon('saving') : t('apply_to_all_members')}
              </button>
            </div>
          </div>
        </form>

        {/* Saved Default Configs */}
        {defaultConfigs && defaultConfigs.length > 0 && (
          <div className="mt-4 bg-green-50 border border-green-200 rounded-lg p-4">
            <h4 className="text-sm font-medium text-green-800 mb-2">{t('saved_default_configs')}</h4>
            <p className="text-xs text-green-600 mb-3">{t('auto_apply_to_new_members')}</p>
            <div className="flex flex-wrap gap-2">
              {defaultConfigs.map((config: DefaultQuotaConfig) => (
                <span
                  key={config.id}
                  className="inline-flex items-center px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm"
                >
                  <span className="capitalize">{config.model_provider}</span>
                  <span className="mx-1">:</span>
                  <span className="font-medium">${config.quota_limit}</span>
                  <button
                    onClick={() => handleDeleteUserQuotasByProvider(config.model_provider)}
                    className="ml-2 text-green-600 hover:text-red-600"
                    title={t('delete')}
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Existing User Quotas (Table View) */}
        {userQuotas.length > 0 && (
          <div className="mb-4">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-medium text-gray-700">{t('current_user_quotas')}</h4>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  placeholder={t('search_by_name')}
                  value={searchQuery}
                  onChange={(e) => handleSearchChange(e.target.value)}
                  className="border border-gray-300 rounded px-3 py-1.5 text-sm w-48"
                />
                {searchQuery && (
                  <button
                    onClick={() => handleSearchChange('')}
                    className="text-gray-500 hover:text-gray-700 text-sm"
                  >
                    {t('clear')}
                  </button>
                )}
              </div>
            </div>

            {filteredUserQuotas.length === 0 ? (
              <p className="text-sm text-gray-500 py-4 text-center">{t('no_results')}</p>
            ) : (
            <>
            <div className="overflow-x-auto">
            <table className="min-w-full border border-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">{t('user')}</th>
                  <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">{t('provider')}</th>
                  <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">{t('limit')}</th>
                  <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">{t('usage')}</th>
                  <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">{t('status')}</th>
                  <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">{t('actions')}</th>
                </tr>
              </thead>
              <tbody>
                {paginatedUserQuotas.map((quota: UserQuota) => (
                  <tr key={quota.id} className="border-t border-gray-200">
                    <td className="px-4 py-2 text-sm">{quota.account_name}</td>
                    <td className="px-4 py-2 text-sm capitalize">{quota.model_provider}</td>
                    <td className="px-4 py-2 text-sm">
                      {editingQuotaId === quota.id ? (
                        <div className="flex items-center gap-1">
                          <span>$</span>
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={editingQuotaLimit}
                            onChange={(e) => setEditingQuotaLimit(e.target.value)}
                            className="w-20 border border-gray-300 rounded px-2 py-1 text-sm"
                            autoFocus
                          />
                          <button
                            onClick={() => handleAdjustUserQuota(quota, editingQuotaLimit)}
                            className="text-green-600 hover:underline text-xs"
                            disabled={isSubmitting}
                          >
                            {tCommon('save')}
                          </button>
                          <button
                            onClick={() => setEditingQuotaId(null)}
                            className="text-gray-500 hover:underline text-xs"
                          >
                            {tCommon('cancel')}
                          </button>
                        </div>
                      ) : (
                        <span>${quota.quota_limit}</span>
                      )}
                    </td>
                    <td className="px-4 py-2 text-sm">
                      <div className="flex items-center gap-2">
                        <div className="w-20 h-2 bg-gray-200 rounded-full overflow-hidden">
                          <div
                            className={`h-full ${
                              quota.is_blocked ? 'bg-red-500' : quota.is_warning ? 'bg-yellow-500' : 'bg-green-500'
                            }`}
                            style={{ width: `${Math.min(quota.usage_percentage, 100)}%` }}
                          />
                        </div>
                        <span>${quota.current_usage} ({quota.usage_percentage.toFixed(1)}%)</span>
                      </div>
                    </td>
                    <td className="px-4 py-2 text-sm">
                      {quota.is_blocked ? (
                        <span className="px-2 py-1 bg-red-100 text-red-700 rounded text-xs">{t('blocked')}</span>
                      ) : quota.is_warning ? (
                        <span className="px-2 py-1 bg-yellow-100 text-yellow-700 rounded text-xs">{t('warning')}</span>
                      ) : (
                        <span className="px-2 py-1 bg-green-100 text-green-700 rounded text-xs">{t('normal')}</span>
                      )}
                    </td>
                    <td className="px-4 py-2 text-sm">
                      <button
                        onClick={() => {
                          setEditingQuotaId(quota.id)
                          setEditingQuotaLimit(quota.quota_limit)
                        }}
                        className="text-blue-600 hover:underline"
                      >
                        {t('adjust_limit')}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-200">
                <span className="text-sm text-gray-500">
                  {t('showing')} {(currentPage - 1) * itemsPerPage + 1}-{Math.min(currentPage * itemsPerPage, filteredUserQuotas.length)} {t('of')} {filteredUserQuotas.length}
                </span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="px-3 py-1 text-sm border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {t('prev')}
                  </button>
                  <span className="text-sm text-gray-600">
                    {currentPage} / {totalPages}
                  </span>
                  <button
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    className="px-3 py-1 text-sm border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {t('next')}
                  </button>
                </div>
              </div>
            )}
            </>
          )}
          </div>
        )}
      </section>
    </div>
  )
}
