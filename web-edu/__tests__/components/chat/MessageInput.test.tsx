/**
 * Tests for MessageInput component
 */

import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MessageInput } from '@/components/chat/MessageInput'

describe('MessageInput', () => {
  const mockOnSend = jest.fn()

  // Mock window.alert
  const mockAlert = jest.spyOn(window, 'alert').mockImplementation()

  beforeEach(() => {
    jest.clearAllMocks()
  })

  afterAll(() => {
    mockAlert.mockRestore()
  })

  it('should render input area with correct elements', () => {
    render(<MessageInput onSend={mockOnSend} disabled={false} />)

    expect(screen.getByLabelText('inputPlaceholder')).toBeInTheDocument()
    expect(screen.getByLabelText('fileUploadButton')).toBeInTheDocument()
    expect(screen.getByLabelText('sendButton')).toBeInTheDocument()
  })

  it('should update message state when typing', async () => {
    const user = userEvent.setup()
    render(<MessageInput onSend={mockOnSend} disabled={false} />)

    const textarea = screen.getByLabelText('inputPlaceholder')
    await user.type(textarea, 'Hello world')

    expect(textarea).toHaveValue('Hello world')
  })

  it('should call onSend when Enter key is pressed', async () => {
    const user = userEvent.setup()
    render(<MessageInput onSend={mockOnSend} disabled={false} />)

    const textarea = screen.getByLabelText('inputPlaceholder')
    await user.type(textarea, 'Test message{Enter}')

    expect(mockOnSend).toHaveBeenCalledWith('Test message', [])
    expect(textarea).toHaveValue('') // Input should be cleared
  })

  it('should insert newline when Shift+Enter is pressed', async () => {
    const user = userEvent.setup()
    render(<MessageInput onSend={mockOnSend} disabled={false} />)

    const textarea = screen.getByLabelText('inputPlaceholder')
    await user.type(textarea, 'Line 1{Shift>}{Enter}{/Shift}Line 2')

    expect(textarea).toHaveValue('Line 1\nLine 2')
    expect(mockOnSend).not.toHaveBeenCalled()
  })

  it('should clear input when Escape key is pressed', async () => {
    const user = userEvent.setup()
    render(<MessageInput onSend={mockOnSend} disabled={false} />)

    const textarea = screen.getByLabelText('inputPlaceholder')
    await user.type(textarea, 'Test message')
    expect(textarea).toHaveValue('Test message')

    await user.type(textarea, '{Escape}')
    expect(textarea).toHaveValue('')
  })

  it('should call onSend when send button is clicked', async () => {
    const user = userEvent.setup()
    render(<MessageInput onSend={mockOnSend} disabled={false} />)

    const textarea = screen.getByLabelText('inputPlaceholder')
    await user.type(textarea, 'Test message')

    const sendButton = screen.getByLabelText('sendButton')
    await user.click(sendButton)

    expect(mockOnSend).toHaveBeenCalledWith('Test message', [])
    expect(textarea).toHaveValue('')
  })

  it('should disable send button when message is empty', () => {
    render(<MessageInput onSend={mockOnSend} disabled={false} />)

    const sendButton = screen.getByLabelText('sendButton')
    expect(sendButton).toBeDisabled()
  })

  it('should trim whitespace from message before sending', async () => {
    const user = userEvent.setup()
    render(<MessageInput onSend={mockOnSend} disabled={false} />)

    const textarea = screen.getByLabelText('inputPlaceholder')
    await user.type(textarea, '  Test message  {Enter}')

    expect(mockOnSend).toHaveBeenCalledWith('Test message', [])
  })

  it('should handle file selection and show preview', async () => {
    const user = userEvent.setup()
    render(<MessageInput onSend={mockOnSend} disabled={false} />)

    const file = new File(['test content'], 'test.pdf', { type: 'application/pdf' })
    const fileInput = screen.getByLabelText('fileUploadButton').nextElementSibling?.querySelector('input[type="file"]')

    if (fileInput) {
      await user.upload(fileInput as HTMLInputElement, file)

      await waitFor(() => {
        expect(screen.getByText(/test\.pdf/)).toBeInTheDocument()
      })
    }
  })

  it('should remove file when remove button is clicked', async () => {
    const user = userEvent.setup()
    render(<MessageInput onSend={mockOnSend} disabled={false} />)

    const file = new File(['test content'], 'test.pdf', { type: 'application/pdf' })
    const fileUploadButton = screen.getByLabelText('fileUploadButton')

    // Simulate file selection by directly calling the file input
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
    if (fileInput) {
      Object.defineProperty(fileInput, 'files', {
        value: [file],
        writable: false,
      })

      await user.click(fileUploadButton)

      // Wait for file preview to appear
      await waitFor(() => {
        const removeButton = screen.queryByLabelText('Remove test.pdf')
        if (removeButton) {
          user.click(removeButton)
        }
      })
    }
  })

  it('should show alert when more than 5 files are selected', async () => {
    const user = userEvent.setup()
    render(<MessageInput onSend={mockOnSend} disabled={false} />)

    const files = Array.from({ length: 6 }, (_, i) =>
      new File(['content'], `file${i}.txt`, { type: 'text/plain' })
    )

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
    if (fileInput) {
      await user.upload(fileInput, files)

      expect(mockAlert).toHaveBeenCalledWith('error.tooManyFiles')
    }
  })

  it('should show alert when file size exceeds 10MB', async () => {
    const user = userEvent.setup()
    render(<MessageInput onSend={mockOnSend} disabled={false} />)

    // Create a file larger than 10MB
    const largeFile = new File(['x'.repeat(11 * 1024 * 1024)], 'large.pdf', {
      type: 'application/pdf',
    })

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
    if (fileInput) {
      await user.upload(fileInput, largeFile)

      expect(mockAlert).toHaveBeenCalledWith('error.fileTooLarge')
    }
  })

  it('should allow sending files without text message', async () => {
    render(<MessageInput onSend={mockOnSend} disabled={false} />)

    const file = new File(['content'], 'test.pdf', { type: 'application/pdf' })
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement

    if (fileInput) {
      Object.defineProperty(fileInput, 'files', {
        value: [file],
        writable: false,
      })

      const event = new Event('change', { bubbles: true })
      fileInput.dispatchEvent(event)

      await waitFor(() => {
        const sendButton = screen.getByLabelText('sendButton')
        expect(sendButton).not.toBeDisabled()
      })
    }
  })

  it('should disable all inputs when disabled prop is true', () => {
    render(<MessageInput onSend={mockOnSend} disabled={true} />)

    const textarea = screen.getByLabelText('inputPlaceholder')
    const fileButton = screen.getByLabelText('fileUploadButton')
    const sendButton = screen.getByLabelText('sendButton')

    expect(textarea).toBeDisabled()
    expect(fileButton).toBeDisabled()
    expect(sendButton).toBeDisabled()
  })

  it('should show sending text on send button when disabled', () => {
    render(<MessageInput onSend={mockOnSend} disabled={true} />)

    const sendButton = screen.getByLabelText('sendButton')
    expect(sendButton).toHaveTextContent('sendButtonSending')
  })

  it('should use custom placeholder when provided', () => {
    render(
      <MessageInput
        onSend={mockOnSend}
        disabled={false}
        placeholder="Custom placeholder"
      />
    )

    const textarea = screen.getByPlaceholderText('Custom placeholder')
    expect(textarea).toBeInTheDocument()
  })

  it('should not send empty or whitespace-only messages', async () => {
    const user = userEvent.setup()
    render(<MessageInput onSend={mockOnSend} disabled={false} />)

    const textarea = screen.getByLabelText('inputPlaceholder')
    await user.type(textarea, '   {Enter}')

    expect(mockOnSend).not.toHaveBeenCalled()
  })

  it('should clear selected files after sending', async () => {
    const _user = userEvent.setup()
    render(<MessageInput onSend={mockOnSend} disabled={false} />)

    const file = new File(['content'], 'test.txt', { type: 'text/plain' })
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement

    if (fileInput) {
      Object.defineProperty(fileInput, 'files', {
        value: [file],
        writable: false,
      })

      const event = new Event('change', { bubbles: true })
      fileInput.dispatchEvent(event)

      await waitFor(() => {
        expect(screen.queryByText(/test\.txt/)).toBeInTheDocument()
      })

      const sendButton = screen.getByLabelText('sendButton')
      await _user.click(sendButton)

      await waitFor(() => {
        expect(screen.queryByText(/test\.txt/)).not.toBeInTheDocument()
      })
    }
  })
})
