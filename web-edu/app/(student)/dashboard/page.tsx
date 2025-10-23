'use client'

import React from 'react'
import { useTranslation } from 'react-i18next'
import useSWR from 'swr'
import { DashboardAPI } from '../../../service/dashboard-api'
import { ResourceSummaryCard, EmptyResourceState } from '../../../components/dashboard/ResourceSummaryCard'
import { RecentActivityTimeline } from '../../../components/dashboard/RecentActivityTimeline'
// import { ApiUsageChart } from '../../../components/dashboard/ApiUsageChart' // Hidden: API usage not needed for students
import { QuickStartButtons } from '../../../components/dashboard/QuickStartButtons'

/**
 * 학생 대시보드 메인 페이지
 * 로그인 후 첫 화면으로 리소스 요약과 최근 활동 표시
 */
export default function StudentDashboard() {
  const { t } = useTranslation('dashboard')
  // SWR을 사용한 데이터 페칭
  const { data, error, isLoading } = useSWR(
    'dashboard-data',
    () => DashboardAPI.getDashboardData(),
    {
      refreshInterval: 30000, // 30초마다 자동 새로고침
      revalidateOnFocus: true  // 탭 포커스 시 재검증
    }
  )

  // 에러 상태 처리
  if (error) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center">
            <div className="text-red-600 text-xl mr-3">⚠️</div>
            <div>
              <h3 className="text-red-900 font-medium">{t('dashboard.error.title')}</h3>
              <p className="text-red-700 text-sm mt-1">
                {t('dashboard.error.description')}
              </p>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // 로딩 상태
  const showLoading = isLoading || !data

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* 페이지 헤더 */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">{t('dashboard.title')}</h1>
        <p className="text-gray-600 mt-2">{t('dashboard.subtitle')}</p>
      </div>

      {/* 리소스 요약 카드 */}
      <div className="mb-8">
        {showLoading ? (
          <ResourceSummaryCard summary={{ agents: 0, workflows: 0, datasets: 0, total: 0 }} isLoading />
        ) : data.resourceSummary.total === 0 ? (
          <EmptyResourceState />
        ) : (
          <ResourceSummaryCard summary={data.resourceSummary} />
        )}
      </div>

      {/* 빠른 시작 버튼 */}
      <div className="mb-8">
        <QuickStartButtons />
      </div>

      {/* 최근 활동 타임라인 */}
      <div className="mb-8">
        <RecentActivityTimeline
          activities={showLoading ? [] : data.recentActivities}
          isLoading={showLoading}
        />
      </div>

      {/* API 사용량 차트 - Hidden for students */}
      {/* <div className="mb-8">
        <ApiUsageChart
          usage={showLoading ? { totalCalls: 0, totalTokens: 0, estimatedCost: 0, dailyUsage: [] } : data.apiUsage}
          isLoading={showLoading}
        />
      </div> */}
    </div>
  )
}
