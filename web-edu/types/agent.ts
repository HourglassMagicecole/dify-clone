/**
 * Agent type definitions for EduAI Studio
 */

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
  role: string             // Role definition (maps to pre_prompt in Dify)
  tool_enabled: boolean    // Whether tools can be used
  icon_type?: 'emoji' | 'image'
  icon?: string
  icon_background?: string  // Hex color code
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
  id: string                // Unique identifier
  mode: AgentType          // Agent type this sample belongs to
  title: string            // Sample title (for display)
  content: string          // Role definition prompt
  icon: string             // Emoji icon for the sample
  suggestedName: string    // Suggested agent name
  description: string      // Short description of the sample
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
  created_at: string        // ISO 8601 format
  updated_at: string        // ISO 8601 format
  created_by?: string
  updated_by?: string
}

/**
 * Agent model configuration (used in Step 3)
 */
export interface AgentModelConfig {
  provider?: string
  model_id?: string
  mode?: string
  pre_prompt?: string
  user_input_form?: unknown[]
  // Additional fields will be added in Story 2.2
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
  page?: number
  limit?: number
}
