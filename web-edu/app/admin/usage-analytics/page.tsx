'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  getSessionUsageSummary,
  getSessionUserBreakdown,
  getUserUsageLogs,
  cleanupOldUsageLogs,
  deleteSessionUsageLogs,
  UsageSummary,
  UserUsage,
  UsageLogEntry,
} from '@/service/usage-analytics-api'
import { exportSessionUsageToXlsx } from '@/utils/export-xlsx'
import { sessionAPI } from '@/service/session-api'
import type { Session } from '@/types/session'
import { useAuth } from '@/hooks/useAuth'

/**
 * 시스템 사용량 관리 페이지 (Owner 전용)
 * - 비활성 세션 로그 관리 (내보내기, 삭제)
 * - 만료된 로그 일괄 정리
 */
export default function UsageAnalyticsPage() {
  const router = useRouter()
  const { user, isLoading: authLoading } = useAuth()
  const isOwner = user?.actualRole === 'owner'

  // Redirect non-owner users
  useEffect(() => {
    if (!authLoading && !isOwner) {
      router.replace('/admin/session-usage')
    }
  }, [authLoading, isOwner, router])

  // Inactive sessions
  const [inactiveSessions, setInactiveSessions] = useState<Session[]>([])
  const [inactiveLoading, setInactiveLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Cleanup state
  const [cleanupLoading, setCleanupLoading] = useState(false)
  const [cleanupResult, setCleanupResult] = useState<{ deleted: number } | null>(null)

  // Session log delete state
  const [deletingSessionId, setDeletingSessionId] = useState<string | null>(null)
  const [deleteResult, setDeleteResult] = useState<{ deleted: number; sessionName: string } | null>(null)

  // Session export state
  const [exportingSessionId, setExportingSessionId] = useState<string | null>(null)

  // Load inactive sessions
  const loadInactiveSessions = async () => {
    try {
      setInactiveLoading(true)
      const data = await sessionAPI.listSessions(false, 1, 100)
      setInactiveSessions(data.sessions)
    } catch (err) {
      console.error('Failed to load inactive sessions:', err)
    } finally {
      setInactiveLoading(false)
    }
  }

  useEffect(() => {
    if (isOwner) {
      loadInactiveSessions()
    }
  }, [isOwner])

  const handleCleanup = async () => {
    if (!confirm('만료된 사용량 로그를 삭제하시겠습니까?\n(보관 기한이 지난 로그가 삭제됩니다)')) {
      return
    }

    try {
      setCleanupLoading(true)
      setCleanupResult(null)
      const res = await cleanupOldUsageLogs()
      if (res.result === 'success' && res.data) {
        setCleanupResult({ deleted: res.data.deleted_count })
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Cleanup 실패')
    } finally {
      setCleanupLoading(false)
    }
  }

  const handleDeleteSessionLogs = async (sessionId: string, sessionName: string) => {
    if (!confirm(`"${sessionName}" 세션의 모든 사용량 로그를 삭제하시겠습니까?\n\n이 작업은 되돌릴 수 없습니다.`)) {
      return
    }

    try {
      setDeletingSessionId(sessionId)
      setDeleteResult(null)
      setError(null)
      const res = await deleteSessionUsageLogs(sessionId)
      if (res.result === 'success' && res.data) {
        setDeleteResult({ deleted: res.data.deleted_count, sessionName })
        loadInactiveSessions()
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '로그 삭제 실패')
    } finally {
      setDeletingSessionId(null)
    }
  }

  const handleExportSession = async (session: Session) => {
    try {
      setExportingSessionId(session.id)
      setError(null)

      const [summaryRes, userRes] = await Promise.all([
        getSessionUsageSummary(session.id),
        getSessionUserBreakdown(session.id),
      ])

      if (summaryRes.result !== 'success' || userRes.result !== 'success') {
        throw new Error('데이터 조회 실패')
      }

      const summaryData: UsageSummary[] = summaryRes.data || []
      const userData: UserUsage[] = userRes.data || []

      // Exclude "unknown" which indicates null account_id
      const userIds = [...new Set(userData.map((u) => u.account_id))].filter((id) => id && id !== 'unknown')

      const userLogs = new Map<string, UsageLogEntry[]>()
      for (const userId of userIds) {
        const logsRes = await getUserUsageLogs(session.id, userId)
        if (logsRes.result === 'success' && logsRes.data) {
          userLogs.set(userId, logsRes.data.items)
        }
      }

      exportSessionUsageToXlsx({
        sessionName: session.session_name,
        sessionTag: session.session_tag,
        startDate: new Date(session.start_date).toLocaleDateString('ko-KR'),
        endDate: session.end_date ? new Date(session.end_date).toLocaleDateString('ko-KR') : null,
        summary: summaryData,
        userBreakdown: userData,
        userLogs,
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : '내보내기 실패')
    } finally {
      setExportingSessionId(null)
    }
  }

  // Show loading while checking auth
  if (authLoading) {
    return (
      <div className="flex h-64 items-center justify-center p-6">
        <div className="text-gray-500">로딩 중...</div>
      </div>
    )
  }

  // Non-owner will be redirected
  if (!isOwner) {
    return null
  }

  return (
    <div className="p-6">
      {/* Page Title */}
      <h1 className="mb-6 text-2xl font-bold text-gray-900">시스템 사용량 관리</h1>

      <div className="space-y-6">
        {/* Delete result message */}
        {deleteResult !== null && (
          <div className="rounded-md bg-green-50 p-4 text-green-800">
            &quot;{deleteResult.sessionName}&quot; 세션의 {deleteResult.deleted}개 로그가 삭제되었습니다.
            <button onClick={() => setDeleteResult(null)} className="ml-2 text-green-900 underline">
              닫기
            </button>
          </div>
        )}

        {error && (
          <div className="rounded-md bg-red-50 p-4 text-red-600">
            {error}
            <button onClick={() => setError(null)} className="ml-2 text-red-800 underline">
              닫기
            </button>
          </div>
        )}

        {/* Inactive Sessions Section */}
        <div className="rounded-lg border border-gray-200 bg-white p-6">
          <h3 className="mb-4 text-lg font-semibold text-gray-900">비활성 세션 로그 관리</h3>
          <p className="mb-4 text-sm text-gray-500">종료된 세션의 사용량 로그를 확인하고 삭제할 수 있습니다.</p>

          {inactiveLoading ? (
            <div className="py-8 text-center text-gray-500">로딩 중...</div>
          ) : inactiveSessions.length === 0 ? (
            <div className="py-8 text-center text-gray-500">비활성 세션이 없습니다.</div>
          ) : (
            <div className="overflow-hidden rounded-lg border border-gray-200">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                      세션명
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                      기간
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                      강사
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">
                      작업
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 bg-white">
                  {inactiveSessions.map((session) => (
                    <tr key={session.id} className="hover:bg-gray-50">
                      <td className="whitespace-nowrap px-4 py-3 text-sm font-medium text-gray-900">
                        {session.session_name}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-500">
                        {new Date(session.start_date).toLocaleDateString()} ~{' '}
                        {session.end_date ? new Date(session.end_date).toLocaleDateString() : '-'}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-500">{session.instructor_name}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-right text-sm">
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => handleExportSession(session)}
                            disabled={exportingSessionId === session.id}
                            className="rounded bg-blue-600 px-3 py-1 text-xs font-medium text-white hover:bg-blue-700 disabled:bg-gray-400"
                          >
                            {exportingSessionId === session.id ? '내보내기 중...' : '내보내기'}
                          </button>
                          <button
                            onClick={() => handleDeleteSessionLogs(session.id, session.session_name)}
                            disabled={deletingSessionId === session.id}
                            className="rounded bg-red-600 px-3 py-1 text-xs font-medium text-white hover:bg-red-700 disabled:bg-gray-400"
                          >
                            {deletingSessionId === session.id ? '삭제 중...' : '로그 삭제'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* System Maintenance Section */}
        <div className="rounded-lg border border-gray-200 bg-white p-6">
          <h3 className="mb-4 text-lg font-semibold text-gray-900">시스템 관리</h3>
          <div className="space-y-4">
            <div className="flex items-start justify-between rounded-lg bg-gray-50 p-4">
              <div>
                <h4 className="font-medium text-gray-900">만료된 로그 일괄 정리</h4>
                <p className="mt-1 text-sm text-gray-500">보관 기한이 지난 모든 사용량 로그를 일괄 삭제합니다.</p>
              </div>
              <button
                onClick={handleCleanup}
                disabled={cleanupLoading}
                className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:bg-gray-400"
              >
                {cleanupLoading ? '삭제 중...' : '일괄 정리'}
              </button>
            </div>
            {cleanupResult !== null && (
              <div className="rounded-md bg-green-50 p-3 text-sm text-green-800">
                {cleanupResult.deleted}개의 로그가 삭제되었습니다.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
