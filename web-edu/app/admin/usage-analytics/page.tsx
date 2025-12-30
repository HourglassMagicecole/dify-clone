'use client'

import { useEffect, useState, useMemo } from 'react'
import {
  getSessionUsageSummary,
  getSessionDailyTrend,
  getSessionUserBreakdown,
  getUserUsageLogs,
  cleanupOldUsageLogs,
  deleteSessionUsageLogs,
  UsageSummary,
  DailyUsage,
  UserUsage,
  UsageLogEntry,
} from '@/service/usage-analytics-api'
import { exportSessionUsageToXlsx } from '@/utils/export-xlsx'
import { sessionAPI } from '@/service/session-api'
import { useSession } from '@/context/SessionContext'
import type { Session } from '@/types/session'
import { useAuth } from '@/hooks/useAuth'
import { DateRangePicker, DateRange } from '@/components/common/DateRangePicker'
import {
  UsageOverviewCards,
  UsageTypeStats,
  TopUsersTable,
  UserUsageDetailModal,
  TrendModal,
  ExportButton,
  StackedTrendDataPoint,
  UserUsageData,
} from '@/components/analytics'

type TabType = 'all' | 'session'

export default function UsageAnalyticsPage() {
  const { currentSession } = useSession()
  const { user } = useAuth()
  const isOwner = user?.actualRole === 'owner'

  // Tab state - Owner can see both tabs, Admin only sees session tab
  const [activeTab, setActiveTab] = useState<TabType>(isOwner ? 'all' : 'session')

  const [summary, setSummary] = useState<UsageSummary[]>([])
  const [dailyTrend, setDailyTrend] = useState<DailyUsage[]>([])
  const [userBreakdown, setUserBreakdown] = useState<UserUsage[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Inactive sessions for "all" tab
  const [inactiveSessions, setInactiveSessions] = useState<Session[]>([])
  const [inactiveLoading, setInactiveLoading] = useState(false)

  // Date range state
  const [dateRange, setDateRange] = useState<DateRange>(() => {
    const getDateString = (date: Date): string => date.toISOString().split('T')[0] ?? ''
    const endDate = getDateString(new Date())
    const startDate = getDateString(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000))
    return { startDate, endDate }
  })

  // Trend modal state
  const [trendModalOpen, setTrendModalOpen] = useState(false)
  const [trendModalType, setTrendModalType] = useState<string | null>(null) // null = total, string = specific type

  // User detail modal
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null)

  // Update tab when user role changes
  useEffect(() => {
    if (!isOwner && activeTab === 'all') {
      setActiveTab('session')
    }
  }, [isOwner, activeTab])

  // Load inactive sessions for "all" tab
  const loadInactiveSessions = async () => {
    try {
      setInactiveLoading(true)
      const data = await sessionAPI.listSessions(false, 1, 100) // Get up to 100 inactive sessions
      setInactiveSessions(data.sessions)
    } catch (err) {
      console.error('Failed to load inactive sessions:', err)
    } finally {
      setInactiveLoading(false)
    }
  }

  useEffect(() => {
    // For "all" tab, load inactive sessions
    if (activeTab === 'all') {
      setLoading(false)
      setSummary([])
      setDailyTrend([])
      setUserBreakdown([])
      loadInactiveSessions()
      return
    }

    // For "session" tab, require session selection
    if (!currentSession?.id) {
      setLoading(false)
      return
    }

    const loadData = async () => {
      try {
        setLoading(true)
        setError(null)

        const [summaryRes, trendRes, userRes] = await Promise.all([
          getSessionUsageSummary(currentSession.id, dateRange.startDate, dateRange.endDate),
          getSessionDailyTrend(currentSession.id, dateRange.startDate, dateRange.endDate),
          getSessionUserBreakdown(currentSession.id, dateRange.startDate, dateRange.endDate),
        ])

        if (summaryRes.result === 'success' && summaryRes.data) {
          setSummary(summaryRes.data)
        }
        if (trendRes.result === 'success' && trendRes.data) {
          setDailyTrend(trendRes.data)
        }
        if (userRes.result === 'success' && userRes.data) {
          setUserBreakdown(userRes.data)
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load analytics')
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [currentSession?.id, dateRange.startDate, dateRange.endDate, activeTab])

  // Transform daily trend data for modal charts
  const stackedTrendData: StackedTrendDataPoint[] = useMemo(() => {
    return dailyTrend.map((d) => ({
      date: d.date,
      usageType: d.usage_type,
      tokens: d.total_tokens,
      price: parseFloat(d.total_price),
      requests: d.request_count,
    }))
  }, [dailyTrend])

  // Usage by type for overview cards
  const usageByTypeStats: UsageTypeStats[] = useMemo(() => {
    return summary.map((s) => ({
      usageType: s.usage_type,
      totalPrice: parseFloat(s.total_price),
      requestCount: s.request_count,
    }))
  }, [summary])

  const userTableData: UserUsageData[] = useMemo(() => {
    return userBreakdown.map((u) => ({
      accountId: u.account_id,
      displayName: u.account_name,
      usageType: u.usage_type,
      requestCount: u.request_count,
      totalTokens: u.total_tokens,
      totalPrice: u.total_price,
    }))
  }, [userBreakdown])

  // Totals
  const getTotalPrice = () => summary.reduce((acc, s) => acc + parseFloat(s.total_price), 0)
  const getTotalTokens = () => summary.reduce((acc, s) => acc + s.total_tokens, 0)
  const getTotalRequests = () => summary.reduce((acc, s) => acc + s.request_count, 0)

  // Export handler
  const handleExport = async (format: 'csv' | 'json') => {
    const data = {
      period: dateRange,
      summary: {
        totalCost: getTotalPrice(),
        totalTokens: getTotalTokens(),
        totalRequests: getTotalRequests(),
      },
      byType: summary,
      byUser: userBreakdown,
      dailyTrend,
    }

    const blob =
      format === 'json'
        ? new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
        : new Blob([convertToCSV(data)], { type: 'text/csv' })

    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `usage-analytics-${dateRange.startDate}-${dateRange.endDate}.${format}`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  // Selected user data for modal
  const selectedUserData = useMemo(() => {
    if (!selectedUserId) return []
    return userBreakdown
      .filter((u) => u.account_id === selectedUserId)
      .map((u) => ({
        usageType: u.usage_type,
        requestCount: u.request_count,
        totalTokens: u.total_tokens,
        totalPrice: u.total_price,
      }))
  }, [selectedUserId, userBreakdown])

  // Cleanup state (Owner - all expired logs)
  const [cleanupLoading, setCleanupLoading] = useState(false)
  const [cleanupResult, setCleanupResult] = useState<{ deleted: number } | null>(null)

  const handleCleanup = async () => {
    if (!confirm('만료된 사용량 로그를 삭제하시겠습니까?\n(보관 기한이 지난 로그가 삭제됩니다)')) {
      return
    }

    try {
      setCleanupLoading(true)
      setCleanupResult(null)
      const res = await cleanupOldUsageLogs()
      if (res.result === 'success' && res.data) {
        setCleanupResult({ deleted: res.data.deleted_count })
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Cleanup 실패')
    } finally {
      setCleanupLoading(false)
    }
  }

  // Session log delete state
  const [deletingSessionId, setDeletingSessionId] = useState<string | null>(null)
  const [deleteResult, setDeleteResult] = useState<{ deleted: number; sessionName: string } | null>(null)

  const handleDeleteSessionLogs = async (sessionId: string, sessionName: string) => {
    if (!confirm(`"${sessionName}" 세션의 모든 사용량 로그를 삭제하시겠습니까?\n\n이 작업은 되돌릴 수 없습니다.`)) {
      return
    }

    try {
      setDeletingSessionId(sessionId)
      setDeleteResult(null)
      setError(null)
      const res = await deleteSessionUsageLogs(sessionId)
      if (res.result === 'success' && res.data) {
        setDeleteResult({ deleted: res.data.deleted_count, sessionName })
        // Reload inactive sessions after deletion
        loadInactiveSessions()
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '로그 삭제 실패')
    } finally {
      setDeletingSessionId(null)
    }
  }

  // Session export state
  const [exportingSessionId, setExportingSessionId] = useState<string | null>(null)

  const handleExportSession = async (session: Session) => {
    try {
      setExportingSessionId(session.id)
      setError(null)

      // Fetch all data for the session
      const [summaryRes, userRes] = await Promise.all([
        getSessionUsageSummary(session.id),
        getSessionUserBreakdown(session.id),
      ])

      if (summaryRes.result !== 'success' || userRes.result !== 'success') {
        throw new Error('데이터 조회 실패')
      }

      const summaryData = summaryRes.data || []
      const userData = userRes.data || []

      // Get unique user IDs
      const userIds = [...new Set(userData.map((u) => u.account_id))]

      // Fetch logs for each user
      const userLogs = new Map<string, UsageLogEntry[]>()
      for (const userId of userIds) {
        const logsRes = await getUserUsageLogs(session.id, userId)
        if (logsRes.result === 'success' && logsRes.data) {
          userLogs.set(userId, logsRes.data.items)
        }
      }

      // Export to XLSX
      exportSessionUsageToXlsx({
        sessionName: session.session_name,
        sessionTag: session.session_tag,
        startDate: new Date(session.start_date).toLocaleDateString('ko-KR'),
        endDate: session.end_date ? new Date(session.end_date).toLocaleDateString('ko-KR') : null,
        summary: summaryData,
        userBreakdown: userData,
        userLogs,
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : '내보내기 실패')
    } finally {
      setExportingSessionId(null)
    }
  }

  // Render "All" tab content
  const renderAllTabContent = () => {
    return (
      <div className="space-y-6">
        {/* Delete result message */}
        {deleteResult !== null && (
          <div className="rounded-md bg-green-50 p-4 text-green-800">
            &quot;{deleteResult.sessionName}&quot; 세션의 {deleteResult.deleted}개 로그가 삭제되었습니다.
            <button onClick={() => setDeleteResult(null)} className="ml-2 text-green-900 underline">
              닫기
            </button>
          </div>
        )}

        {error && (
          <div className="rounded-md bg-red-50 p-4 text-red-600">
            {error}
            <button onClick={() => setError(null)} className="ml-2 text-red-800 underline">
              닫기
            </button>
          </div>
        )}

        {/* Inactive Sessions Section */}
        <div className="rounded-lg border border-gray-200 bg-white p-6">
          <h3 className="mb-4 text-lg font-semibold text-gray-900">비활성 세션 로그 관리</h3>
          <p className="mb-4 text-sm text-gray-500">
            종료된 세션의 사용량 로그를 확인하고 삭제할 수 있습니다.
          </p>

          {inactiveLoading ? (
            <div className="py-8 text-center text-gray-500">로딩 중...</div>
          ) : inactiveSessions.length === 0 ? (
            <div className="py-8 text-center text-gray-500">비활성 세션이 없습니다.</div>
          ) : (
            <div className="overflow-hidden rounded-lg border border-gray-200">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                      세션명
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                      기간
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                      강사
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">
                      작업
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 bg-white">
                  {inactiveSessions.map((session) => (
                    <tr key={session.id} className="hover:bg-gray-50">
                      <td className="whitespace-nowrap px-4 py-3 text-sm font-medium text-gray-900">
                        {session.session_name}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-500">
                        {new Date(session.start_date).toLocaleDateString()} ~{' '}
                        {session.end_date ? new Date(session.end_date).toLocaleDateString() : '-'}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-500">
                        {session.instructor_name}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-right text-sm">
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => handleExportSession(session)}
                            disabled={exportingSessionId === session.id}
                            className="rounded bg-blue-600 px-3 py-1 text-xs font-medium text-white hover:bg-blue-700 disabled:bg-gray-400"
                          >
                            {exportingSessionId === session.id ? '내보내기 중...' : '내보내기'}
                          </button>
                          <button
                            onClick={() => handleDeleteSessionLogs(session.id, session.session_name)}
                            disabled={deletingSessionId === session.id}
                            className="rounded bg-red-600 px-3 py-1 text-xs font-medium text-white hover:bg-red-700 disabled:bg-gray-400"
                          >
                            {deletingSessionId === session.id ? '삭제 중...' : '로그 삭제'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* System Maintenance Section - Owner Only */}
        <div className="rounded-lg border border-gray-200 bg-white p-6">
          <h3 className="mb-4 text-lg font-semibold text-gray-900">시스템 관리</h3>
          <div className="space-y-4">
            <div className="flex items-start justify-between rounded-lg bg-gray-50 p-4">
              <div>
                <h4 className="font-medium text-gray-900">만료된 로그 일괄 정리</h4>
                <p className="mt-1 text-sm text-gray-500">
                  보관 기한이 지난 모든 사용량 로그를 일괄 삭제합니다.
                </p>
              </div>
              <button
                onClick={handleCleanup}
                disabled={cleanupLoading}
                className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:bg-gray-400"
              >
                {cleanupLoading ? '삭제 중...' : '일괄 정리'}
              </button>
            </div>
            {cleanupResult !== null && (
              <div className="rounded-md bg-green-50 p-3 text-sm text-green-800">
                {cleanupResult.deleted}개의 로그가 삭제되었습니다.
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

  // Render "Session" tab content
  const renderSessionTabContent = () => {
    if (!currentSession) {
      return (
        <div className="flex h-64 items-center justify-center">
          <div className="text-gray-500">세션을 선택해주세요.</div>
        </div>
      )
    }

    return (
      <>
        {/* Header with session info */}
        <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-gray-600">세션: {currentSession.session_name}</p>
          </div>
          <div className="flex items-center gap-4">
            <DateRangePicker value={dateRange} onChange={setDateRange} />
            <ExportButton onExport={handleExport} />
          </div>
        </div>

        {error && (
          <div className="mb-4 rounded-md bg-red-50 p-4 text-red-600">
            {error}
            <button onClick={() => setError(null)} className="ml-2 text-red-800 underline">
              닫기
            </button>
          </div>
        )}

        {/* Usage Overview Cards */}
        <div className="mb-8">
          <UsageOverviewCards
            totalCost={getTotalPrice()}
            totalRequests={getTotalRequests()}
            byType={usageByTypeStats}
            loading={loading}
            onTotalClick={() => {
              setTrendModalType(null)
              setTrendModalOpen(true)
            }}
            onTypeClick={(usageType) => {
              setTrendModalType(usageType)
              setTrendModalOpen(true)
            }}
          />
        </div>

        {/* User Breakdown */}
        <div>
          <h2 className="mb-4 text-lg font-semibold text-gray-900">사용자별 사용량</h2>
          <TopUsersTable
            users={userTableData}
            loading={loading}
            onUserClick={(accountId) => setSelectedUserId(accountId)}
            pageSize={10}
          />
        </div>

        {/* User Detail Modal */}
        <UserUsageDetailModal
          isOpen={!!selectedUserId}
          onClose={() => setSelectedUserId(null)}
          sessionId={currentSession?.id || ''}
          accountId={selectedUserId || ''}
          displayName={userBreakdown.find((u) => u.account_id === selectedUserId)?.account_name}
          usageData={selectedUserData}
          dateRange={dateRange}
        />

        {/* Trend Modal */}
        <TrendModal
          isOpen={trendModalOpen}
          onClose={() => setTrendModalOpen(false)}
          title={trendModalType ? `${trendModalType.toUpperCase()} 일별 추이` : '총 비용 일별 추이'}
          data={stackedTrendData}
          usageType={trendModalType ?? undefined}
        />
      </>
    )
  }

  return (
    <div className="p-6">
      {/* Page Title */}
      <h1 className="mb-6 text-2xl font-bold text-gray-900">사용량 분석</h1>

      {/* Tab Navigation - Only show for Owner */}
      {isOwner && (
        <div className="mb-6 border-b border-gray-200">
          <nav className="-mb-px flex space-x-8">
            <button
              onClick={() => setActiveTab('all')}
              className={`whitespace-nowrap border-b-2 px-1 py-4 text-sm font-medium ${
                activeTab === 'all'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
              }`}
            >
              전체
            </button>
            <button
              onClick={() => setActiveTab('session')}
              className={`whitespace-nowrap border-b-2 px-1 py-4 text-sm font-medium ${
                activeTab === 'session'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
              }`}
            >
              세션별
            </button>
          </nav>
        </div>
      )}

      {/* Tab Content */}
      {activeTab === 'all' ? renderAllTabContent() : renderSessionTabContent()}
    </div>
  )
}

// Helper functions
function convertToCSV(data: {
  summary: { totalCost: number; totalTokens: number; totalRequests: number }
  byType: UsageSummary[]
}): string {
  const lines = ['Type,Requests,Input Tokens,Output Tokens,Total Tokens,Price']
  data.byType.forEach((s) => {
    lines.push(
      `${s.usage_type},${s.request_count},${s.total_input_tokens},${s.total_output_tokens},${s.total_tokens},${s.total_price}`,
    )
  })
  lines.push('')
  lines.push(`Total,,,,${data.summary.totalTokens},${data.summary.totalCost}`)
  return lines.join('\n')
}

