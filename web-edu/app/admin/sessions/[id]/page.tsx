'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useTranslation } from 'react-i18next'
import { sessionAPI } from '@/service/session-api'
import {
  getSessionUsageSummary,
  getSessionUserBreakdown,
  getUserUsageLogs,
  deleteSessionUsageLogs,
  UsageSummary,
  UserUsage,
  UsageLogEntry,
} from '@/service/usage-analytics-api'
import { exportSessionUsageToXlsx } from '@/utils/export-xlsx'
import { SessionMemberTable } from '@/components/session/SessionMemberTable'
import { EditSessionModal } from '@/components/session/EditSessionModal'
import { SessionResourceSection } from '@/components/session/SessionResourceSection'
import { ResourceDeleteDialog } from '@/components/session/ResourceDeleteDialog'
import { SessionDeleteDialog } from '@/components/session/SessionDeleteDialog'
import { QuotaSettingsTab } from '@/components/session/QuotaSettingsTab'
import { SessionQuotaWarningBanner } from '@/components/session/SessionQuotaWarningBanner'
import { useSession } from '@/context/SessionContext'
import type { Session, SessionMember } from '@/types/session'

type TabType = 'members' | 'resources' | 'quotas'

export default function SessionDetailPage() {
  const params = useParams()
  const router = useRouter()
  const { t } = useTranslation('session')
  const { t: tCommon } = useTranslation('common')
  const { currentSession, refreshSessions: refreshSessionContext } = useSession()
  const sessionId = params.id as string
  const isCurrentSession = currentSession?.id === sessionId

  const [session, setSession] = useState<Session | null>(null)
  const [members, setMembers] = useState<SessionMember[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showEditModal, setShowEditModal] = useState(false)
  const [isCopied, setIsCopied] = useState(false)
  const [activeTab, setActiveTab] = useState<TabType>('members')

  // Resource delete dialog state
  const [showDeleteResourceDialog, setShowDeleteResourceDialog] = useState(false)
  const [deleteAccountId, setDeleteAccountId] = useState<string | undefined>()
  const [deleteAccountName, setDeleteAccountName] = useState<string | undefined>()
  const [resourceSummary, setResourceSummary] = useState({ total_apps: 0, total_datasets: 0 })

  // Session delete dialog state
  const [showDeleteSessionDialog, setShowDeleteSessionDialog] = useState(false)

  // Usage log management state
  const [exportingLogs, setExportingLogs] = useState(false)
  const [deletingLogs, setDeletingLogs] = useState(false)
  const [logActionResult, setLogActionResult] = useState<{ type: 'success' | 'error'; message: string } | null>(null)

  const loadSessionData = async () => {
    try {
      setIsLoading(true)
      setError(null)

      const [sessionData, membersData] = await Promise.all([
        sessionAPI.getSession(sessionId),
        sessionAPI.getSessionMembers(sessionId),
      ])

      setSession(sessionData)
      setMembers(membersData)
    }
    catch (err) {
      setError(err instanceof Error ? err.message : t('failed_to_load'))
    }
    finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadSessionData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId])

  const handleDelete = () => {
    setShowDeleteSessionDialog(true)
  }

  const handleDeleteComplete = async () => {
    await refreshSessionContext() // Update SessionSelector
    router.push('/admin/sessions')
  }

  const handleCopySessionId = async () => {
    try {
      await navigator.clipboard.writeText(session?.id || '')
      setIsCopied(true)
      setTimeout(() => setIsCopied(false), 2000)
    }
    catch (err) {
      console.error('Failed to copy:', err)
    }
  }

  const handleExportLogs = async () => {
    if (!session) return

    try {
      setExportingLogs(true)
      setLogActionResult(null)

      const [summaryRes, userRes] = await Promise.all([
        getSessionUsageSummary(session.id),
        getSessionUserBreakdown(session.id),
      ])

      if (summaryRes.result !== 'success' || userRes.result !== 'success') {
        throw new Error(t('usage_data_load_failed'))
      }

      const summaryData: UsageSummary[] = summaryRes.data || []
      const userData: UserUsage[] = userRes.data || []

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

      setLogActionResult({ type: 'success', message: t('export_success') })
    } catch (err) {
      setLogActionResult({ type: 'error', message: err instanceof Error ? err.message : t('export_failed') })
    } finally {
      setExportingLogs(false)
    }
  }

  const handleDeleteLogs = async () => {
    if (!session) return
    if (!confirm(t('confirm_delete_logs', { sessionName: session.session_name }))) return

    try {
      setDeletingLogs(true)
      setLogActionResult(null)

      const res = await deleteSessionUsageLogs(session.id)
      if (res.result === 'success' && res.data) {
        setLogActionResult({ type: 'success', message: t('logs_deleted', { count: res.data.deleted_count }) })
      }
    } catch (err) {
      setLogActionResult({ type: 'error', message: err instanceof Error ? err.message : t('delete_failed') })
    } finally {
      setDeletingLogs(false)
    }
  }

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">{t('loading')}</div>
      </div>
    )
  }

  if (error || !session) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-red-600">Error: {error || t('session_not_found')}</div>
        <button onClick={() => router.push('/admin/sessions')} className="mt-4 text-blue-600 hover:underline">
          {t('back_to_sessions')}
        </button>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <button onClick={() => router.push('/admin/sessions')} className="mb-2 text-blue-600 hover:underline">
            ← {t('back_to_sessions')}
          </button>
          <h1 className="text-2xl font-bold">{session.session_name}</h1>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowEditModal(true)}
            className="rounded bg-gray-600 px-4 py-2 text-white hover:bg-gray-700"
          >
            {t('edit_session')}
          </button>
          <div
            title={
              session.is_default
                ? t('cannot_delete_default_session')
                : isCurrentSession
                  ? t('cannot_delete_current_session')
                  : session.is_currently_active
                    ? t('cannot_delete_active_session')
                    : undefined
            }
          >
            <button
              onClick={handleDelete}
              disabled={session.is_default || isCurrentSession || session.is_currently_active}
              className={`rounded px-4 py-2 text-white ${
                session.is_default || isCurrentSession || session.is_currently_active
                  ? 'bg-gray-400 cursor-not-allowed'
                  : 'bg-red-600 hover:bg-red-700'
              }`}
            >
              {t('delete_session')}
            </button>
          </div>
        </div>
      </div>

      {/* Session Info - Compact Layout */}
      <div className="mb-6 rounded-lg border border-gray-300 bg-white p-4">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-500">{t('session_id')}:</span>
            <code className="rounded bg-gray-100 px-2 py-0.5 text-xs">{session.id}</code>
            <button
              onClick={handleCopySessionId}
              className={`px-2 py-0.5 text-xs rounded transition-colors ${
                isCopied
                  ? 'bg-green-600 text-white'
                  : 'bg-gray-500 text-white hover:bg-gray-600'
              }`}
            >
              {isCopied ? tCommon('copied') : tCommon('copy')}
            </button>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-500">{t('session_tag')}:</span>
            <code className="rounded bg-gray-100 px-2 py-0.5 text-sm">{session.session_tag}</code>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-500">{t('status')}:</span>
            <span
              className={`rounded px-2 py-0.5 text-xs ${
                session.is_currently_active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
              }`}
            >
              {session.is_currently_active ? t('active') : t('inactive')}
            </span>
            {session.force_status !== null && (
              <span className="text-xs text-gray-500">
                ({session.force_status ? t('force_active') : t('force_inactive')})
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-500">{t('start')}:</span>
            <span className="text-sm">{new Date(session.start_date).toLocaleDateString()}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-500">{t('end')}:</span>
            <span className="text-sm">{session.end_date ? new Date(session.end_date).toLocaleDateString() : 'N/A'}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-500">{t('max_students')}:</span>
            <span className="text-sm">{session.max_students}</span>
          </div>
        </div>
        {session.description && (
          <div className="mt-3 pt-3 border-t border-gray-200">
            <span className="text-sm text-gray-500">{t('description')}:</span>
            <span className="ml-2 text-sm">{session.description}</span>
          </div>
        )}
      </div>

      {/* Quota Warning Banner */}
      <SessionQuotaWarningBanner
        sessionId={sessionId}
        onNavigateToQuotas={() => setActiveTab('quotas')}
      />

      {/* Usage Log Management */}
      <div className="mb-6 rounded-lg border border-gray-300 bg-white p-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-medium text-gray-900">{t('usage_log_management')}</h3>
            <p className="text-xs text-gray-500">{t('usage_log_management_desc')}</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleExportLogs}
              disabled={exportingLogs}
              className="rounded bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:bg-gray-400"
            >
              {exportingLogs ? t('exporting') : t('export_logs')}
            </button>
            <div title={session.is_currently_active ? t('cannot_delete_active_session_logs') : undefined}>
              <button
                onClick={handleDeleteLogs}
                disabled={deletingLogs || session.is_currently_active}
                className="rounded bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                {deletingLogs ? t('deleting') : t('delete_logs')}
              </button>
            </div>
          </div>
        </div>
        {logActionResult && (
          <div className={`mt-3 rounded p-2 text-sm ${
            logActionResult.type === 'success' ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'
          }`}>
            {logActionResult.message}
            <button onClick={() => setLogActionResult(null)} className="ml-2 underline">
              {tCommon('close')}
            </button>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="rounded-lg border border-gray-300 bg-white">
        {/* Tab Headers */}
        <div className="flex border-b border-gray-300">
          <button
            onClick={() => setActiveTab('members')}
            className={`px-6 py-3 text-sm font-medium transition-colors ${
              activeTab === 'members'
                ? 'border-b-2 border-blue-600 text-blue-600 bg-blue-50'
                : 'text-gray-600 hover:text-gray-800 hover:bg-gray-50'
            }`}
          >
            {t('members_tab')} ({members.length})
          </button>
          <button
            onClick={() => setActiveTab('resources')}
            className={`px-6 py-3 text-sm font-medium transition-colors ${
              activeTab === 'resources'
                ? 'border-b-2 border-blue-600 text-blue-600 bg-blue-50'
                : 'text-gray-600 hover:text-gray-800 hover:bg-gray-50'
            }`}
          >
            {t('resources_tab')}
          </button>
          <button
            onClick={() => setActiveTab('quotas')}
            className={`px-6 py-3 text-sm font-medium transition-colors ${
              activeTab === 'quotas'
                ? 'border-b-2 border-blue-600 text-blue-600 bg-blue-50'
                : 'text-gray-600 hover:text-gray-800 hover:bg-gray-50'
            }`}
          >
            {t('quotas_tab')}
          </button>
        </div>

        {/* Tab Content */}
        <div className="p-6">
          {activeTab === 'members' && (
            <SessionMemberTable
              sessionId={sessionId}
              members={members}
              instructorAccountId={session.instructor_account_id}
              onMembersChange={loadSessionData}
            />
          )}

          {activeTab === 'resources' && (
            <SessionResourceSection
              sessionId={sessionId}
              onDeleteRequest={(accountId, accountName, summary) => {
                setDeleteAccountId(accountId)
                setDeleteAccountName(accountName)
                setResourceSummary(summary || { total_apps: 0, total_datasets: 0 })
                setShowDeleteResourceDialog(true)
              }}
            />
          )}

          {activeTab === 'quotas' && (
            <QuotaSettingsTab sessionId={sessionId} />
          )}
        </div>
      </div>

      {/* Edit Modal */}
      {showEditModal && (
        <EditSessionModal
          session={session}
          onClose={() => {
            setShowEditModal(false)
            loadSessionData()
          }}
        />
      )}

      {/* Resource Delete Dialog */}
      <ResourceDeleteDialog
        isOpen={showDeleteResourceDialog}
        sessionId={sessionId}
        accountId={deleteAccountId}
        accountName={deleteAccountName}
        resourceSummary={resourceSummary}
        onClose={() => setShowDeleteResourceDialog(false)}
        onDeleteComplete={() => {
          loadSessionData()
        }}
      />

      {/* Session Delete Dialog */}
      {session && (
        <SessionDeleteDialog
          isOpen={showDeleteSessionDialog}
          session={session}
          onClose={() => setShowDeleteSessionDialog(false)}
          onDeleteComplete={handleDeleteComplete}
        />
      )}
    </div>
  )
}
