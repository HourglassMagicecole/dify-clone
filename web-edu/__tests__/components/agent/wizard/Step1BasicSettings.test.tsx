/**
 * Tests for Step1BasicSettings component
 */

import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Step1BasicSettings } from '@/components/agent/wizard/Step1BasicSettings'
import { AgentWizardProvider } from '@/context/AgentWizardContext'

// Create stable mock functions
const mockShowToast = jest.fn()
const mockT = jest.fn((key: string) => key)

// Mock useAuth hook
jest.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({
    user: { id: 'test-user-123', name: 'Test User', email: 'test@test.com' },
    isAuthenticated: true,
    isLoading: false,
  }),
}))

// Mock useToast hook with stable function reference
jest.mock('@/context/ToastContext', () => ({
  useToast: () => ({
    showToast: mockShowToast,
  }),
}))

// Mock useSession hook
jest.mock('@/context/SessionContext', () => ({
  useSession: () => ({
    currentSession: { id: 'test-session-123', session_name: 'Test Session', is_active: true },
    sessions: [{ id: 'test-session-123', session_name: 'Test Session', is_active: true }],
    isLoading: false,
    error: null,
    selectSession: jest.fn(),
    refreshSessions: jest.fn(),
  }),
}))

// Mock react-i18next with stable function reference
jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: mockT,
  }),
}))

// Helper to render component with Provider
function renderWithProvider(component: React.ReactElement) {
  return render(<AgentWizardProvider>{component}</AgentWizardProvider>)
}

describe('Step1BasicSettings', () => {
  beforeEach(() => {
    // Clear localStorage before each test
    localStorage.clear()

    // Clear mock function calls
    mockShowToast.mockClear()
    mockT.mockClear()
  })

  it('should render all form fields correctly', () => {
    renderWithProvider(<Step1BasicSettings />)

    // Check for all required fields
    expect(screen.getByLabelText(/basicSettings.nameLabel/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/basicSettings.descriptionLabel/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/basicSettings.typeLabel/i)).toBeInTheDocument()
  })

  it('should disable submit button when form is initially empty', () => {
    renderWithProvider(<Step1BasicSettings />)

    const submitButton = screen.getByRole('button', { name: /buttons.next/i })

    // Button should be disabled initially
    expect(submitButton).toBeDisabled()
  })

  it('should have max length attribute for name input', () => {
    renderWithProvider(<Step1BasicSettings />)

    const nameInput = screen.getByLabelText(/basicSettings.nameLabel/i) as HTMLInputElement
    expect(nameInput).toHaveAttribute('maxlength', '255')
  })

  it('should have max length attribute for role textarea', () => {
    renderWithProvider(<Step1BasicSettings />)

    const roleInput = screen.getByPlaceholderText(/basicSettings.rolePlaceholder/i) as HTMLTextAreaElement
    expect(roleInput).toHaveAttribute('maxlength', '2000')
  })

  it('should allow selecting different agent types', async () => {
    const user = userEvent.setup()
    renderWithProvider(<Step1BasicSettings />)

    // Find radio buttons (by their labels)
    const chatRadio = screen.getByLabelText(/types.chat.title/i)
    const completionRadio = screen.getByLabelText(/types.completion.title/i)

    // Chat should be selected by default
    expect(chatRadio).toBeChecked()

    // Select completion
    await user.click(completionRadio)
    expect(completionRadio).toBeChecked()
    expect(chatRadio).not.toBeChecked()

    // Select chat again
    await user.click(chatRadio)
    expect(chatRadio).toBeChecked()
    expect(completionRadio).not.toBeChecked()
  })

  it('should show character count for description and role fields', () => {
    renderWithProvider(<Step1BasicSettings />)

    // Character counts should be visible
    expect(screen.getByText(/0 \/ 400/i)).toBeInTheDocument() // Description
    expect(screen.getByText(/0 \/ 2000/i)).toBeInTheDocument() // Role
  })

  it('should submit form with valid data', async () => {
    const user = userEvent.setup()
    renderWithProvider(<Step1BasicSettings />)

    // Fill all required fields
    const nameInput = screen.getByLabelText(/basicSettings.nameLabel/i)
    await user.type(nameInput, 'Test Agent')

    const descriptionInput = screen.getByLabelText(/basicSettings.descriptionLabel/i)
    await user.type(descriptionInput, 'This is a test agent')

    const roleInput = screen.getByPlaceholderText(/basicSettings.rolePlaceholder/i)
    await user.type(roleInput, 'You are a helpful assistant that helps users with their questions')

    // Submit form
    const submitButton = screen.getByRole('button', { name: /buttons.next/i })
    await user.click(submitButton)

    // Form should submit without errors
    await waitFor(() => {
      expect(screen.queryByText(/validation.nameRequired/i)).not.toBeInTheDocument()
    })
  })

  it('should have proper ARIA labels for accessibility', () => {
    renderWithProvider(<Step1BasicSettings />)

    // All inputs should have proper labels
    const nameInput = screen.getByLabelText(/basicSettings.nameLabel/i)
    expect(nameInput).toHaveAttribute('required')

    const descriptionInput = screen.getByLabelText(/basicSettings.descriptionLabel/i)
    expect(descriptionInput).toBeInTheDocument()

    const roleInput = screen.getByPlaceholderText(/basicSettings.rolePlaceholder/i)
    expect(roleInput).toHaveAttribute('required')
  })

  it('should disable submit button when form is invalid', () => {
    renderWithProvider(<Step1BasicSettings />)

    const submitButton = screen.getByRole('button', { name: /buttons.next/i })

    // Button should be disabled initially (form is invalid)
    expect(submitButton).toBeDisabled()
  })

  it('should enable submit button when form is valid', async () => {
    const user = userEvent.setup()
    renderWithProvider(<Step1BasicSettings />)

    // Fill all required fields with valid data
    const nameInput = screen.getByLabelText(/basicSettings.nameLabel/i)
    await user.type(nameInput, 'Test Agent')

    const roleInput = screen.getByPlaceholderText(/basicSettings.rolePlaceholder/i)
    await user.type(roleInput, 'You are a helpful assistant')

    // Wait for form validation
    await waitFor(() => {
      const submitButton = screen.getByRole('button', { name: /buttons.next/i })
      expect(submitButton).not.toBeDisabled()
    })
  })

  it('should not show draft badge when no draft exists', () => {
    renderWithProvider(<Step1BasicSettings />)

    // Draft badge should not be visible
    expect(screen.queryByText(/draft.badge/i)).not.toBeInTheDocument()
  })

  it('should not show previous button on first step', () => {
    renderWithProvider(<Step1BasicSettings />)

    // Previous button should not be visible on step 1
    expect(screen.queryByRole('button', { name: /buttons.previous/i })).not.toBeInTheDocument()
  })
})
