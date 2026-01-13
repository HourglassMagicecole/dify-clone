'use client'

import { useState, useRef, useEffect } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import useSWR from 'swr'
import { useSession } from '@/context/SessionContext'
import { agentAPI } from '@/service/agent-api'
import { MessageList } from '@/components/chat/MessageList'
import { MessageInput } from '@/components/chat/MessageInput'
import { ConversationHistory } from '@/components/chat/ConversationHistory'
import { AgentInfo } from '@/components/chat/AgentInfo'
import type { Message, ProcessingStep, Conversation } from '@/types/chat'
import { ForbiddenError, RateLimitError, NotFoundError } from '@/types/errors'
import { useTranslation } from 'react-i18next'
import { savePendingMessage, loadPendingMessage, clearPendingMessage } from '@/utils/pending-message-store'

/**
 * Agent Chat Page
 * Provides a conversational interface to interact with the created Agent
 */
export default function AgentChatPage() {
  const params = useParams()
  const router = useRouter()
  const searchParams = useSearchParams()
  const agentId = params.id as string
  const { currentSession, isLoading: sessionLoading } = useSession()
  const { t } = useTranslation('chat')

  // URL query parameter for conversation ID
  const urlConversationId = searchParams.get('conversationId')

  // Update URL with conversation ID
  const updateUrlConversationId = (conversationId: string | null) => {
    const params = new URLSearchParams(searchParams.toString())
    if (conversationId && conversationId !== 'temp-new-conversation') {
      params.set('conversationId', conversationId)
    } else {
      params.delete('conversationId')
    }
    const queryString = params.toString()
    router.replace(`/agents/${agentId}/chat${queryString ? `?${queryString}` : ''}`, { scroll: false })
  }

  // Message state
  const [messages, setMessages] = useState<Message[]>([])
  const [isStreaming, setIsStreaming] = useState(false)
  const [streamingContent, setStreamingContent] = useState('')
  const currentAgentThoughtsRef = useRef<ProcessingStep[]>([])
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null)
  const conversationIdRef = useRef<string>('') // For API calls (immediate update)
  const parentMessageIdRef = useRef<string>('') // For conversation history chain
  const isUnloadingRef = useRef(false) // Track page unload to suppress error alerts
  const isStreamingRef = useRef(false) // Mirror isStreaming state for beforeunload handler
  const [showAgentInfo, setShowAgentInfo] = useState(false)

  // Sync isStreaming state to ref for beforeunload handler
  useEffect(() => {
    isStreamingRef.current = isStreaming
  }, [isStreaming])

  // Detect page unload to suppress error alerts during refresh/navigation
  // Also warn user if streaming without conversationId (message would be lost)
  useEffect(() => {
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      isUnloadingRef.current = true

      // Warn if streaming and no conversationId yet (pending message can't be saved)
      if (isStreamingRef.current && !conversationIdRef.current) {
        event.preventDefault()
        // Chrome requires returnValue to be set
        event.returnValue = ''
      }
    }
    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [])

  // Load Agent data first
  const {
    data: agent,
    isLoading: agentLoading,
    error: agentError,
  } = useSWR(
    currentSession ? ['agent', agentId] : null,
    () => agentAPI.getAgent(agentId),
    {
      dedupingInterval: 0,
      revalidateOnMount: true,
    }
  )

  // Load conversations list (depends on agent mode)
  const { data: conversations = [], mutate: mutateConversations } = useSWR<Conversation[]>(
    currentSession && agent ? ['conversations', agentId, agent.mode] : null,
    () => agentAPI.listConversations(agentId, agent!.mode),
    {
      dedupingInterval: 0,
      revalidateOnMount: true,
    }
  )

  // Handle conversation selection
  const handleSelectConversation = async (conversationId: string) => {
    setCurrentConversationId(conversationId)
    updateUrlConversationId(conversationId)
    conversationIdRef.current = conversationId === 'temp-new-conversation' ? '' : conversationId
    parentMessageIdRef.current = '' // Reset parent message ID when switching conversations

    // If selecting the temporary conversation, restore opening_statement
    if (conversationId === 'temp-new-conversation') {
      setStreamingContent('')
      const openingStatement = (agent?.model_config as unknown as Record<string, unknown>)?.opening_statement as string | undefined
      if (openingStatement) {
        const openingMessage: Message = {
          id: 'opening-statement',
          conversationId: 'temp-new-conversation',
          role: 'assistant',
          content: openingStatement,
          createdAt: new Date().toISOString(),
        }
        setMessages([openingMessage])
      } else {
        setMessages([])
      }
      return
    }

    try {
      const loadedMessages = await agentAPI.getConversationMessages(agentId, conversationId)

      // Set parent_message_id to the last assistant message for conversation continuity
      const lastAssistantMessage = [...loadedMessages].reverse().find(m => m.role === 'assistant' && !m.id.startsWith('opening-'))
      if (lastAssistantMessage) {
        parentMessageIdRef.current = lastAssistantMessage.id
      }

      // Handle opening_statement display
      const openingStatement = (agent?.model_config as unknown as Record<string, unknown>)?.opening_statement as string | undefined

      // Case 1: New conversation (no messages yet) - show opening_statement if available
      if (loadedMessages.length === 0) {
        if (openingStatement) {
          const openingMessage: Message = {
            id: 'opening-statement',
            conversationId,
            role: 'assistant',
            content: openingStatement,
            createdAt: new Date().toISOString(),
          }
          setMessages([openingMessage])
        } else {
          setMessages([])
        }
      }
      // Case 2: Existing conversation - prepend opening_statement if not already present
      else if (openingStatement && loadedMessages[0]?.id !== 'opening-statement') {
        const openingMessage: Message = {
          id: 'opening-statement',
          conversationId,
          role: 'assistant',
          content: openingStatement,
          createdAt: loadedMessages[0]?.createdAt || new Date().toISOString(),
        }
        setMessages([openingMessage, ...loadedMessages])
      }
      // Case 3: Messages already include opening_statement or no opening_statement configured
      else {
        setMessages(loadedMessages)
      }
    }
    catch (error) {
      // Security: Handle forbidden access
      if (error instanceof ForbiddenError) {
        alert(error.message)
        setCurrentConversationId(null) // Deselect conversation
        return
      }
      alert(t('error.loadConversation'))
    }
  }

  // Handle new conversation - creates conversation on server immediately
  const handleNewConversation = async () => {
    if (!agent) return

    try {
      // Create conversation on server to get real conversation ID immediately
      const newConversation = await agentAPI.createConversation(agentId, agent.mode, t('newConversationTitle'))

      // Create conversation object for local state
      const conversation: Conversation = {
        id: newConversation.id,
        name: newConversation.name,
        agentId,
        createdAt: newConversation.createdAt,
        updatedAt: newConversation.createdAt,
        messageCount: 0,
      }

      // Add to conversations list and refresh
      mutateConversations([conversation, ...conversations], false)

      // Select the new conversation
      setCurrentConversationId(newConversation.id)
      updateUrlConversationId(newConversation.id)
      conversationIdRef.current = newConversation.id
      parentMessageIdRef.current = ''
      setStreamingContent('')

      // Add opening_statement as the first assistant message if available
      const openingStatement = (agent.model_config as unknown as Record<string, unknown>)?.opening_statement as string | undefined
      if (openingStatement) {
        const openingMessage: Message = {
          id: 'opening-statement',
          conversationId: newConversation.id,
          role: 'assistant',
          content: openingStatement,
          createdAt: new Date().toISOString(),
        }
        setMessages([openingMessage])
      } else {
        setMessages([])
      }
    } catch (error) {
      console.error('Failed to create new conversation:', error)
      alert(t('error.createConversation'))
    }
  }

  // Handle export conversation
  const handleExportConversation = () => {
    if (messages.length === 0) {
      alert(t('noMessages'))
      return
    }

    let content = `Agent: ${agent?.name}\n`
    content += `Date: ${new Date().toLocaleString()}\n\n`
    content += '='.repeat(50) + '\n\n'

    messages.forEach((msg) => {
      content += `[${msg.role === 'user' ? t('user') || 'User' : 'Agent'}] ${new Date(
        msg.createdAt
      ).toLocaleTimeString()}\n`
      content += `${msg.content}\n\n`

      if (msg.tokenUsage) {
        content += `  ${t('tokenUsage')}: ${msg.tokenUsage.totalTokens}, ${t('responseTime')}: ${(
          (msg.responseTime || 0) / 1000
        ).toFixed(2)}s\n\n`
      }
    })

    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `conversation-${Date.now()}.txt`
    a.click()
    URL.revokeObjectURL(url)

    alert(t('exportSuccess'))
  }

  // Handle delete conversation
  const handleDeleteConversation = async (conversationId: string) => {
    if (!confirm(t('deleteConversationConfirm'))) {
      return
    }

    try {
      await agentAPI.deleteConversation(agentId, conversationId, agent!.mode)

      // Refresh conversation list
      mutateConversations()

      // If the deleted conversation was selected, clear messages and URL
      if (conversationId === currentConversationId) {
        setCurrentConversationId(null)
        updateUrlConversationId(null)
        setMessages([])
        setStreamingContent('')
      }
    }
    catch (error) {
      if (error instanceof ForbiddenError) {
        alert(t('error.forbidden'))
      }
      else {
        alert(t('error.deleteConversation'))
      }
    }
  }

  // Handle regenerate last response
  const handleRegenerate = () => {
    if (messages.length < 2) return

    // Find last assistant message
    const lastAssistantIndex = messages.findLastIndex((m) => m.role === 'assistant')
    if (lastAssistantIndex === -1) return

    // Find last user message before that
    const lastUserMessage = messages
      .slice(0, lastAssistantIndex)
      .reverse()
      .find((m) => m.role === 'user')

    if (!lastUserMessage) return

    // Remove assistant message
    setMessages((prev) => prev.slice(0, lastAssistantIndex))

    // Resend user message
    handleSend(lastUserMessage.content, [])
  }

  // Handle message send
  const handleSend = async (message: string, files: File[]) => {
    if (!message.trim() && files.length === 0) return

    setIsStreaming(true)
    setStreamingContent('')
    currentAgentThoughtsRef.current = []

    // Save pending message for existing conversations (we already have conversationId)
    // For new conversations, pending message is saved in onChunk after receiving conversation_id
    if (conversationIdRef.current) {
      savePendingMessage(agentId, conversationIdRef.current, message, files)
    }

    // Create user message immediately
    const userMessageId = `user-${Date.now()}`
    const userMessage: Message = {
      id: userMessageId,
      conversationId: '', // Will be filled after response
      role: 'user',
      content: message,
      createdAt: new Date().toISOString(),
      files: files.map((f) => ({
        id: `file-${Date.now()}-${f.name}`,
        name: f.name,
        type: f.type,
        size: f.size,
        url: '',
      })),
    }
    setMessages((prev) => [...prev, userMessage])

    try {
      let fullContent = ''
      const startTime = Date.now()

      await agentAPI.sendMessage(
        agentId,
        agent!.mode,
        message,
        files,
        conversationIdRef.current || null, // Use ref for immediate value
        parentMessageIdRef.current || null, // For conversation history chain
        // onChunk callback
        (chunk) => {
          // Update conversation ID immediately when received (before onComplete)
          if (chunk.conversation_id && !conversationIdRef.current) {
            conversationIdRef.current = chunk.conversation_id
            setCurrentConversationId(chunk.conversation_id)
            updateUrlConversationId(chunk.conversation_id)
            mutateConversations()

            // Update pending message with new conversation ID for refresh recovery
            savePendingMessage(agentId, chunk.conversation_id, message, files)
          }

          // Handle both 'message' (completion) and 'agent_message' (agent-chat) events
          if (chunk.event === 'message' || chunk.event === 'agent_message') {
            const newContent = chunk.answer || chunk.data?.answer || ''
            fullContent += newContent
            setStreamingContent(fullContent)
          }
          else if (chunk.event === 'agent_thought') {
            // Store agent thoughts in Dify format for message history using ref
            const stepId = chunk.id || `step-${Date.now()}`
            const existingIndex = currentAgentThoughtsRef.current.findIndex((s) => s.id === stepId)

            const thoughtItem: ProcessingStep = {
              id: stepId,
              position: chunk.position,
              thought: chunk.thought,
              tool: chunk.tool,
              tool_input: chunk.tool_input,
              observation: chunk.observation,
              message_files: chunk.message_files,
            }

            if (existingIndex >= 0) {
              currentAgentThoughtsRef.current[existingIndex] = {
                ...currentAgentThoughtsRef.current[existingIndex],
                ...thoughtItem
              }
            }
            else {
              currentAgentThoughtsRef.current.push(thoughtItem)
            }
          }
        },
        // onComplete callback
        (result) => {
          const responseTime = Date.now() - startTime

          // Update conversation ID immediately via ref
          if (result.conversationId && !conversationIdRef.current) {
            conversationIdRef.current = result.conversationId
            setCurrentConversationId(result.conversationId)
            updateUrlConversationId(result.conversationId)
            mutateConversations()
          }

          // Update parent message ID for next message in conversation
          if (result.messageId) {
            parentMessageIdRef.current = result.messageId
          }

          const assistantMessage: Message = {
            id: result.messageId || `assistant-${Date.now()}`,
            conversationId: result.conversationId || conversationIdRef.current || '',
            role: 'assistant',
            content: fullContent,
            createdAt: new Date().toISOString(),
            tokenUsage: result.tokenUsage,
            responseTime,
            agent_thoughts: currentAgentThoughtsRef.current.length > 0 ? [...currentAgentThoughtsRef.current] : undefined,
          }

          setMessages((prev) => [...prev, assistantMessage])
          setStreamingContent('')
          setIsStreaming(false)
          currentAgentThoughtsRef.current = []

          // Refresh conversation list to get updated name (auto-generated by server)
          mutateConversations()

          // Clear pending message on successful completion
          clearPendingMessage(agentId)
        },
        // onError callback
        (error) => {
          // Skip error handling if page is unloading (refresh/navigation)
          if (isUnloadingRef.current) {
            return
          }

          setIsStreaming(false)
          setStreamingContent('')

          // Handle specific error types
          if (error instanceof RateLimitError) {
            alert(t('rateLimitExceeded'))
          }
          else if (error instanceof ForbiddenError) {
            alert(t('error.forbidden'))
          }
          else if (error instanceof NotFoundError) {
            alert(t('error.conversationNotFound'))
            // Reset conversation state to start fresh
            conversationIdRef.current = ''
            parentMessageIdRef.current = ''
            setCurrentConversationId(null)
            setMessages([])
            mutateConversations() // Refresh conversation list
          }
          else {
            alert(t('error.sendMessage'))
          }

          // Remove failed user message
          setMessages((prev) => prev.filter((m) => m.id !== userMessageId))
        }
      )
    }
    catch {
      // Skip error handling if page is unloading (refresh/navigation)
      if (isUnloadingRef.current) {
        return
      }
      setIsStreaming(false)
      setStreamingContent('')
      alert(t('error.sendMessage'))
      setMessages((prev) => prev.filter((m) => m.id !== userMessageId))
    }
  }

  // Restore conversation from URL on initial load
  // Intentionally only depends on urlConversationId and conversations to avoid re-running on every selection
  useEffect(() => {
    if (urlConversationId && conversations.length > 0 && currentConversationId !== urlConversationId) {
      const exists = conversations.find(c => c.id === urlConversationId)
      if (exists) {
        handleSelectConversation(urlConversationId)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlConversationId, conversations])

  // Resend pending message after page refresh
  useEffect(() => {
    const checkAndResendPendingMessage = async () => {
      // Only check after agent is loaded and not currently streaming
      if (!agent || isStreaming) return

      // Wait for conversations to be loaded
      if (conversations.length === 0) return

      // Wait for URL conversation to be selected first (URL recovery must complete)
      if (urlConversationId && currentConversationId !== urlConversationId) {
        return
      }

      const pending = await loadPendingMessage(agentId)
      if (!pending) return

      // Verify the conversation matches or is empty (new conversation)
      const currentConvId = conversationIdRef.current || urlConversationId || ''
      if (pending.conversationId && pending.conversationId !== currentConvId) {
        // Different conversation, clear stale pending message
        await clearPendingMessage(agentId)
        return
      }

      // Clear pending message BEFORE resending to prevent infinite loop
      await clearPendingMessage(agentId)

      // Set conversationId ref before resending to continue the same conversation
      // Use pending.conversationId first, fallback to URL conversationId
      const targetConversationId = pending.conversationId || urlConversationId || ''
      if (targetConversationId) {
        conversationIdRef.current = targetConversationId
      }

      // Resend the pending message
      handleSend(pending.message, pending.files)
    }

    checkAndResendPendingMessage()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agent, agentId, conversations, urlConversationId, currentConversationId])

  // Loading states
  if (sessionLoading || agentLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-center">
          <div className="mb-4 h-12 w-12 animate-spin rounded-full border-b-2 border-t-2 border-blue-500 mx-auto"></div>
          <p className="text-gray-600">{t('loadingAgent')}</p>
        </div>
      </div>
    )
  }

  // Error state
  if (agentError) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-center">
          <p className="text-red-600 mb-2">{t('error.loadAgent')}</p>
          <p className="text-sm text-gray-500">{agentError.message}</p>
        </div>
      </div>
    )
  }

  // No agent found
  if (!agent) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600">{t('agentNotFound')}</p>
        </div>
      </div>
    )
  }

  // No session selected
  if (!currentSession) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600">{t('noSessionSelected')}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 flex bg-gray-50 z-50">
      {/* Left Sidebar: Conversation History */}
      <ConversationHistory
        conversations={conversations}
        currentConversationId={currentConversationId}
        onSelect={handleSelectConversation}
        onNewConversation={handleNewConversation}
        onDelete={handleDeleteConversation}
      />

      {/* Center: Message Area */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="border-b p-4 bg-white flex justify-between items-center flex-shrink-0 h-[85px]">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push('/agents')}
              className="px-3 py-1 border rounded hover:bg-gray-100 flex items-center gap-1"
              aria-label="Back to agents list"
            >
              <span>←</span>
              <span>{t('backToList')}</span>
            </button>
            <div>
              <h2 className="font-bold text-gray-900">{agent.name}</h2>
              <p className="text-sm text-gray-500">{agent.description}</p>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setShowAgentInfo(true)}
              className="px-3 py-1 border rounded hover:bg-gray-100 flex items-center gap-1"
              aria-label={t('agentInfoButton')}
            >
              <span>ⓘ</span>
              <span>{t('agentInfoButton')}</span>
            </button>
            <button
              onClick={handleExportConversation}
              className="px-3 py-1 border rounded hover:bg-gray-100"
              aria-label={t('exportButton')}
            >
              {t('exportButton')}
            </button>
          </div>
        </header>

        {/* Messages - Scrollable area */}
        <div className="flex-1 overflow-hidden">
          <MessageList
            messages={messages}
            isStreaming={isStreaming}
            streamingContent={streamingContent}
            onRegenerate={handleRegenerate}
            hasConversationSelected={currentConversationId !== null}
          />
        </div>

        {/* Suggested questions - show above input when only opening statement exists */}
        {(() => {
          const suggestedQuestions = (agent.model_config as unknown as Record<string, unknown>)?.suggested_questions as string[] | undefined
          const showSuggestions = currentConversationId !== null
            && messages.length === 1
            && messages[0]?.id === 'opening-statement'
            && suggestedQuestions
            && suggestedQuestions.length > 0
            && !isStreaming

          if (!showSuggestions) return null

          return (
            <div className="flex-shrink-0 px-4 py-3 bg-gray-50 border-t">
              <div className="flex flex-wrap gap-2 justify-center">
                {suggestedQuestions!.map((question, index) => (
                  <button
                    key={index}
                    onClick={() => handleSend(question, [])}
                    className="px-4 py-2 bg-white border border-gray-300 rounded-full text-sm text-gray-700 hover:bg-blue-50 hover:border-blue-300 hover:text-blue-600 transition-colors shadow-sm"
                  >
                    {question}
                  </button>
                ))}
              </div>
            </div>
          )
        })()}

        {/* Input Area - Fixed at bottom, only show when conversation is selected */}
        {currentConversationId !== null && (
          <div className="flex-shrink-0 border-t bg-white">
            <MessageInput onSend={handleSend} disabled={isStreaming} isSending={isStreaming} />
          </div>
        )}
      </main>

      {/* Agent Info Modal */}
      {showAgentInfo && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
          onClick={() => setShowAgentInfo(false)}
        >
          <div
            className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[80vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 bg-white border-b p-4 flex justify-between items-center">
              <h3 className="text-lg font-bold">{t('agentInfo')}</h3>
              <button
                onClick={() => setShowAgentInfo(false)}
                className="text-gray-500 hover:text-gray-700"
                aria-label={t('close')}
              >
                ✕
              </button>
            </div>
            <div className="p-4">
              <AgentInfo agent={agent} showHeader={false} showPrompt={true} />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
