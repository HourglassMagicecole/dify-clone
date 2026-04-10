'use client'

import { useState, KeyboardEvent, useRef, ChangeEvent, DragEvent } from 'react'
import { useTranslation } from 'react-i18next'

interface MessageInputProps {
  onSend: (message: string, files: File[]) => void
  disabled: boolean
  isSending?: boolean
  placeholder?: string
}

/**
 * MessageInput Component
 * Text input area with file upload support
 */
export function MessageInput({ onSend, disabled, isSending = false, placeholder }: MessageInputProps) {
  const { t } = useTranslation('chat')
  const [message, setMessage] = useState('')
  const [selectedFiles, setSelectedFiles] = useState<File[]>([])
  const [isDragActive, setIsDragActive] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    // Enter: send message (Shift+Enter: new line)
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
    // Esc: clear input
    if (e.key === 'Escape') {
      setMessage('')
      setSelectedFiles([])
    }
  }

  const handleSend = () => {
    if ((message.trim() || selectedFiles.length > 0) && !disabled) {
      onSend(message.trim(), selectedFiles)
      setMessage('')
      setSelectedFiles([])
    }
  }

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])

    // Validate file count (max 5)
    if (files.length > 5) {
      alert(t('error.tooManyFiles', { max: 5 }))
      return
    }

    // Validate file size (max 10MB per file)
    const oversizedFiles = files.filter((f) => f.size > 10 * 1024 * 1024)
    if (oversizedFiles.length > 0) {
      alert(t('error.fileTooLarge'))
      return
    }

    setSelectedFiles((prev) => [...prev, ...files])

    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const handleRemoveFile = (index: number) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index))
  }

  const handleDragEnter = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragActive(true)
  }

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
  }

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragActive(false)
  }

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragActive(false)

    const files = Array.from(e.dataTransfer.files)
    if (files.length === 0) return

    // Validate file count (max 5)
    if (files.length > 5) {
      alert(t('error.tooManyFiles', { max: 5 }))
      return
    }

    // Validate file size (max 10MB per file)
    const oversizedFiles = files.filter((f) => f.size > 10 * 1024 * 1024)
    if (oversizedFiles.length > 0) {
      alert(t('error.fileTooLarge'))
      return
    }

    setSelectedFiles((prev) => [...prev, ...files])
  }

  return (
    <div
      className={`p-4 rounded-lg border-2 transition-colors ${isDragActive ? 'border-blue-500 bg-blue-50' : 'border-transparent'}`}
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Selected files preview */}
      {selectedFiles.length > 0 && (
        <div className="mb-2 flex gap-2 flex-wrap">
          {selectedFiles.map((file, index) => (
            <div key={index} className="flex items-center gap-1 bg-gray-100 px-2 py-1 rounded text-sm">
              <span>📎 {file.name}</span>
              <button
                onClick={() => handleRemoveFile(index)}
                className="text-red-500 hover:text-red-700"
                aria-label={`Remove ${file.name}`}
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Input area */}
      <div className="flex gap-2">
        {/* File upload button */}
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="image/*,.pdf,.txt,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.csv,.md"
          onChange={handleFileChange}
          className="hidden"
          disabled={disabled}
        />
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={disabled}
          className="p-2 hover:bg-gray-100 rounded-lg disabled:opacity-50 flex-shrink-0"
          aria-label={t('fileUploadButton')}
          title={t('fileUploadHelp')}
        >
          📎
        </button>

        {/* Textarea */}
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder || t('inputPlaceholder')}
          disabled={disabled}
          className="flex-1 resize-none border rounded-lg p-2 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
          rows={1}
          style={{ maxHeight: '120px' }}
          aria-label={t('inputPlaceholder')}
        />

        {/* Send button */}
        <button
          onClick={handleSend}
          disabled={disabled || (!message.trim() && selectedFiles.length === 0)}
          className="px-4 py-2 bg-blue-500 text-white rounded-lg disabled:opacity-50 flex-shrink-0"
          aria-label={t('sendButton')}
        >
          {isSending ? t('sendButtonSending') : t('sendButton')}
        </button>
      </div>
    </div>
  )
}
