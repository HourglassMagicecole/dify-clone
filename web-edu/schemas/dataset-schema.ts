/**
 * Zod validation schemas for RAG/Dataset creation wizard
 * Story 3.1: RAG Creation Wizard - Load & Split
 */

import { z } from 'zod'

/**
 * Step 1: Load - Dataset basic info validation
 */
export const datasetBasicInfoSchema = z.object({
  name: z
    .string()
    .min(1, 'validation.nameRequired')
    .max(40, 'validation.nameTooLong'),  // Dify limit: 40 chars
  description: z
    .string()
    .max(400, 'validation.descriptionTooLong')  // Dify limit: 400 chars
    .optional()
    .or(z.literal('')),
})

export type DatasetBasicInfoFormData = z.infer<typeof datasetBasicInfoSchema>

/**
 * Step 2: Split - Process rule validation
 *
 * Constraints:
 * - max_tokens: 50 ~ 4000 (backend minimum is 50)
 * - chunk_overlap: 0 ~ 50% of max_tokens
 */
export const segmentationSchema = z.object({
  separator: z.string().min(1, 'validation.separatorRequired'),
  max_tokens: z.number()
    .min(50, 'validation.maxTokensMin')
    .max(4000, 'validation.maxTokensMax'),
  chunk_overlap: z.number()
    .min(0, 'validation.chunkOverlapMin'),
}).refine(
  (data) => data.chunk_overlap <= Math.floor(data.max_tokens * 0.5),
  {
    message: 'validation.chunkOverlapMaxDynamic',
    path: ['chunk_overlap'],
  }
)

export const processRuleSchema = z.object({
  mode: z.enum(['automatic', 'custom']),
  rules: z.object({
    pre_processing_rules: z.array(z.object({
      id: z.enum(['remove_extra_spaces', 'remove_urls_emails']),
      enabled: z.boolean(),
    })),
    segmentation: segmentationSchema,
  }).optional(),
})

export type ProcessRuleFormData = z.infer<typeof processRuleSchema>
