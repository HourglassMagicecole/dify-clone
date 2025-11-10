import { render, screen, waitFor } from '@testing-library/react'
import { RoleGuard } from '@/components/auth/RoleGuard'
import type { User } from '@/types/auth'

// Mock next/navigation
const mockPush = jest.fn()
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
  }),
}))

// Mock useAuth hook
let mockUser: User | null = null
let mockIsLoading = false

jest.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({
    user: mockUser,
    isLoading: mockIsLoading,
    isAuthenticated: !!mockUser,
    signIn: jest.fn(),
    signOut: jest.fn(),
  }),
}))

describe('RoleGuard', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockUser = null
    mockIsLoading = false
  })

  it('shows loading state while auth is loading', () => {
    mockIsLoading = true
    mockUser = null

    render(
      <RoleGuard allowedRoles={['owner']}>
        <div>Protected Content</div>
      </RoleGuard>,
    )

    expect(screen.getByText('Loading...')).toBeInTheDocument()
    expect(screen.queryByText('Protected Content')).not.toBeInTheDocument()
  })

  it('allows access for authorized owner', () => {
    mockIsLoading = false
    mockUser = {
      id: 'test-id',
      name: 'Test Owner',
      email: 'owner@test.com',
      role: 'admin',
      actualRole: 'owner',
    }

    render(
      <RoleGuard allowedRoles={['owner']}>
        <div>Protected Content</div>
      </RoleGuard>,
    )

    expect(screen.getByText('Protected Content')).toBeInTheDocument()
    expect(mockPush).not.toHaveBeenCalled()
  })

  it('allows access for authorized admin', () => {
    mockIsLoading = false
    mockUser = {
      id: 'test-id',
      name: 'Test Admin',
      email: 'admin@test.com',
      role: 'admin',
      actualRole: 'admin',
    }

    render(
      <RoleGuard allowedRoles={['owner', 'admin']}>
        <div>Protected Content</div>
      </RoleGuard>,
    )

    expect(screen.getByText('Protected Content')).toBeInTheDocument()
    expect(mockPush).not.toHaveBeenCalled()
  })

  it('redirects unauthorized student to 403', async () => {
    mockIsLoading = false
    mockUser = {
      id: 'test-id',
      name: 'Test Student',
      email: 'student@test.com',
      role: 'normal',
      actualRole: 'student',
    }

    render(
      <RoleGuard allowedRoles={['owner']}>
        <div>Protected Content</div>
      </RoleGuard>,
    )

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/403')
    })

    expect(screen.queryByText('Protected Content')).not.toBeInTheDocument()
  })

  it('does not render content when user is not authenticated', () => {
    mockIsLoading = false
    mockUser = null

    render(
      <RoleGuard allowedRoles={['owner']}>
        <div>Protected Content</div>
      </RoleGuard>,
    )

    expect(screen.queryByText('Protected Content')).not.toBeInTheDocument()
    expect(mockPush).not.toHaveBeenCalled()
  })

  it('redirects admin trying to access owner-only page', async () => {
    mockIsLoading = false
    mockUser = {
      id: 'test-id',
      name: 'Test Admin',
      email: 'admin@test.com',
      role: 'admin',
      actualRole: 'admin',
    }

    render(
      <RoleGuard allowedRoles={['owner']}>
        <div>Owner Only Content</div>
      </RoleGuard>,
    )

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/403')
    })

    expect(screen.queryByText('Owner Only Content')).not.toBeInTheDocument()
  })

  it('allows multiple roles to access content', () => {
    mockIsLoading = false
    mockUser = {
      id: 'test-id',
      name: 'Test Admin',
      email: 'admin@test.com',
      role: 'admin',
      actualRole: 'admin',
    }

    render(
      <RoleGuard allowedRoles={['owner', 'admin', 'student']}>
        <div>Multi-Role Content</div>
      </RoleGuard>,
    )

    expect(screen.getByText('Multi-Role Content')).toBeInTheDocument()
    expect(mockPush).not.toHaveBeenCalled()
  })
})
