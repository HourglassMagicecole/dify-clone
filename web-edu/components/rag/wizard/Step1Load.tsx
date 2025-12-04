/**
 * Step 1: Load - File Upload Component
 * Story 3.1: RAG Creation Wizard - Load & Split
 *
 * Features:
 * - Drag & Drop file upload
 * - Progress indicator
 * - Dataset name/description input
 */

'use client'

import React, { useCallback, useState, useEffect } from 'react'
import { useDropzone, type FileRejection } from 'react-dropzone'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useTranslation } from 'react-i18next'
import { useRAGWizard } from '@/context/RAGWizardContext'
import { datasetAPI } from '@/service/dataset-api'
import { Input } from '@/components/common/Input'
import { Textarea } from '@/components/common/Textarea'
import { Button } from '@/components/common/Button'
import { datasetBasicInfoSchema, type DatasetBasicInfoFormData } from '@/schemas/dataset-schema'
import { getErrorMessage, logError } from '@/utils/error-messages'
import type { FileUploadProgress } from '@/types/dataset'

/**
 * Supported file extensions for RAG
 * Source: api/constants/DOCUMENT_EXTENSIONS
 */
const ACCEPTED_FILE_TYPES = {
  'text/plain': ['.txt'],
  'text/markdown': ['.md'],
  'application/pdf': ['.pdf'],
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
  'text/csv': ['.csv'],
  'text/html': ['.html', '.htm'],
}

const MAX_FILE_SIZE = 15 * 1024 * 1024  // 15MB

export function Step1Load(): React.ReactElement {
  const { t } = useTranslation('dataset')
  const {
    datasetName,
    datasetDescription,
    uploadedFiles,
    setDatasetName,
    setDatasetDescription,
    addUploadedFile,
    removeUploadedFile,
    addUploadProgress,
    updateUploadProgress,
    nextStep,
    isLoading,
    setLoading,
    setError,
  } = useRAGWizard()

  // Local state for upload progress UI
  const [localProgress, setLocalProgress] = useState<FileUploadProgress[]>([])
  // Local state for rejection errors
  const [rejectionErrors, setRejectionErrors] = useState<string[]>([])

  // Form setup
  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isValid },
  } = useForm<DatasetBasicInfoFormData>({
    resolver: zodResolver(datasetBasicInfoSchema),
    mode: 'onChange',
    defaultValues: {
      name: datasetName,
      description: datasetDescription,
    },
  })

  // Auto-save to context when form changes (matching Agent wizard pattern)
  useEffect(() => {
    const subscription = watch((value) => {
      if (value.name !== undefined) {
        setDatasetName(value.name)
      }
      if (value.description !== undefined) {
        setDatasetDescription(value.description || '')
      }
    })
    return () => subscription.unsubscribe()
  }, [watch, setDatasetName, setDatasetDescription])

  /**
   * Handle file drop
   */
  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    for (const file of acceptedFiles) {
      // Check for duplicates
      if (uploadedFiles.some(f => f.name === file.name)) {
        continue
      }

      // Add to local progress
      const progressItem: FileUploadProgress = {
        file,
        progress: 0,
        status: 'uploading',
      }
      setLocalProgress(prev => [...prev, progressItem])
      addUploadProgress(progressItem)

      try {
        setLoading(true)
        const response = await datasetAPI.uploadFile(file, (progress) => {
          setLocalProgress(prev =>
            prev.map(p =>
              p.file.name === file.name ? { ...p, progress } : p
            )
          )
          updateUploadProgress(file.name, { progress })
        })

        // Remove from local progress (will show in uploadedFiles instead)
        setLocalProgress(prev => prev.filter(p => p.file.name !== file.name))
        updateUploadProgress(file.name, { status: 'completed', progress: 100, response })

        // Add to context
        addUploadedFile(response)
      } catch (error) {
        const errorInfo = getErrorMessage(error, t)
        logError(errorInfo, 'Step1Load.onDrop')
        const displayError = `${errorInfo.userMessage} (${errorInfo.code})`
        setLocalProgress(prev =>
          prev.map(p =>
            p.file.name === file.name
              ? { ...p, status: 'error', error: displayError }
              : p
          )
        )
        updateUploadProgress(file.name, { status: 'error', error: displayError })
        setError(displayError)
      } finally {
        setLoading(false)
      }
    }
  }, [addUploadedFile, addUploadProgress, updateUploadProgress, setError, setLoading, uploadedFiles, t])

  /**
   * Handle rejected files (size too large, unsupported format)
   */
  const onDropRejected = useCallback((fileRejections: FileRejection[]) => {
    const errors: string[] = []
    for (const rejection of fileRejections) {
      for (const error of rejection.errors) {
        if (error.code === 'file-too-large') {
          errors.push(`${rejection.file.name}: ${t('errors.fileTooLarge')}`)
        } else if (error.code === 'file-invalid-type') {
          errors.push(`${rejection.file.name}: ${t('errors.unsupportedFormat')}`)
        } else {
          errors.push(`${rejection.file.name}: ${error.message}`)
        }
      }
    }
    setRejectionErrors(errors)
    // Auto-clear errors after 5 seconds
    setTimeout(() => setRejectionErrors([]), 5000)
  }, [t])

  /**
   * Dropzone configuration
   */
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    onDropRejected,
    accept: ACCEPTED_FILE_TYPES,
    maxSize: MAX_FILE_SIZE,
    disabled: isLoading,
  })

  /**
   * Handle form submission and proceed to next step
   */
  const onSubmit = (data: DatasetBasicInfoFormData) => {
    setDatasetName(data.name)
    setDatasetDescription(data.description || '')
    nextStep()
  }

  /**
   * Check if can proceed to next step
   */
  const canProceed = isValid && uploadedFiles.length > 0 && !isLoading

  /**
   * Format file size
   */
  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  return (
    <div className="space-y-6">
      {/* Dataset Name & Description */}
      <div className="space-y-4">
        <Input
          id="dataset-name"
          label={t('step1.datasetName')}
          placeholder={t('step1.datasetNamePlaceholder')}
          required
          error={errors.name?.message ? t(errors.name.message) : undefined}
          {...register('name')}
        />

        <Textarea
          id="dataset-description"
          label={t('step1.datasetDescription')}
          placeholder={t('step1.datasetDescriptionPlaceholder')}
          rows={3}
          error={errors.description?.message ? t(errors.description.message) : undefined}
          {...register('description')}
        />
      </div>

      {/* Dropzone */}
      <div
        {...getRootProps()}
        role="button"
        aria-label={t('step1.dropzone')}
        className={`
          border-2 border-dashed rounded-lg p-8 text-center cursor-pointer
          transition-colors duration-200
          ${isDragActive
            ? 'border-blue-500 bg-blue-50'
            : 'border-gray-300 hover:border-gray-400'
          }
          ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}
        `}
      >
        <input {...getInputProps()} />
        <div className="text-4xl mb-4">📁</div>
        <p className="text-gray-700 font-medium">
          {isDragActive ? t('step1.dropHere') : t('step1.dropzone')}
        </p>
        <p className="text-sm text-gray-500 mt-2">
          {t('step1.supportedFormats')}
        </p>
        <p className="text-xs text-gray-400 mt-1">
          {t('step1.maxFileSize')}
        </p>
      </div>

      {/* Rejection Errors */}
      {rejectionErrors.length > 0 && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
          {rejectionErrors.map((error, index) => (
            <p key={index} className="text-sm text-red-600">
              ⚠️ {error}
            </p>
          ))}
        </div>
      )}

      {/* Upload Progress */}
      {localProgress.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-gray-700">
            {t('step1.uploadProgress')}
          </h4>
          {localProgress.map((item) => (
            <div
              key={item.file.name}
              className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg"
            >
              <span className="text-lg">
                {item.status === 'completed' ? '✅' : item.status === 'error' ? '❌' : '📄'}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">
                  {item.file.name}
                </p>
                {item.status === 'uploading' && (
                  <div
                    className="w-full bg-gray-200 rounded-full h-1.5 mt-1"
                    role="progressbar"
                    aria-valuenow={item.progress}
                    aria-valuemin={0}
                    aria-valuemax={100}
                  >
                    <div
                      className="bg-blue-600 h-1.5 rounded-full transition-all duration-300"
                      style={{ width: `${item.progress}%` }}
                    />
                  </div>
                )}
                {item.status === 'error' && (
                  <p className="text-xs text-red-600 mt-1">{item.error}</p>
                )}
              </div>
              <span className="text-xs text-gray-500">
                {formatFileSize(item.file.size)}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Uploaded Files List */}
      {uploadedFiles.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-gray-700">
            {t('step1.uploadedFiles')} ({uploadedFiles.length})
          </h4>
          {uploadedFiles.map((file) => (
            <div
              key={file.id}
              className="flex items-center justify-between p-3 bg-green-50 rounded-lg"
            >
              <div className="flex items-center gap-3">
                <span className="text-lg">✅</span>
                <div>
                  <p className="text-sm font-medium text-gray-900">{file.name}</p>
                  <p className="text-xs text-gray-500">
                    {formatFileSize(file.size)}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => removeUploadedFile(file.id)}
                className="text-red-600 hover:text-red-800 p-1"
                aria-label={t('step1.removeFile')}
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Navigation */}
      <div className="flex justify-end pt-4 border-t">
        <Button
          type="button"
          onClick={handleSubmit(onSubmit)}
          disabled={!canProceed}
        >
          {isLoading ? t('common.uploading') : t('common.next')}
        </Button>
      </div>
    </div>
  )
}
