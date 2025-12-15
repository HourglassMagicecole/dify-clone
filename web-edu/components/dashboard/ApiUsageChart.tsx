'use client'

import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  type TooltipItem,
} from 'chart.js'
import { Bar } from 'react-chartjs-2'
import type { ApiUsageSummary } from '@/types/dashboard'

// Chart.js 등록
ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend)

interface ApiUsageChartProps {
  data: ApiUsageSummary
  isLoading?: boolean
}

/**
 * API 사용량 차트 컴포넌트
 * AC: 1, 3 - 일별 호출 수, 토큰 사용량, 추정 비용 표시
 */
export function ApiUsageChart({ data, isLoading }: ApiUsageChartProps) {
  const { t } = useTranslation('dashboard')

  const chartData = useMemo(() => {
    const labels = data.dailyUsage.map((d) => {
      const date = new Date(d.date)
      return `${date.getMonth() + 1}/${date.getDate()}`
    })

    return {
      labels,
      datasets: [
        {
          label: t('apiUsage.chart.calls'),
          data: data.dailyUsage.map((d) => d.callCount),
          backgroundColor: 'rgba(59, 130, 246, 0.8)',
          borderRadius: 4,
        },
      ],
    }
  }, [data.dailyUsage, t])

  const options = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: false,
        },
        tooltip: {
          callbacks: {
            afterBody: (context: TooltipItem<'bar'>[]) => {
              if (!context[0]) return []
              const index = context[0].dataIndex
              const usage = data.dailyUsage[index]
              if (!usage) return []
              return [
                `${t('apiUsage.chart.tokens')}: ${usage.totalTokens.toLocaleString()}`,
                `${t('apiUsage.chart.cost')}: $${usage.estimatedCost.toFixed(4)}`,
              ]
            },
          },
        },
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: {
            precision: 0,
          },
        },
      },
    }),
    [data.dailyUsage, t]
  )

  if (isLoading) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-1/4 mb-4" />
          <div className="h-48 bg-gray-200 rounded" />
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h3 className="text-lg font-semibold mb-4">{t('apiUsage.title')}</h3>

      {/* 요약 통계 */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="text-center p-3 bg-blue-50 rounded-lg">
          <div className="text-2xl font-bold text-blue-600">
            {data.totalCalls.toLocaleString()}
          </div>
          <div className="text-sm text-gray-600">{t('apiUsage.summary.calls')}</div>
        </div>
        <div className="text-center p-3 bg-green-50 rounded-lg">
          <div className="text-2xl font-bold text-green-600">
            {data.totalTokens.toLocaleString()}
          </div>
          <div className="text-sm text-gray-600">{t('apiUsage.summary.tokens')}</div>
        </div>
        <div className="text-center p-3 bg-purple-50 rounded-lg">
          <div className="text-2xl font-bold text-purple-600">
            ${data.estimatedCost.toFixed(2)}
          </div>
          <div className="text-sm text-gray-600">{t('apiUsage.summary.cost')}</div>
        </div>
      </div>

      {/* 차트 */}
      <div className="h-48">
        <Bar data={chartData} options={options} />
      </div>
    </div>
  )
}
