'use client'

import { useEffect, useState } from 'react'
import useSWR from 'swr'
import { useTranslation } from 'react-i18next'
import { useAuth } from '@/hooks/useAuth'
import {
  getMyUsageSummary,
  getUserUsageLogs,
  UsageSummary,
  UsageLogEntry,
} from '@/service/usage-analytics-api'
import { quotaAPI } from '@/service/quota-api'
import type { MyQuotaStatus } from '@/types/quota'

interface MyUsageSectionProps {
  sessionId: string
}

interface UsageByType {
  usageType: string
  requestCount: number
  totalTokens: number
  totalPrice: string
}

function formatPrice(price: string | number): string {
  const num = typeof price === 'string' ? parseFloat(price) : price
  if (num === 0) return '$0.00'
  return num < 0.01 ? `$${num.toFixed(6)}` : `$${num.toFixed(2)}`
}

function formatTokens(tokens: number): string {
  if (tokens >= 1000000) return `${(tokens / 1000000).toFixed(2)}M`
  if (tokens >= 1000) return `${(tokens / 1000).toFixed(1)}K`
  return tokens.toString()
}

function formatDateTime(isoString: string): string {
  const date = new Date(isoString)
  return date.toLocaleString('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

function simplifyProvider(provider: string | null): string {
  if (!provider) return ''
  return provider.includes('/') ? provider.split('/').pop() || provider : provider
}

function getSourceDisplay(appName: string | null, invokeSource: string | null): string {
  if (appName) return appName
  switch (invokeSource) {
    case 'tool_test':
      return '도구 테스트'
    case 'hit_testing':
      return 'RAG 테스트'
    case 'indexing':
      return '인덱싱'
    case 'agent':
      return '에이전트'
    default:
      return invokeSource || '-'
  }
}

export function MyUsageSection({ sessionId }: MyUsageSectionProps) {
  const { user } = useAuth()
  const { t } = useTranslation('quota')
  const [usageData, setUsageData] = useState<UsageByType[]>([])
  const [logs, setLogs] = useState<UsageLogEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [logsLoading, setLogsLoading] = useState(false)
  const [activeTab, setActiveTab] = useState<'summary' | 'logs'>('summary')
  const [totalStats, setTotalStats] = useState({ requests: 0, tokens: 0, price: 0 })

  // Fetch quota data
  const { data: quotas } = useSWR(
    sessionId ? ['my-quotas', sessionId] : null,
    () => quotaAPI.getMyQuotas(sessionId),
    { refreshInterval: 60000 },
  )

  // Load usage summary
  useEffect(() => {
    const loadSummary = async () => {
      if (!sessionId) return

      try {
        setLoading(true)
        const response = await getMyUsageSummary(sessionId)

        if (response.result === 'success' && response.data) {
          const transformed: UsageByType[] = response.data.map((s: UsageSummary) => ({
            usageType: s.usage_type,
            requestCount: s.request_count,
            totalTokens: s.total_tokens,
            totalPrice: s.total_price,
          }))
          setUsageData(transformed)

          const stats = transformed.reduce(
            (acc, item) => ({
              requests: acc.requests + item.requestCount,
              tokens: acc.tokens + item.totalTokens,
              price: acc.price + parseFloat(item.totalPrice),
            }),
            { requests: 0, tokens: 0, price: 0 }
          )
          setTotalStats(stats)
        }
      } catch (error) {
        console.error('Failed to load usage summary:', error)
      } finally {
        setLoading(false)
      }
    }

    loadSummary()
  }, [sessionId])

  // Load logs when switching to logs tab
  useEffect(() => {
    const loadLogs = async () => {
      if (activeTab !== 'logs' || !sessionId || !user?.id) return

      try {
        setLogsLoading(true)
        const response = await getUserUsageLogs(sessionId, user.id)

        if (response.result === 'success' && response.data) {
          setLogs(response.data.items)
        }
      } catch (error) {
        console.error('Failed to load usage logs:', error)
      } finally {
        setLogsLoading(false)
      }
    }

    loadLogs()
  }, [activeTab, sessionId, user?.id])

  return (
    <div className="rounded-lg border border-gray-300 bg-white p-6">
      <h2 className="mb-4 text-xl font-bold">내 사용량</h2>

      {/* Summary Stats */}
      <div className="mb-6 grid grid-cols-3 gap-4">
        <div className="rounded-lg bg-gray-50 p-4">
          <div className="text-sm text-gray-500">총 요청</div>
          <div className="mt-1 text-2xl font-bold text-gray-900">
            {loading ? '-' : totalStats.requests.toLocaleString()}
          </div>
        </div>
        <div className="rounded-lg bg-gray-50 p-4">
          <div className="text-sm text-gray-500">총 토큰</div>
          <div className="mt-1 text-2xl font-bold text-gray-900">
            {loading ? '-' : formatTokens(totalStats.tokens)}
          </div>
        </div>
        <div className="rounded-lg bg-gray-50 p-4">
          <div className="text-sm text-gray-500">총 비용</div>
          <div className="mt-1 text-2xl font-bold text-blue-600">
            {loading ? '-' : formatPrice(totalStats.price)}
          </div>
        </div>
      </div>

      {/* Quota Status */}
      {quotas && quotas.length > 0 && (
        <div className="mb-6">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">{t('my_quota_status')}</h3>
          <div className="space-y-3">
            {quotas.map((quota: MyQuotaStatus) => (
              <div key={quota.model_provider} className="rounded-lg border border-gray-200 p-3">
                {/* Provider name and status */}
                <div className="flex items-center justify-between mb-2">
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
                <div className="relative mb-1">
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
                  <div className="text-xs text-gray-400 mt-1">
                    {t('resets_at')}: {new Date(quota.reset_at).toLocaleString()}
                  </div>
                )}

                {/* Blocked message */}
                {quota.is_blocked && (
                  <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded text-xs text-red-700">
                    {t('quota_exceeded_message')}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab('summary')}
            className={`whitespace-nowrap border-b-2 px-1 py-3 text-sm font-medium ${
              activeTab === 'summary'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
            }`}
          >
            타입별 요약
          </button>
          <button
            onClick={() => setActiveTab('logs')}
            className={`whitespace-nowrap border-b-2 px-1 py-3 text-sm font-medium ${
              activeTab === 'logs'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
            }`}
          >
            상세 로그
          </button>
        </nav>
      </div>

      {/* Tab Content */}
      <div className="mt-6">
        {activeTab === 'summary' ? (
          <div>
            {loading ? (
              <div className="animate-pulse space-y-2">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-12 rounded bg-gray-200" />
                ))}
              </div>
            ) : usageData.length === 0 ? (
              <div className="rounded-lg bg-gray-50 p-8 text-center text-gray-500">
                사용량 데이터가 없습니다.
              </div>
            ) : (
              <div className="space-y-2">
                {usageData.map((item) => (
                  <div
                    key={item.usageType}
                    className="flex items-center justify-between rounded-lg border border-gray-200 p-3"
                  >
                    <div className="flex items-center gap-3">
                      <span className="inline-flex rounded-full bg-blue-100 px-3 py-1 text-sm font-medium text-blue-800">
                        {item.usageType.toUpperCase()}
                      </span>
                      <span className="text-sm text-gray-500">
                        {item.requestCount.toLocaleString()} 요청
                      </span>
                    </div>
                    <div className="flex items-center gap-6">
                      <div className="text-right">
                        <div className="text-xs text-gray-500">토큰</div>
                        <div className="font-medium text-gray-900">{formatTokens(item.totalTokens)}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-xs text-gray-500">비용</div>
                        <div className="font-medium text-blue-600">{formatPrice(item.totalPrice)}</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="max-h-96 overflow-auto">
            {logsLoading ? (
              <div className="animate-pulse space-y-2">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="h-10 rounded bg-gray-200" />
                ))}
              </div>
            ) : logs.length === 0 ? (
              <div className="rounded-lg bg-gray-50 p-8 text-center text-gray-500">
                상세 로그가 없습니다.
              </div>
            ) : (
              <table className="min-w-full divide-y divide-gray-200 text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium text-gray-500">시간</th>
                    <th className="px-3 py-2 text-left font-medium text-gray-500">타입</th>
                    <th className="px-3 py-2 text-left font-medium text-gray-500">모델</th>
                    <th className="px-3 py-2 text-left font-medium text-gray-500">출처</th>
                    <th className="px-3 py-2 text-right font-medium text-gray-500">입력</th>
                    <th className="px-3 py-2 text-right font-medium text-gray-500">출력</th>
                    <th className="px-3 py-2 text-right font-medium text-gray-500">비용</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {logs.map((log) => (
                    <tr key={log.id} className="hover:bg-gray-50">
                      <td className="whitespace-nowrap px-3 py-2 text-gray-600">
                        {formatDateTime(log.created_at)}
                      </td>
                      <td className="px-3 py-2">
                        <span className="inline-flex rounded bg-blue-100 px-2 py-0.5 text-xs text-blue-800">
                          {log.usage_type}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-gray-900">
                        {log.model_provider && log.model_id
                          ? `${simplifyProvider(log.model_provider)}/${log.model_id}`
                          : '-'}
                      </td>
                      <td className="max-w-32 truncate px-3 py-2 text-gray-600" title={log.app_name || log.invoke_source || ''}>
                        {getSourceDisplay(log.app_name, log.invoke_source)}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2 text-right text-gray-900">
                        {log.input_tokens.toLocaleString()}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2 text-right text-gray-900">
                        {log.output_tokens.toLocaleString()}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2 text-right text-blue-600">
                        {formatPrice(log.total_price)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
