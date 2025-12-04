/**
 * DocumentAddModal Component
 * Story 3.3 Extension: Add documents to existing dataset
 */

'use client'

import { useState, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { XMarkIcon, DocumentArrowUpIcon, ArrowPathIcon } from '@heroicons/react/24/outline'
import { datasetAPI } from '@/service/dataset-api'
import type { Dataset, FileUploadResponse } from '@/types/dataset'

interface DocumentAddModalProps {
  isOpen: boolean
  dataset: Dataset
  onClose: () => void
  onSuccess: () => void
}

const ACCEPTED_FILE_TYPES = [
  '.txt', '.md', '.markdown',
  '.pdf',
  '.docx', '.doc',
  '.csv',
  '.html', '.htm',
]
const MAX_FILE_SIZE = 15 * 1024 * 1024 // 15MB

interface UploadingFile {
  file: File
  progress: number
  status: 'pending' | 'uploading' | 'completed' | 'error'
  response?: FileUploadResponse
  error?: string
}

/**
 * Modal for adding documents to an existing dataset
 */
export function DocumentAddModal({
  isOpen,
  dataset,
  onClose,
  onSuccess,
}: DocumentAddModalProps) {
  const { t } = useTranslation('dataset')
  const [uploadingFiles, setUploadingFiles] = useState<UploadingFile[]>([])
  const [isCreating, setIsCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isDragOver, setIsDragOver] = useState(false)

  const resetState = useCallback(() => {
    setUploadingFiles([])
    setIsCreating(false)
    setError(null)
    setIsDragOver(false)
  }, [])

  const handleClose = () => {
    if (!isCreating) {
      resetState()
      onClose()
    }
  }

  const validateFile = (file: File): string | null => {
    // Check file size
    if (file.size > MAX_FILE_SIZE) {
      return t('errors.fileTooLarge')
    }

    // Check file type
    const ext = '.' + file.name.split('.').pop()?.toLowerCase()
    if (!ACCEPTED_FILE_TYPES.includes(ext)) {
      return t('errors.unsupportedFormat')
    }

    return null
  }

  const uploadFile = async (file: File, index: number) => {
    try {
      setUploadingFiles(prev => prev.map((f, i) =>
        i === index ? { ...f, status: 'uploading' as const } : f
      ))

      const response = await datasetAPI.uploadFile(file, (progress) => {
        setUploadingFiles(prev => prev.map((f, i) =>
          i === index ? { ...f, progress } : f
        ))
      })

      setUploadingFiles(prev => prev.map((f, i) =>
        i === index ? { ...f, status: 'completed' as const, response, progress: 100 } : f
      ))

      return response
    } catch (err) {
      setUploadingFiles(prev => prev.map((f, i) =>
        i === index ? {
          ...f,
          status: 'error' as const,
          error: err instanceof Error ? err.message : 'Upload failed'
        } : f
      ))
      return null
    }
  }

  const handleFilesSelected = async (files: FileList | File[]) => {
    const fileArray = Array.from(files)
    const validFiles: UploadingFile[] = []

    for (const file of fileArray) {
      const validationError = validateFile(file)
      if (validationError) {
        setError(validationError)
        continue
      }
      validFiles.push({
        file,
        progress: 0,
        status: 'pending',
      })
    }

    if (validFiles.length === 0) return

    setUploadingFiles(prev => [...prev, ...validFiles])
    setError(null)

    // Upload files sequentially
    const startIndex = uploadingFiles.length
    for (let i = 0; i < validFiles.length; i++) {
      await uploadFile(validFiles[i].file, startIndex + i)
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
    if (e.dataTransfer.files.length > 0) {
      handleFilesSelected(e.dataTransfer.files)
    }
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
  }

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFilesSelected(e.target.files)
    }
    e.target.value = '' // Reset input
  }

  const removeFile = (index: number) => {
    setUploadingFiles(prev => prev.filter((_, i) => i !== index))
  }

  const handleCreateDocuments = async () => {
    const completedFiles = uploadingFiles.filter(f => f.status === 'completed' && f.response)
    if (completedFiles.length === 0) return

    try {
      setIsCreating(true)
      setError(null)

      const response = await datasetAPI.createDocumentByFile(dataset.id, {
        data_source: {
          info_list: {
            data_source_type: 'upload_file',
            file_info_list: {
              file_ids: completedFiles.map(f => f.response!.id),
            },
          },
        },
        indexing_technique: dataset.indexing_technique || 'high_quality',
        doc_form: 'text_model',
        doc_language: 'English',
        process_rule: {
          mode: 'automatic',
          rules: null,
        },
      })

      if (response.result === 'success') {
        resetState()
        onSuccess()
        onClose()
      } else {
        setError(t('errors.generic'))
      }
    } catch (err) {
      console.error('Failed to create documents:', err)
      setError(err instanceof Error ? err.message : t('errors.generic'))
    } finally {
      setIsCreating(false)
    }
  }

  const completedCount = uploadingFiles.filter(f => f.status === 'completed').length
  const canCreate = completedCount > 0 && !isCreating

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
        onClick={handleClose}
        aria-hidden="true"
      />

      {/* Modal */}
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="relative bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-lg transform transition-all">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              {t('detail.addDocumentTitle')}
            </h3>
            <button
              type="button"
              onClick={handleClose}
              className="text-gray-400 hover:text-gray-500 dark:hover:text-gray-300"
              disabled={isCreating}
            >
              <XMarkIcon className="h-5 w-5" />
            </button>
          </div>

          {/* Content */}
          <div className="p-4 space-y-4">
            {/* Dropzone */}
            <div
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              className={`
                relative border-2 border-dashed rounded-lg p-8 text-center transition-colors
                ${isDragOver
                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                  : 'border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500'
                }
              `}
            >
              <input
                type="file"
                multiple
                accept={ACCEPTED_FILE_TYPES.join(',')}
                onChange={handleFileInputChange}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                disabled={isCreating}
              />
              <DocumentArrowUpIcon className="h-12 w-12 mx-auto text-gray-400 mb-3" />
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {isDragOver ? t('step1.dropHere') : t('step1.dropzone')}
              </p>
              <p className="text-xs text-gray-500 mt-1">
                {t('step1.supportedFormats')}
              </p>
            </div>

            {/* File List */}
            {uploadingFiles.length > 0 && (
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {uploadingFiles.map((f, index) => (
                  <div
                    key={index}
                    className="flex items-center gap-3 p-2 bg-gray-50 dark:bg-gray-700 rounded-lg"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                        {f.file.name}
                      </p>
                      {f.status === 'uploading' && (
                        <div className="mt-1 h-1 bg-gray-200 dark:bg-gray-600 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-blue-600 transition-all duration-300"
                            style={{ width: `${f.progress}%` }}
                          />
                        </div>
                      )}
                      {f.status === 'error' && (
                        <p className="text-xs text-red-600">{f.error}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {f.status === 'uploading' && (
                        <ArrowPathIcon className="h-4 w-4 text-blue-600 animate-spin" />
                      )}
                      {f.status === 'completed' && (
                        <span className="text-xs text-green-600">✓</span>
                      )}
                      {f.status !== 'uploading' && (
                        <button
                          onClick={() => removeFile(index)}
                          className="text-gray-400 hover:text-red-600"
                          disabled={isCreating}
                        >
                          <XMarkIcon className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Error */}
            {error && (
              <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-3 p-4 border-t border-gray-200 dark:border-gray-700">
            <button
              type="button"
              onClick={handleClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600"
              disabled={isCreating}
            >
              {t('common.cancel')}
            </button>
            <button
              type="button"
              onClick={handleCreateDocuments}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={!canCreate}
            >
              {isCreating ? (
                <span className="flex items-center gap-2">
                  <ArrowPathIcon className="h-4 w-4 animate-spin" />
                  {t('detail.addingDocuments')}
                </span>
              ) : (
                t('detail.addDocumentsButton', { count: completedCount })
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
