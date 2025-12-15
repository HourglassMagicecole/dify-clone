'use client'

import React from 'react'
import { useTranslation } from 'react-i18next'
import useSWR from 'swr'
import { useAuth } from '@/hooks/useAuth'
import { useSession } from '@/context/SessionContext'
import { DashboardAPI } from '@/service/dashboard-api'
import { ContextBanner } from '@/components/dashboard/ContextBanner'
import { ResourceSummaryCard, EmptyResourceState } from '@/components/dashboard/ResourceSummaryCard'
import { RecentActivityTimeline } from '@/components/dashboard/RecentActivityTimeline'
import { QuickStartButtons } from '@/components/dashboard/QuickStartButtons'
import { ApiUsageChart } from '@/components/dashboard/ApiUsageChart'

/**
 * 공용 대시보드 페이지 (Story 2.2B)
 * Owner/Admin/Student 역할에 따라 다른 UI를 표시
 */
export default function UnifiedDashboard() {
  const { t } = useTranslation('dashboard')
  const { user } = useAuth()
  const { currentSession, sessions, selectedAdminId } = useSession()

  // SWR 캐시 키 생성 (Owner는 selectedAdminId 포함)
  const swrKey = React.useMemo(() => {
    if (!user) return null

    const { actualRole } = user

    if (actualRole === 'owner') {
      if (selectedAdminId) {
        return currentSession
          ? `dashboard-owner-admin-${selectedAdminId}-session-${currentSession.id}`
          : `dashboard-owner-admin-${selectedAdminId}`
      }
      return currentSession
        ? `dashboard-owner-session-${currentSession.id}`
        : 'dashboard-owner-system'
    }
    else if (actualRole === 'admin') {
      return currentSession ? `dashboard-admin-${currentSession.id}` : null
    }
    else {
      // student
      return currentSession ? `dashboard-student-${currentSession.id}` : 'dashboard-student-all'
    }
  }, [user, selectedAdminId, currentSession])

  // Fetcher 함수: currentSession 의존성 사용
  const fetcher = React.useCallback(() => {
    const sessionId = user?.actualRole === 'owner' && !selectedAdminId
      ? undefined
      : currentSession?.id
    // Owner도 세션의 모든 리소스를 보기 위해 admin_id를 전달하지 않음
    return DashboardAPI.getDashboardData(sessionId, undefined)
  }, [user?.actualRole, selectedAdminId, currentSession?.id])

  // 데이터 페칭 (Owner는 selectedAdminId도 전달)
  // Owner가 "전체 관리자" 선택 시 (selectedAdminId = null) session_id를 전달하지 않음
  const { data, error, isLoading } = useSWR(swrKey, fetcher, {
    refreshInterval: 30000,
    revalidateOnFocus: true,
    dedupingInterval: 0, // 중복 제거 비활성화 (즉시 재요청)
    revalidateOnMount: true, // 마운트 시 항상 재검증
    keepPreviousData: false, // 이전 데이터 유지 안 함 (race condition 방지)
  })

  // 역할이 없으면 로딩 중
  if (!user) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="text-center text-gray-500">로딩 중...</div>
      </div>
    )
  }

  const { actualRole } = user

  // 에러 처리
  if (error) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center">
            <div className="text-red-600 text-xl mr-3">⚠️</div>
            <div>
              <h3 className="text-red-900 font-medium">{t('error.title')}</h3>
              <p className="text-red-700 text-sm mt-1">{t('error.description')}</p>
            </div>
          </div>
        </div>
      </div>
    )
  }

  const showLoading = isLoading || !data

  // Owner 대시보드
  if (actualRole === 'owner') {
    return (
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Context Banner */}
        <div className="mb-6">
          <ContextBanner
            role="owner"
            scope="system"
            sessionName={currentSession?.session_name}
          />
        </div>

        {/* 전체 리소스 요약 */}
        <section className="mb-8">
          <ResourceSummaryCard
            summary={data?.resourceSummary || { agents: 0, workflows: 0, datasets: 0, total: 0 }}
            scope="system"
            sessionName={currentSession?.session_name}
            isLoading={showLoading}
          />
        </section>

        {/* API 사용량 차트 (Story 3.8) */}
        <section className="mb-8">
          <ApiUsageChart
            data={
              data?.apiUsage || {
                totalCalls: 0,
                totalTokens: 0,
                estimatedCost: 0,
                dailyUsage: [],
              }
            }
            isLoading={showLoading}
          />
        </section>

        {/* 최근 활동 타임라인 (사용자 이름 포함) */}
        <section className="mb-8">
          <RecentActivityTimeline
            activities={showLoading ? [] : (data?.recentActivities || [])}
            isLoading={showLoading}
            showUserName
          />
        </section>
      </div>
    )
  }

  // Admin 대시보드
  if (actualRole === 'admin') {
    if (!currentSession) {
      return (
        <div className="max-w-7xl mx-auto px-4 py-8">
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 text-center">
            <div className="text-4xl mb-4">⚠️</div>
            <h3 className="font-semibold text-yellow-900 mb-2">세션을 선택해주세요</h3>
            <p className="text-yellow-700">
              상단의 세션 선택기에서 관리할 세션을 선택하세요.
            </p>
          </div>
        </div>
      )
    }

    return (
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Context Banner */}
        <div className="mb-6">
          <ContextBanner
            role="admin"
            scope="session"
            sessionName={currentSession.session_name}
          />
        </div>

        {/* 내 리소스 (세션별) */}
        <section className="mb-8">
          <ResourceSummaryCard
            summary={data?.resourceSummary || { agents: 0, workflows: 0, datasets: 0, total: 0 }}
            scope="my_resources"
            sessionName={currentSession.session_name}
            isLoading={showLoading}
          />
        </section>

        {/* API 사용량 차트 (Story 3.8) */}
        <section className="mb-8">
          <ApiUsageChart
            data={
              data?.apiUsage || {
                totalCalls: 0,
                totalTokens: 0,
                estimatedCost: 0,
                dailyUsage: [],
              }
            }
            isLoading={showLoading}
          />
        </section>

        {/* 최근 활동 타임라인 (사용자 이름 포함) */}
        <section className="mb-8">
          <RecentActivityTimeline
            activities={showLoading ? [] : (data?.recentActivities || [])}
            isLoading={showLoading}
            showUserName
          />
        </section>
      </div>
    )
  }

  // Student 대시보드
  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Context Banner */}
      <div className="mb-6">
        <ContextBanner
          role="student"
          scope="my_resources"
          sessionName={currentSession?.session_name}
        />
      </div>

      {/* 멀티 세션 안내 */}
      {sessions.length > 1 && (
        <div className="mb-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-start">
            <div className="text-blue-600 text-xl mr-3">ℹ️</div>
            <div>
              <h3 className="text-blue-900 font-medium">{t('multiSession.title')}</h3>
              <p className="text-blue-700 text-sm mt-1">
                {t('multiSession.description', { count: sessions.length })}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* 리소스 요약 카드 */}
      <div className="mb-8">
        {showLoading ? (
          <ResourceSummaryCard
            summary={{ agents: 0, workflows: 0, datasets: 0, total: 0 }}
            scope="my_resources"
            sessionName={currentSession?.session_name}
            isLoading
          />
        ) : data.resourceSummary.total === 0 ? (
          <EmptyResourceState />
        ) : (
          <ResourceSummaryCard
            summary={data.resourceSummary}
            scope="my_resources"
            sessionName={currentSession?.session_name}
          />
        )}
      </div>

      {/* 빠른 시작 버튼 */}
      <div className="mb-8">
        <QuickStartButtons />
      </div>
    </div>
  )
}
