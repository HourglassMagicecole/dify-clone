'use client'

import type React from 'react'
import { useCallback, useState } from 'react'
import { useDropzone } from 'react-dropzone'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

/**
 * Uploaded file information
 */
export interface UploadedFileInfo {
  id: string
  name: string
  type: string
  size: number
  url: string
}

/**
 * File upload field props
 */
export interface FileUploadFieldProps {
  name: string
  label: string
  required: boolean
  onChange: (fileInfo: UploadedFileInfo | null) => void
  value?: UploadedFileInfo | null
}

// Security: Allowed file types (whitelist approach)
const ALLOWED_FILE_TYPES = [
  'application/pdf',
  'image/*',
  'text/*',
  'application/vnd.*', // Office files
  'application/json',
  'application/xml',
]

// Security: Forbidden file extensions (blacklist approach)
const FORBIDDEN_EXTENSIONS = ['.exe', '.bat', '.sh', '.cmd', '.scr', '.vbs', '.ps1', '.app', '.msi', '.dmg']

// File size limit: 15MB
const MAX_FILE_SIZE = 15 * 1024 * 1024 // 15MB in bytes

/**
 * File upload field component with drag & drop support
 *
 * Features:
 * - Drag & drop file upload
 * - File type validation (security)
 * - File size validation
 * - Upload progress indicator
 * - File preview after upload
 *
 * Security:
 * - Whitelist allowed MIME types
 * - Blacklist forbidden extensions
 * - File size limit enforcement
 */
export function FileUploadField({ name, label, required, onChange, value }: FileUploadFieldProps) {
  const { t } = useTranslation()
  const [uploadedFile, setUploadedFile] = useState<UploadedFileInfo | null>(value || null)
  const [isUploading, setIsUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)

  /**
   * Validate file type and extension (security check)
   */
  const validateFile = useCallback((file: File): { valid: boolean, error?: string } => {
    // 1. Check forbidden extensions
    const ext = file.name.toLowerCase().split('.').pop()
    if (ext && FORBIDDEN_EXTENSIONS.includes(`.${ext}`)) {
      return {
        valid: false,
        error: t('execute.fileUpload.errors.forbiddenType', { defaultValue: '이 파일 형식은 보안상 업로드할 수 없습니다' }),
      }
    }

    // 2. Check MIME type against allowed types
    const isAllowedType = ALLOWED_FILE_TYPES.some((allowedType) => {
      const regex = new RegExp(allowedType.replace('*', '.*'))
      return regex.test(file.type)
    })

    if (!isAllowedType) {
      return {
        valid: false,
        error: t('execute.fileUpload.errors.unsupportedType', { defaultValue: '지원하지 않는 파일 형식입니다' }),
      }
    }

    // 3. Check file size
    if (file.size > MAX_FILE_SIZE) {
      return {
        valid: false,
        error: t('execute.fileUpload.errors.sizeTooLarge', {
          defaultValue: '파일 크기가 너무 큽니다 (최대 15MB)',
          maxSize: '15MB',
        }),
      }
    }

    return { valid: true }
  }, [t])

  /**
   * Upload file to Dify API (Task 8.2)
   */
  const uploadFile = useCallback(async (file: File): Promise<UploadedFileInfo> => {
    // Use agentAPI.uploadFile with progress tracking
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest()

      // Track upload progress
      xhr.upload.addEventListener('progress', (event) => {
        if (event.lengthComputable) {
          const progress = Math.round((event.loaded / event.total) * 100)
          setUploadProgress(progress)
        }
      })

      // Handle upload completion
      xhr.addEventListener('load', () => {
        if (xhr.status === 200 || xhr.status === 201) {
          try {
            const data = JSON.parse(xhr.responseText)
            resolve({
              id: data.id,
              name: data.name || file.name,
              type: data.mime_type || file.type,
              size: data.size || file.size,
              url: data.url || `/files/${data.id}`,
            })
          }
          catch {
            reject(new Error('Failed to parse upload response'))
          }
        }
        else {
          reject(new Error(`Upload failed: ${xhr.statusText}`))
        }
      })

      // Handle upload error
      xhr.addEventListener('error', () => {
        reject(new Error('Network error during file upload'))
      })

      // Prepare FormData
      const formData = new FormData()
      formData.append('file', file)

      // Get API base URL
      const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL !== undefined
        ? process.env.NEXT_PUBLIC_API_BASE_URL
        : 'http://localhost:5001'

      // Start upload
      xhr.open('POST', `${apiBaseUrl}/v1/files/upload`)

      // Get auth token from localStorage
      const token = localStorage.getItem('access_token')
      if (token) {
        xhr.setRequestHeader('Authorization', `Bearer ${token}`)
      }

      xhr.send(formData)
    })
  }, [])

  /**
   * Handle file drop/selection
   */
  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    if (acceptedFiles.length === 0)
      return

    const file = acceptedFiles[0]
    if (!file)
      return

    // Validate file
    const validation = validateFile(file)
    if (!validation.valid) {
      toast.error(validation.error)
      return
    }

    // Upload file
    setIsUploading(true)
    setUploadProgress(0)

    try {
      const fileInfo = await uploadFile(file)
      setUploadedFile(fileInfo)
      onChange(fileInfo)
      toast.success(t('execute.fileUpload.success', { defaultValue: '파일 업로드 완료' }))
    }
    catch (error) {
      console.error('File upload error:', error)
      toast.error(
        t('execute.fileUpload.errors.uploadFailed', {
          defaultValue: '파일 업로드 실패',
          error: error instanceof Error ? error.message : String(error),
        }),
      )
    }
    finally {
      setIsUploading(false)
      setUploadProgress(0)
    }
  }, [validateFile, uploadFile, onChange, t])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    multiple: false,
    disabled: isUploading,
  })

  /**
   * Handle file removal
   */
  const handleRemove = useCallback(() => {
    setUploadedFile(null)
    onChange(null)
  }, [onChange])

  return (
    <div className="space-y-2">
      {/* Label */}
      <label htmlFor={name} className="block text-sm font-medium text-gray-900">
        {label}
        {required && <span className="text-red-500 ml-1">*</span>}
      </label>

      {/* Upload area or preview */}
      {!uploadedFile
        ? (
            <div
              {...getRootProps()}
              className={`
              border-2 border-dashed rounded-lg p-6 text-center cursor-pointer
              transition-colors duration-200
              ${isDragActive ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-gray-400'}
              ${isUploading ? 'opacity-50 cursor-not-allowed' : ''}
            `}
            >
              <input {...getInputProps()} id={name} />

              {isUploading
                ? (
                    <div className="space-y-2">
                      <div className="text-sm text-gray-600">
                        {t('execute.fileUpload.uploading', { defaultValue: '업로드 중...' })}
                        {' '}
                        {uploadProgress}
                        %
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                          style={{ width: `${uploadProgress}%` }}
                        />
                      </div>
                    </div>
                  )
                : (
                    <div className="space-y-2">
                      <svg
                        className="mx-auto h-12 w-12 text-gray-400"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                        />
                      </svg>
                      <div className="text-sm text-gray-600">
                        {isDragActive
                          ? t('execute.fileUpload.dropHere', { defaultValue: '여기에 파일을 놓으세요' })
                          : t('execute.fileUpload.dragOrClick', {
                            defaultValue: '파일을 드래그하거나 클릭하세요',
                          })}
                      </div>
                      <p className="text-xs text-gray-500">
                        {t('execute.fileUpload.maxSize', { defaultValue: '최대 15MB' })}
                      </p>
                    </div>
                  )}
            </div>
          )
        : (
            <div className="border border-gray-300 rounded-lg p-4 flex items-center justify-between">
              <div className="flex items-center space-x-3">
                {/* File icon */}
                <svg
                  className="h-10 w-10 text-gray-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                  />
                </svg>

                {/* File info */}
                <div>
                  <p className="text-sm font-medium text-gray-900">{uploadedFile.name}</p>
                  <p className="text-xs text-gray-500">
                    {(uploadedFile.size / 1024).toFixed(2)}
                    {' '}
                    KB
                  </p>
                </div>
              </div>

              {/* Remove button */}
              <button
                type="button"
                onClick={handleRemove}
                className="text-red-500 hover:text-red-700 transition-colors"
                aria-label={t('execute.fileUpload.remove', { defaultValue: '삭제' })}
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>
          )}
    </div>
  )
}
