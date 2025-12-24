'use client'

import { useEffect, useState, useMemo } from 'react'
import {
  getMyUsageSummary,
  getMyDailyUsage,
  UsageSummary,
  DailyUsage,
} from '@/service/usage-analytics-api'
import { useSession } from '@/context/SessionContext'
import { UsageSummaryCards, UsageTrendChart, UsageByTypeChart, TrendDataPoint, UsageTypeData } from '@/components/analytics'

export default function MyUsagePage() {
  const { currentSession } = useSession()
  const [summary, setSummary] = useState<UsageSummary[]>([])
  const [dailyUsage, setDailyUsage] = useState<DailyUsage[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true)
        setError(null)

        const [summaryRes, dailyRes] = await Promise.all([
          getMyUsageSummary(currentSession?.id),
          getMyDailyUsage(currentSession?.id, 30),
        ])

        if (summaryRes.result === 'success' && summaryRes.data) {
          setSummary(summaryRes.data)
        }
        if (dailyRes.result === 'success' && dailyRes.data) {
          setDailyUsage(dailyRes.data)
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load usage data')
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [currentSession?.id])

  // Transform data for charts
  const trendData: TrendDataPoint[] = useMemo(() => {
    const grouped: Record<string, TrendDataPoint> = {}
    for (const d of dailyUsage) {
      const existing = grouped[d.date]
      if (existing) {
        existing.tokens += d.total_tokens
        existing.price += parseFloat(d.total_price)
        existing.requests += d.request_count
      } else {
        grouped[d.date] = {
          date: d.date,
          tokens: d.total_tokens,
          price: parseFloat(d.total_price),
          requests: d.request_count,
        }
      }
    }
    return Object.values(grouped).sort((a, b) => a.date.localeCompare(b.date))
  }, [dailyUsage])

  const usageByTypeData: UsageTypeData[] = useMemo(() => {
    return summary.map((s) => ({
      usageType: s.usage_type,
      totalPrice: parseFloat(s.total_price),
      totalTokens: s.total_tokens,
      requestCount: s.request_count,
    }))
  }, [summary])

  const getTotalPrice = () => summary.reduce((acc, s) => acc + parseFloat(s.total_price), 0)
  const getTotalTokens = () => summary.reduce((acc, s) => acc + s.total_tokens, 0)
  const getTotalRequests = () => summary.reduce((acc, s) => acc + s.request_count, 0)

  // Recent usage calculations
  const getDateString = (date: Date): string => {
    return date.toISOString().split('T')[0] ?? ''
  }
  const today = getDateString(new Date())
  const weekAgo = getDateString(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000))

  const todayUsage = dailyUsage
    .filter((d) => d.date === today)
    .reduce((acc, d) => ({ tokens: acc.tokens + d.total_tokens, price: acc.price + parseFloat(d.total_price) }), { tokens: 0, price: 0 })

  const weekUsage = dailyUsage
    .filter((d) => d.date >= weekAgo)
    .reduce((acc, d) => ({ tokens: acc.tokens + d.total_tokens, price: acc.price + parseFloat(d.total_price) }), { tokens: 0, price: 0 })

  const formatPrice = (price: number) => (price < 0.01 ? `$${price.toFixed(6)}` : `$${price.toFixed(2)}`)
  const formatTokens = (tokens: number) => {
    if (tokens >= 1000000) return `${(tokens / 1000000).toFixed(2)}M`
    if (tokens >= 1000) return `${(tokens / 1000).toFixed(1)}K`
    return tokens.toString()
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">내 사용량</h1>
        <p className="text-gray-600">나의 API 사용량 현황입니다.</p>
      </div>

      {error && (
        <div className="mb-4 rounded-md bg-red-50 p-4 text-red-600">
          {error}
          <button onClick={() => setError(null)} className="ml-2 text-red-800 underline">
            닫기
          </button>
        </div>
      )}

      {/* Summary Cards */}
      <div className="mb-8">
        <UsageSummaryCards
          totalCost={getTotalPrice()}
          totalTokens={getTotalTokens()}
          totalRequests={getTotalRequests()}
          loading={loading}
        />
      </div>

      {/* Recent Usage */}
      <div className="mb-8 grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="rounded-lg border border-gray-200 bg-white p-6">
          <h3 className="text-sm font-medium text-gray-500">오늘 사용량</h3>
          <div className="mt-2 flex items-end justify-between">
            <div className="text-2xl font-bold text-gray-900">{formatPrice(todayUsage.price)}</div>
            <div className="text-sm text-gray-500">{formatTokens(todayUsage.tokens)} 토큰</div>
          </div>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-6">
          <h3 className="text-sm font-medium text-gray-500">최근 7일 사용량</h3>
          <div className="mt-2 flex items-end justify-between">
            <div className="text-2xl font-bold text-gray-900">{formatPrice(weekUsage.price)}</div>
            <div className="text-sm text-gray-500">{formatTokens(weekUsage.tokens)} 토큰</div>
          </div>
        </div>
      </div>

      {/* Charts Row */}
      <div className="mb-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Trend Chart */}
        <div>
          <h2 className="mb-3 text-lg font-semibold text-gray-900">일별 사용량 추이</h2>
          <UsageTrendChart data={trendData} metric="price" loading={loading} />
        </div>

        {/* Usage by Type */}
        <div>
          <h2 className="mb-3 text-lg font-semibold text-gray-900">API 타입별 사용량</h2>
          <UsageByTypeChart data={usageByTypeData} metric="price" loading={loading} />
        </div>
      </div>

      {/* Usage by Type Table */}
      <div>
        <h2 className="mb-4 text-lg font-semibold text-gray-900">타입별 상세</h2>
        <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">타입</th>
                <th className="px-4 py-3 text-right text-sm font-medium text-gray-500">요청 수</th>
                <th className="px-4 py-3 text-right text-sm font-medium text-gray-500">입력 토큰</th>
                <th className="px-4 py-3 text-right text-sm font-medium text-gray-500">출력 토큰</th>
                <th className="px-4 py-3 text-right text-sm font-medium text-gray-500">총 토큰</th>
                <th className="px-4 py-3 text-right text-sm font-medium text-gray-500">비용</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                    로딩 중...
                  </td>
                </tr>
              ) : summary.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                    아직 사용 내역이 없습니다.
                  </td>
                </tr>
              ) : (
                summary.map((s, idx) => (
                  <tr key={idx}>
                    <td className="px-4 py-3">
                      <span className="inline-flex rounded-full bg-blue-100 px-3 py-1 text-sm font-medium text-blue-800">
                        {s.usage_type.toUpperCase()}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right text-gray-600">
                      {s.request_count.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-600">
                      {formatTokens(s.total_input_tokens)}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-600">
                      {formatTokens(s.total_output_tokens)}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-600">
                      {formatTokens(s.total_tokens)}
                    </td>
                    <td className="px-4 py-3 text-right font-medium text-gray-900">
                      {formatPrice(parseFloat(s.total_price))}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
