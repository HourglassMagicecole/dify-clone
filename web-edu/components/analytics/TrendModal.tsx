'use client'

import { useMemo, useState } from 'react'
import { UsageTrendChart, StackedTrendDataPoint } from './UsageTrendChart'

interface TrendModalProps {
  isOpen: boolean
  onClose: () => void
  title: string
  data: StackedTrendDataPoint[]
  usageType?: string // If provided, filter data for this type only
}

export function TrendModal({ isOpen, onClose, title, data, usageType }: TrendModalProps) {
  const [metric, setMetric] = useState<'price' | 'tokens' | 'requests'>('price')
  const [cumulative, setCumulative] = useState(false)

  // Filter data if usageType is specified
  const filteredData = useMemo(() => {
    if (!usageType) return data
    return data.filter((d) => d.usageType === usageType)
  }, [data, usageType])

  // For single type, we don't need stacked - convert to simple format
  const trendData = useMemo(() => {
    let result: { date: string; tokens: number; price: number; requests: number }[] = []

    if (usageType) {
      // Single type - aggregate by date
      const grouped: Record<string, { date: string; tokens: number; price: number; requests: number }> = {}
      for (const d of filteredData) {
        const existing = grouped[d.date]
        if (existing) {
          existing.tokens += d.tokens
          existing.price += d.price
          existing.requests += d.requests
        } else {
          grouped[d.date] = {
            date: d.date,
            tokens: d.tokens,
            price: d.price,
            requests: d.requests,
          }
        }
      }
      result = Object.values(grouped).sort((a, b) => a.date.localeCompare(b.date))
    } else {
      // For total - aggregate all types by date
      const grouped: Record<string, { date: string; tokens: number; price: number; requests: number }> = {}
      for (const d of data) {
        const existing = grouped[d.date]
        if (existing) {
          existing.tokens += d.tokens
          existing.price += d.price
          existing.requests += d.requests
        } else {
          grouped[d.date] = {
            date: d.date,
            tokens: d.tokens,
            price: d.price,
            requests: d.requests,
          }
        }
      }
      result = Object.values(grouped).sort((a, b) => a.date.localeCompare(b.date))
    }

    // Apply cumulative sum if enabled
    if (cumulative && result.length > 0) {
      let sumTokens = 0
      let sumPrice = 0
      let sumRequests = 0
      result = result.map((d) => {
        sumTokens += d.tokens
        sumPrice += d.price
        sumRequests += d.requests
        return {
          date: d.date,
          tokens: sumTokens,
          price: sumPrice,
          requests: sumRequests,
        }
      })
    }

    return result
  }, [data, filteredData, usageType, cumulative])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div
        className="w-full max-w-3xl rounded-lg bg-white p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-gray-900">{title}</h2>
          <button
            onClick={onClose}
            className="rounded-full p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
          >
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Controls */}
        <div className="mb-4 flex items-center justify-end gap-4">
          <label className="flex cursor-pointer items-center gap-2 text-sm text-gray-600">
            <input
              type="checkbox"
              checked={cumulative}
              onChange={(e) => setCumulative(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            누적
          </label>
          <select
            value={metric}
            onChange={(e) => setMetric(e.target.value as typeof metric)}
            className="rounded-md border border-gray-300 px-3 py-1 text-sm"
          >
            <option value="price">비용</option>
            <option value="tokens">토큰</option>
            <option value="requests">요청 수</option>
          </select>
        </div>

        {/* Chart */}
        <div className="h-80">
          {trendData.length > 0 ? (
            <UsageTrendChart
              data={trendData}
              metric={metric}
              stacked={false}
              loading={false}
            />
          ) : (
            <div className="flex h-full items-center justify-center text-gray-500">
              데이터가 없습니다
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
