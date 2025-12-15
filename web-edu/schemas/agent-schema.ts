/**
 * Zod validation schemas for Agent creation wizard
 */

import { z } from 'zod'
import { AgentType } from '@/types/agent'

/**
 * Basic settings validation schema for Step 1
 */
export const basicSettingsSchema = z.object({
  name: z
    .string()
    .min(1, 'validation.nameRequired')
    .max(255, 'validation.nameTooLong'),
  description: z
    .string()
    .max(400, 'validation.descriptionTooLong')
    .optional()
    .or(z.literal('')),
  mode: z.nativeEnum(AgentType),
  role: z
    .string()
    .max(2000, 'validation.roleTooLong')
    .optional()
    .or(z.literal('')),
  tool_enabled: z.boolean(),
  icon_type: z.enum(['emoji', 'image']).optional(),
  icon: z.string().optional(),
  icon_background: z.string().optional(),
})

/**
 * Type inference from schema
 */
export type BasicSettingsFormData = z.infer<typeof basicSettingsSchema>

/**
 * Step 2: Prompt configuration validation schema
 */
export const promptSettingsSchema = z.object({
  pre_prompt: z.string()
    .min(10, 'agent.validation.promptMinLength')
    .max(4000, 'agent.validation.promptTooLong'),
  prompt_type: z.enum(['simple', 'advanced']),
  user_input_form: z.array(z.object({
    variable: z.string().regex(/^[a-zA-Z_][a-zA-Z0-9_]*$/, 'agent.validation.invalidVariableName'),
    label: z.string().min(1, 'agent.validation.labelRequired'),
    input_type: z.enum(['text-input', 'paragraph', 'select', 'number', 'checkbox', 'file']),
    required: z.boolean(),
    max_length: z.number().positive().optional(),
    options: z.array(z.string()).optional(),
    default_value: z.string().optional(),
  })).optional(),
  opening_statement: z.string().max(500, 'agent.validation.openingStatementTooLong').optional(),
  suggested_questions: z.array(z.string().max(200)).max(5).optional(),
}).superRefine((data, ctx) => {
  // Completion mode validation: user_input_form required
  if (data.prompt_type === 'advanced' && (!data.user_input_form || data.user_input_form.length === 0)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'agent.validation.userInputFormRequired',
      path: ['user_input_form'],
    })
  }
  // Select type validation: options required
  data.user_input_form?.forEach((field, index) => {
    if (field.input_type === 'select' && (!field.options || field.options.length === 0)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'agent.validation.selectOptionsRequired',
        path: ['user_input_form', index, 'options'],
      })
    }
  })
})

export type PromptSettingsFormData = z.infer<typeof promptSettingsSchema>

/**
 * Step 3: LLM model configuration validation schema
 */
export const modelConfigSchema = z.object({
  provider: z.string().min(1, 'validation.providerRequired'),
  original_provider: z.string().optional(),
  model: z.string().min(1, 'validation.modelRequired'),
  mode: z.enum(['chat', 'completion']),
  completion_params: z.object({
    temperature: z.number().min(0).max(1).default(1.0),
    top_p: z.number().min(0).max(1).default(1.0),
    presence_penalty: z.number().min(-2).max(2).default(0.0),
    frequency_penalty: z.number().min(-2).max(2).default(0.0),
    max_tokens: z.number().positive().max(128000), // Model-specific max validated dynamically
    stop: z.array(z.string()).max(4).default([]),
  }),
}).superRefine((data, ctx) => {
  // Model-specific max_tokens validation handled dynamically in client
  // Basic range validation only
  if (data.completion_params.max_tokens > 128000) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'validation.maxTokensTooLarge',
      path: ['completion_params', 'max_tokens'],
    })
  }
})

export type ModelConfigFormData = z.infer<typeof modelConfigSchema>

/**
 * Step 4: Tools configuration validation schema
 */
export const toolsConfigSchema = z.object({
  tools: z.array(z.object({
    provider_id: z.string().min(1),
    provider_type: z.enum(['builtin', 'api']),
    provider_name: z.string().min(1),
    tool_name: z.string().min(1),
    tool_label: z.string().min(1),
    tool_parameters: z.record(z.string(), z.any()),
    enabled: z.boolean(),
  })).default([]),
})
// Note: agent-chat mode could require at least 1 tool (optional rule)
// This validation can be enabled/disabled based on business logic
// Currently treating as optional (no superRefine validation)

export type ToolsConfigFormData = z.infer<typeof toolsConfigSchema>

/**
 * Complete agent creation validation schema (Steps 1-4 combined)
 */
export const createAgentSchema = z.object({
  // Step 1: Basic settings
  basic: basicSettingsSchema,
  // Step 2: Prompt configuration
  prompt: promptSettingsSchema,
  // Step 3: LLM settings
  model: modelConfigSchema,
  // Step 4: Tools configuration
  tools: toolsConfigSchema,
})

export type CreateAgentFormData = z.infer<typeof createAgentSchema>
