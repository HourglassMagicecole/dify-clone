'use client'

import { useEffect, useState, useMemo, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  getSystemUsageSummary,
  getSystemDailyTrend,
  getSystemUserBreakdown,
  UsageSummary,
  DailyUsage,
  UserUsage,
} from '@/service/usage-analytics-api'
import { useAuth } from '@/hooks/useAuth'
import { DateRangePicker, DateRange } from '@/components/common/DateRangePicker'
import { UsageOverviewCards, TrendModal, StackedTrendDataPoint } from '@/components/analytics'

/**
 * 시스템 사용량 페이지 (Owner 전용)
 * - 전체 시스템 사용량 통계
 * - 사용자별 순위 (전체 시스템)
 */
export default function UsageAnalyticsPage() {
  const router = useRouter()
  const { user, isLoading: authLoading } = useAuth()
  const isOwner = user?.actualRole === 'owner'

  // Redirect non-owner users
  useEffect(() => {
    if (!authLoading && !isOwner) {
      router.replace('/dashboard')
    }
  }, [authLoading, isOwner, router])

  // Date range state
  const [dateRange, setDateRange] = useState<DateRange>(() => {
    const getDateString = (date: Date): string => date.toISOString().split('T')[0] ?? ''
    const endDate = getDateString(new Date())
    const startDate = getDateString(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000))
    return { startDate, endDate }
  })

  // System usage stats
  const [summary, setSummary] = useState<UsageSummary[]>([])
  const [dailyTrend, setDailyTrend] = useState<DailyUsage[]>([])
  const [userBreakdown, setUserBreakdown] = useState<UserUsage[]>([])
  const [statsLoading, setStatsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Trend modal state
  const [trendModalOpen, setTrendModalOpen] = useState(false)
  const [trendModalType, setTrendModalType] = useState<string | null>(null)

  // Load system stats
  const loadSystemStats = useCallback(async () => {
    try {
      setStatsLoading(true)
      setError(null)

      const [summaryRes, trendRes, userRes] = await Promise.all([
        getSystemUsageSummary(dateRange.startDate, dateRange.endDate),
        getSystemDailyTrend(dateRange.startDate, dateRange.endDate),
        getSystemUserBreakdown(dateRange.startDate, dateRange.endDate),
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
      setStatsLoading(false)
    }
  }, [dateRange.startDate, dateRange.endDate])

  useEffect(() => {
    if (isOwner) {
      loadSystemStats()
    }
  }, [isOwner, loadSystemStats])

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
    return dailyTrend
      .map((d) => ({
        date: d.date,
        usageType: d.usage_type,
        tokens: d.total_tokens,
        price: parseFloat(d.total_price),
        requests: d.request_count,
      }))
      .sort((a, b) => a.date.localeCompare(b.date))
  }, [dailyTrend])

  // User ranking table data (aggregate by user across all sessions)
  const userRankingData = useMemo(() => {
    const userMap = new Map<
      string,
      { name: string; sessions: Set<string>; totalCost: number; totalRequests: number }
    >()

    userBreakdown.forEach((u) => {
      if (!userMap.has(u.account_id)) {
        userMap.set(u.account_id, { name: u.account_name, sessions: new Set(), totalCost: 0, totalRequests: 0 })
      }
      const user = userMap.get(u.account_id)!
      if (u.session_name) user.sessions.add(u.session_name)
      user.totalCost += parseFloat(u.total_price)
      user.totalRequests += u.request_count
    })

    return Array.from(userMap.entries())
      .map(([accountId, data]) => ({
        accountId,
        displayName: data.name,
        sessions: Array.from(data.sessions).join(', '),
        totalCost: data.totalCost,
        totalRequests: data.totalRequests,
      }))
      .sort((a, b) => b.totalCost - a.totalCost)
      .slice(0, 20) // Top 20
  }, [userBreakdown])

  // Show loading while checking auth
  if (authLoading) {
    return (
      <div className="flex h-64 items-center justify-center p-6">
        <div className="text-gray-500">로딩 중...</div>
      </div>
    )
  }

  // Non-owner will be redirected
  if (!isOwner) {
    return null
  }

  return (
    <div className="p-6">
      {/* Page Title */}
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <h1 className="text-2xl font-bold text-gray-900">시스템 사용량</h1>
        <DateRangePicker value={dateRange} onChange={setDateRange} />
      </div>

      {error && (
        <div className="mb-4 rounded-md bg-red-50 p-4 text-red-600">
          {error}
          <button onClick={() => setError(null)} className="ml-2 text-red-800 underline">
            닫기
          </button>
        </div>
      )}

      <div className="space-y-6">
        {/* System Usage Summary */}
        <div className="rounded-lg border border-gray-200 bg-white p-6">
          <h3 className="mb-4 text-lg font-semibold text-gray-900">전체 시스템 사용량</h3>
          <UsageOverviewCards
            totalCost={getTotalPrice()}
            totalRequests={getTotalRequests()}
            byType={usageByTypeStats}
            loading={statsLoading}
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

        {/* User Ranking */}
        <div className="rounded-lg border border-gray-200 bg-white p-6">
          <h3 className="mb-4 text-lg font-semibold text-gray-900">사용자별 사용량 순위 (Top 20)</h3>
          {statsLoading ? (
            <div className="py-8 text-center text-gray-500">로딩 중...</div>
          ) : userRankingData.length === 0 ? (
            <div className="py-8 text-center text-gray-500">사용량 데이터가 없습니다.</div>
          ) : (
            <div className="overflow-hidden rounded-lg border border-gray-200">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                      순위
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                      사용자
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                      세션
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">
                      요청 수
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">
                      비용
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 bg-white">
                  {userRankingData.map((user, index) => (
                    <tr key={user.accountId} className="hover:bg-gray-50">
                      <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-500">{index + 1}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-sm font-medium text-gray-900">
                        {user.displayName}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500">{user.sessions || '-'}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-right text-sm text-gray-600">
                        {user.totalRequests.toLocaleString()}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-right text-sm font-medium text-gray-900">
                        ${user.totalCost.toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

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
