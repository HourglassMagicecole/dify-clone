'use client'

import React from 'react'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js'
import { Line } from 'react-chartjs-2'
import type { ApiUsage } from '../../types/dashboard'

// Chart.js 등록
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
)

interface ApiUsageChartProps {
  usage: ApiUsage
  isLoading?: boolean
}

/**
 * API 사용량 차트 컴포넌트
 * 일별 API 호출 수와 토큰 사용량을 라인 차트로 표시
 */
export function ApiUsageChart({ usage, isLoading = false }: ApiUsageChartProps) {
  if (isLoading) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold mb-4">API 사용량</h3>
        <div className="h-64 bg-gray-100 rounded animate-pulse"></div>
      </div>
    )
  }

  // 빈 상태 처리
  if (usage.dailyUsage.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold mb-4">API 사용량</h3>
        <div className="text-center py-12">
          <div className="text-4xl mb-2">📊</div>
          <p className="text-gray-600">아직 API 사용 데이터가 없습니다</p>
          <p className="text-sm text-gray-500 mt-2">
            Agent를 실행하면 사용량이 표시됩니다
          </p>
        </div>
      </div>
    )
  }

  // 차트 데이터 준비
  const chartData = {
    labels: usage.dailyUsage.map(day => {
      const date = new Date(day.date)
      return `${date.getMonth() + 1}/${date.getDate()}`
    }),
    datasets: [
      {
        label: 'API 호출 수',
        data: usage.dailyUsage.map(day => day.calls),
        borderColor: 'rgb(59, 130, 246)',
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
        fill: true,
        tension: 0.4
      },
      {
        label: '토큰 사용량 (1K 단위)',
        data: usage.dailyUsage.map(day => day.tokens / 1000),
        borderColor: 'rgb(168, 85, 247)',
        backgroundColor: 'rgba(168, 85, 247, 0.1)',
        fill: true,
        tension: 0.4
      }
    ]
  }

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top' as const,
      },
      title: {
        display: false,
      },
      tooltip: {
        mode: 'index' as const,
        intersect: false,
      },
    },
    scales: {
      y: {
        beginAtZero: true,
      },
    },
  }

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="mb-4">
        <h3 className="text-lg font-semibold">API 사용량</h3>
        <div className="flex items-center gap-4 mt-2 text-sm text-gray-600">
          <div>
            <span className="font-medium">총 호출:</span> {usage.totalCalls.toLocaleString()}
          </div>
          <div>
            <span className="font-medium">총 토큰:</span> {usage.totalTokens.toLocaleString()}
          </div>
          <div>
            <span className="font-medium">추정 비용:</span> ${usage.estimatedCost.toFixed(2)}
          </div>
        </div>
      </div>
      <div className="h-64">
        <Line data={chartData} options={options} />
      </div>
    </div>
  )
}
