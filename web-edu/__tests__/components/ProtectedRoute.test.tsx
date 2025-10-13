/**
 * Unit Tests for components/auth/ProtectedRoute.tsx
 * Tests route protection and authorization
 * Priority: P1 (Security-related functionality)
 */

import { render, screen, waitFor } from '@testing-library/react'
import { ProtectedRoute } from '@/components/auth/ProtectedRoute'
import { useAuth } from '@/hooks/useAuth'
import { useRouter } from 'next/navigation'

// Mock useAuth hook
jest.mock('@/hooks/useAuth')

// Mock useRouter hook
jest.mock('next/navigation', () => ({
  useRouter: jest.fn(),
}))

describe('components/auth/ProtectedRoute', () => {
  const mockPush = jest.fn()
  const mockUseAuth = useAuth as jest.Mock
  const mockUseRouter = useRouter as jest.Mock

  beforeEach(() => {
    jest.clearAllMocks()
    mockUseRouter.mockReturnValue({
      push: mockPush,
    })
  })

  it('should show loading state while authentication is being checked', () => {
    // Arrange
    mockUseAuth.mockReturnValue({
      isAuthenticated: false,
      isLoading: true,
      user: null,
    })

    // Act
    render(
      <ProtectedRoute>
        <div>Protected Content</div>
      </ProtectedRoute>,
    )

    // Assert
    expect(screen.getByText('auth:loading')).toBeInTheDocument()
    expect(screen.queryByText('Protected Content')).not.toBeInTheDocument()
  })

  it('should redirect to /signin when user is not authenticated', async () => {
    // Arrange
    mockUseAuth.mockReturnValue({
      isAuthenticated: false,
      isLoading: false,
      user: null,
    })

    // Act
    render(
      <ProtectedRoute>
        <div>Protected Content</div>
      </ProtectedRoute>,
    )

    // Assert
    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/signin')
    })
    expect(screen.queryByText('Protected Content')).not.toBeInTheDocument()
  })

  it('should render children when user is authenticated', () => {
    // Arrange
    mockUseAuth.mockReturnValue({
      isAuthenticated: true,
      isLoading: false,
      user: { id: '123', name: 'Test User', email: 'test@example.com', role: 'normal' },
    })

    // Act
    render(
      <ProtectedRoute>
        <div>Protected Content</div>
      </ProtectedRoute>,
    )

    // Assert
    expect(screen.getByText('Protected Content')).toBeInTheDocument()
    expect(mockPush).not.toHaveBeenCalled()
  })

  it('should redirect to /403 when admin access is required but user is not admin', async () => {
    // Arrange
    mockUseAuth.mockReturnValue({
      isAuthenticated: true,
      isLoading: false,
      user: { id: '123', name: 'Test User', email: 'test@example.com', role: 'normal' },
    })

    // Act
    render(
      <ProtectedRoute requireAdmin>
        <div>Admin Content</div>
      </ProtectedRoute>,
    )

    // Assert
    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/403')
    })
    expect(screen.queryByText('Admin Content')).not.toBeInTheDocument()
  })

  it('should render children when admin access is required and user is admin', () => {
    // Arrange
    mockUseAuth.mockReturnValue({
      isAuthenticated: true,
      isLoading: false,
      user: { id: '123', name: 'Admin User', email: 'admin@example.com', role: 'admin' },
    })

    // Act
    render(
      <ProtectedRoute requireAdmin>
        <div>Admin Content</div>
      </ProtectedRoute>,
    )

    // Assert
    expect(screen.getByText('Admin Content')).toBeInTheDocument()
    expect(mockPush).not.toHaveBeenCalled()
  })

  it('should not redirect when requireAdmin is false and user is normal', () => {
    // Arrange
    mockUseAuth.mockReturnValue({
      isAuthenticated: true,
      isLoading: false,
      user: { id: '123', name: 'Test User', email: 'test@example.com', role: 'normal' },
    })

    // Act
    render(
      <ProtectedRoute requireAdmin={false}>
        <div>Normal Content</div>
      </ProtectedRoute>,
    )

    // Assert
    expect(screen.getByText('Normal Content')).toBeInTheDocument()
    expect(mockPush).not.toHaveBeenCalled()
  })

  it('should not redirect when user is authenticated and no requireAdmin is specified', () => {
    // Arrange
    mockUseAuth.mockReturnValue({
      isAuthenticated: true,
      isLoading: false,
      user: { id: '123', name: 'Test User', email: 'test@example.com', role: 'normal' },
    })

    // Act
    render(
      <ProtectedRoute>
        <div>Protected Content</div>
      </ProtectedRoute>,
    )

    // Assert
    expect(screen.getByText('Protected Content')).toBeInTheDocument()
    expect(mockPush).not.toHaveBeenCalled()
  })

  it('should handle user with no role gracefully when requireAdmin is true', async () => {
    // Arrange
    mockUseAuth.mockReturnValue({
      isAuthenticated: true,
      isLoading: false,
      user: { id: '123', name: 'Test User', email: 'test@example.com', role: undefined },
    })

    // Act
    render(
      <ProtectedRoute requireAdmin>
        <div>Admin Content</div>
      </ProtectedRoute>,
    )

    // Assert
    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/403')
    })
    expect(screen.queryByText('Admin Content')).not.toBeInTheDocument()
  })

  it('should not show loading when authentication check is complete', () => {
    // Arrange
    mockUseAuth.mockReturnValue({
      isAuthenticated: true,
      isLoading: false,
      user: { id: '123', name: 'Test User', email: 'test@example.com', role: 'normal' },
    })

    // Act
    render(
      <ProtectedRoute>
        <div>Protected Content</div>
      </ProtectedRoute>,
    )

    // Assert
    expect(screen.queryByText('auth:loading')).not.toBeInTheDocument()
    expect(screen.getByText('Protected Content')).toBeInTheDocument()
  })
})
