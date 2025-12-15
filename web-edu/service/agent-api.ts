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
  AgentExecutionRequest,
  AgentExecutionResponse,
  AgentExecutionCallbacks,
  AgentThought,
  TokenUsage,
  UserInputForm,
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
  private readonly apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL !== undefined
    ? process.env.NEXT_PUBLIC_API_BASE_URL
    : 'http://localhost:5001'

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

    // Helper function to extract user_input_form from model_config
    const extractUserInputForm = (agent: Agent): Agent => {
      // Extract user_input_form from model_config if it exists
      const modelConfig = agent.model_config as unknown as Record<string, unknown>
      if (modelConfig?.user_input_form) {
        return {
          ...agent,
          user_input_form: modelConfig.user_input_form as UserInputForm[],
        }
      }
      return agent
    }

    // getDifyNative wraps the response, so response.data is already GetAgentsResponse
    // Check if response.data has the pagination structure
    if ('data' in response.data && Array.isArray(response.data.data)) {
      // Backend pagination response - map agents to extract user_input_form
      return {
        ...response.data,
        data: response.data.data.map(extractUserInputForm),
      } as GetAgentsResponse
    }

    // Fallback for old format (shouldn't happen)
    return {
      data: Array.isArray(response.data) ? response.data.map(extractUserInputForm) : [],
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
   * Also creates an API key for the copied agent
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

    const copiedAgent = response.data

    // Create API key for the copied agent (required for execution)
    try {
      await this.createAppApiKey(copiedAgent.id)
    } catch (apiKeyError) {
      console.error('[copyAgent] Failed to create API key for copied agent:', apiKeyError)
      // Don't fail the whole operation, just log the error
    }

    return copiedAgent
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
    parentMessageId: string | null,
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
        model_config: {},
        response_mode: 'streaming',
      }

      // Add conversation_id if continuing an existing conversation
      if (conversationId) {
        requestBody.conversation_id = conversationId
      }

      // Add parent_message_id for conversation history chain
      if (parentMessageId) {
        requestBody.parent_message_id = parentMessageId
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
      onComplete({ success: true, conversationId: receivedConversationId, messageId: receivedMessageId })
    }
    catch (error) {
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

  /**
   * Get API Keys for an Agent
   * Uses Console API to retrieve the agent's API tokens
   */
  async getAppApiKeys(appId: string): Promise<Array<{
    id: string
    type: string
    token: string
    last_used_at: string | null
    created_at: string
  }>> {
    const response = await apiClient.getDifyNative<Array<{
      id: string
      type: string
      token: string
      last_used_at: string | null
      created_at: string
    }>>(`/console/api/apps/${appId}/api-keys`)

    if (response.result !== 'success' || !response.data) {
      throw new Error(response.message || 'Failed to fetch API keys')
    }

    // response.data is already the array (getDifyNative extracts json.data)
    return response.data
  }

  /**
   * Create API Key for an Agent
   * Uses Console API to create a new API token
   */
  async createAppApiKey(appId: string): Promise<{
    id: string
    type: string
    token: string
    last_used_at: string | null
    created_at: string
  }> {
    const response = await apiClient.postDifyNative<{
      id: string
      type: string
      token: string
      last_used_at: string | null
      created_at: string
    }>(`/console/api/apps/${appId}/api-keys`, {})

    if (response.result !== 'success' || !response.data) {
      throw new Error(response.message || 'Failed to create API key')
    }

    return response.data
  }

  /**
   * Upload a single file for task-based agent execution (Task 8.2)
   * Returns file information for use in AgentExecutionRequest
   */
  async uploadFile(file: File): Promise<{
    id: string
    name: string
    type: string
    size: number
    url: string
  }> {
    // Sanitize filename
    const sanitizedFilename = sanitizeFilename(file.name)
    const sanitizedFile = new File([file], sanitizedFilename, { type: file.type })

    const formData = new FormData()
    formData.append('file', sanitizedFile)

    // Prepare headers
    const headers: HeadersInit = {}
    const token = getAccessToken()
    if (token) {
      headers['Authorization'] = `Bearer ${token}`
    }

    const response = await fetch(`${this.apiBaseUrl}/v1/files/upload`, {
      method: 'POST',
      headers,
      body: formData,
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`File upload failed: ${errorText}`)
    }

    const data = await response.json()

    return {
      id: data.id,
      name: data.name || file.name,
      type: data.mime_type || file.type,
      size: data.size || file.size,
      url: data.url || `/files/${data.id}`,
    }
  }

  /**
   * Execute task-based agent with blocking or streaming mode
   * Supports both blocking and streaming response modes
   *
   * @param agentId - Agent ID
   * @param request - Execution request with inputs and files
   * @param callbacks - Optional callbacks for streaming mode
   * @returns Agent execution response with result and agent_thoughts (blocking mode only)
   */
  async executeAgent(
    agentId: string,
    request: AgentExecutionRequest,
    callbacks?: AgentExecutionCallbacks
  ): Promise<AgentExecutionResponse | void> {
    try {
      // Get agent info and API keys
      const agent = await this.getAgent(agentId)
      const apiKeys = await this.getAppApiKeys(agentId)

      // Use the first (or most recently used) API token
      if (apiKeys.length === 0 || !apiKeys[0]) {
        throw new Error('Agent API token not found. Make sure the agent has API access enabled.')
      }

      const apiToken = apiKeys[0].token

      // Determine endpoint based on agent mode
      const agentMode = agent.mode
      const endpoint = agentMode === 'completion'
        ? `${this.apiBaseUrl}/v1/completion-messages`
        : `${this.apiBaseUrl}/v1/chat-messages`

      // Prepare request body based on mode
      const requestBody: Record<string, unknown> = {
        response_mode: request.response_mode, // Support both blocking and streaming
        files: request.files || [],
        user: 'web-edu-user', // Required by Dify API
      }

      // Chat API requires 'query' field, Completion API uses 'inputs'
      if (agentMode === 'completion') {
        requestBody.inputs = request.inputs
      } else {
        // agent-chat or chat mode: need both query and inputs
        // Combine all input values as query message
        const inputValues = Object.values(request.inputs).filter(v => v !== null && v !== undefined)
        requestBody.query = inputValues.length > 0 ? String(inputValues[0]) : ''
        requestBody.inputs = request.inputs
      }

      // Prepare headers
      const headers: HeadersInit = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiToken}`,
      }

      // Call Dify Agent API
      const response = await fetch(endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify(requestBody),
      })

      // Enhanced error handling (Task 8.3)
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))

        // User-friendly error messages
        let userMessage = ''
        switch (response.status) {
          case 400:
            userMessage = `입력 오류: ${errorData.message || '잘못된 요청입니다'}`
            break
          case 401:
            userMessage = '인증 오류: 로그인이 필요합니다'
            break
          case 403:
            userMessage = '권한 오류: 이 Agent를 실행할 권한이 없습니다'
            break
          case 404:
            userMessage = 'Agent를 찾을 수 없습니다'
            break
          case 429:
            userMessage = '요청 한도 초과: 잠시 후 다시 시도해주세요'
            break
          case 500:
            userMessage = '서버 오류: Agent 실행 중 오류가 발생했습니다'
            break
          case 504:
            userMessage = 'Agent 응답 시간 초과 (60초)'
            break
          default:
            userMessage = `알 수 없는 오류 (${response.status}): ${errorData.message || response.statusText}`
        }

        // Log error for monitoring (Task 8.3)
        if (process.env.NODE_ENV === 'production') {
          // Production error logging for monitoring
          console.error('[executeAgent] Error:', {
            agentId,
            userId: apiToken ? 'authenticated' : 'anonymous',
            inputs: request.inputs,
            status: response.status,
            error: errorData,
            timestamp: new Date().toISOString(),
          })
        }

        throw new Error(userMessage)
      }

      // Handle streaming mode
      if (request.response_mode === 'streaming') {
        return this.handleStreamingResponse(response, callbacks)
      }

      // Handle blocking mode
      const data = await response.json()

      // Validate agent_thoughts (Task 8.4)
      if (data.agent_thoughts) {
        data.agent_thoughts.forEach((thought: unknown, index: number) => {
          const t = thought as Record<string, unknown>
          if (!t.id) {
            console.warn(`[executeAgent] Thought ${index} missing ID`)
          }
          if (t.tool && !t.tool_input) {
            console.warn(`[executeAgent] Tool ${t.tool} missing input`)
          }
        })
      }

      // Map response to AgentExecutionResponse
      return {
        task_id: data.task_id || '',
        workflow_run_id: data.workflow_run_id || '',
        data: {
          id: data.id || data.message_id || '',
          answer: data.answer || '',
          metadata: {
            usage: {
              prompt_tokens: data.metadata?.usage?.prompt_tokens || 0,
              completion_tokens: data.metadata?.usage?.completion_tokens || 0,
              total_tokens: data.metadata?.usage?.total_tokens || 0,
              latency: data.metadata?.usage?.latency, // Include latency from Backend
            },
            retriever_resources: data.metadata?.retriever_resources || [],
          },
          created_at: data.created_at || Date.now(),
        },
        agent_thoughts: data.agent_thoughts || [],
      }
    }
    catch (error) {
      // Re-throw with context
      if (error instanceof Error) {
        throw error
      }
      throw new Error(`Agent 실행 실패: ${String(error)}`)
    }
  }

  /**
   * Handle streaming response from agent execution
   * Processes SSE events and invokes callbacks
   */
  private async handleStreamingResponse(
    response: Response,
    callbacks?: AgentExecutionCallbacks
  ): Promise<void> {
    const reader = response.body?.getReader()
    const decoder = new TextDecoder()

    if (!reader) {
      throw new Error('No response body')
    }

    let buffer = ''
    let finalAnswer = ''
    const agentThoughts: AgentThought[] = []
    let tokenUsage: TokenUsage | null = null
    let messageId = ''
    let receivedMessageEnd = false // Track if we received proper completion
    let lastErrorMessage = '' // Track error messages from stream

    try {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          if (!line.trim() || !line.startsWith('data: ')) continue

          try {
            const data = JSON.parse(line.slice(6)) as Record<string, unknown>

            // Handle different event types
            switch (data.event) {
              case 'agent_thought':
                // Agent thought event
                {
                  const thought: AgentThought = {
                    id: String(data.id || Date.now()),
                    thought: String(data.thought || ''),
                    tool: data.tool ? String(data.tool) : null,
                    tool_input: (data.tool_input as Record<string, unknown>) || {},
                    tool_output: data.observation ? String(data.observation) : null,
                    observation: String(data.observation || ''),
                    message_files: (data.message_files as Array<Record<string, unknown>> | undefined)?.map((file) => ({
                      id: String(file.id || ''),
                      type: String(file.type || 'document'),
                      url: String(file.url || ''),
                      filename: String(file.filename || ''),
                      mime_type: file.mime_type ? String(file.mime_type) : undefined,
                      size: file.size ? Number(file.size) : undefined,
                      transfer_method: file.transfer_method ? String(file.transfer_method) : undefined,
                      belongs_to: file.belongs_to as 'user' | 'assistant' | undefined,
                      upload_file_id: file.upload_file_id ? String(file.upload_file_id) : undefined,
                    })),
                    // Backend may send created_at in seconds, normalize to milliseconds
                    created_at: data.created_at
                      ? (Number(data.created_at) < 10000000000
                          ? Number(data.created_at) * 1000 // Convert seconds to milliseconds
                          : Number(data.created_at)) // Already in milliseconds
                      : Date.now(),
                  }

                  // Prevent duplicates: update existing thought or add new one
                  const existingIndex = agentThoughts.findIndex(t => t.id === thought.id)
                  if (existingIndex >= 0) {
                    // Update existing thought
                    agentThoughts[existingIndex] = thought
                  }
                  else {
                    // Add new thought
                    agentThoughts.push(thought)
                  }

                  callbacks?.onThought?.(thought)
                }
                break

              case 'agent_message':
              case 'message':
                // Message chunk
                if (data.answer) {
                  const chunk = String(data.answer)
                  finalAnswer += chunk
                  callbacks?.onMessage?.(chunk)
                }
                if (data.id) {
                  messageId = String(data.id)
                }
                break

              case 'message_end':
                // Final event with metadata - marks successful completion
                receivedMessageEnd = true
                if (data.metadata) {
                  const metadata = data.metadata as Record<string, unknown>
                  const usage = metadata.usage as Record<string, unknown> | undefined
                  if (usage) {
                    tokenUsage = {
                      prompt_tokens: Number(usage.prompt_tokens || 0),
                      completion_tokens: Number(usage.completion_tokens || 0),
                      total_tokens: Number(usage.total_tokens || 0),
                      latency: usage.latency ? Number(usage.latency) : undefined,
                    }
                  }
                }

                // Call onComplete callback
                if (callbacks?.onComplete) {
                  callbacks.onComplete({
                    task_id: String(data.task_id || ''),
                    workflow_run_id: String(data.workflow_run_id || ''),
                    data: {
                      id: messageId,
                      answer: finalAnswer,
                      metadata: {
                        usage: tokenUsage || {
                          prompt_tokens: 0,
                          completion_tokens: 0,
                          total_tokens: 0,
                        },
                        retriever_resources: [],
                      },
                      created_at: Date.now(),
                    },
                    agent_thoughts: agentThoughts,
                  })
                }
                return

              case 'error':
                // Store error message and throw
                lastErrorMessage = String(data.message || 'Unknown error')
                throw new Error(lastErrorMessage)
            }
          }
          catch (parseError) {
            // Check if this is a thrown error from switch case
            if (parseError instanceof Error && parseError.message === lastErrorMessage) {
              throw parseError
            }
            console.warn('[handleStreamingResponse] Failed to parse SSE line:', line, parseError)
          }
        }
      }

      // IMPORTANT: If we reach here without message_end, treat as error
      // This happens when backend encounters an error mid-stream
      if (!receivedMessageEnd) {
        const errorMessage = finalAnswer
          ? 'Agent 실행 중 오류가 발생했습니다. 부분 결과만 수신되었습니다.'
          : 'Agent 실행 중 오류가 발생했습니다. 응답을 받지 못했습니다.'

        console.error('[handleStreamingResponse] Stream ended without message_end event', {
          messageId,
          hasAnswer: !!finalAnswer,
          thoughtCount: agentThoughts.length,
        })

        if (callbacks?.onError) {
          callbacks.onError(new Error(errorMessage))
        }
        else {
          throw new Error(errorMessage)
        }
        return
      }
    }
    catch (error) {
      if (callbacks?.onError) {
        callbacks.onError(error instanceof Error ? error : new Error(String(error)))
      }
      else {
        throw error
      }
    }
  }

  /**
   * Get execution history (completion-messages logs)
   * Uses Next.js API Route to proxy Backend API (avoids CORS issues)
   */
  async getExecutionHistory(agentId: string, params?: {
    limit?: number
    first_id?: string
  }): Promise<{
    limit: number
    has_more: boolean
    data: Array<{
      id: string
      inputs: Record<string, unknown>
      answer: string
      status: string
      created_at: number
      message_tokens: number
      answer_tokens: number
      total_tokens: number
      provider_response_latency: number
      total_price?: number
      currency?: string
    }>
  }> {
    try {
      const queryParams = new URLSearchParams()
      if (params?.limit) queryParams.append('limit', String(params.limit))
      if (params?.first_id) queryParams.append('first_id', params.first_id)

      // Use Next.js API Route instead of direct Backend call
      const url = `/api/agents/${agentId}/history${queryParams.toString() ? `?${queryParams.toString()}` : ''}`

      // Send request with credentials to include cookies (edu_access_token)
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include', // Important: Send cookies with request
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${await response.text()}`)
      }

      const data = await response.json()

      return data.data || data || {
        limit: 20,
        has_more: false,
        data: [],
      }
    }
    catch (error) {
      console.error('[getExecutionHistory] Error:', error)
      console.error('[getExecutionHistory] Error details:', {
        agentId,
        params,
        error: error instanceof Error ? error.message : String(error),
      })
      // Return empty result on error
      return {
        limit: 20,
        has_more: false,
        data: [],
      }
    }
  }
}

/**
 * Singleton instance
 */
export const agentAPI = new AgentAPIService()
