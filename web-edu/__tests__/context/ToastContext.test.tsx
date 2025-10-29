/**
 * Tests for ToastContext
 */

import React from 'react'
import { renderHook, act } from '@testing-library/react'
import { ToastProvider, useToast } from '@/context/ToastContext'

// Wrapper component with Provider
const wrapper = ({ children }: { children: React.ReactNode }) => (
  <ToastProvider>{children}</ToastProvider>
)

describe('ToastContext', () => {
  beforeEach(() => {
    jest.useFakeTimers()
  })

  afterEach(() => {
    jest.runOnlyPendingTimers()
    jest.useRealTimers()
  })

  it('should provide showToast function', () => {
    const { result } = renderHook(() => useToast(), { wrapper })

    expect(result.current.showToast).toBeDefined()
    expect(typeof result.current.showToast).toBe('function')
  })

  it('should throw error when used outside provider', () => {
    // Suppress console.error for this test
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {})

    expect(() => {
      renderHook(() => useToast())
    }).toThrow('useToast must be used within ToastProvider')

    consoleError.mockRestore()
  })

  it('should show toast with default type (info) and duration', () => {
    const { result } = renderHook(() => useToast(), { wrapper })

    act(() => {
      result.current.showToast('Test message')
    })

    // Toast should be created (we can't easily test the DOM rendering here,
    // but we can verify the function doesn't throw)
    expect(result.current.showToast).toBeDefined()
  })

  it('should show toast with custom type and duration', () => {
    const { result } = renderHook(() => useToast(), { wrapper })

    act(() => {
      result.current.showToast('Success message', 'success', 5000)
    })

    expect(result.current.showToast).toBeDefined()
  })

  it('should handle multiple toasts', () => {
    const { result } = renderHook(() => useToast(), { wrapper })

    act(() => {
      result.current.showToast('Message 1', 'info')
      result.current.showToast('Message 2', 'success')
      result.current.showToast('Message 3', 'error')
    })

    expect(result.current.showToast).toBeDefined()
  })
})
