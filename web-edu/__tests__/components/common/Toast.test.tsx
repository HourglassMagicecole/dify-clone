/**
 * Tests for Toast component
 */

import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Toast } from '@/components/common/Toast'

describe('Toast', () => {
  const mockOnClose = jest.fn()

  beforeEach(() => {
    jest.clearAllMocks()
    jest.useFakeTimers()
  })

  afterEach(() => {
    jest.runOnlyPendingTimers()
    jest.useRealTimers()
  })

  it('should render success toast with correct styling', () => {
    render(
      <Toast
        id="test-1"
        message="Success message"
        type="success"
        onClose={mockOnClose}
      />
    )

    expect(screen.getByText('Success message')).toBeInTheDocument()
    expect(screen.getByRole('alert')).toHaveClass('bg-green-50', 'border-green-200')
  })

  it('should render error toast with correct styling', () => {
    render(
      <Toast
        id="test-2"
        message="Error message"
        type="error"
        onClose={mockOnClose}
      />
    )

    expect(screen.getByText('Error message')).toBeInTheDocument()
    expect(screen.getByRole('alert')).toHaveClass('bg-red-50', 'border-red-200')
  })

  it('should render info toast with correct styling', () => {
    render(
      <Toast
        id="test-3"
        message="Info message"
        type="info"
        onClose={mockOnClose}
      />
    )

    expect(screen.getByText('Info message')).toBeInTheDocument()
    expect(screen.getByRole('alert')).toHaveClass('bg-blue-50', 'border-blue-200')
  })

  it('should render warning toast with correct styling', () => {
    render(
      <Toast
        id="test-4"
        message="Warning message"
        type="warning"
        onClose={mockOnClose}
      />
    )

    expect(screen.getByText('Warning message')).toBeInTheDocument()
    expect(screen.getByRole('alert')).toHaveClass('bg-yellow-50', 'border-yellow-200')
  })

  it('should call onClose when close button is clicked', async () => {
    const user = userEvent.setup({ delay: null })
    render(
      <Toast
        id="test-5"
        message="Test message"
        type="info"
        onClose={mockOnClose}
      />
    )

    const closeButton = screen.getByLabelText('Close notification')
    await user.click(closeButton)

    expect(mockOnClose).toHaveBeenCalledWith('test-5')
  })

  it('should auto-close after duration', async () => {
    render(
      <Toast
        id="test-6"
        message="Test message"
        type="info"
        duration={2000}
        onClose={mockOnClose}
      />
    )

    expect(mockOnClose).not.toHaveBeenCalled()

    // Fast-forward time by 2 seconds
    jest.advanceTimersByTime(2000)

    await waitFor(() => {
      expect(mockOnClose).toHaveBeenCalledWith('test-6')
    })
  })

  it('should use default duration of 3000ms if not specified', async () => {
    render(
      <Toast
        id="test-7"
        message="Test message"
        type="info"
        onClose={mockOnClose}
      />
    )

    // Fast-forward by 2.5 seconds (should not close yet)
    jest.advanceTimersByTime(2500)
    expect(mockOnClose).not.toHaveBeenCalled()

    // Fast-forward remaining 0.5 seconds (should close now)
    jest.advanceTimersByTime(500)

    await waitFor(() => {
      expect(mockOnClose).toHaveBeenCalledWith('test-7')
    })
  })
})
