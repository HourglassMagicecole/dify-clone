'use client'

import React, { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Modal } from '@/components/common/Modal'
import { UserManagementAPI } from '@/service/user-management-api'
import type { BulkCreateStatus } from '@/types/user-management'

interface BulkCreateModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess?: () => void // Called when bulk create succeeds
  onSubmit: (file: File, sessionId?: string) => Promise<string> // Returns task_id
  onCheckStatus: (taskId: string) => Promise<BulkCreateStatus>
}

export function BulkCreateModal({
  isOpen,
  onClose,
  onSuccess,
  onSubmit,
  onCheckStatus,
}: BulkCreateModalProps) {
  const { t } = useTranslation('user-management')
  const [file, setFile] = useState<File | null>(null)
  const [sessionId, setSessionId] = useState<string>('')
  const [isUploading, setIsUploading] = useState(false)
  const [taskId, setTaskId] = useState<string | null>(null)
  const [status, setStatus] = useState<BulkCreateStatus | null>(null)
  const intervalRef = useRef<NodeJS.Timeout | null>(null)

  // 파일 드래그 앤 드롭
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    const droppedFile = e.dataTransfer.files[0]
    if (droppedFile && droppedFile.name.endsWith('.csv'))
      setFile(droppedFile)
  }, [])

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    if (selectedFile)
      setFile(selectedFile)
  }

  // Interval 정리 함수
  const clearPollingInterval = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
  }

  const handleSubmit = async () => {
    if (!file)
      return

    setIsUploading(true)
    try {
      const newTaskId = await onSubmit(file, sessionId || undefined)
      setTaskId(newTaskId)

      // 이전 interval 정리
      clearPollingInterval()

      // 주기적으로 상태 확인 (2초마다)
      intervalRef.current = setInterval(async () => {
        const currentStatus = await onCheckStatus(newTaskId)
        setStatus(currentStatus)

        // 완료 조건: SUCCESS, FAILURE, 또는 진행률 100%
        const isCompleted = currentStatus.status === 'SUCCESS'
          || currentStatus.status === 'FAILURE'
          || (currentStatus.progress && currentStatus.progress.current === currentStatus.progress.total)

        if (isCompleted) {
          clearPollingInterval()
          setIsUploading(false)
        }
      }, 2000)
    }
    catch (error) {
      console.error('Failed to start bulk create:', error)
      setIsUploading(false)
    }
  }

  const handleDownloadTemplate = async () => {
    try {
      await UserManagementAPI.downloadTemplate()
    }
    catch (error) {
      console.error('Failed to download template:', error)
    }
  }

  const resetState = () => {
    clearPollingInterval() // interval 정리
    setFile(null)
    setSessionId('')
    setTaskId(null)
    setStatus(null)
    setIsUploading(false)
  }

  const handleClose = () => {
    resetState()
    onClose()
  }

  const handleConfirm = () => {
    // Call onSuccess to refresh user list
    if (onSuccess) {
      onSuccess()
    }
    resetState()
    onClose()
  }

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      clearPollingInterval()
    }
  }, [])

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={t('userManagement.bulkCreateModal.title')}
      footer={
        <div className="flex justify-end gap-3">
          {/* Check if completed: either status is SUCCESS/FAILURE or progress is 100% */}
          {(() => {
            const isCompleted = status
              && (status.status === 'SUCCESS'
              || status.status === 'FAILURE'
              || (status.progress && status.progress.current === status.progress.total))

            if (isCompleted) {
              // Show Confirm button when completed
              return (
                <button
                  type="button"
                  onClick={handleConfirm}
                  className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700"
                >
                  {t('userManagement.bulkCreateModal.confirmButton')}
                </button>
              )
            }
            else if (taskId) {
              // Show Cancel button when in progress
              return (
                <button
                  type="button"
                  onClick={handleClose}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                  disabled={isUploading}
                >
                  {t('userManagement.bulkCreateModal.cancelButton')}
                </button>
              )
            }
            else {
              // Show Submit button when no task
              return (
                <button
                  type="button"
                  onClick={handleSubmit}
                  className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 disabled:opacity-50"
                  disabled={!file || isUploading}
                >
                  {t('userManagement.bulkCreateModal.submitButton')}
                </button>
              )
            }
          })()}
        </div>
      }
    >
      <div className="space-y-4">
        {!taskId
          ? (
              <>
                {/* File Upload */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {t('userManagement.bulkCreateModal.uploadLabel')}
                  </label>
                  <div
                    onDrop={handleDrop}
                    onDragOver={e => e.preventDefault()}
                    className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-indigo-500 cursor-pointer"
                  >
                    <input
                      type="file"
                      accept=".csv"
                      onChange={handleFileChange}
                      className="hidden"
                      id="csv-upload"
                    />
                    <label htmlFor="csv-upload" className="cursor-pointer">
                      {file
                        ? (
                            <div>
                              <p className="text-sm text-gray-900 font-medium">{file.name}</p>
                              <p className="text-xs text-gray-500 mt-1">
                                {(file.size / 1024).toFixed(2)}
                                {' '}
                                KB
                              </p>
                            </div>
                          )
                        : (
                            <p className="text-sm text-gray-500">
                              {t('userManagement.bulkCreateModal.uploadPlaceholder')}
                            </p>
                          )}
                    </label>
                  </div>
                </div>

                {/* Session ID (Optional) */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {t('userManagement.bulkCreateModal.sessionLabel')}
                  </label>
                  <input
                    type="text"
                    value={sessionId}
                    onChange={e => setSessionId(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    placeholder="session-id (optional)"
                  />
                </div>

                {/* Download Template */}
                <div>
                  <button
                    type="button"
                    onClick={handleDownloadTemplate}
                    className="text-sm text-indigo-600 hover:text-indigo-800 underline"
                  >
                    {t('userManagement.bulkCreateModal.downloadTemplate')}
                  </button>
                </div>
              </>
            )
          : (
              <>
                {/* Progress */}
                <div>
                  <h4 className="text-sm font-medium text-gray-900 mb-2">
                    {t('userManagement.bulkCreateModal.statusTitle')}
                  </h4>

                  {status && (
                    <div className="space-y-3">
                      {/* Status */}
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-700">
                          {status.status === 'PENDING' && t('userManagement.bulkCreateModal.statusProcessing')}
                          {status.status === 'PROGRESS' && t('userManagement.bulkCreateModal.statusProcessing')}
                          {status.status === 'SUCCESS' && t('userManagement.bulkCreateModal.statusSuccess')}
                          {status.status === 'FAILURE' && t('userManagement.bulkCreateModal.statusFailed')}
                        </span>
                        <span className="text-sm font-medium text-gray-900">
                          {status.progress?.current || 0}
                          {' '}
                          /
                          {' '}
                          {status.progress?.total || 0}
                        </span>
                      </div>

                      {/* Progress Bar */}
                      {status.progress && (
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div
                            className="bg-indigo-600 h-2 rounded-full transition-all duration-300"
                            style={{
                              width: `${((status.progress.current || 0) / (status.progress.total || 1)) * 100}%`,
                            }}
                          />
                        </div>
                      )}

                      {/* Results */}
                      {status.progress && (
                        <div className="grid grid-cols-2 gap-3">
                          <div className="p-3 bg-green-50 rounded-md">
                            <p className="text-xs text-green-600">{t('userManagement.bulkCreateModal.successLabel')}</p>
                            <p className="text-lg font-semibold text-green-900">
                              {status.progress.created}
                            </p>
                          </div>
                          <div className="p-3 bg-red-50 rounded-md">
                            <p className="text-xs text-red-600">{t('userManagement.bulkCreateModal.failedLabel')}</p>
                            <p className="text-lg font-semibold text-red-900">
                              {status.progress.failed}
                            </p>
                          </div>
                        </div>
                      )}

                      {/* Errors */}
                      {status.progress?.errors && status.progress.errors.length > 0 && (
                        <div className="mt-3">
                          <p className="text-xs text-gray-700 mb-2">{t('userManagement.bulkCreateModal.recentErrors')}</p>
                          <div className="space-y-1 max-h-32 overflow-y-auto">
                            {status.progress.errors.map((error, idx) => (
                              <div key={idx} className="text-xs text-red-600">
                                {error.email}
                                :
                                {' '}
                                {error.error}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </>
            )}
      </div>
    </Modal>
  )
}
