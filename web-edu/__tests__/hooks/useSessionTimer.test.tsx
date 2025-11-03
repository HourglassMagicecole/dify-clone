/**
 * Unit Tests for hooks/useSessionTimer.ts
 * Tests session timeout and auto-logout functionality
 * Priority: P0 (Security-critical functionality)
 */

import { renderHook } from '@testing-library/react'
import { useSessionTimer } from '@/hooks/useSessionTimer'
import { useAuth } from '@/hooks/useAuth'

// Mock useAuth hook
jest.mock('@/hooks/useAuth')

// Mock useToast hook
jest.mock('@/context/ToastContext', () => ({
  useToast: jest.fn(() => ({
    showToast: jest.fn(),
  })),
}))

// Mock lodash debounce
jest.mock('lodash', () => ({
  debounce: jest.fn((fn) => {
    const debouncedFn = (...args: unknown[]) => fn(...args)
    debouncedFn.cancel = jest.fn()
    return debouncedFn
  }),
}))

// Mock window.alert
global.alert = jest.fn()

describe('hooks/useSessionTimer', () => {
  const mockSignOut = jest.fn()
  const mockUseAuth = useAuth as jest.Mock

  beforeEach(() => {
    jest.clearAllMocks()
    mockUseAuth.mockReturnValue({
      signOut: mockSignOut,
      isAuthenticated: true,
    })
  })

  it('should render without errors when authenticated', () => {
    // Act
    const { result } = renderHook(() => useSessionTimer())

    // Assert - Hook should not throw any errors
    expect(result.current).toBeUndefined()
  })

  it('should render without errors when not authenticated', () => {
    // Arrange
    mockUseAuth.mockReturnValue({
      signOut: mockSignOut,
      isAuthenticated: false,
    })

    // Act
    const { result } = renderHook(() => useSessionTimer())

    // Assert - Hook should not throw any errors
    expect(result.current).toBeUndefined()
  })

  it('should attach event listeners for user activity when authenticated', () => {
    // Arrange
    const addEventListenerSpy = jest.spyOn(window, 'addEventListener')

    // Act
    renderHook(() => useSessionTimer())

    // Assert - Should attach event listeners
    expect(addEventListenerSpy).toHaveBeenCalledWith('mousedown', expect.any(Function))
    expect(addEventListenerSpy).toHaveBeenCalledWith('keydown', expect.any(Function))
    expect(addEventListenerSpy).toHaveBeenCalledWith('touchstart', expect.any(Function))

    // Cleanup
    addEventListenerSpy.mockRestore()
  })

  it('should remove event listeners on unmount', () => {
    // Arrange
    const removeEventListenerSpy = jest.spyOn(window, 'removeEventListener')

    // Act
    const { unmount } = renderHook(() => useSessionTimer())

    // Assert before unmount
    expect(removeEventListenerSpy).not.toHaveBeenCalled()

    // Act - Unmount
    unmount()

    // Assert after unmount
    expect(removeEventListenerSpy).toHaveBeenCalledWith('mousedown', expect.any(Function))
    expect(removeEventListenerSpy).toHaveBeenCalledWith('keydown', expect.any(Function))
    expect(removeEventListenerSpy).toHaveBeenCalledWith('touchstart', expect.any(Function))

    // Cleanup
    removeEventListenerSpy.mockRestore()
  })

  it('should not attach event listeners when not authenticated', () => {
    // Arrange
    mockUseAuth.mockReturnValue({
      signOut: mockSignOut,
      isAuthenticated: false,
    })
    const addEventListenerSpy = jest.spyOn(window, 'addEventListener')

    // Act
    renderHook(() => useSessionTimer())

    // Assert - Should not attach event listeners
    expect(addEventListenerSpy).not.toHaveBeenCalled()

    // Cleanup
    addEventListenerSpy.mockRestore()
  })
})
