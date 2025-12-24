'use client'

import { useEffect, useState } from 'react'
import { Modal } from '@/components/common/Modal'
import { ExportButton } from './ExportButton'
import { getUserUsageLogs, UsageLogEntry } from '@/service/usage-analytics-api'

interface UsageByType {
  usageType: string
  requestCount: number
  totalTokens: number
  totalPrice: string
}

interface UserUsageDetailModalProps {
  isOpen: boolean
  onClose: () => void
  sessionId: string
  accountId: string
  displayName?: string
  usageData: UsageByType[]
  dateRange?: { startDate: string; endDate: string }
  loading?: boolean
}

function formatPrice(price: string | number): string {
  const num = typeof price === 'string' ? parseFloat(price) : price
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

function sanitizeFileName(name: string): string {
  return name.replace(/[^a-zA-Z0-9가-힣_-]/g, '_')
}

export function UserUsageDetailModal({
  isOpen,
  onClose,
  sessionId,
  accountId,
  displayName,
  usageData,
  dateRange,
  loading = false,
}: UserUsageDetailModalProps) {
  const [totalStats, setTotalStats] = useState({ requests: 0, tokens: 0, price: 0 })
  const [logs, setLogs] = useState<UsageLogEntry[]>([])
  const [logsLoading, setLogsLoading] = useState(false)
  const [activeTab, setActiveTab] = useState<'summary' | 'logs'>('summary')

  useEffect(() => {
    const stats = usageData.reduce(
      (acc, item) => ({
        requests: acc.requests + item.requestCount,
        tokens: acc.tokens + item.totalTokens,
        price: acc.price + parseFloat(item.totalPrice),
      }),
      { requests: 0, tokens: 0, price: 0 },
    )
    setTotalStats(stats)
  }, [usageData])

  // Fetch detailed logs when switching to logs tab
  useEffect(() => {
    if (isOpen && activeTab === 'logs' && sessionId && accountId) {
      const fetchLogs = async () => {
        setLogsLoading(true)
        try {
          const response = await getUserUsageLogs(
            sessionId,
            accountId,
            dateRange?.startDate,
            dateRange?.endDate,
          )
          if (response.result === 'success' && response.data) {
            setLogs(response.data.items)
          }
        } catch (error) {
          console.error('Failed to fetch logs:', error)
        } finally {
          setLogsLoading(false)
        }
      }
      fetchLogs()
    }
  }, [isOpen, activeTab, sessionId, accountId, dateRange])

  // Reset tab when modal closes
  useEffect(() => {
    if (!isOpen) {
      setActiveTab('summary')
      setLogs([])
    }
  }, [isOpen])

  const handleExport = async (format: 'csv' | 'json') => {
    // Fetch logs if not already loaded
    let exportLogs = logs
    if (exportLogs.length === 0) {
      try {
        const response = await getUserUsageLogs(
          sessionId,
          accountId,
          dateRange?.startDate,
          dateRange?.endDate,
        )
        if (response.result === 'success' && response.data) {
          exportLogs = response.data.items
        }
      } catch (error) {
        console.error('Failed to fetch logs for export:', error)
        return
      }
    }

    const exportData = {
      user: {
        accountId,
        displayName: displayName || `User ${accountId.slice(0, 8)}`,
      },
      period: dateRange,
      summary: {
        totalRequests: totalStats.requests,
        totalTokens: totalStats.tokens,
        totalPrice: totalStats.price,
      },
      logs: exportLogs,
    }

    const userName = sanitizeFileName(displayName || `User_${accountId.slice(0, 8)}`)
    const dateStr = dateRange ? `${dateRange.startDate}_${dateRange.endDate}` : 'all'
    const fileName = `usage_${userName}_${dateStr}.${format}`

    const blob =
      format === 'json'
        ? new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' })
        : new Blob([convertLogsToCSV(exportLogs, displayName || `User ${accountId.slice(0, 8)}`)], {
            type: 'text/csv;charset=utf-8',
          })

    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = fileName
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="사용자 상세 사용량" size="xl">
      <div className="space-y-6">
        {/* User Info */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-100 text-lg font-medium text-blue-600">
              {displayName?.charAt(0) || accountId.charAt(0).toUpperCase()}
            </div>
            <div>
              <div className="font-medium text-gray-900">
                {displayName || `User ${accountId.slice(0, 8)}`}
              </div>
              <div className="text-sm text-gray-500">{accountId}</div>
            </div>
          </div>
          <ExportButton onExport={handleExport} />
        </div>

        {/* Summary Stats */}
        <div className="grid grid-cols-3 gap-4">
          <div className="rounded-lg bg-gray-50 p-4">
            <div className="text-sm text-gray-500">총 요청</div>
            <div className="mt-1 text-2xl font-bold text-gray-900">
              {totalStats.requests.toLocaleString()}
            </div>
          </div>
          <div className="rounded-lg bg-gray-50 p-4">
            <div className="text-sm text-gray-500">총 토큰</div>
            <div className="mt-1 text-2xl font-bold text-gray-900">
              {formatTokens(totalStats.tokens)}
            </div>
          </div>
          <div className="rounded-lg bg-gray-50 p-4">
            <div className="text-sm text-gray-500">총 비용</div>
            <div className="mt-1 text-2xl font-bold text-blue-600">
              {formatPrice(totalStats.price)}
            </div>
          </div>
        </div>

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
                    <th className="px-3 py-2 text-left font-medium text-gray-500">앱</th>
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
                      <td className="max-w-32 truncate px-3 py-2 text-gray-600" title={log.app_name || '-'}>
                        {log.app_name || '-'}
                      </td>
                      <td className="px-3 py-2 text-gray-600">
                        {log.invoke_source ? (
                          <span className="inline-flex rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-700">
                            {log.invoke_source}
                          </span>
                        ) : '-'}
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

        {/* Note */}
        <div className="rounded-lg bg-yellow-50 p-3 text-sm text-yellow-800">
          <strong>참고:</strong> 상세 사용 로그는 세션 종료 후 14일간 보관됩니다.
        </div>
      </div>
    </Modal>
  )
}

function simplifyProvider(provider: string | null): string {
  if (!provider) return ''
  // "langgenius/openai/openai" -> "openai"
  return provider.includes('/') ? provider.split('/').pop() || provider : provider
}

function getSourceDisplay(appName: string | null, invokeSource: string | null): string {
  if (appName)
    return appName
  switch (invokeSource) {
    case 'tool_test': return '도구 테스트'
    case 'hit_testing': return 'RAG 테스트'
    case 'indexing': return '인덱싱'
    case 'agent': return '에이전트'
    default: return invokeSource || ''
  }
}

function convertLogsToCSV(logs: UsageLogEntry[], userName: string): string {
  const BOM = '\uFEFF'
  const headers = ['사용자', '시간', '타입', 'Provider', '모델', '출처', '입력 토큰', '출력 토큰', '총 토큰', '비용', '통화']
  const rows = logs.map((log) => [
    userName,
    formatDateTime(log.created_at),
    log.usage_type,
    simplifyProvider(log.model_provider),
    log.model_id || '',
    getSourceDisplay(log.app_name, log.invoke_source),
    log.input_tokens.toString(),
    log.output_tokens.toString(),
    log.total_tokens.toString(),
    log.total_price,
    log.currency,
  ])

  const csvContent = [headers, ...rows].map((row) => row.map((cell) => `"${cell}"`).join(',')).join('\n')
  return BOM + csvContent
}
