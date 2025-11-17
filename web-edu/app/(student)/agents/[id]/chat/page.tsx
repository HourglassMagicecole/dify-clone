'use client'

import { useState, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
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

/**
 * Agent Chat Page
 * Provides a conversational interface to interact with the created Agent
 */
export default function AgentChatPage() {
  const params = useParams()
  const router = useRouter()
  const agentId = params.id as string
  const { currentSession, isLoading: sessionLoading } = useSession()
  const { t } = useTranslation('chat')

  // Message state
  const [messages, setMessages] = useState<Message[]>([])
  const [isStreaming, setIsStreaming] = useState(false)
  const [streamingContent, setStreamingContent] = useState('')
  const currentAgentThoughtsRef = useRef<ProcessingStep[]>([])
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null)
  const [showAgentInfo, setShowAgentInfo] = useState(false)

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

    // If selecting the temporary conversation, don't load messages
    if (conversationId === 'temp-new-conversation') {
      setMessages([])
      setStreamingContent('')
      return
    }

    try {
      const loadedMessages = await agentAPI.getConversationMessages(agentId, conversationId)
      setMessages(loadedMessages)
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

  // Handle new conversation
  const handleNewConversation = () => {
    // Create temporary conversation
    const tempConversation: Conversation = {
      id: 'temp-new-conversation',
      name: t('newConversationTitle'),
      agentId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      messageCount: 0,
    }

    // Add temporary conversation to the list
    mutateConversations([tempConversation, ...(conversations || [])], false)

    // Select the temporary conversation
    setCurrentConversationId('temp-new-conversation')
    setMessages([])
    setStreamingContent('')
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

      // If the deleted conversation was selected, clear messages
      if (conversationId === currentConversationId) {
        setCurrentConversationId(null)
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
        currentConversationId === 'temp-new-conversation' ? null : currentConversationId,
        // onChunk callback
        (chunk) => {
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

          // If this was a temporary conversation, replace it with the real one
          if (currentConversationId === 'temp-new-conversation' && result.conversationId) {
            setCurrentConversationId(result.conversationId)
            mutateConversations()
          }
          // Update current conversation ID if starting a new conversation
          else if (result.conversationId && !currentConversationId) {
            setCurrentConversationId(result.conversationId)
            mutateConversations()
          }

          const assistantMessage: Message = {
            id: result.messageId || `assistant-${Date.now()}`,
            conversationId: result.conversationId || currentConversationId || '',
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
        },
        // onError callback
        (error) => {
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
      setIsStreaming(false)
      setStreamingContent('')
      alert(t('error.sendMessage'))
      setMessages((prev) => prev.filter((m) => m.id !== userMessageId))
    }
  }

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
        <header className="border-b p-4 bg-white flex justify-between items-center flex-shrink-0">
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
          />
        </div>

        {/* Input Area - Fixed at bottom */}
        <div className="flex-shrink-0 border-t bg-white">
          <MessageInput onSend={handleSend} disabled={isStreaming} />
        </div>
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
              <AgentInfo agent={agent} showHeader={false} />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
