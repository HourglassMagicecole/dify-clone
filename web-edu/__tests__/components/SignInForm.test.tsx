/**
 * Unit Tests for components/auth/SignInForm.tsx
 * Tests sign-in form validation and submission
 * Priority: P1 (User-facing functionality)
 */

import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SignInForm } from '@/components/auth/SignInForm'
import { useAuth } from '@/hooks/useAuth'

// Mock useAuth hook
jest.mock('@/hooks/useAuth')

describe('components/auth/SignInForm', () => {
  const mockSignIn = jest.fn()
  const mockUseAuth = useAuth as jest.Mock

  beforeEach(() => {
    jest.clearAllMocks()
    mockUseAuth.mockReturnValue({
      signIn: mockSignIn,
    })
  })

  it('should render sign-in form with email and password fields', () => {
    // Act
    render(<SignInForm />)

    // Assert
    expect(screen.getByLabelText(/signin.email/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/signin.password/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /signin.submit/i })).toBeInTheDocument()
  })

  it('should submit form with valid credentials', async () => {
    // Arrange
    const user = userEvent.setup()
    mockSignIn.mockResolvedValue(undefined)

    render(<SignInForm />)

    const emailInput = screen.getByLabelText(/signin.email/i)
    const passwordInput = screen.getByLabelText(/signin.password/i)
    const submitButton = screen.getByRole('button', { name: /signin.submit/i })

    // Act
    await user.type(emailInput, 'test@example.com')
    await user.type(passwordInput, 'password123')
    await user.click(submitButton)

    // Assert
    await waitFor(() => {
      expect(mockSignIn).toHaveBeenCalledWith('test@example.com', 'password123')
    })
  })

  it('should show error message when sign-in fails', async () => {
    // Arrange
    const user = userEvent.setup()
    mockSignIn.mockRejectedValue(new Error('Invalid credentials'))

    render(<SignInForm />)

    const emailInput = screen.getByLabelText(/signin.email/i)
    const passwordInput = screen.getByLabelText(/signin.password/i)
    const submitButton = screen.getByRole('button', { name: /signin.submit/i })

    // Act
    await user.type(emailInput, 'test@example.com')
    await user.type(passwordInput, 'wrongpassword')
    await user.click(submitButton)

    // Assert
    await waitFor(() => {
      expect(screen.getByText(/signin.error.login_failed/i)).toBeInTheDocument()
    })
  })

  it('should clear previous error message on new submission', async () => {
    // Arrange
    const user = userEvent.setup()
    mockSignIn
      .mockRejectedValueOnce(new Error('Invalid credentials'))
      .mockResolvedValueOnce(undefined)

    render(<SignInForm />)

    const emailInput = screen.getByLabelText(/signin.email/i)
    const passwordInput = screen.getByLabelText(/signin.password/i)
    const submitButton = screen.getByRole('button', { name: /signin.submit/i })

    // Act - First submission (fails)
    await user.type(emailInput, 'test@example.com')
    await user.type(passwordInput, 'wrongpassword')
    await user.click(submitButton)

    await waitFor(() => {
      expect(screen.getByText(/signin.error.login_failed/i)).toBeInTheDocument()
    })

    // Act - Second submission (succeeds)
    await user.clear(passwordInput)
    await user.type(passwordInput, 'correctpassword')
    await user.click(submitButton)

    // Assert - Error message should be cleared
    await waitFor(() => {
      expect(screen.queryByText(/signin.error.login_failed/i)).not.toBeInTheDocument()
    })
  })

  it('should disable submit button while submitting', async () => {
    // Arrange
    const user = userEvent.setup()
    let resolveSignIn: () => void
    const signInPromise = new Promise<void>((resolve) => {
      resolveSignIn = resolve
    })
    mockSignIn.mockReturnValue(signInPromise)

    render(<SignInForm />)

    const emailInput = screen.getByLabelText(/signin.email/i)
    const passwordInput = screen.getByLabelText(/signin.password/i)
    const submitButton = screen.getByRole('button', { name: /signin.submit/i })

    // Act
    await user.type(emailInput, 'test@example.com')
    await user.type(passwordInput, 'password123')
    await user.click(submitButton)

    // Assert - Button should be disabled during submission
    await waitFor(() => {
      expect(submitButton).toBeDisabled()
      expect(submitButton).toHaveTextContent(/signin.submitting/i)
    })

    // Resolve the sign-in promise
    resolveSignIn!()

    // Assert - Button should be enabled after submission
    await waitFor(() => {
      expect(submitButton).not.toBeDisabled()
      expect(submitButton).toHaveTextContent(/signin.submit/i)
    })
  })

  it('should have proper input types for email and password fields', () => {
    // Act
    render(<SignInForm />)

    // Assert
    const emailInput = screen.getByLabelText(/signin.email/i)
    const passwordInput = screen.getByLabelText(/signin.password/i)

    expect(emailInput).toHaveAttribute('type', 'email')
    expect(passwordInput).toHaveAttribute('type', 'password')
  })
})
