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
    .min(10, 'validation.roleMinLength')
    .max(2000, 'validation.roleTooLong'),
  tool_enabled: z.boolean(),
  icon_type: z.enum(['emoji', 'image']).optional(),
  icon: z.string().optional(),
  icon_background: z.string().optional(),
})

/**
 * Type inference from schema
 */
export type BasicSettingsFormData = z.infer<typeof basicSettingsSchema>
