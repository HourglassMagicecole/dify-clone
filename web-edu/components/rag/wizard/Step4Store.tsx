/**
 * Step 4: Store - Create RAG and Monitor Indexing Progress
 * Story 3.2: RAG Creation Wizard - Embed & Store
 *
 * Features:
 * - Create dataset with documents
 * - Monitor indexing progress via polling
 * - Display success/error states
 */

'use client'

import React, { useCallback, useEffect, useRef, useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslation } from 'react-i18next'
import { useRAGWizard } from '@/context/RAGWizardContext'
import { useSession } from '@/context/SessionContext'
import { datasetAPI } from '@/service/dataset-api'
import { Button } from '@/components/common/Button'
import { getErrorMessage, logError } from '@/utils/error-messages'
import type { DatasetInitRequest } from '@/types/dataset'

const POLLING_INTERVAL = 2000 // 2 seconds
const PROGRESS_TIMEOUT = 60000 // 1 minute - timeout if no progress change

export function Step4Store(): React.ReactElement {
  const { t } = useTranslation('dataset')
  const router = useRouter()
  const { currentSession } = useSession()
  const {
    // Step 1 data
    datasetName,
    datasetDescription,
    uploadedFiles,
    // Step 2 data
    processRule,
    separatorType,
    customSeparator,
    // Step 3 data
    selectedEmbeddingModel,
    selectedEmbeddingProvider,
    // Step 4 state
    createdDataset,
    batchId,
    indexingStatus,
    isIndexingComplete,
    setCreatedDataset,
    setCreatedDocuments,
    setBatchId,
    setIndexingStatus,
    setIsIndexingComplete,
    // Common
    prevStep,
    setError,
    clearDraft,
  } = useRAGWizard()

  const [isCreating, setIsCreating] = useState(false)
  const [isTimedOut, setIsTimedOut] = useState(false)
  const pollingRef = useRef<NodeJS.Timeout | null>(null)
  const maxProgressRef = useRef<number>(0)
  const lastProgressChangeRef = useRef<number>(Date.now())
  const lastProgressValueRef = useRef<number>(0)

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current)
      }
    }
  }, [])

  /**
   * Build the separator value based on type
   */
  const getSeparator = (): string => {
    if (separatorType === 'custom' && customSeparator) {
      return customSeparator
    }
    return processRule.rules?.segmentation.delimiter || '\n'
  }

  /**
   * Fetch indexing status with timeout detection
   */
  const fetchIndexingStatus = useCallback(async (datasetId: string, batch: string, currentProgress: number) => {
    try {
      const response = await datasetAPI.getBatchIndexingStatus(datasetId, batch)

      if (response.result === 'success' && response.data) {
        // response.data is already an array (getDifyNative unwraps { data: [...] })
        const statusData = response.data
        setIndexingStatus(statusData)

        // Check if all documents are completed
        const allCompleted = statusData.every(
          (doc) => doc.indexing_status === 'completed'
        )
        const hasError = statusData.some(
          (doc) => doc.indexing_status === 'error'
        )

        if (allCompleted || hasError) {
          setIsIndexingComplete(true)
          // Stop polling
          if (pollingRef.current) {
            clearInterval(pollingRef.current)
            pollingRef.current = null
          }
          // Clear draft from localStorage on success
          if (allCompleted && !hasError) {
            clearDraft()
          }
          return
        }

        // Check for timeout - if progress hasn't changed for PROGRESS_TIMEOUT
        if (currentProgress !== lastProgressValueRef.current) {
          // Progress changed, reset timer
          lastProgressChangeRef.current = Date.now()
          lastProgressValueRef.current = currentProgress
        } else {
          // Progress hasn't changed, check timeout
          const timeSinceLastChange = Date.now() - lastProgressChangeRef.current
          if (timeSinceLastChange >= PROGRESS_TIMEOUT) {
            setIsTimedOut(true)
            setIsIndexingComplete(true)
            // Stop polling
            if (pollingRef.current) {
              clearInterval(pollingRef.current)
              pollingRef.current = null
            }
          }
        }
      }
    } catch (err) {
      console.error('Failed to fetch indexing status:', err)
    }
  }, [setIndexingStatus, setIsIndexingComplete, clearDraft])

  /**
   * Start polling for indexing status
   */
  const startPolling = useCallback((datasetId: string, batchId: string) => {
    // Clear existing polling
    if (pollingRef.current) {
      clearInterval(pollingRef.current)
    }

    // Reset timeout tracking
    lastProgressChangeRef.current = Date.now()
    lastProgressValueRef.current = 0

    // Initial fetch
    fetchIndexingStatus(datasetId, batchId, maxProgressRef.current)

    // Start polling
    pollingRef.current = setInterval(() => {
      fetchIndexingStatus(datasetId, batchId, maxProgressRef.current)
    }, POLLING_INTERVAL)
  }, [fetchIndexingStatus])

  /**
   * Retry polling for existing dataset (when timeout occurred)
   */
  const handleRetry = () => {
    if (!createdDataset || !batchId) {
      // No existing dataset, need to create new one
      handleCreateRAG()
      return
    }

    // Reset states for retry
    setError(null)
    setIsTimedOut(false)
    setIsIndexingComplete(false)
    maxProgressRef.current = 0
    lastProgressChangeRef.current = Date.now()
    lastProgressValueRef.current = 0

    // Restart polling for existing dataset
    startPolling(createdDataset.id, batchId)
  }

  /**
   * Create RAG knowledge base
   */
  const handleCreateRAG = async () => {
    if (!selectedEmbeddingModel || !selectedEmbeddingProvider) {
      setError(t('step4.embeddingModelRequired'))
      return
    }

    try {
      setIsCreating(true)
      setError(null)
      setIsTimedOut(false) // Reset timeout state
      maxProgressRef.current = 0 // Reset progress for new creation

      // Build request - data_source.info_list.data_source_type is required by backend
      const request: DatasetInitRequest = {
        name: datasetName || undefined,
        description: datasetDescription || undefined,
        indexing_technique: 'high_quality',
        session_id: currentSession?.id,
        data_source: {
          info_list: {
            data_source_type: 'upload_file',
            file_info_list: {
              file_ids: uploadedFiles.map(f => f.id),
            },
          },
        },
        process_rule: {
          mode: processRule.mode,
          rules: processRule.rules ? {
            pre_processing_rules: processRule.rules.pre_processing_rules,
            segmentation: {
              separator: getSeparator(),
              max_tokens: processRule.rules.segmentation.max_tokens,
              chunk_overlap: processRule.rules.segmentation.chunk_overlap,
            },
          } : null,
        },
        doc_form: 'text_model',
        doc_language: 'Korean',
        embedding_model: selectedEmbeddingModel,
        embedding_model_provider: selectedEmbeddingProvider,
      }

      // Call API
      const response = await datasetAPI.initDataset(request)

      if (response.result === 'success' && response.data) {
        setCreatedDataset(response.data.dataset)
        setCreatedDocuments(response.data.documents)
        setBatchId(response.data.batch)

        // Start polling for indexing status
        startPolling(response.data.dataset.id, response.data.batch)
      } else {
        throw new Error(response.message || 'Failed to create RAG')
      }
    } catch (err) {
      const errorInfo = getErrorMessage(err, t)
      logError(errorInfo, 'Step4Store.handleCreateRAG')
      setError(`${errorInfo.userMessage} (${errorInfo.code})`)
    } finally {
      setIsCreating(false)
    }
  }

  /**
   * Calculate overall progress with stage-based weighting (never decreases)
   *
   * Stages and weights:
   * - waiting/parsing: 0-25%
   * - cleaning/splitting: 25-50%
   * - indexing: 50-100% (based on completed_segments/total_segments)
   * - completed: 100%
   */
  const progress = useMemo(() => {
    if (indexingStatus.length === 0) return maxProgressRef.current

    const docCount = indexingStatus.length
    let totalProgress = 0

    for (const doc of indexingStatus) {
      let docProgress = 0

      switch (doc.indexing_status) {
        case 'waiting':
          docProgress = 5
          break
        case 'parsing':
          docProgress = 15
          break
        case 'cleaning':
          docProgress = 30
          break
        case 'splitting':
          docProgress = 45
          break
        case 'indexing':
          // 50-99% based on segment progress
          if (doc.total_segments > 0) {
            const segmentProgress = doc.completed_segments / doc.total_segments
            docProgress = 50 + Math.round(segmentProgress * 49)
          } else {
            docProgress = 50
          }
          break
        case 'completed':
          docProgress = 100
          break
        case 'error':
        case 'paused':
          docProgress = maxProgressRef.current / docCount // Keep current progress
          break
        default:
          docProgress = 0
      }

      totalProgress += docProgress
    }

    const currentProgress = Math.round(totalProgress / docCount)

    // Progress should never decrease (prevents flickering)
    if (currentProgress > maxProgressRef.current) {
      maxProgressRef.current = currentProgress
    }

    return maxProgressRef.current
  }, [indexingStatus])
  const hasError = indexingStatus.some(doc => doc.indexing_status === 'error') || isTimedOut
  const displayName = datasetName || (uploadedFiles[0]?.name ?? 'Untitled')

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium text-gray-900 mb-2">
          {t('step4.title')}
        </h3>
        <p className="text-sm text-gray-500">
          {t('step4.description')}
        </p>
      </div>

      {/* Summary before creation */}
      {!createdDataset && (
        <div className="bg-gray-50 rounded-lg p-4 space-y-3">
          <h4 className="font-medium text-gray-900">{t('step4.summary')}</h4>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div>
              <span className="text-gray-500">{t('step4.datasetName')}:</span>{' '}
              <span className="font-medium">{displayName}</span>
            </div>
            <div>
              <span className="text-gray-500">{t('step4.fileCount')}:</span>{' '}
              <span className="font-medium">{uploadedFiles.length}</span>
            </div>
            <div>
              <span className="text-gray-500">{t('step4.embeddingModel')}:</span>{' '}
              <span className="font-medium">{selectedEmbeddingModel}</span>
            </div>
            <div>
              <span className="text-gray-500">{t('step4.chunkSize')}:</span>{' '}
              <span className="font-medium">{processRule.rules?.segmentation.max_tokens}</span>
            </div>
          </div>
        </div>
      )}

      {/* Progress during indexing */}
      {createdDataset && !isIndexingComplete && (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600" />
            <span className="text-gray-700">{t('step4.indexing')}</span>
          </div>

          {/* Overall progress bar */}
          <div>
            <div className="flex justify-between text-sm mb-1">
              <span className="text-gray-600">{t('step4.progress')}</span>
              <span className="font-medium">{progress}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>

          {/* Document status */}
          <div className="space-y-2">
            {indexingStatus.map((doc) => (
              <div key={doc.id} className="flex items-center gap-2 text-sm">
                <span className={`w-2 h-2 rounded-full ${
                  doc.indexing_status === 'completed' ? 'bg-green-500' :
                  doc.indexing_status === 'error' ? 'bg-red-500' :
                  'bg-yellow-500 animate-pulse'
                }`} />
                <span className="flex-1 truncate">{t(`step4.status.${doc.indexing_status}`)}</span>
                <span className="text-gray-500">{doc.completed_segments}/{doc.total_segments}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Success state */}
      {isIndexingComplete && !hasError && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center">
          <div className="text-4xl mb-2">&#x2705;</div>
          <h4 className="font-medium text-green-900">{t('step4.success')}</h4>
          <p className="text-sm text-green-700 mt-1">
            {t('step4.successDesc', {
              count: indexingStatus.reduce((sum, d) => sum + d.total_segments, 0)
            })}
          </p>
          <Button
            className="mt-4"
            onClick={() => router.push('/datasets')}
          >
            {t('step4.viewDataset')}
          </Button>
        </div>
      )}

      {/* Error state */}
      {hasError && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <h4 className="font-medium text-red-900">{t('step4.error')}</h4>
          <p className="text-sm text-red-700 mt-1">
            {isTimedOut
              ? t('step4.timeoutError')
              : indexingStatus.find(d => d.error)?.error || t('step4.unknownError')}
          </p>
          <Button
            variant="outline"
            className="mt-3"
            onClick={handleRetry}
          >
            {t('step4.retry')}
          </Button>
        </div>
      )}

      {/* Navigation */}
      {!createdDataset && (
        <div className="flex justify-between pt-4 border-t">
          <Button variant="outline" onClick={prevStep}>
            {t('common.back')}
          </Button>
          <Button
            onClick={handleCreateRAG}
            disabled={isCreating}
          >
            {isCreating ? t('step4.creating') : t('step4.createRAG')}
          </Button>
        </div>
      )}
    </div>
  )
}
