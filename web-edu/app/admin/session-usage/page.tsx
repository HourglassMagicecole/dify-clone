'use client'

import { useEffect, useState, useMemo } from 'react'
import {
  getSessionUsageSummary,
  getSessionDailyTrend,
  getSessionUserBreakdown,
  getUserUsageLogs,
  UsageSummary,
  DailyUsage,
  UserUsage,
  UsageLogEntry,
} from '@/service/usage-analytics-api'
import { exportSessionUsageToXlsx } from '@/utils/export-xlsx'
import { useSession } from '@/context/SessionContext'
import { DateRangePicker, DateRange } from '@/components/common/DateRangePicker'
import {
  UsageOverviewCards,
  TopUsersTable,
  UserUsageDetailModal,
  TrendModal,
  StackedTrendDataPoint,
  UserUsageData,
} from '@/components/analytics'

export default function SessionUsagePage() {
  const { currentSession } = useSession()

  const [summary, setSummary] = useState<UsageSummary[]>([])
  const [dailyTrend, setDailyTrend] = useState<DailyUsage[]>([])
  const [userBreakdown, setUserBreakdown] = useState<UserUsage[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Date range state
  const [dateRange, setDateRange] = useState<DateRange>(() => {
    const getDateString = (date: Date): string => date.toISOString().split('T')[0] ?? ''
    const endDate = getDateString(new Date())
    const startDate = getDateString(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000))
    return { startDate, endDate }
  })

  // Trend modal state
  const [trendModalOpen, setTrendModalOpen] = useState(false)
  const [trendModalType, setTrendModalType] = useState<string | null>(null)

  // User detail modal
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null)

  // Fetch data when session or date range changes
  useEffect(() => {
    if (!currentSession?.id) {
      setLoading(false)
      return
    }

    const fetchData = async () => {
      try {
        setLoading(true)
        setError(null)

        const [summaryRes, trendRes, userRes] = await Promise.all([
          getSessionUsageSummary(currentSession.id, dateRange.startDate, dateRange.endDate),
          getSessionDailyTrend(currentSession.id, dateRange.startDate, dateRange.endDate),
          getSessionUserBreakdown(currentSession.id, dateRange.startDate, dateRange.endDate),
        ])

        if (summaryRes.result === 'success') {
          setSummary(summaryRes.data || [])
        }
        if (trendRes.result === 'success') {
          setDailyTrend(trendRes.data || [])
        }
        if (userRes.result === 'success') {
          setUserBreakdown(userRes.data || [])
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : '데이터 로드 실패')
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [currentSession?.id, dateRange])

  // Calculate totals
  const getTotalPrice = () => summary.reduce((acc, s) => acc + parseFloat(s.total_price), 0)
  const getTotalRequests = () => summary.reduce((acc, s) => acc + s.request_count, 0)

  // Usage by type for cards
  const usageByTypeStats = useMemo(() => {
    return summary.map((s) => ({
      usageType: s.usage_type,
      totalPrice: parseFloat(s.total_price),
      requestCount: s.request_count,
    }))
  }, [summary])

  // Stacked trend data for chart
  const stackedTrendData: StackedTrendDataPoint[] = useMemo(() => {
    const dateMap = new Map<string, StackedTrendDataPoint>()

    dailyTrend.forEach((d) => {
      if (!dateMap.has(d.date)) {
        dateMap.set(d.date, { date: d.date })
      }
      const point = dateMap.get(d.date)!
      point[d.usage_type] = parseFloat(d.total_price)
    })

    return Array.from(dateMap.values()).sort((a, b) => a.date.localeCompare(b.date))
  }, [dailyTrend])

  // User table data - convert to UserUsageData format for TopUsersTable
  const userTableData = useMemo(() => {
    return userBreakdown.map((u) => ({
      accountId: u.account_id,
      displayName: u.account_name,
      usageType: u.usage_type,
      requestCount: u.request_count,
      totalTokens: u.total_tokens,
      totalPrice: u.total_price,
    }))
  }, [userBreakdown])

  // Selected user data for modal
  const selectedUserData: UserUsageData[] = useMemo(() => {
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

  // Export state
  const [exporting, setExporting] = useState(false)

  // Export handler - XLSX with session summary and per-user sheets
  const handleExport = async () => {
    if (!currentSession) return

    try {
      setExporting(true)
      setError(null)

      // Get unique user IDs (exclude "unknown" which indicates null account_id)
      const userIds = [...new Set(userBreakdown.map((u) => u.account_id))].filter(
        (id) => id && id !== 'unknown',
      )

      // Fetch logs for each user
      const userLogs = new Map<string, UsageLogEntry[]>()
      for (const userId of userIds) {
        const logsRes = await getUserUsageLogs(currentSession.id, userId, dateRange.startDate, dateRange.endDate)
        if (logsRes.result === 'success' && logsRes.data) {
          userLogs.set(userId, logsRes.data.items)
        }
      }

      // Export to XLSX
      exportSessionUsageToXlsx({
        sessionName: currentSession.session_name,
        sessionTag: currentSession.session_tag,
        startDate: dateRange.startDate,
        endDate: dateRange.endDate,
        summary,
        userBreakdown,
        userLogs,
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : '내보내기 실패')
    } finally {
      setExporting(false)
    }
  }

  if (!currentSession) {
    return (
      <div className="p-6">
        <h1 className="mb-6 text-2xl font-bold text-gray-900">세션 사용량</h1>
        <div className="flex h-64 items-center justify-center">
          <div className="text-gray-500">세션을 선택해주세요.</div>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6">
      {/* Page Title */}
      <h1 className="mb-6 text-2xl font-bold text-gray-900">세션 사용량</h1>

      {/* Header with session info */}
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-gray-600">세션: {currentSession.session_name}</p>
        </div>
        <div className="flex items-center gap-4">
          <DateRangePicker value={dateRange} onChange={setDateRange} />
          <button
            onClick={handleExport}
            disabled={exporting || loading}
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:bg-gray-400"
          >
            {exporting ? '내보내기 중...' : '내보내기'}
          </button>
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
        sessionId={currentSession.id}
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
    </div>
  )
}
