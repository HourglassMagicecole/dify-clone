'use client'

import React from 'react'
import useSWR from 'swr'
import { DashboardAPI } from '../../../service/dashboard-api'
import { ResourceSummaryCard, EmptyResourceState } from '../../../components/dashboard/ResourceSummaryCard'
import { RecentActivityTimeline } from '../../../components/dashboard/RecentActivityTimeline'
import { ApiUsageChart } from '../../../components/dashboard/ApiUsageChart'
import { QuickStartButtons } from '../../../components/dashboard/QuickStartButtons'

/**
 * 학생 대시보드 메인 페이지
 * 로그인 후 첫 화면으로 리소스 요약, 최근 활동, API 사용량 표시
 */
export default function StudentDashboard() {
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
              <h3 className="text-red-900 font-medium">데이터 로딩 실패</h3>
              <p className="text-red-700 text-sm mt-1">
                대시보드 데이터를 불러올 수 없습니다. 잠시 후 다시 시도해주세요.
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
        <h1 className="text-3xl font-bold text-gray-900">대시보드</h1>
        <p className="text-gray-600 mt-2">내 학습 현황과 리소스를 확인하세요</p>
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

      {/* 2열 레이아웃: 최근 활동 & API 사용량 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* 최근 활동 타임라인 */}
        <div>
          <RecentActivityTimeline
            activities={showLoading ? [] : data.recentActivities}
            isLoading={showLoading}
          />
        </div>

        {/* API 사용량 차트 */}
        <div>
          <ApiUsageChart
            usage={showLoading ? { totalCalls: 0, totalTokens: 0, estimatedCost: 0, dailyUsage: [] } : data.apiUsage}
            isLoading={showLoading}
          />
        </div>
      </div>
    </div>
  )
}
