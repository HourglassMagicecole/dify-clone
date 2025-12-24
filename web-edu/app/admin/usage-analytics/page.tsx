'use client'

import { useEffect, useState, useMemo } from 'react'
import {
  getSessionUsageSummary,
  getSessionDailyTrend,
  getSessionUserBreakdown,
  UsageSummary,
  DailyUsage,
  UserUsage,
} from '@/service/usage-analytics-api'
import { useSession } from '@/context/SessionContext'
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

  useEffect(() => {
    // For "all" tab, we'll show a placeholder for now (API not yet implemented)
    if (activeTab === 'all') {
      setLoading(false)
      setSummary([])
      setDailyTrend([])
      setUserBreakdown([])
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

  // Render "All" tab content (placeholder for now)
  const renderAllTabContent = () => {
    return (
      <div className="flex h-64 flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-300 bg-gray-50">
        <div className="text-center">
          <svg
            className="mx-auto h-12 w-12 text-gray-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
            />
          </svg>
          <h3 className="mt-2 text-sm font-medium text-gray-900">전체 사용량 분석</h3>
          <p className="mt-1 text-sm text-gray-500">이 기능은 준비 중입니다.</p>
          <p className="mt-1 text-xs text-gray-400">세션별 탭에서 개별 세션의 사용량을 확인하세요.</p>
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

