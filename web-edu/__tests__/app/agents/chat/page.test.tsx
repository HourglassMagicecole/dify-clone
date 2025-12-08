/**
 * Tests for Agent Chat Page
 * Note: These are simplified integration tests focused on component structure
 */

import React from 'react'
import { render, screen } from '@testing-library/react'
import { MessageList } from '@/components/chat/MessageList'
import { MessageInput } from '@/components/chat/MessageInput'
import { ProcessingSteps } from '@/components/chat/ProcessingSteps'
import { ConversationHistory } from '@/components/chat/ConversationHistory'
import type { Message, ProcessingStep, Conversation } from '@/types/chat'

describe('Chat Page Components Integration', () => {
  const mockMessages: Message[] = [
    {
      id: 'msg-1',
      conversationId: 'conv-1',
      role: 'user',
      content: 'Hello',
      createdAt: '2025-01-01T00:00:00Z',
    },
  ]

  const mockConversations: Conversation[] = [
    {
      id: 'conv-1',
      name: 'Test Conversation',
      updatedAt: '2025-01-01T00:00:00Z',
      messageCount: 5,
    },
  ]

  const mockSteps: ProcessingStep[] = [
    {
      id: 'step-1',
      name: 'Processing',
      status: 'running',
    },
  ]

  it('should render MessageList with messages', () => {
    render(
      <MessageList
        messages={mockMessages}
        isStreaming={false}
        streamingContent=""
        onRegenerate={() => {}}
      />
    )

    expect(screen.getByText('Hello')).toBeInTheDocument()
  })

  it('should render MessageInput', () => {
    render(<MessageInput onSend={() => {}} disabled={false} />)

    expect(screen.getByLabelText('inputPlaceholder')).toBeInTheDocument()
    expect(screen.getByLabelText('sendButton')).toBeInTheDocument()
  })

  it('should render ProcessingSteps when visible', () => {
    render(<ProcessingSteps steps={mockSteps} isVisible={true} />)

    expect(screen.getByText('Processing')).toBeInTheDocument()
  })

  it('should render ConversationHistory', () => {
    render(
      <ConversationHistory
        conversations={mockConversations}
        currentConversationId={null}
        onSelect={() => {}}
        onNewConversation={() => {}}
      />
    )

    expect(screen.getByText('Test Conversation')).toBeInTheDocument()
  })

  it('should render three-column layout structure with all components', () => {
    const { container } = render(
      <div className="flex h-screen">
        <ConversationHistory
          conversations={mockConversations}
          currentConversationId={null}
          onSelect={() => {}}
          onNewConversation={() => {}}
        />
        <main className="flex-1 flex flex-col">
          <MessageList
            messages={mockMessages}
            isStreaming={false}
            streamingContent=""
            onRegenerate={() => {}}
          />
          <MessageInput onSend={() => {}} disabled={false} />
        </main>
        <ProcessingSteps steps={mockSteps} isVisible={true} />
      </div>
    )

    // Verify layout structure
    expect(container.querySelector('.flex.h-screen')).toBeInTheDocument()
    expect(screen.getByText('Test Conversation')).toBeInTheDocument()
    expect(screen.getByText('Hello')).toBeInTheDocument()
    expect(screen.getByText('Processing')).toBeInTheDocument()
  })

  it('should handle streaming state in MessageList', () => {
    render(
      <MessageList
        messages={[]}
        isStreaming={true}
        streamingContent="Streaming content..."
        onRegenerate={() => {}}
      />
    )

    expect(screen.getByText(/Streaming content\.\.\./)).toBeInTheDocument()
    expect(screen.getByText('assistantTyping')).toBeInTheDocument()
  })

  it('should disable MessageInput when streaming', () => {
    render(<MessageInput onSend={() => {}} disabled={true} />)

    const textarea = screen.getByLabelText('inputPlaceholder')
    const sendButton = screen.getByLabelText('sendButton')

    expect(textarea).toBeDisabled()
    expect(sendButton).toBeDisabled()
  })

  it('should render conversation history sidebar with empty state', () => {
    render(
      <ConversationHistory
        conversations={[]}
        currentConversationId={null}
        onSelect={() => {}}
        onNewConversation={() => {}}
      />
    )

    expect(screen.getByText('noConversations')).toBeInTheDocument()
  })

  it('should render message list with empty state', () => {
    render(
      <MessageList
        messages={[]}
        isStreaming={false}
        streamingContent=""
        onRegenerate={() => {}}
        hasConversationSelected={true}
      />
    )

    expect(screen.getByText('noMessages')).toBeInTheDocument()
  })

  it('should render all ARIA labels for accessibility', () => {
    render(
      <div>
        <MessageList
          messages={mockMessages}
          isStreaming={false}
          streamingContent=""
          onRegenerate={() => {}}
        />
        <MessageInput onSend={() => {}} disabled={false} />
        <ProcessingSteps steps={mockSteps} isVisible={true} />
      </div>
    )

    expect(screen.getByRole('log')).toBeInTheDocument()
    expect(screen.getByLabelText('inputPlaceholder')).toBeInTheDocument()
    expect(screen.getByLabelText('processingStepsAccessible')).toBeInTheDocument()
  })
})
