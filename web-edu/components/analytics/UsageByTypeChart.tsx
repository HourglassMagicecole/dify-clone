'use client'

import { useMemo } from 'react'
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js'
import { Doughnut } from 'react-chartjs-2'

ChartJS.register(ArcElement, Tooltip, Legend)

export interface UsageTypeData {
  usageType: string
  totalPrice: number
  totalTokens: number
  requestCount: number
}

interface UsageByTypeChartProps {
  data: UsageTypeData[]
  metric?: 'price' | 'tokens' | 'requests'
  loading?: boolean
}

const COLORS = [
  'rgb(59, 130, 246)', // blue
  'rgb(34, 197, 94)', // green
  'rgb(168, 85, 247)', // purple
  'rgb(249, 115, 22)', // orange
  'rgb(236, 72, 153)', // pink
  'rgb(20, 184, 166)', // teal
  'rgb(245, 158, 11)', // amber
]

const USAGE_TYPE_LABELS: Record<string, string> = {
  llm: 'LLM',
  embedding: 'Embedding',
  rerank: 'Rerank',
  tts: 'TTS',
  stt: 'STT',
  image_gen: 'Image Gen',
  tool: 'Tool',
}

export function UsageByTypeChart({ data, metric = 'price', loading = false }: UsageByTypeChartProps) {
  const chartData = useMemo(() => {
    const labels = data.map((d) => USAGE_TYPE_LABELS[d.usageType] || d.usageType.toUpperCase())
    const values = data.map((d) => {
      switch (metric) {
        case 'tokens':
          return d.totalTokens
        case 'requests':
          return d.requestCount
        default:
          return d.totalPrice
      }
    })

    return {
      labels,
      datasets: [
        {
          data: values,
          backgroundColor: COLORS.slice(0, data.length),
          borderColor: COLORS.slice(0, data.length).map((c) => c.replace('rgb', 'rgba').replace(')', ', 0.8)')),
          borderWidth: 1,
        },
      ],
    }
  }, [data, metric])

  const options = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'right' as const,
          labels: {
            usePointStyle: true,
            padding: 15,
          },
        },
        tooltip: {
          callbacks: {
            label: (context: { label: string; parsed: number }) => {
              const value = context.parsed
              if (metric === 'price') {
                return `${context.label}: $${value.toFixed(4)}`
              }
              return `${context.label}: ${value.toLocaleString()}`
            },
          },
        },
      },
    }),
    [metric],
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
      <Doughnut data={chartData} options={options} />
    </div>
  )
}
