/**
 * Agent type definitions for EduAI Studio
 */

import type { MessageFile } from './chat'

/**
 * Agent type enum (maps to Dify's app mode)
 */
export enum AgentType {
  CHAT = 'chat',             // Conversational agent (대화형)
  COMPLETION = 'completion', // Task-oriented agent (작업형)
}

/**
 * Agent basic settings for Step 1 of the wizard
 */
export interface AgentBasicSettings {
  name: string              // Maximum 255 characters
  description?: string      // Maximum 400 characters (optional)
  mode: AgentType          // Agent type
  role?: string            // Role definition (deprecated, use promptSettings.pre_prompt instead)
  tool_enabled: boolean    // Whether tools can be used
  icon_type?: 'emoji' | 'image'
  icon?: string
  icon_background?: string  // Hex color code
  suggested_tools?: string[]  // Suggested tool provider names (frontend only, not sent to backend)
}

/**
 * Agent wizard step enum
 */
export enum AgentWizardStep {
  BASIC = 1,
  PROMPT = 2,
  MODEL = 3,
  TOOLS = 4,
  REVIEW = 5,
}

/**
 * Configuration mode for Agent creation
 */
export enum ConfigMode {
  AUTO = 'auto',     // Auto-fill from sample templates
  MANUAL = 'manual', // Manual input from scratch
}

/**
 * Role sample template for Auto mode
 */
export interface RoleSample {
  id: string                           // Unique identifier
  mode: AgentType                      // Agent type this sample belongs to
  title: string                        // Sample title (for display)
  content: string                      // Role definition prompt
  icon: string                         // Emoji icon for the sample
  suggestedName: string                // Suggested agent name
  description: string                  // Short description of the sample
  // Completion mode suggestions
  suggested_user_input_form?: UserInputForm[]  // Suggested input form (completion mode only)
  suggested_output_format?: OutputFormat       // Suggested output format (completion mode only)
  suggested_tools?: string[]           // Suggested tool names (e.g., ["google_search", "wikipedia"])
  // Chat mode suggestions
  suggested_opening_statement?: string // Suggested opening message (chat mode only)
  suggested_questions?: string[]       // Suggested questions (chat mode only, max 5)
}

/**
 * Complete Agent data structure (returned from Dify API)
 */
export interface Agent {
  id: string
  name: string
  description: string
  mode: string
  icon_type: 'emoji' | 'image'
  icon: string
  icon_background: string
  enable_site: boolean
  enable_api: boolean
  model_config: AgentModelConfig
  created_at: number | string  // Unix timestamp (seconds) or ISO 8601 format
  updated_at: number | string  // Unix timestamp (seconds) or ISO 8601 format
  created_by?: string
  updated_by?: string
  author_name?: string         // Creator's name (for Administrator view)
  user_input_form?: UserInputForm[]  // Task-based agent input form (from model_config)
}

/**
 * Step 2: User input form field definition
 */
export interface UserInputForm {
  variable: string                    // Variable name (e.g., "query")
  label: string                       // Display label
  input_type: 'text-input' | 'paragraph' | 'select' | 'number' | 'checkbox' | 'file'
  required: boolean
  max_length?: number
  options?: string[]                  // For select type only
  default_value?: string
}

/**
 * Step 2: Output format definition for task-based agents
 */
export interface OutputFormat {
  format_type: 'text' | 'image' | 'audio' | 'file' | 'mixed'

  // Text output
  text_format?: 'markdown' | 'json' | 'plain_text' | 'html'
  structure?: string                  // Structure description (e.g., "Table format", "List", "JSON schema")
  example?: string                    // Output example

  // Image output
  image_format?: 'png' | 'jpg' | 'svg' | 'webp'
  image_specs?: {
    width?: number
    height?: number
    aspect_ratio?: string             // "16:9", "1:1", "4:3"
    style?: string                    // "realistic", "illustration", "3D"
  }

  // Audio output
  audio_format?: 'mp3' | 'wav' | 'ogg'
  audio_specs?: {
    voice?: string                    // "female", "male", "neutral"
    speed?: number                    // 1.0 = normal speed
    language?: string                 // "ko-KR", "en-US"
    tone?: string                     // "professional", "friendly", "calm"
  }

  // File output
  file_format?: 'csv' | 'pdf' | 'docx' | 'xlsx' | 'pptx'
  file_specs?: {
    template?: string                 // Template description
    format_rules?: string             // Format rules
    include_header?: boolean
  }

  // Mixed output (multiple formats)
  mixed_outputs?: Array<{
    type: 'text' | 'image' | 'audio' | 'file'
    description: string
    required: boolean
  }>
}

/**
 * Step 2: Prompt configuration settings
 */
export interface AgentPromptSettings {
  pre_prompt: string                   // System prompt (role definition)
  prompt_type: 'simple' | 'advanced'  // Prompt mode
  user_input_form?: UserInputForm[]   // User input form (completion mode only)
  output_format?: OutputFormat        // Output format definition (completion mode only)
  opening_statement?: string          // Conversation starter message (chat mode only)
  suggested_questions?: string[]      // Suggested questions (chat mode only, max 5)
}

/**
 * Step 3: LLM parameter rule definition
 */
export interface ParameterRule {
  name: string                        // Parameter name
  type: 'int' | 'float' | 'string' | 'boolean'
  use_template: string                // Default value template
  label: { en_US: string }
  help?: { en_US: string }            // Help text
  required: boolean
  default?: number | string | boolean
  min?: number
  max?: number
  precision?: number                  // Float precision
  options?: string[]                  // Selection options
}

/**
 * Step 3: Model information
 */
export interface ModelInfo {
  model: string                       // Model ID
  label: { en_US: string }            // Model display name
  model_type: 'llm' | 'text-embedding'
  features: string[]                  // Supported features (e.g., ["agent-thought"])
  model_properties: {
    context_size: number              // Context size
    max_chunks: number
    mode: string
  }
  parameter_rules: ParameterRule[]    // Parameter rules
}

/**
 * Step 3: Model provider information
 */
export interface ModelProvider {
  provider: string                    // Provider name
  label: string                       // Display name
  icon_small: { en_US: string }       // Icon URL
  supported_model_types: string[]     // Supported model types
  models: ModelInfo[]                 // Available models
  status: 'active' | 'no-configure'   // Activation status
  original_provider?: string          // Original provider name from API (optional)
}

/**
 * Step 3: Agent model configuration
 */
export interface AgentModelConfig {
  provider: string                    // Provider (e.g., "openai", "anthropic")
  original_provider?: string          // Original provider name (e.g., "langgenius/openai/openai")
  model: string                       // Model (e.g., "gpt-4", "claude-3-sonnet")
  mode: 'chat' | 'completion'         // Mode (auto-set by agent type)
  completion_params: {
    temperature: number               // 0.0 - 2.0 (default: 1.0)
    top_p: number                     // 0.0 - 1.0 (default: 1.0)
    presence_penalty: number          // -2.0 - 2.0 (default: 0.0)
    frequency_penalty: number         // -2.0 - 2.0 (default: 0.0)
    max_tokens: number                // Model-specific max (e.g., 4096)
    stop: string[]                    // Stop sequences (optional)
  }
}

/**
 * Step 4: Selected tool information
 */
export interface SelectedTool {
  provider_id: string                 // Provider ID (e.g., "edu_tools")
  provider_type: 'builtin' | 'api'    // Tool type
  provider_name: string               // Provider display name
  tool_name: string                   // Tool name (e.g., "calculator")
  tool_label: string                  // Tool display name
  tool_parameters: Record<string, unknown> // Tool parameters (API Key, etc.)
  enabled: boolean                    // Enabled status
}

/**
 * Step 4: Tools configuration
 */
export interface AgentToolsConfig {
  tools: SelectedTool[]               // Selected tools
}

/**
 * Step 5: Test message for agent testing
 */
export interface AgentTestMessage {
  role: 'user' | 'assistant'
  content: string
  created_at: Date
}

/**
 * Step 5: Test session state
 */
export interface AgentTestSession {
  messages: AgentTestMessage[]
  isLoading: boolean
  error: string | null
}

/**
 * Step 5: Agent configuration summary
 */
export interface AgentSummary {
  basic: AgentBasicSettings
  prompt: AgentPromptSettings
  model: AgentModelConfig
  tools: AgentToolsConfig
}

/**
 * Agent wizard state (all steps)
 */
export interface AgentWizardState {
  currentStep: AgentWizardStep
  basicSettings: AgentBasicSettings | null      // Step 1 (Story 2.1)
  promptSettings: AgentPromptSettings | null    // Step 2 (NEW)
  modelConfig: AgentModelConfig | null          // Step 3 (NEW)
  toolsConfig: AgentToolsConfig | null          // Step 4 (NEW)
  isDraft: boolean
  isLoading: boolean
  error: string | null
  createdAppId: string | null                   // Created agent ID (NEW)
}

/**
 * Dify App API response (backend API spec)
 */
export interface DifyApp {
  id: string
  name: string
  description: string
  mode: 'chat' | 'agent-chat' | 'completion'
  icon: string
  icon_background: string
  model_config: {
    provider: string
    model: string
    parameters: Record<string, unknown>
    stop: string[]
  }
  created_at: string
  updated_at: string
}

/**
 * Create app request payload for Dify API
 */
export interface CreateAppRequest {
  name: string
  description?: string
  mode: 'chat' | 'agent-chat' | 'completion'
  icon: string
  icon_background: string
  session_id: string
  model_config: {
    provider: string
    name: string
    mode: 'chat' | 'completion'
    completion_params: Record<string, unknown>
    stop: string[]
  }
  user_input_form?: UserInputForm[]
  pre_prompt?: string
  opening_statement?: string
  suggested_questions?: string[]
  agent_mode?: {
    enabled: boolean
    strategy?: string
    tools: Array<{
      provider_id: string
      provider_type: string
      tool_name: string
      tool_parameters: Record<string, unknown>
    }>
  }
}

/**
 * Agent creation request payload
 */
export interface CreateAgentRequest {
  name: string
  description?: string
  mode: AgentType
  icon_type?: 'emoji' | 'image'
  icon?: string
  icon_background?: string
  session_id?: string  // Session-based resource tagging (Story 2.2)
}

/**
 * Agent creation response from Dify API
 */
export interface CreateAgentResponse {
  result: 'success'
  data: Agent
}

/**
 * Agent list response from Dify API
 */
export interface GetAgentsResponse {
  data: Agent[]
  total: number
  page: number
  limit: number
  has_more: boolean
}

/**
 * Update agent request payload (for editing existing agent)
 */
export interface UpdateAgentRequest {
  name?: string
  description?: string
  icon?: string
  icon_type?: 'emoji' | 'image'
  icon_background?: string
  use_icon_as_answer_icon?: boolean
  model_config?: {
    provider: string
    model: string
    mode: 'chat' | 'completion'
    completion_params: {
      temperature: number
      top_p: number
      presence_penalty: number
      frequency_penalty: number
      max_tokens: number
      stop?: string[]
    }
  }
  user_input_form?: UserInputForm[]
  pre_prompt?: string
  opening_statement?: string
  suggested_questions?: string[]
  agent_mode?: {
    enabled: boolean
    strategy?: string
    tools: Array<{
      provider_id: string
      provider_type: string
      tool_name: string
      tool_parameters: Record<string, unknown>
    }>
  }
}

/**
 * Story 2.5: Task-based Agent Execution Interface Types
 */

/**
 * Agent execution status
 */
export type ExecutionStatus = 'idle' | 'running' | 'success' | 'failed'

/**
 * Agent thought (tool execution step)
 */
export interface AgentThought {
  id: string
  thought: string                     // Agent's reasoning
  tool: string | null                 // Tool name
  tool_input: Record<string, unknown> // Tool input parameters
  tool_output: string | null          // Tool output
  observation: string                 // Observation from tool execution
  message_files?: MessageFile[]       // Generated files (images, audio, documents)
  created_at: number                  // Unix timestamp (milliseconds) - when thought was created
  updated_at?: number                 // Unix timestamp (milliseconds) - when observation was filled
}

/**
 * Token usage information
 */
export interface TokenUsage {
  prompt_tokens: number
  completion_tokens: number
  total_tokens: number
  latency?: number                    // LLM execution time in seconds (from Backend)
  cost?: number                       // USD (calculated on frontend)
}

/**
 * Execution time breakdown
 */
export interface ExecutionTime {
  total: number                       // Total execution time (ms)
  tool: number                        // Tool execution time (ms)
  llm: number                         // LLM execution time (ms)
}

/**
 * Agent execution state
 */
export interface ExecutionState {
  status: ExecutionStatus
  currentInputs: Record<string, unknown> // Current form input values
  result: string | null               // Execution result
  error: string | null                // Error message
  agentThoughts: AgentThought[]       // Agent reasoning steps
  tokenUsage: TokenUsage | null       // Token usage
  executionTime: ExecutionTime | null // Execution time
}

/**
 * Agent execution request payload
 */
export interface AgentExecutionRequest {
  inputs: Record<string, unknown>     // user_input_form values
  response_mode: 'blocking' | 'streaming' // completion mode
  files?: Array<{
    type: string
    transfer_method: string
    url: string
  }>
}

/**
 * Streaming callbacks for agent execution
 */
export interface AgentExecutionCallbacks {
  onThought?: (thought: AgentThought) => void
  onMessage?: (message: string) => void
  onComplete?: (result: AgentExecutionResponse) => void
  onError?: (error: Error) => void
}

/**
 * Agent execution response
 */
export interface AgentExecutionResponse {
  task_id: string
  workflow_run_id: string
  data: {
    id: string
    answer: string                    // Final result
    metadata: {
      usage: TokenUsage
      retriever_resources: unknown[]
    }
    created_at: number
  }
  agent_thoughts: AgentThought[]      // Tool execution history
}
