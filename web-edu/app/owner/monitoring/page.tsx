'use client'

import Link from 'next/link'
import useSWR from 'swr'
import { useTranslation } from 'react-i18next'
import { DashboardAPI } from '@/service/dashboard-api'
import { ResourceSummaryCard } from '@/components/dashboard/ResourceSummaryCard'
import { ApiUsageChart } from '@/components/dashboard/ApiUsageChart'

/**
 * Owner Monitoring Dashboard
 * System-wide statistics and monitoring (always shows entire system)
 */
export default function OwnerMonitoring() {
  const { t } = useTranslation('dashboard')

  // Always fetch system-wide data (no session filtering)
  const { data, error, isLoading } = useSWR(
    'owner-monitoring-system',
    () => DashboardAPI.getDashboardData(),
  )

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-6">
        <h2 className="text-red-800 font-semibold mb-2">{t('error.title')}</h2>
        <p className="text-red-600">{t('error.description')}</p>
      </div>
    )
  }

  return (
    <div>
      {/* System-wide Resource Summary */}
      <section className="mb-8">
        <h2 className="text-2xl font-bold mb-4">📊 시스템 전체 현황</h2>
        <ResourceSummaryCard
          summary={data?.resourceSummary || { agents: 0, datasets: 0, total: 0 }}
          scope="system"
          isLoading={isLoading}
        />
      </section>

      {/* Active Sessions Overview */}
      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-4">활성 세션 현황</h2>
        <div className="bg-white rounded-lg shadow p-6">
          <p className="text-gray-500">세션 현황 위젯 (향후 구현 예정)</p>
        </div>
      </section>

      {/* API Usage */}
      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-4">API 사용량</h2>
        <ApiUsageChart
          usage={data?.apiUsage || { totalCalls: 0, totalTokens: 0, estimatedCost: 0, dailyUsage: [] }}
          isLoading={isLoading}
        />
      </section>

      {/* Quick Admin Links */}
      <section>
        <h2 className="text-xl font-semibold mb-4">관리 빠른 링크</h2>
        <div className="grid grid-cols-2 gap-4">
          <Link
            href="/admin/sessions"
            className="bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg p-6 transition-colors"
          >
            <div className="text-2xl mb-2">📋</div>
            <h3 className="font-semibold text-blue-900">세션 관리</h3>
            <p className="text-sm text-blue-700">세션 생성 및 관리</p>
          </Link>

          <Link
            href="/admin/users"
            className="bg-green-50 hover:bg-green-100 border border-green-200 rounded-lg p-6 transition-colors"
          >
            <div className="text-2xl mb-2">👥</div>
            <h3 className="font-semibold text-green-900">사용자 관리</h3>
            <p className="text-sm text-green-700">사용자 생성 및 관리</p>
          </Link>

          <Link
            href="/api-keys"
            className="bg-purple-50 hover:bg-purple-100 border border-purple-200 rounded-lg p-6 transition-colors"
          >
            <div className="text-2xl mb-2">🔑</div>
            <h3 className="font-semibold text-purple-900">API Key 관리</h3>
            <p className="text-sm text-purple-700">API 키 생성 및 설정</p>
          </Link>

          <Link
            href="/dashboard"
            className="bg-orange-50 hover:bg-orange-100 border border-orange-200 rounded-lg p-6 transition-colors"
          >
            <div className="text-2xl mb-2">📈</div>
            <h3 className="font-semibold text-orange-900">세션 대시보드</h3>
            <p className="text-sm text-orange-700">세션별 리소스 관리</p>
          </Link>
        </div>
      </section>
    </div>
  )
}
