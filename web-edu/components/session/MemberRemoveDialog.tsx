'use client'

import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { sessionAPI } from '@/service/session-api'
import type { MemberRemoveProgress, MemberRemoveResult, SessionMember } from '@/types/session'

type RemovePhase = 'confirm' | 'removing' | 'completed' | 'failed'

interface MemberRemoveDialogProps {
  isOpen: boolean
  sessionId: string
  member: SessionMember
  onClose: () => void
  onRemoveComplete: () => void
}

export function MemberRemoveDialog({
  isOpen,
  sessionId,
  member,
  onClose,
  onRemoveComplete,
}: MemberRemoveDialogProps) {
  const { t } = useTranslation('session')

  const [phase, setPhase] = useState<RemovePhase>('confirm')
  const [taskId, setTaskId] = useState<string | null>(null)
  const [progress, setProgress] = useState<MemberRemoveProgress | null>(null)
  const [result, setResult] = useState<MemberRemoveResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Reset state when dialog opens
  useEffect(() => {
    if (isOpen) {
      setPhase('confirm')
      setTaskId(null)
      setProgress(null)
      setResult(null)
      setError(null)
    }
  }, [isOpen])

  // Poll for status when removing
  useEffect(() => {
    if (phase !== 'removing' || !taskId)
      return

    const interval = setInterval(async () => {
      try {
        const status = await sessionAPI.getMemberRemoveStatus(sessionId, member.account_id, taskId)

        if (status.status === 'completed') {
          setPhase('completed')
          setResult(status.result)
          clearInterval(interval)
        }
        else if (status.status === 'failed') {
          setPhase('failed')
          setError(status.error || t('member_remove_failed'))
          clearInterval(interval)
        }
        else if (status.status === 'progress' && status.progress) {
          setProgress(status.progress)
        }
      }
      catch (err) {
        console.error('Failed to get removal status:', err)
      }
    }, 2000) // Poll every 2 seconds

    return () => clearInterval(interval)
  }, [phase, taskId, sessionId, member.account_id, t])

  const handleRemove = useCallback(async () => {
    try {
      setPhase('removing')
      const response = await sessionAPI.removeSessionMember(sessionId, member.account_id)
      setTaskId(response.task_id)
    }
    catch (err) {
      setPhase('failed')
      setError(err instanceof Error ? err.message : t('member_remove_failed'))
    }
  }, [sessionId, member.account_id, t])

  const handleClose = useCallback(() => {
    if (phase === 'completed') {
      onRemoveComplete()
    }
    onClose()
  }, [phase, onClose, onRemoveComplete])

  const getPhaseLabel = (phaseKey: string): string => {
    const labels: Record<string, string> = {
      deleting_apps: t('phase_deleting_apps'),
      deleting_datasets: t('phase_deleting_datasets'),
      removing_member: t('phase_removing_member'),
    }
    return labels[phaseKey] || phaseKey
  }

  const progressPercentage = progress
    ? Math.round((progress.current / progress.total) * 100)
    : 0

  if (!isOpen)
    return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black bg-opacity-50"
        onClick={phase === 'removing' ? undefined : handleClose}
      />

      {/* Dialog */}
      <div className="relative bg-white rounded-lg shadow-xl w-full max-w-md mx-4 p-6">
        {/* Confirm Phase */}
        {phase === 'confirm' && (
          <div>
            <div className="flex items-center gap-2 text-red-600 font-bold mb-4">
              <span className="text-xl">&#9888;</span>
              {t('member_remove_warning')}
            </div>

            <div className="bg-gray-100 p-4 rounded mb-4">
              <p className="font-medium mb-2">{t('member_to_remove')}:</p>
              <div className="text-sm text-gray-600">
                <p>
                  <strong>{t('name')}:</strong>
                  {' '}
                  {member.name}
                </p>
                <p>
                  <strong>{t('email')}:</strong>
                  {' '}
                  {member.email}
                </p>
              </div>
            </div>

            <p className="text-gray-600 text-sm mb-6">
              {t('member_remove_description')}
            </p>

            <div className="flex gap-2 justify-end">
              <button
                onClick={handleClose}
                className="px-4 py-2 rounded border border-gray-300 hover:bg-gray-50"
              >
                {t('cancel')}
              </button>
              <button
                onClick={handleRemove}
                className="px-4 py-2 rounded bg-red-600 text-white hover:bg-red-700"
              >
                {t('confirm_remove')}
              </button>
            </div>
          </div>
        )}

        {/* Removing Phase */}
        {phase === 'removing' && (
          <div>
            <div className="mb-4">
              <div className="text-lg font-bold">{t('removing_member')}</div>
              {progress && (
                <div className="text-gray-600 text-sm mt-1">
                  {getPhaseLabel(progress.phase)}
                </div>
              )}
            </div>

            {/* Progress Bar */}
            <div className="w-full bg-gray-200 rounded h-4 mb-4 overflow-hidden">
              <div
                className="bg-blue-600 h-4 rounded transition-all duration-300"
                style={{ width: `${progressPercentage}%` }}
              />
            </div>

            {progress && (
              <div className="text-sm text-gray-600 space-y-1">
                <div>
                  {progress.current}
                  {' '}
                  /
                  {' '}
                  {progress.total}
                </div>
                <div>
                  {t('deleted_apps')}
                  :
                  {' '}
                  {progress.deleted_apps}
                </div>
                <div>
                  {t('deleted_datasets')}
                  :
                  {' '}
                  {progress.deleted_datasets}
                </div>
              </div>
            )}

            <div className="mt-4 text-center text-gray-500 text-sm">
              {t('please_wait')}
            </div>
          </div>
        )}

        {/* Completed Phase */}
        {phase === 'completed' && (
          <div>
            <div className="flex items-center gap-2 text-green-600 text-lg font-bold mb-4">
              <span>&#10003;</span>
              {t('member_remove_completed')}
            </div>

            {result && (
              <div className="bg-gray-100 p-4 rounded mb-4">
                <p>
                  {t('deleted_apps')}
                  :
                  {' '}
                  {result.deleted_apps}
                </p>
                <p>
                  {t('deleted_datasets')}
                  :
                  {' '}
                  {result.deleted_datasets}
                </p>
                {result.errors && result.errors.length > 0 && (
                  <div className="mt-2 text-sm text-orange-600">
                    <p className="font-medium">{t('warnings')}:</p>
                    <ul className="list-disc list-inside">
                      {result.errors.map((err, idx) => (
                        <li key={idx}>{err}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}

            <div className="flex justify-end">
              <button
                onClick={handleClose}
                className="px-4 py-2 rounded bg-gray-600 text-white hover:bg-gray-700"
              >
                {t('close')}
              </button>
            </div>
          </div>
        )}

        {/* Failed Phase */}
        {phase === 'failed' && (
          <div>
            <div className="flex items-center gap-2 text-red-600 text-lg font-bold mb-4">
              <span>&#10005;</span>
              {t('member_remove_failed')}
            </div>

            <p className="text-gray-600 mb-6">{error}</p>

            <div className="flex justify-end">
              <button
                onClick={handleClose}
                className="px-4 py-2 rounded bg-gray-600 text-white hover:bg-gray-700"
              >
                {t('close')}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
