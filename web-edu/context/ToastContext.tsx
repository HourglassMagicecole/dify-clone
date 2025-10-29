/**
 * Toast Context - Global toast notification management
 */

'use client'

import React, { createContext, useContext, useState, useCallback, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { Toast, ToastType } from '@/components/common/Toast'

interface ToastItem {
  id: string
  message: string
  type: ToastType
  duration?: number
}

interface ToastContextValue {
  showToast: (message: string, type?: ToastType, duration?: number) => void
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined)

/**
 * Generate unique ID for toast
 */
function generateToastId(): string {
  return `toast-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
}

/**
 * Toast Provider Component
 */
export function ToastProvider({ children }: { children: React.ReactNode }): React.ReactElement {
  const [toasts, setToasts] = useState<ToastItem[]>([])

  /**
   * Show a new toast notification
   */
  const showToast = useCallback((message: string, type: ToastType = 'info', duration = 3000) => {
    const id = generateToastId()
    const newToast: ToastItem = { id, message, type, duration }

    setToasts((prev) => [...prev, newToast])
  }, [])

  /**
   * Remove a toast notification
   */
  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id))
  }, [])

  /**
   * Memoize context value
   */
  const contextValue = useMemo<ToastContextValue>(
    () => ({
      showToast,
    }),
    [showToast]
  )

  // Portal target
  const [mounted, setMounted] = React.useState(false)
  React.useEffect(() => {
    setMounted(true)
  }, [])

  return (
    <ToastContext.Provider value={contextValue}>
      {children}
      {/* Toast Container - Rendered via Portal to document.body */}
      {mounted && toasts.length > 0 && createPortal(
        <div
          style={{
            position: 'fixed',
            top: '16px',
            right: '16px',
            zIndex: 9999,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'flex-end',
            pointerEvents: 'none',
          }}
        >
          {toasts.map((toast) => (
            <div key={toast.id} style={{ pointerEvents: 'auto' }}>
              <Toast
                id={toast.id}
                message={toast.message}
                type={toast.type}
                duration={toast.duration}
                onClose={removeToast}
              />
            </div>
          ))}
        </div>,
        document.body
      )}
    </ToastContext.Provider>
  )
}

/**
 * Hook to use Toast context
 */
export function useToast(): ToastContextValue {
  const context = useContext(ToastContext)
  if (!context) {
    throw new Error('useToast must be used within ToastProvider')
  }
  return context
}
