/**
 * Toast Component - Displays temporary notification messages
 */

'use client'

import React, { useEffect } from 'react'
import { XMarkIcon, CheckCircleIcon, ExclamationCircleIcon, InformationCircleIcon } from '@heroicons/react/24/outline'

export type ToastType = 'success' | 'error' | 'info'

export interface ToastProps {
  id: string
  message: string
  type: ToastType
  duration?: number
  onClose: (id: string) => void
}

/**
 * Toast icon based on type
 */
function ToastIcon({ type }: { type: ToastType }): React.ReactElement {
  switch (type) {
    case 'success':
      return <CheckCircleIcon className="h-5 w-5 text-green-500" />
    case 'error':
      return <ExclamationCircleIcon className="h-5 w-5 text-red-500" />
    case 'info':
      return <InformationCircleIcon className="h-5 w-5 text-blue-500" />
  }
}

/**
 * Toast background color based on type
 */
function getToastStyles(type: ToastType): string {
  switch (type) {
    case 'success':
      return 'bg-green-50 border-green-200'
    case 'error':
      return 'bg-red-50 border-red-200'
    case 'info':
      return 'bg-blue-50 border-blue-200'
  }
}

/**
 * Toast Component
 */
export function Toast({ id, message, type, duration = 3000, onClose }: ToastProps): React.ReactElement {
  useEffect(() => {
    const timer = setTimeout(() => {
      onClose(id)
    }, duration)

    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, duration])

  return (
    <div
      className={`flex items-center justify-between p-4 mb-3 rounded-lg border shadow-lg min-w-[320px] max-w-md animate-slide-in ${getToastStyles(
        type
      )}`}
      role="alert"
    >
      <div className="flex items-center space-x-3">
        <ToastIcon type={type} />
        <p className="text-sm font-medium text-gray-900">{message}</p>
      </div>
      <button
        onClick={() => onClose(id)}
        className="ml-4 text-gray-400 hover:text-gray-600 focus:outline-none focus:ring-2 focus:ring-gray-300 rounded"
        aria-label="Close notification"
      >
        <XMarkIcon className="h-5 w-5" />
      </button>
    </div>
  )
}
