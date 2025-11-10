/**
 * Tests for SessionSelector component - Story 2.2B
 */

import { render, screen } from '@testing-library/react'
import { SessionSelector } from '@/components/session/SessionSelector'
import type { Session } from '@/types/session'

// Mock SessionContext
const mockSessions: Session[] = [
  {
    id: 'session-1',
    session_name: 'Spring 2025',
    start_date: '2025-01-01',
    end_date: '2025-06-30',
    is_active: true,
    instructor_account_id: 'instructor-1',
    created_at: '2024-12-01',
    updated_at: '2024-12-01',
    tenant_id: 'tenant-1',
    session_tag: 'spring-2025',
    max_students: 100,
  },
]

jest.mock('@/context/SessionContext', () => ({
  useSession: () => ({
    sessions: mockSessions,
    filteredSessions: mockSessions,
    currentSession: mockSessions[0],
    setCurrentSessionId: jest.fn(),
    selectSession: jest.fn(),
    refreshSessions: jest.fn(),
    isLoading: false,
  }),
}))

// Mock useTranslation
jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}))

describe('SessionSelector', () => {
  it('hides create button for student role', () => {
    render(<SessionSelector userRole="student" />)

    // Student should not see the "+" create button
    const createButton = screen.queryByRole('button', { name: /\+/ })
    expect(createButton).not.toBeInTheDocument()
  })

  it('shows create button for admin role', () => {
    render(<SessionSelector userRole="admin" />)

    // Admin should see the "+" create button
    const createButton = screen.queryByRole('button', { name: /\+/ })
    expect(createButton).toBeInTheDocument()
  })

  it('shows create button for owner role', () => {
    render(<SessionSelector userRole="owner" />)

    // Owner should see the "+" create button
    const createButton = screen.queryByRole('button', { name: /\+/ })
    expect(createButton).toBeInTheDocument()
  })

  it('renders session selector with current session', () => {
    render(<SessionSelector userRole="admin" />)

    // Should display current session name
    expect(screen.getByText('Spring 2025')).toBeInTheDocument()
  })
})
