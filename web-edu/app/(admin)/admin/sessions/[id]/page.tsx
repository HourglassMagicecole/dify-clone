'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useTranslation } from 'react-i18next'
import { sessionAPI } from '@/service/session-api'
import { SessionMemberTable } from '@/components/session/SessionMemberTable'
import { EditSessionModal } from '@/components/session/EditSessionModal'
import { useSession } from '@/context/SessionContext'
import type { Session, SessionMember } from '@/types/session'

export default function SessionDetailPage() {
  const params = useParams()
  const router = useRouter()
  const { t } = useTranslation('session')
  const { t: tCommon } = useTranslation('common')
  const { refreshSessions: refreshSessionContext } = useSession()
  const sessionId = params.id as string

  const [session, setSession] = useState<Session | null>(null)
  const [members, setMembers] = useState<SessionMember[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showEditModal, setShowEditModal] = useState(false)
  const [isCopied, setIsCopied] = useState(false)

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

  const handleDelete = async () => {
    if (!confirm(t('delete_confirm_detail'))) {
      return
    }

    try {
      await sessionAPI.deleteSession(sessionId)
      await refreshSessionContext() // Update SessionSelector
      router.push('/admin/sessions')
    }
    catch (err) {
      alert(err instanceof Error ? err.message : t('failed_to_delete'))
    }
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
          <button onClick={handleDelete} className="rounded bg-red-600 px-4 py-2 text-white hover:bg-red-700">
            {t('delete_session')}
          </button>
        </div>
      </div>

      {/* Session Info */}
      <div className="mb-6 rounded-lg border border-gray-300 bg-white p-6">
        <h2 className="mb-4 text-lg font-bold">{t('session_info')}</h2>
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <div className="text-sm text-gray-600">{t('session_id')}</div>
            <div className="flex items-center gap-2">
              <code className="rounded bg-gray-100 px-2 py-1 text-xs">{session.id}</code>
              <button
                onClick={handleCopySessionId}
                className={`px-3 py-1 text-xs rounded transition-colors ${
                  isCopied
                    ? 'bg-green-600 text-white'
                    : 'bg-gray-600 text-white hover:bg-gray-700'
                }`}
              >
                {isCopied ? tCommon('copied') : tCommon('copy')}
              </button>
            </div>
          </div>
          <div>
            <div className="text-sm text-gray-600">{t('session_tag')}</div>
            <div className="font-medium">
              <code className="rounded bg-gray-100 px-2 py-1">{session.session_tag}</code>
            </div>
          </div>
          <div>
            <div className="text-sm text-gray-600">{t('status')}</div>
            <div>
              <span
                className={`rounded px-2 py-1 text-sm ${
                  session.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                }`}
              >
                {session.is_active ? t('active') : t('inactive')}
              </span>
            </div>
          </div>
          <div>
            <div className="text-sm text-gray-600">{t('start_date')}</div>
            <div className="font-medium">{new Date(session.start_date).toLocaleDateString()}</div>
          </div>
          <div>
            <div className="text-sm text-gray-600">{t('end_date')}</div>
            <div className="font-medium">
              {session.end_date ? new Date(session.end_date).toLocaleDateString() : 'N/A'}
            </div>
          </div>
          <div>
            <div className="text-sm text-gray-600">{t('max_students')}</div>
            <div className="font-medium">{session.max_students}</div>
          </div>
          <div>
            <div className="text-sm text-gray-600">{t('current_members')}</div>
            <div className="font-medium">{members.length}</div>
          </div>
        </div>
        {session.description && (
          <div className="mt-4">
            <div className="text-sm text-gray-600">{t('description')}</div>
            <div className="mt-1">{session.description}</div>
          </div>
        )}
      </div>

      {/* Session Members */}
      <div className="rounded-lg border border-gray-300 bg-white p-6">
        <h2 className="mb-4 text-lg font-bold">
          {t('session_members')} ({members.length})
        </h2>
        <SessionMemberTable
          sessionId={sessionId}
          members={members}
          instructorAccountId={session.instructor_account_id}
          onMembersChange={loadSessionData}
        />
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
    </div>
  )
}
