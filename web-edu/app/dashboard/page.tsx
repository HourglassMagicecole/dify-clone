'use client'

import React, { useState, useMemo, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslation } from 'react-i18next'
import useSWR from 'swr'
import { useAuth } from '@/hooks/useAuth'
import { useSession } from '@/context/SessionContext'
import { DashboardAPI } from '@/service/dashboard-api'
import { sessionAPI } from '@/service/session-api'
import {
  getSessionUsageSummary,
  getSessionDailyTrend,
  getSessionUserBreakdown,
  getUserUsageLogs,
  UsageSummary,
  DailyUsage,
  UserUsage,
  UsageLogEntry,
} from '@/service/usage-analytics-api'
import { exportSessionUsageToXlsx } from '@/utils/export-xlsx'
import { ContextBanner } from '@/components/dashboard/ContextBanner'
import { SessionQuotaWarningBanner } from '@/components/session/SessionQuotaWarningBanner'
import { ResourceSummaryCard, EmptyResourceState } from '@/components/dashboard/ResourceSummaryCard'
import { QuickStartButtons } from '@/components/dashboard/QuickStartButtons'
import { QuotaStatusCard } from '@/components/common/QuotaStatusCard'
import { DateRangePicker, DateRange } from '@/components/common/DateRangePicker'
import {
  UsageOverviewCards,
  TopUsersTable,
  UserUsageDetailModal,
  TrendModal,
  StackedTrendDataPoint,
  UsageByType,
} from '@/components/analytics'

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

  // Owner 대시보드 - Admin과 동일한 UI 사용
  if (actualRole === 'owner') {
    return <AdminDashboard currentSession={currentSession} dashboardData={data} isLoading={showLoading} />
  }

  // Admin 대시보드
  if (actualRole === 'admin') {
    return <AdminDashboard currentSession={currentSession} dashboardData={data} isLoading={showLoading} />
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

      {/* 내 사용량 한도 상태 */}
      {currentSession && (
        <div className="mb-6">
          <QuotaStatusCard sessionId={currentSession.id} />
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

/**
 * Admin 전용 대시보드 컴포넌트
 * 세션 사용량 통계 및 사용자별 사용량 표시
 */
function AdminDashboard({
  currentSession,
  dashboardData,
  isLoading: dashboardLoading,
}: {
  currentSession: ReturnType<typeof useSession>['currentSession']
  dashboardData: Awaited<ReturnType<typeof DashboardAPI.getDashboardData>> | undefined
  isLoading: boolean
}) {
  const router = useRouter()

  // Date range state (default: last 30 days)
  const [dateRange, setDateRange] = useState<DateRange>(() => {
    const getDateString = (date: Date): string => date.toISOString().split('T')[0] ?? ''
    const endDate = getDateString(new Date())
    const startDate = getDateString(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000))
    return { startDate, endDate }
  })

  // Usage data state
  const [summary, setSummary] = useState<UsageSummary[]>([])
  const [dailyTrend, setDailyTrend] = useState<DailyUsage[]>([])
  const [userBreakdown, setUserBreakdown] = useState<UserUsage[]>([])
  const [usageLoading, setUsageLoading] = useState(true)

  // Member count state
  const [memberCount, setMemberCount] = useState<number>(0)

  // Modal state
  const [trendModalOpen, setTrendModalOpen] = useState(false)
  const [trendModalType, setTrendModalType] = useState<string | null>(null)
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null)

  // Export state
  const [exporting, setExporting] = useState(false)

  // Load usage data
  const loadUsageData = useCallback(async () => {
    if (!currentSession?.id) return

    try {
      setUsageLoading(true)
      const [summaryRes, trendRes, userRes] = await Promise.all([
        getSessionUsageSummary(currentSession.id, dateRange.startDate, dateRange.endDate),
        getSessionDailyTrend(currentSession.id, dateRange.startDate, dateRange.endDate),
        getSessionUserBreakdown(currentSession.id, dateRange.startDate, dateRange.endDate),
      ])

      if (summaryRes.result === 'success') setSummary(summaryRes.data || [])
      if (trendRes.result === 'success') setDailyTrend(trendRes.data || [])
      if (userRes.result === 'success') setUserBreakdown(userRes.data || [])
    } catch (err) {
      console.error('Failed to load usage data:', err)
    } finally {
      setUsageLoading(false)
    }
  }, [currentSession?.id, dateRange.startDate, dateRange.endDate])

  // Load member count
  const loadMemberCount = useCallback(async () => {
    if (!currentSession?.id) return
    try {
      const members = await sessionAPI.getSessionMembers(currentSession.id)
      setMemberCount(members.filter((m) => m.status === 'active').length)
    } catch (err) {
      console.error('Failed to load member count:', err)
    }
  }, [currentSession?.id])

  // Load data on mount and when session/date changes
  React.useEffect(() => {
    loadUsageData()
    loadMemberCount()
  }, [loadUsageData, loadMemberCount])

  // Calculate totals
  const getTotalPrice = () => summary.reduce((acc, s) => acc + parseFloat(s.total_price), 0)
  const getTotalRequests = () => summary.reduce((acc, s) => acc + s.request_count, 0)

  // Usage by type for cards
  const usageByTypeStats = useMemo(() => {
    return summary.map((s) => ({
      usageType: s.usage_type,
      totalPrice: parseFloat(s.total_price),
      requestCount: s.request_count,
    }))
  }, [summary])

  // Stacked trend data for chart
  const stackedTrendData: StackedTrendDataPoint[] = useMemo(() => {
    return dailyTrend
      .map((d) => ({
        date: d.date,
        usageType: d.usage_type,
        tokens: d.total_tokens,
        price: parseFloat(d.total_price),
        requests: d.request_count,
      }))
      .sort((a, b) => a.date.localeCompare(b.date))
  }, [dailyTrend])

  // User table data
  const userTableData = useMemo(() => {
    return userBreakdown.map((u) => ({
      accountId: u.account_id,
      displayName: u.account_name,
      usageType: u.usage_type,
      requestCount: u.request_count,
      totalTokens: u.total_tokens,
      totalPrice: u.total_price,
    }))
  }, [userBreakdown])

  // Selected user data for modal
  const selectedUserData: UsageByType[] = useMemo(() => {
    if (!selectedUserId) return []
    return userBreakdown
      .filter((u) => u.account_id === selectedUserId)
      .map((u) => ({
        usageType: u.usage_type,
        requestCount: u.request_count,
        totalTokens: u.total_tokens,
        totalPrice: u.total_price,
      }))
  }, [selectedUserId, userBreakdown])

  // Export handler
  const handleExport = async () => {
    if (!currentSession) return

    try {
      setExporting(true)
      const userIds = [...new Set(userBreakdown.map((u) => u.account_id))].filter(
        (id) => id && id !== 'unknown',
      )

      const userLogs = new Map<string, UsageLogEntry[]>()
      for (const userId of userIds) {
        const logsRes = await getUserUsageLogs(currentSession.id, userId, dateRange.startDate, dateRange.endDate)
        if (logsRes.result === 'success' && logsRes.data) {
          userLogs.set(userId, logsRes.data.items)
        }
      }

      exportSessionUsageToXlsx({
        sessionName: currentSession.session_name,
        sessionTag: currentSession.session_tag,
        startDate: dateRange.startDate,
        endDate: dateRange.endDate,
        summary,
        userBreakdown,
        userLogs,
      })
    } catch (err) {
      console.error('Export failed:', err)
    } finally {
      setExporting(false)
    }
  }

  if (!currentSession) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 text-center">
          <div className="text-4xl mb-4">⚠️</div>
          <h3 className="font-semibold text-yellow-900 mb-2">세션을 선택해주세요</h3>
          <p className="text-yellow-700">상단의 세션 선택기에서 관리할 세션을 선택하세요.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Context Banner */}
      <div className="mb-6">
        <ContextBanner role="admin" scope="session" sessionName={currentSession.session_name} />
      </div>

      {/* 리소스 요약 (멤버 수 포함) */}
      <section className="mb-16">
        <ResourceSummaryCard
          summary={dashboardData?.resourceSummary || { agents: 0, workflows: 0, datasets: 0, total: 0 }}
          scope="my_resources"
          sessionName={currentSession.session_name}
          isLoading={dashboardLoading}
          memberCount={memberCount}
          maxMembers={currentSession.max_students}
        />
      </section>

      {/* 사용량 개요 */}
      <section className="mb-16">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
          <h3 className="text-lg font-bold text-gray-900">사용량 개요</h3>
          <div className="flex items-center gap-3">
            <DateRangePicker value={dateRange} onChange={setDateRange} />
            <button
              onClick={handleExport}
              disabled={exporting || usageLoading}
              className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:bg-gray-400"
            >
              {exporting ? '내보내기 중...' : '내보내기'}
            </button>
          </div>
        </div>
        <UsageOverviewCards
          totalCost={getTotalPrice()}
          totalRequests={getTotalRequests()}
          byType={usageByTypeStats}
          loading={usageLoading}
          onTotalClick={() => {
            setTrendModalType(null)
            setTrendModalOpen(true)
          }}
          onTypeClick={(usageType) => {
            setTrendModalType(usageType)
            setTrendModalOpen(true)
          }}
        />
      </section>

      {/* 사용자별 사용량 */}
      <section className="mb-8">
        <h3 className="text-lg font-bold text-gray-900 mb-4">사용자별 사용량</h3>
        {/* Quota Warning Banner */}
        <SessionQuotaWarningBanner
          sessionId={currentSession.id}
          onNavigateToQuotas={() => router.push(`/admin/sessions/${currentSession.id}?tab=quotas`)}
        />
        <div className="bg-white rounded-lg shadow p-6">
          <TopUsersTable
            users={userTableData}
            loading={usageLoading}
            onUserClick={(accountId) => setSelectedUserId(accountId)}
            pageSize={5}
          />
        </div>
      </section>

      {/* User Detail Modal */}
      <UserUsageDetailModal
        isOpen={!!selectedUserId}
        onClose={() => setSelectedUserId(null)}
        sessionId={currentSession.id}
        accountId={selectedUserId || ''}
        displayName={userBreakdown.find((u) => u.account_id === selectedUserId)?.account_name}
        usageData={selectedUserData}
        dateRange={dateRange}
      />

      {/* Trend Modal */}
      <TrendModal
        isOpen={trendModalOpen}
        onClose={() => setTrendModalOpen(false)}
        title={trendModalType ? `${trendModalType.toUpperCase()} 일별 추이` : '총 비용 일별 추이'}
        data={stackedTrendData}
        usageType={trendModalType ?? undefined}
      />
    </div>
  )
}
