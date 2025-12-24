'use client'

import { useMemo } from 'react'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js'
import { Line, Bar } from 'react-chartjs-2'

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  Filler,
)

export interface TrendDataPoint {
  date: string
  tokens: number
  price: number
  requests: number
}

// For stacked charts - data grouped by usage type
export interface StackedTrendDataPoint {
  date: string
  usageType: string
  tokens: number
  price: number
  requests: number
}

interface UsageTrendChartProps {
  data: TrendDataPoint[]
  stackedData?: StackedTrendDataPoint[]
  chartType?: 'line' | 'bar'
  metric?: 'tokens' | 'price' | 'requests'
  stacked?: boolean
  loading?: boolean
}

const USAGE_TYPE_COLORS: Record<string, { border: string; background: string }> = {
  llm: { border: 'rgb(34, 197, 94)', background: 'rgba(34, 197, 94, 0.6)' },
  embedding: { border: 'rgb(59, 130, 246)', background: 'rgba(59, 130, 246, 0.6)' },
  rerank: { border: 'rgb(168, 85, 247)', background: 'rgba(168, 85, 247, 0.6)' },
  tts: { border: 'rgb(249, 115, 22)', background: 'rgba(249, 115, 22, 0.6)' },
  stt: { border: 'rgb(236, 72, 153)', background: 'rgba(236, 72, 153, 0.6)' },
  image_gen: { border: 'rgb(20, 184, 166)', background: 'rgba(20, 184, 166, 0.6)' },
  tool: { border: 'rgb(245, 158, 11)', background: 'rgba(245, 158, 11, 0.6)' },
}

const USAGE_TYPE_LABELS: Record<string, string> = {
  llm: 'LLM',
  embedding: 'Embedding',
  rerank: 'Rerank',
  tts: 'TTS',
  stt: 'STT',
  image_gen: 'Image Gen',
  tool: 'Tool',
}

export function UsageTrendChart({
  data,
  stackedData,
  chartType = 'line',
  metric = 'price',
  stacked = false,
  loading = false,
}: UsageTrendChartProps) {
  const chartData = useMemo(() => {
    // If stacked mode with stackedData, create multiple datasets
    if (stacked && stackedData && stackedData.length > 0) {
      // Get unique sorted dates
      const dates = [...new Set(stackedData.map((d) => d.date))].sort()
      const labels = dates.map((d) => {
        const date = new Date(d)
        return `${date.getMonth() + 1}/${date.getDate()}`
      })

      // Get unique usage types
      const usageTypes = [...new Set(stackedData.map((d) => d.usageType))]

      // Create dataset for each usage type
      const datasets = usageTypes.map((usageType) => {
        const typeData = stackedData.filter((d) => d.usageType === usageType)
        const colors = USAGE_TYPE_COLORS[usageType] || {
          border: 'rgb(156, 163, 175)',
          background: 'rgba(156, 163, 175, 0.6)',
        }

        // Map values to dates (fill missing dates with 0)
        const values = dates.map((date) => {
          const point = typeData.find((d) => d.date === date)
          if (!point) return 0
          switch (metric) {
            case 'tokens':
              return point.tokens
            case 'requests':
              return point.requests
            default:
              return point.price
          }
        })

        return {
          label: USAGE_TYPE_LABELS[usageType] || usageType.toUpperCase(),
          data: values,
          borderColor: colors.border,
          backgroundColor: colors.background,
          fill: true,
          tension: 0.3,
          stack: 'stack0',
        }
      })

      return { labels, datasets }
    }

    // Original non-stacked behavior
    const labels = data.map((d) => {
      const date = new Date(d.date)
      return `${date.getMonth() + 1}/${date.getDate()}`
    })

    const values = data.map((d) => {
      switch (metric) {
        case 'tokens':
          return d.tokens
        case 'requests':
          return d.requests
        default:
          return d.price
      }
    })

    const metricConfig = {
      tokens: {
        label: '토큰 사용량',
        borderColor: 'rgb(34, 197, 94)',
        backgroundColor: 'rgba(34, 197, 94, 0.1)',
      },
      price: {
        label: '비용 (USD)',
        borderColor: 'rgb(59, 130, 246)',
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
      },
      requests: {
        label: '요청 수',
        borderColor: 'rgb(168, 85, 247)',
        backgroundColor: 'rgba(168, 85, 247, 0.1)',
      },
    }

    const config = metricConfig[metric]

    return {
      labels,
      datasets: [
        {
          label: config.label,
          data: values,
          borderColor: config.borderColor,
          backgroundColor: config.backgroundColor,
          fill: chartType === 'line',
          tension: 0.3,
        },
      ],
    }
  }, [data, stackedData, metric, chartType, stacked])

  const options = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: stacked,
          position: 'top' as const,
          labels: {
            usePointStyle: true,
            padding: 10,
          },
        },
        tooltip: {
          mode: stacked ? ('index' as const) : ('nearest' as const),
          intersect: !stacked,
          callbacks: {
            label: (context: { dataset: { label?: string }; parsed: { y: number } }) => {
              const value = context.parsed.y
              const label = context.dataset.label ?? ''
              if (metric === 'price') {
                return `${label}: $${value.toFixed(4)}`
              }
              return `${label}: ${value.toLocaleString()}`
            },
          },
        },
      },
      scales: {
        x: {
          stacked: stacked,
        },
        y: {
          stacked: stacked,
          beginAtZero: true,
          ticks: {
            callback: (value: number | string) => {
              const numValue = typeof value === 'string' ? parseFloat(value) : value
              if (metric === 'price') {
                return `$${numValue.toFixed(2)}`
              }
              if (numValue >= 1000000) {
                return `${(numValue / 1000000).toFixed(1)}M`
              }
              if (numValue >= 1000) {
                return `${(numValue / 1000).toFixed(0)}K`
              }
              return numValue.toString()
            },
          },
        },
      },
    }),
    [metric, stacked],
  )

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center rounded-lg border border-gray-200 bg-white">
        <div className="text-gray-500">로딩 중...</div>
      </div>
    )
  }

  if (data.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center rounded-lg border border-gray-200 bg-white">
        <div className="text-gray-500">데이터가 없습니다</div>
      </div>
    )
  }

  return (
    <div className="h-64 rounded-lg border border-gray-200 bg-white p-4">
      {chartType === 'line' ? (
        <Line data={chartData} options={options} />
      ) : (
        <Bar data={chartData} options={options} />
      )}
    </div>
  )
}
