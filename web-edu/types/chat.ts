/**
 * Chat and Conversation Types
 * TypeScript interfaces for the Agent chat functionality
 */

/**
 * Chat Message
 */
export interface Message {
  id: string
  conversationId: string
  role: 'user' | 'assistant'
  content: string
  createdAt: string
  files?: UploadedFile[]
  tokenUsage?: TokenUsage
  responseTime?: number // milliseconds
  agent_thoughts?: ProcessingStep[] // Agent tool call history (Dify format)
}

/**
 * Conversation (Chat Session)
 */
export interface Conversation {
  id: string
  name: string
  agentId: string
  createdAt: string
  updatedAt: string
  messageCount: number
}

/**
 * Message File (attached to ProcessingStep or Message)
 */
export interface MessageFile {
  id: string
  filename: string
  type: string
  url: string
  mime_type?: string
  size?: number
  transfer_method?: string
  belongs_to?: 'user' | 'assistant'
  upload_file_id?: string
}

/**
 * Processing Step (Agent Thought)
 * Represents a single step in the Agent's processing pipeline
 * Compatible with Dify's ThoughtItem format
 */
export interface ProcessingStep {
  id: string
  position?: number
  thought?: string
  tool?: string
  tool_input?: string
  observation?: string
  message_files?: MessageFile[]
  // Legacy fields (for backward compatibility)
  name?: string
  status?: 'pending' | 'running' | 'completed' | 'failed'
  startedAt?: string
  completedAt?: string
  output?: string
}

/**
 * Token Usage Statistics
 */
export interface TokenUsage {
  promptTokens: number
  completionTokens: number
  totalTokens: number
  cost?: number // USD
}

/**
 * Uploaded File
 */
export interface UploadedFile {
  id: string
  name: string
  type: string
  size: number
  url: string
  mime_type?: string
  extension?: string
}

/**
 * Completion Chunk (SSE Event)
 * Streaming response from Dify Completion API
 */
export interface CompletionChunk {
  event: 'message' | 'agent_message' | 'agent_thought' | 'message_end' | 'error'
  conversation_id?: string
  message_id?: string
  answer?: string
  // For agent_thought event
  id?: string
  position?: number
  thought?: string
  observation?: string
  tool?: string
  tool_labels?: Record<string, unknown>
  tool_input?: string
  message_files?: MessageFile[]
  // For other events
  data?: {
    answer?: string
    thoughts?: ProcessingStep[]
  }
  metadata?: {
    usage?: {
      prompt_tokens: number
      completion_tokens: number
      total_tokens: number
    }
    retriever_resources?: unknown[]
  }
  code?: string
  message?: string
}

/**
 * Completion Result
 * Final result after streaming completes
 */
export interface CompletionResult {
  success: boolean
  conversationId?: string
  messageId?: string
  tokenUsage?: TokenUsage
}
