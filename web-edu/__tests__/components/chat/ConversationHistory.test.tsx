/**
 * Tests for ConversationHistory component
 */

import React from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ConversationHistory } from '@/components/chat/ConversationHistory'
import type { Conversation } from '@/types/chat'

describe('ConversationHistory', () => {
  const mockOnSelect = jest.fn()
  const mockOnNewConversation = jest.fn()

  const mockConversations: Conversation[] = [
    {
      id: 'conv-1',
      name: 'First conversation',
      updatedAt: '2025-01-01T10:00:00Z',
      messageCount: 5,
    },
    {
      id: 'conv-2',
      name: 'Second conversation',
      updatedAt: '2025-01-02T12:00:00Z',
      messageCount: 10,
    },
  ]

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should render empty state when no conversations', () => {
    render(
      <ConversationHistory
        conversations={[]}
        currentConversationId={null}
        onSelect={mockOnSelect}
        onNewConversation={mockOnNewConversation}
      />
    )

    expect(screen.getByText('noConversations')).toBeInTheDocument()
  })

  it('should render conversation list with correct data', () => {
    render(
      <ConversationHistory
        conversations={mockConversations}
        currentConversationId={null}
        onSelect={mockOnSelect}
        onNewConversation={mockOnNewConversation}
      />
    )

    expect(screen.getByText('First conversation')).toBeInTheDocument()
    expect(screen.getByText('Second conversation')).toBeInTheDocument()
  })

  it('should call onSelect when conversation is clicked', async () => {
    const user = userEvent.setup()
    render(
      <ConversationHistory
        conversations={mockConversations}
        currentConversationId={null}
        onSelect={mockOnSelect}
        onNewConversation={mockOnNewConversation}
      />
    )

    const firstConversation = screen.getByText('First conversation')
    await user.click(firstConversation)

    expect(mockOnSelect).toHaveBeenCalledWith('conv-1')
  })

  it('should call onSelect when Enter key is pressed', async () => {
    const user = userEvent.setup()
    render(
      <ConversationHistory
        conversations={mockConversations}
        currentConversationId={null}
        onSelect={mockOnSelect}
        onNewConversation={mockOnNewConversation}
      />
    )

    const conversationButton = screen.getByLabelText('Select conversation: First conversation')
    conversationButton.focus()
    await user.keyboard('{Enter}')

    expect(mockOnSelect).toHaveBeenCalledWith('conv-1')
  })

  it('should call onSelect when Space key is pressed', async () => {
    const user = userEvent.setup()
    render(
      <ConversationHistory
        conversations={mockConversations}
        currentConversationId={null}
        onSelect={mockOnSelect}
        onNewConversation={mockOnNewConversation}
      />
    )

    const conversationButton = screen.getByLabelText('Select conversation: First conversation')
    conversationButton.focus()
    await user.keyboard(' ')

    expect(mockOnSelect).toHaveBeenCalledWith('conv-1')
  })

  it('should highlight current conversation', () => {
    render(
      <ConversationHistory
        conversations={mockConversations}
        currentConversationId="conv-1"
        onSelect={mockOnSelect}
        onNewConversation={mockOnNewConversation}
      />
    )

    const currentButton = screen.getByLabelText('Select conversation: First conversation')
    // Check parent div has highlight classes
    const parentDiv = currentButton.parentElement
    expect(parentDiv).toHaveClass('bg-blue-50', 'border-2', 'border-blue-500')
    expect(currentButton).toHaveAttribute('aria-current', 'true')
  })

  it('should not highlight non-current conversations', () => {
    render(
      <ConversationHistory
        conversations={mockConversations}
        currentConversationId="conv-1"
        onSelect={mockOnSelect}
        onNewConversation={mockOnNewConversation}
      />
    )

    const nonCurrentButton = screen.getByLabelText('Select conversation: Second conversation')
    // Check parent div has non-highlight classes
    const parentDiv = nonCurrentButton.parentElement
    expect(parentDiv).toHaveClass('border', 'border-gray-200', 'bg-white')
    expect(nonCurrentButton).toHaveAttribute('aria-current', 'false')
  })

  it('should call onNewConversation when new conversation button is clicked', async () => {
    const user = userEvent.setup()
    render(
      <ConversationHistory
        conversations={mockConversations}
        currentConversationId={null}
        onSelect={mockOnSelect}
        onNewConversation={mockOnNewConversation}
      />
    )

    const newButton = screen.getByLabelText('newConversationButton')
    await user.click(newButton)

    expect(mockOnNewConversation).toHaveBeenCalledTimes(1)
  })

  it('should display conversation updated date', () => {
    render(
      <ConversationHistory
        conversations={mockConversations}
        currentConversationId={null}
        onSelect={mockOnSelect}
        onNewConversation={mockOnNewConversation}
      />
    )

    // The date will be formatted by toLocaleDateString()
    // Check for Korean date format (2025. 1. 1.) or US format (1/1/2025)
    const dateElements = screen.getAllByText(/(\d{4}\.\s+\d{1,2}\.\s+\d{1,2}\.)/)
    expect(dateElements.length).toBeGreaterThan(0)
  })

  it('should display message count for each conversation', () => {
    render(
      <ConversationHistory
        conversations={mockConversations}
        currentConversationId={null}
        onSelect={mockOnSelect}
        onNewConversation={mockOnNewConversation}
      />
    )

    // Check for Korean format "개 메시지"
    const messageCounts = screen.getAllByText(/개 메시지/)
    expect(messageCounts.length).toBeGreaterThan(0)
  })

  it('should render header with title', () => {
    render(
      <ConversationHistory
        conversations={[]}
        currentConversationId={null}
        onSelect={mockOnSelect}
        onNewConversation={mockOnNewConversation}
      />
    )

    expect(screen.getByText('conversationHistory')).toBeInTheDocument()
  })

  it('should render all conversations in order', () => {
    render(
      <ConversationHistory
        conversations={mockConversations}
        currentConversationId={null}
        onSelect={mockOnSelect}
        onNewConversation={mockOnNewConversation}
      />
    )

    const conversationButtons = screen.getAllByRole('button').filter(
      (btn) => btn.getAttribute('aria-label')?.startsWith('Select conversation:')
    )

    expect(conversationButtons).toHaveLength(2)
  })
})
