/**
 * Tests for MessageList component
 */

import React from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MessageList } from '@/components/chat/MessageList'
import type { Message } from '@/types/chat'

describe('MessageList', () => {
  const mockOnRegenerate = jest.fn()

  const mockMessages: Message[] = [
    {
      id: 'msg-1',
      conversationId: 'conv-1',
      role: 'user',
      content: 'Hello, how are you?',
      createdAt: '2025-01-01T00:00:00Z',
    },
    {
      id: 'msg-2',
      conversationId: 'conv-1',
      role: 'assistant',
      content: 'I am doing well, thank you!',
      createdAt: '2025-01-01T00:00:05Z',
      tokenUsage: {
        promptTokens: 10,
        completionTokens: 20,
        totalTokens: 30,
      },
      responseTime: 1500,
    },
  ]

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should render empty state when no messages', () => {
    render(
      <MessageList
        messages={[]}
        isStreaming={false}
        streamingContent=""
        onRegenerate={mockOnRegenerate}
        hasConversationSelected={true}
      />
    )

    expect(screen.getByText('noMessages')).toBeInTheDocument()
  })

  it('should render user message with correct styling', () => {
    render(
      <MessageList
        messages={[mockMessages[0]]}
        isStreaming={false}
        streamingContent=""
        onRegenerate={mockOnRegenerate}
      />
    )

    const messageElement = screen.getByText('Hello, how are you?')
    expect(messageElement).toBeInTheDocument()
    expect(messageElement.closest('.max-w-\\[50\\%\\]')).toHaveClass('bg-blue-500', 'text-white')
  })

  it('should render assistant message with correct styling', () => {
    render(
      <MessageList
        messages={[mockMessages[1]]}
        isStreaming={false}
        streamingContent=""
        onRegenerate={mockOnRegenerate}
      />
    )

    const messageElement = screen.getByText('I am doing well, thank you!')
    expect(messageElement).toBeInTheDocument()
    expect(messageElement.closest('.max-w-\\[50\\%\\]')).toHaveClass('bg-gray-200', 'text-gray-900')
  })

  it('should render file attachments in user message', () => {
    const messageWithFile: Message = {
      ...mockMessages[0],
      files: [
        {
          id: 'file-1',
          name: 'test.pdf',
          type: 'application/pdf',
          size: 102400, // 100KB
          url: 'https://example.com/test.pdf',
        },
      ],
    }

    render(
      <MessageList
        messages={[messageWithFile]}
        isStreaming={false}
        streamingContent=""
        onRegenerate={mockOnRegenerate}
      />
    )

    expect(screen.getByText(/test\.pdf/)).toBeInTheDocument()
    expect(screen.getByText(/100KB/)).toBeInTheDocument()
  })

  it('should render token usage metadata for assistant messages', () => {
    render(
      <MessageList
        messages={[mockMessages[1]]}
        isStreaming={false}
        streamingContent=""
        onRegenerate={mockOnRegenerate}
      />
    )

    expect(screen.getByText(/tokenUsage/)).toBeInTheDocument()
    expect(screen.getByText(/30/)).toBeInTheDocument()
  })

  it('should render response time metadata for assistant messages', () => {
    render(
      <MessageList
        messages={[mockMessages[1]]}
        isStreaming={false}
        streamingContent=""
        onRegenerate={mockOnRegenerate}
      />
    )

    expect(screen.getByText(/responseTime/)).toBeInTheDocument()
    expect(screen.getByText(/1\.50s/)).toBeInTheDocument()
  })

  it('should render streaming message with cursor', () => {
    render(
      <MessageList
        messages={[]}
        isStreaming={true}
        streamingContent="This is streaming content..."
        onRegenerate={mockOnRegenerate}
      />
    )

    expect(screen.getByText(/This is streaming content\.\.\./)).toBeInTheDocument()
    expect(screen.getByText('▋')).toBeInTheDocument()
    expect(screen.getByText('▋')).toHaveClass('animate-pulse')
  })

  it('should render regenerate button only on last assistant message', () => {
    const multipleMessages: Message[] = [
      mockMessages[0]!,
      mockMessages[1]!,
      {
        id: 'msg-3',
        conversationId: 'conv-1',
        role: 'user',
        content: 'Another question',
        createdAt: '2025-01-01T00:00:10Z',
      },
      {
        id: 'msg-4',
        conversationId: 'conv-1',
        role: 'assistant',
        content: 'Another answer',
        createdAt: '2025-01-01T00:00:15Z',
      },
    ]

    render(
      <MessageList
        messages={multipleMessages}
        isStreaming={false}
        streamingContent=""
        onRegenerate={mockOnRegenerate}
      />
    )

    // Should only have one regenerate button
    const regenerateButtons = screen.getAllByLabelText('regenerateButton')
    expect(regenerateButtons).toHaveLength(1)
  })

  it('should call onRegenerate when regenerate button is clicked', async () => {
    const user = userEvent.setup()
    render(
      <MessageList
        messages={[mockMessages[0]!, mockMessages[1]!]}
        isStreaming={false}
        streamingContent=""
        onRegenerate={mockOnRegenerate}
      />
    )

    const regenerateButton = screen.getByLabelText('regenerateButton')
    await user.click(regenerateButton)

    expect(mockOnRegenerate).toHaveBeenCalledTimes(1)
  })

  it('should not show regenerate button when streaming', () => {
    render(
      <MessageList
        messages={[mockMessages[0]!, mockMessages[1]!]}
        isStreaming={true}
        streamingContent="Streaming..."
        onRegenerate={mockOnRegenerate}
      />
    )

    expect(screen.queryByLabelText('regenerateButton')).not.toBeInTheDocument()
  })

  it('should render ARIA attributes correctly', () => {
    render(
      <MessageList
        messages={[mockMessages[0]!]}
        isStreaming={false}
        streamingContent=""
        onRegenerate={mockOnRegenerate}
      />
    )

    const messageList = screen.getByRole('log')
    expect(messageList).toHaveAttribute('aria-live', 'polite')
    expect(messageList).toHaveAttribute('aria-label', 'messageList')
  })

  it('should show screen reader announcement when streaming', () => {
    render(
      <MessageList
        messages={[]}
        isStreaming={true}
        streamingContent="Streaming..."
        onRegenerate={mockOnRegenerate}
      />
    )

    const announcement = screen.getByText('assistantTyping')
    expect(announcement).toHaveClass('sr-only')
    expect(announcement.closest('[role="status"]')).toHaveAttribute('aria-live', 'polite')
  })

  it('should render multiple messages in correct order', () => {
    render(
      <MessageList
        messages={mockMessages}
        isStreaming={false}
        streamingContent=""
        onRegenerate={mockOnRegenerate}
      />
    )

    const messages = screen.getAllByRole('generic').filter(el =>
      el.className.includes('max-w-[50%]')
    )

    expect(messages).toHaveLength(2)
    expect(messages[0]).toHaveTextContent('Hello, how are you?')
    expect(messages[1]).toHaveTextContent('I am doing well, thank you!')
  })

  it('should render whitespace-pre-wrap for message content', () => {
    const messageWithNewlines: Message = {
      ...mockMessages[0]!,
      id: 'msg-newlines',
      content: 'Line 1\nLine 2\nLine 3',
    }

    render(
      <MessageList
        messages={[messageWithNewlines]}
        isStreaming={false}
        streamingContent=""
        onRegenerate={mockOnRegenerate}
      />
    )

    const contentElement = screen.getByText(/Line 1/)
    expect(contentElement).toHaveClass('whitespace-pre-wrap', 'break-words')
  })

  // Regression tests for hotfix_20260417_chat-new-conversation-cta
  describe('no-conversation-selected empty state CTA (hotfix_20260417)', () => {
    it('should call onNewConversation when the empty-state CTA is clicked', async () => {
      const user = userEvent.setup()
      const mockOnNewConversation = jest.fn()

      render(
        <MessageList
          messages={[]}
          isStreaming={false}
          streamingContent=""
          hasConversationSelected={false}
          onNewConversation={mockOnNewConversation}
        />
      )

      const cta = screen.getByLabelText('newConversationButton')
      await user.click(cta)

      expect(mockOnNewConversation).toHaveBeenCalledTimes(1)
    })

    it('should render CTA as a button with accessible label when onNewConversation is provided', () => {
      render(
        <MessageList
          messages={[]}
          isStreaming={false}
          streamingContent=""
          hasConversationSelected={false}
          onNewConversation={jest.fn()}
        />
      )

      const cta = screen.getByLabelText('newConversationButton')
      expect(cta.tagName).toBe('BUTTON')
      // Still shows the original guiding text
      expect(screen.getByText('selectConversation')).toBeInTheDocument()
    })

    it('should render non-interactive fallback when onNewConversation is not provided', () => {
      render(
        <MessageList
          messages={[]}
          isStreaming={false}
          streamingContent=""
          hasConversationSelected={false}
        />
      )

      // Guiding text still visible for backward compatibility
      expect(screen.getByText('selectConversation')).toBeInTheDocument()
      // No CTA button labeled as newConversationButton in this mode
      expect(screen.queryByLabelText('newConversationButton')).not.toBeInTheDocument()
    })

    it('should not render the empty-state CTA once a conversation is selected', () => {
      render(
        <MessageList
          messages={[]}
          isStreaming={false}
          streamingContent=""
          hasConversationSelected={true}
          onNewConversation={jest.fn()}
        />
      )

      expect(screen.queryByLabelText('newConversationButton')).not.toBeInTheDocument()
      // Instead, the noMessages state is shown
      expect(screen.getByText('noMessages')).toBeInTheDocument()
    })
  })
})
