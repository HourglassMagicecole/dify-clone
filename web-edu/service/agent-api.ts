/**
 * Agent API Client
 * Handles all API calls related to Agent creation and management
 */

import { apiClient } from './base-api'
import { getAccessToken } from '@/utils/storage'
import {
  Agent,
  CreateAgentRequest,
  GetAgentsResponse,
  AgentBasicSettings,
  UpdateAgentRequest,
} from '@/types/agent'
import type {
  CompletionChunk,
  CompletionResult,
  UploadedFile,
  Conversation,
  Message,
} from '@/types/chat'
import { ForbiddenError, RateLimitError, NotFoundError } from '@/types/errors'

/**
 * Sanitize filename to prevent path traversal attacks
 * Removes or replaces potentially dangerous characters
 */
function sanitizeFilename(filename: string): string {
  // Remove path separators and dangerous characters
  return filename.replace(/[^a-zA-Z0-9._-]/g, '_')
}

/**
 * Agent API Service
 */
export class AgentAPIService {
  private readonly apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:5001'

  /**
   * Get the appropriate conversation endpoint based on app mode
   */
  private getConversationEndpoint(mode: string): string {
    // completion mode uses /completion-conversations
    if (mode === 'completion') {
      return 'completion-conversations'
    }
    // chat, agent-chat, advanced-chat use /chat-conversations
    return 'chat-conversations'
  }

  /**
   * Get the appropriate message endpoint based on app mode
   */
  private getMessageEndpoint(mode: string): string {
    // completion mode uses /completion-messages
    if (mode === 'completion') {
      return 'completion-messages'
    }
    // chat, agent-chat use /chat-messages
    // Note: advanced-chat uses workflow-run endpoints, not handled here
    return 'chat-messages'
  }
  /**
   * Create a new Agent
   * Uses Dify's POST /console/api/apps endpoint
   */
  async createAgent(settings: AgentBasicSettings, sessionId?: string): Promise<Agent> {
    const payload: CreateAgentRequest = {
      name: settings.name,
      description: settings.description,
      mode: settings.mode,
      icon_type: settings.icon_type,
      icon: settings.icon,
      icon_background: settings.icon_background,
      session_id: sessionId, // Add session_id for SessionResourceTag
    }

    const response = await apiClient.postDifyNative<Agent>(
      '/console/api/apps',
      payload
    )

    if (response.result !== 'success' || !response.data) {
      throw new Error(response.message || 'Failed to create agent')
    }

    return response.data
  }

  /**
   * Get list of Agents
   * Uses Dify's GET /console/api/apps endpoint with server-side pagination
   */
  async getAgents(filters?: {
    page?: number
    limit?: number
    session_id?: string
    admin_id?: string
  }): Promise<GetAgentsResponse> {
    const params = new URLSearchParams()
    // Default pagination values
    params.append('page', String(filters?.page || 1))
    params.append('limit', String(filters?.limit || 20))

    if (filters?.session_id) {
      params.append('session_id', filters.session_id)
    }
    if (filters?.admin_id) {
      params.append('admin_id', filters.admin_id)
    }

    const endpoint = `/console/api/apps?${params.toString()}`

    // Backend returns paginated response: {data, total, page, limit, has_more}
    const response = await apiClient.getDifyNative<GetAgentsResponse>(endpoint)

    if (response.result !== 'success' || !response.data) {
      throw new Error(response.message || 'Failed to fetch agents')
    }

    // getDifyNative wraps the response, so response.data is already GetAgentsResponse
    // Check if response.data has the pagination structure
    if ('data' in response.data && Array.isArray(response.data.data)) {
      // Backend pagination response
      return response.data as GetAgentsResponse
    }

    // Fallback for old format (shouldn't happen)
    return {
      data: Array.isArray(response.data) ? response.data : [],
      total: Array.isArray(response.data) ? response.data.length : 0,
      page: 1,
      limit: 20,
      has_more: false,
    }
  }

  /**
   * Get Agent by ID
   */
  async getAgent(id: string): Promise<Agent> {
    const response = await apiClient.getDifyNative<Agent>(`/console/api/apps/${id}`)

    if (response.result !== 'success' || !response.data) {
      throw new Error(response.message || 'Failed to fetch agent')
    }

    return response.data
  }

  /**
   * Update Agent basic info (name, description, icon)
   * Uses Dify's PUT /console/api/apps/{id} endpoint
   */
  async updateAgent(id: string, updates: UpdateAgentRequest): Promise<Agent> {
    const response = await apiClient.putDifyNative<Agent>(`/console/api/apps/${id}`, updates)

    if (response.result !== 'success' || !response.data) {
      throw new Error(response.message || 'Failed to update agent')
    }

    return response.data
  }

  /**
   * Update Agent model configuration (LLM settings, prompts, tools)
   * Uses Dify's POST /console/api/apps/{id}/model-config endpoint
   */
  async updateModelConfig(id: string, modelConfig: Record<string, unknown>): Promise<void> {
    const response = await apiClient.post<void>(`/console/api/apps/${id}/model-config`, modelConfig)

    if (response.result !== 'success') {
      throw new Error(response.message || 'Failed to update model config')
    }
  }

  /**
   * Delete Agent
   */
  async deleteAgent(id: string): Promise<void> {
    const response = await apiClient.delete<void>(`/console/api/apps/${id}`)

    if (response.result !== 'success') {
      throw new Error(response.message || 'Failed to delete agent')
    }
  }

  /**
   * Copy (Duplicate) Agent
   * Uses Dify's POST /console/api/apps/{app_id}/copy endpoint
   */
  async copyAgent(id: string, name?: string): Promise<Agent> {
    const payload: { name?: string } = {}
    if (name) {
      payload.name = name
    }

    const response = await apiClient.postDifyNative<Agent>(
      `/console/api/apps/${id}/copy`,
      payload
    )

    if (response.result !== 'success' || !response.data) {
      throw new Error(response.message || 'Failed to copy agent')
    }

    return response.data
  }

  /**
   * Upload files for chat
   * Uploads files and returns file metadata for message attachment
   */
  async uploadFiles(files: File[]): Promise<UploadedFile[]> {
    const uploadedFiles: UploadedFile[] = []

    // Upload files one by one (backend only accepts one file at a time)
    for (const file of files) {
      // Sanitize filename to prevent path traversal attacks
      const sanitizedFilename = sanitizeFilename(file.name)
      const sanitizedFile = new File([file], sanitizedFilename, { type: file.type })

      const formData = new FormData()
      formData.append('file', sanitizedFile) // Backend expects 'file', not 'files'

      // Prepare headers with authentication
      // Note: Do NOT set Content-Type for FormData - browser sets it automatically with boundary
      const headers: HeadersInit = {}

      const token = getAccessToken()
      if (token) {
        headers['Authorization'] = `Bearer ${token}`
      }

      const response = await fetch(`${this.apiBaseUrl}/console/api/files/upload`, {
        method: 'POST',
        headers,
        body: formData,
      })

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`File upload failed for ${file.name}: ${errorText}`)
      }

      const data = await response.json()
      // Map backend response to UploadedFile format
      uploadedFiles.push({
        id: data.id,
        name: data.name,
        size: data.size,
        type: data.extension || '',
        url: data.source_url || data.preview_url || '',
        mime_type: data.mime_type,
        extension: data.extension,
      })
    }

    return uploadedFiles
  }

  /**
   * Send message to Agent with streaming response
   * Handles SSE (Server-Sent Events) streaming from Dify Completion API
   */
  async sendMessage(
    agentId: string,
    mode: string,
    message: string,
    files: File[],
    conversationId: string | null,
    onChunk: (chunk: CompletionChunk) => void,
    onComplete: (result: CompletionResult) => void,
    onError: (error: Error) => void
  ): Promise<void> {
    try {
      // Upload files first if any
      let uploadedFiles: UploadedFile[] = []
      if (files.length > 0) {
        uploadedFiles = await this.uploadFiles(files)
      }

      // Helper function to determine file type from mime_type
      const getFileType = (mimeType?: string): string => {
        if (!mimeType) return 'file'
        if (mimeType.startsWith('image/')) return 'image'
        if (mimeType.startsWith('audio/')) return 'audio'
        if (mimeType.startsWith('video/')) return 'video'
        // Document types: PDF, Office documents, text files, etc.
        if (
          mimeType.includes('pdf') ||
          mimeType.includes('document') ||
          mimeType.includes('spreadsheet') ||
          mimeType.includes('presentation') ||
          mimeType.includes('text/') ||
          mimeType.includes('msword') ||
          mimeType.includes('ms-excel') ||
          mimeType.includes('ms-powerpoint')
        ) {
          return 'document'
        }
        return 'file'
      }

      // Prepare request body
      const requestBody: Record<string, unknown> = {
        inputs: {},
        query: message,
        files: uploadedFiles.map((f) => ({
          type: getFileType(f.mime_type),
          transfer_method: 'remote_url',
          url: f.url,
        })),
        model_config: {}, // Use Agent's default config
        response_mode: 'streaming',
      }

      // Add conversation_id if continuing an existing conversation
      if (conversationId) {
        requestBody.conversation_id = conversationId
      }

      // Prepare headers with authentication
      const headers: HeadersInit = {
        'Content-Type': 'application/json',
      }

      const token = getAccessToken()
      if (token) {
        headers['Authorization'] = `Bearer ${token}`
      }

      // Determine endpoint based on app mode
      const endpoint = this.getMessageEndpoint(mode)

      // Make streaming request - use direct API URL to bypass Next.js rewrites buffering
      const response = await fetch(`${this.apiBaseUrl}/console/api/apps/${agentId}/${endpoint}`, {
        method: 'POST',
        headers,
        body: JSON.stringify(requestBody),
      })

      // Check for rate limiting
      if (response.status === 429) {
        throw new RateLimitError('Rate limit exceeded')
      }

      // Check for forbidden
      if (response.status === 403) {
        throw new ForbiddenError('Access denied')
      }

      // Check for not found (conversation deleted or doesn't exist)
      if (response.status === 404) {
        throw new NotFoundError('Conversation not found')
      }

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
      }

      // Process streaming response
      const reader = response.body?.getReader()
      const decoder = new TextDecoder()

      if (!reader) {
        throw new Error('No response body')
      }

      let receivedConversationId = ''
      let receivedMessageId = ''
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || '' // Keep last incomplete line in buffer

        for (const line of lines) {
          if (!line.trim() || !line.startsWith('data: ')) continue

          try {
            const data = JSON.parse(line.slice(6)) as CompletionChunk

            // Store conversation and message IDs
            if (data.conversation_id) receivedConversationId = data.conversation_id
            if (data.message_id) receivedMessageId = data.message_id

            // Pass chunk to callback
            onChunk(data)

            // Handle completion
            if (data.event === 'message_end') {
              const tokenUsage = data.metadata?.usage
                ? {
                    promptTokens: data.metadata.usage.prompt_tokens,
                    completionTokens: data.metadata.usage.completion_tokens,
                    totalTokens: data.metadata.usage.total_tokens,
                  }
                : undefined

              // Wait a bit for all agent_thought events to be processed
              setTimeout(() => {
                onComplete({
                  success: true,
                  conversationId: receivedConversationId,
                  messageId: receivedMessageId,
                  tokenUsage,
                })
              }, 50)
              return
            }

            // Handle error
            if (data.event === 'error') {
              throw new Error(data.message || 'Unknown error')
            }
          }
          catch (parseError) {
            console.warn('Failed to parse SSE line:', line, parseError)
          }
        }
      }

      // If we reach here without message_end, consider it complete
      if (process.env.NODE_ENV === 'development') {
        console.log('[STREAMING DEBUG] Stream ended without message_end event')
      }
      onComplete({ success: true, conversationId: receivedConversationId, messageId: receivedMessageId })
    }
    catch (error) {
      if (process.env.NODE_ENV === 'development') {
        console.error('[STREAMING DEBUG] Error:', error)
      }
      onError(error as Error)
    }
  }

  /**
   * List conversations for an Agent
   */
  async listConversations(agentId: string, mode: string): Promise<Conversation[]> {
    // Prepare headers with authentication
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    }

    const token = getAccessToken()
    if (token) {
      headers['Authorization'] = `Bearer ${token}`
    }

    // Determine endpoint based on app mode
    const endpoint = this.getConversationEndpoint(mode)

    const response = await fetch(`${this.apiBaseUrl}/console/api/apps/${agentId}/${endpoint}`, {
      headers,
    })

    if (response.status === 403) {
      throw new ForbiddenError('Access denied to conversation list')
    }

    if (!response.ok) {
      throw new Error('Failed to fetch conversations')
    }

    const data = await response.json()
    const conversations = data.data || []

    // Transform snake_case to camelCase
    return conversations.map((conv: Record<string, unknown>) => ({
      id: conv.id as string,
      name: conv.name as string,
      agentId,
      createdAt: new Date((conv.created_at as number) * 1000).toISOString(),
      updatedAt: new Date((conv.updated_at as number) * 1000).toISOString(),
      messageCount: (conv.message_count as number) || 0,
    }))
  }

  /**
   * Get messages from a conversation
   */
  async getConversationMessages(agentId: string, conversationId: string): Promise<Message[]> {
    // Prepare headers with authentication
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    }

    const token = getAccessToken()
    if (token) {
      headers['Authorization'] = `Bearer ${token}`
    }

    // Use query parameter for conversation_id
    const response = await fetch(
      `${this.apiBaseUrl}/console/api/apps/${agentId}/chat-messages?conversation_id=${conversationId}`,
      {
        headers,
      }
    )

    // Security: Check for forbidden access
    if (response.status === 403) {
      throw new ForbiddenError('Access denied to this conversation')
    }

    if (!response.ok) {
      throw new Error('Failed to fetch messages')
    }

    const data = await response.json()
    const rawMessages = data.data || []

    // Transform backend format to frontend Message format
    // Each backend message contains both query and answer, we need to split them
    const messages: Message[] = []

    rawMessages.forEach((msg: Record<string, unknown>) => {
      // Add user message
      if (msg.query) {
        messages.push({
          id: `${msg.id as string}-user`,
          conversationId,
          role: 'user',
          content: msg.query as string,
          createdAt: new Date((msg.created_at as number) * 1000).toISOString(),
        })
      }

      // Add assistant message
      if (msg.answer) {
        const metadata = msg.metadata as Record<string, unknown> | undefined
        const usage = metadata?.usage as Record<string, number> | undefined
        const agentThoughts = msg.agent_thoughts as Array<Record<string, unknown>> | undefined

        messages.push({
          id: msg.id as string,
          conversationId,
          role: 'assistant',
          content: msg.answer as string,
          createdAt: new Date((msg.created_at as number) * 1000).toISOString(),
          tokenUsage: usage ? {
            promptTokens: usage.prompt_tokens || 0,
            completionTokens: usage.completion_tokens || 0,
            totalTokens: usage.total_tokens || 0,
          } : undefined,
          responseTime: msg.provider_response_latency ? (msg.provider_response_latency as number) * 1000 : undefined,
          agent_thoughts: agentThoughts?.map((thought) => ({
            id: thought.id as string,
            position: thought.position as number | undefined,
            thought: thought.thought as string | undefined,
            tool: thought.tool as string | undefined,
            tool_input: thought.tool_input as string | undefined,
            observation: thought.observation as string | undefined,
            message_files: (thought.message_files as Array<Record<string, unknown>> | undefined)?.map((file) => ({
              id: file.id as string,
              filename: file.filename as string,
              type: file.type as string,
              url: file.url as string,
              mime_type: file.mime_type as string | undefined,
              size: file.size as number | undefined,
              transfer_method: file.transfer_method as string | undefined,
              belongs_to: file.belongs_to as 'user' | 'assistant' | undefined,
              upload_file_id: file.upload_file_id as string | undefined,
            })),
          })),
        })
      }
    })

    return messages
  }

  /**
   * Delete a conversation
   */
  async deleteConversation(agentId: string, conversationId: string, mode: string): Promise<void> {
    // Prepare headers with authentication
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    }

    const token = getAccessToken()
    if (token) {
      headers['Authorization'] = `Bearer ${token}`
    }

    // Determine endpoint based on app mode
    const endpoint = this.getConversationEndpoint(mode)

    const response = await fetch(
      `${this.apiBaseUrl}/console/api/apps/${agentId}/${endpoint}/${conversationId}`,
      {
        method: 'DELETE',
        headers,
      }
    )

    if (response.status === 403) {
      throw new ForbiddenError('Access denied to delete this conversation')
    }

    if (!response.ok) {
      throw new Error('Failed to delete conversation')
    }
  }
}

/**
 * Singleton instance
 */
export const agentAPI = new AgentAPIService()
