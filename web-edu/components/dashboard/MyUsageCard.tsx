'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { getMyUsageSummary, getMyDailyUsage, UsageSummary, DailyUsage } from '@/service/usage-analytics-api'
import { useSession } from '@/context/SessionContext'

interface MyUsageCardProps {
  className?: string
}

function formatPrice(price: number): string {
  return price < 0.01 ? `$${price.toFixed(6)}` : `$${price.toFixed(2)}`
}

function formatTokens(tokens: number): string {
  if (tokens >= 1000000) return `${(tokens / 1000000).toFixed(2)}M`
  if (tokens >= 1000) return `${(tokens / 1000).toFixed(1)}K`
  return tokens.toString()
}

export function MyUsageCard({ className = '' }: MyUsageCardProps) {
  const { currentSession } = useSession()
  const [summary, setSummary] = useState<UsageSummary[]>([])
  const [dailyUsage, setDailyUsage] = useState<DailyUsage[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true)
        const [summaryRes, dailyRes] = await Promise.all([
          getMyUsageSummary(currentSession?.id),
          getMyDailyUsage(currentSession?.id, 7),
        ])

        if (summaryRes.result === 'success' && summaryRes.data) {
          setSummary(summaryRes.data)
        }
        if (dailyRes.result === 'success' && dailyRes.data) {
          setDailyUsage(dailyRes.data)
        }
      } catch (err) {
        console.error('Failed to load usage data:', err)
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [currentSession?.id])

  const getTotalPrice = () => {
    return summary.reduce((acc, s) => acc + parseFloat(s.total_price), 0)
  }

  const getTotalTokens = () => {
    return summary.reduce((acc, s) => acc + s.total_tokens, 0)
  }

  const getTotalRequests = () => {
    return summary.reduce((acc, s) => acc + s.request_count, 0)
  }

  // Calculate today's usage
  const formatDateString = (date: Date): string => date.toISOString().split('T')[0] ?? ''
  const today = formatDateString(new Date())
  const todayUsage = dailyUsage
    .filter((d) => d.date === today)
    .reduce((acc, d) => acc + parseFloat(d.total_price), 0)

  // Calculate this week's usage
  const weekAgo = formatDateString(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000))
  const weekUsage = dailyUsage
    .filter((d) => d.date >= weekAgo)
    .reduce((acc, d) => acc + parseFloat(d.total_price), 0)

  if (loading) {
    return (
      <div className={`rounded-lg border border-gray-200 bg-white p-6 ${className}`}>
        <div className="animate-pulse">
          <div className="h-5 w-24 rounded bg-gray-200" />
          <div className="mt-4 grid grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <div key={i}>
                <div className="h-3 w-12 rounded bg-gray-200" />
                <div className="mt-2 h-6 w-16 rounded bg-gray-200" />
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className={`rounded-lg border border-gray-200 bg-white p-6 ${className}`}>
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900">내 사용량</h3>
        <Link href="/my-usage" className="text-sm text-blue-600 hover:text-blue-800">
          상세 보기 →
        </Link>
      </div>

      {/* Summary Stats */}
      <div className="mb-4 grid grid-cols-3 gap-4">
        <div>
          <div className="text-xs text-gray-500">총 비용</div>
          <div className="text-lg font-bold text-blue-600">{formatPrice(getTotalPrice())}</div>
        </div>
        <div>
          <div className="text-xs text-gray-500">총 토큰</div>
          <div className="text-lg font-bold text-green-600">{formatTokens(getTotalTokens())}</div>
        </div>
        <div>
          <div className="text-xs text-gray-500">총 요청</div>
          <div className="text-lg font-bold text-purple-600">{getTotalRequests().toLocaleString()}</div>
        </div>
      </div>

      {/* Recent Usage */}
      <div className="border-t border-gray-100 pt-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="rounded-lg bg-gray-50 p-3">
            <div className="text-xs text-gray-500">오늘</div>
            <div className="mt-1 font-semibold text-gray-900">{formatPrice(todayUsage)}</div>
          </div>
          <div className="rounded-lg bg-gray-50 p-3">
            <div className="text-xs text-gray-500">최근 7일</div>
            <div className="mt-1 font-semibold text-gray-900">{formatPrice(weekUsage)}</div>
          </div>
        </div>
      </div>

      {/* Mini Trend (optional) */}
      {dailyUsage.length > 0 && (
        <div className="mt-4 border-t border-gray-100 pt-4">
          <div className="flex items-end justify-between gap-1">
            {dailyUsage.slice(-7).map((d, index) => {
              const maxPrice = Math.max(...dailyUsage.map((dd) => parseFloat(dd.total_price)), 0.01)
              const height = Math.max((parseFloat(d.total_price) / maxPrice) * 100, 4)
              return (
                <div key={index} className="flex flex-1 flex-col items-center">
                  <div
                    className="w-full rounded-t bg-blue-400"
                    style={{ height: `${height}%`, minHeight: '4px', maxHeight: '40px' }}
                  />
                  <div className="mt-1 text-[10px] text-gray-400">
                    {new Date(d.date).getDate()}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
