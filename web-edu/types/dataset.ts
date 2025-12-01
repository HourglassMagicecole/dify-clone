/**
 * Dataset related TypeScript types
 * Based on Dify API response structure
 * Story 3.1: RAG Creation Wizard - Load & Split
 */

// ============================================================================
// Task 1.1: Dataset 기본 타입 정의
// ============================================================================

export type DatasetPermission = 'only_me' | 'all_team_members' | 'partial_members'
export type IndexingTechnique = 'high_quality' | 'economy'

export interface Dataset {
  id: string
  name: string
  description: string | null
  permission: DatasetPermission
  indexing_technique: IndexingTechnique | null
  embedding_model: string | null
  embedding_model_provider: string | null
  embedding_available: boolean
  document_count: number
  word_count: number
  app_count: number
  created_by: string
  created_at: number
  updated_at: number
}

export interface DatasetListResponse {
  data: Dataset[]
  has_more: boolean
  limit: number
  total: number
  page: number
}

// ============================================================================
// Task 1.2: 파일 업로드 관련 타입 정의
// ============================================================================

/**
 * File upload response from Dify API
 * Endpoint: POST /console/api/files/upload
 * Source: api/fields/file_fields.py - file_fields
 */
export interface FileUploadResponse {
  id: string
  name: string
  size: number
  extension: string
  mime_type: string
  created_by: string
  created_at: number
  preview_url: string | null
  source_url: string | null
}

/**
 * File upload progress tracking (frontend only)
 */
export interface FileUploadProgress {
  file: File
  progress: number  // 0-100
  status: 'pending' | 'uploading' | 'completed' | 'error'
  response?: FileUploadResponse
  error?: string
}

/**
 * Upload config from GET /console/api/files/upload
 */
export interface UploadConfig {
  file_size_limit: number
  batch_count_limit: number
  image_file_size_limit: number
  video_file_size_limit: number
  audio_file_size_limit: number
  workflow_file_upload_limit: number
}

// ============================================================================
// Task 1.3: ProcessRule 타입 정의
// ============================================================================

/**
 * Pre-processing rule item
 * Source: api/services/entities/knowledge_entities/knowledge_entities.py - PreProcessingRule
 */
export interface PreProcessingRule {
  id: 'remove_extra_spaces' | 'remove_urls_emails'
  enabled: boolean
}

/**
 * Segmentation configuration
 * Source: api/services/dataset_service.py - DocumentService.DEFAULT_RULES
 */
export interface Segmentation {
  delimiter: string      // default: "\n"
  max_tokens: number     // default: 1024
  chunk_overlap: number  // default: 50
}

/**
 * Process rule configuration
 * Source: api/services/dataset_service.py - DocumentService.DEFAULT_RULES
 */
export interface ProcessRuleConfig {
  pre_processing_rules: PreProcessingRule[]
  segmentation: Segmentation
}

/**
 * Process rule with mode
 * Source: api/services/entities/knowledge_entities/knowledge_entities.py - ProcessRule
 */
export type ProcessRuleMode = 'automatic' | 'custom' | 'hierarchical'

export interface ProcessRule {
  mode: ProcessRuleMode
  rules: ProcessRuleConfig | null  // null when mode is 'automatic'
}

/**
 * Process rule limits from API
 */
export interface ProcessRuleLimits {
  indexing_max_segmentation_tokens_length: number
}

/**
 * GET /console/api/datasets/process-rule response
 */
export interface ProcessRuleResponse {
  mode: ProcessRuleMode
  rules: ProcessRuleConfig
  limits: ProcessRuleLimits
}

/**
 * Default values matching Dify backend
 * Source: api/services/dataset_service.py - DocumentService.DEFAULT_RULES
 */
export const DEFAULT_PROCESS_RULE: ProcessRule = {
  mode: 'custom',
  rules: {
    pre_processing_rules: [
      { id: 'remove_extra_spaces', enabled: true },
      { id: 'remove_urls_emails', enabled: false },
    ],
    segmentation: {
      delimiter: '\n',
      max_tokens: 1024,
      chunk_overlap: 50,
    },
  },
}

// ============================================================================
// Task 1.4: RAG 마법사 상태 타입 정의
// ============================================================================

/**
 * RAG Wizard step enum
 * Story 3.1: LOAD, SPLIT only
 * Story 3.2: EMBED, STORE will be added
 */
export enum RAGWizardStep {
  LOAD = 1,
  SPLIT = 2,
  EMBED = 3,   // Placeholder for Story 3.2
  STORE = 4,   // Placeholder for Story 3.2
}

/**
 * RAG Wizard state interface
 * Similar pattern to AgentWizardContext
 */
export interface RAGWizardState {
  currentStep: RAGWizardStep

  // Step 1: Load
  datasetName: string
  datasetDescription: string
  uploadedFiles: FileUploadResponse[]
  uploadProgress: FileUploadProgress[]

  // Step 2: Split
  processRule: ProcessRule

  // Common
  isLoading: boolean
  error: string | null
}

/**
 * Dataset creation request
 * Endpoint: POST /console/api/datasets
 */
export interface CreateDatasetRequest {
  name: string
  description?: string
  indexing_technique?: IndexingTechnique
  permission?: DatasetPermission
}

// ============================================================================
// Task 5.1: Indexing Estimate 타입 정의 (Preview Chunk)
// ============================================================================

/**
 * Data source type for indexing estimate
 */
export type DataSourceType = 'upload_file' | 'notion_import' | 'website_crawl'

/**
 * Chunking mode for document processing
 */
export type ChunkingMode = 'text_model' | 'qa_model' | 'parent_child_model'

/**
 * Segmentation config for API requests (uses 'separator' instead of 'delimiter')
 * Note: GET /process-rule returns 'delimiter', but POST /indexing-estimate expects 'separator'
 */
export interface SegmentationForAPI {
  separator: string      // API expects 'separator', not 'delimiter'
  max_tokens: number
  chunk_overlap: number
}

/**
 * Process rule config for API requests
 */
export interface ProcessRuleConfigForAPI {
  pre_processing_rules: PreProcessingRule[]
  segmentation: SegmentationForAPI
}

/**
 * Process rule for API requests
 */
export interface ProcessRuleForAPI {
  mode: ProcessRuleMode
  rules: ProcessRuleConfigForAPI | null
}

/**
 * Indexing estimate request for preview chunk
 * Endpoint: POST /console/api/datasets/indexing-estimate
 * Source: web/models/datasets.ts - IndexingEstimateParams
 */
export interface IndexingEstimateRequest {
  info_list: {
    data_source_type: DataSourceType
    file_info_list?: {
      file_ids: string[]
    }
  }
  indexing_technique: IndexingTechnique
  process_rule: ProcessRuleForAPI
  doc_form: ChunkingMode
  doc_language: string
  dataset_id: string
}

/**
 * Single chunk preview item
 */
export interface ChunkPreview {
  content: string
  child_chunks?: string[]
}

/**
 * QA preview item (for qa_model mode)
 */
export interface QAPreview {
  question: string
  answer: string
}

/**
 * Indexing estimate response
 * Source: web/models/datasets.ts - IndexingEstimateResponse
 */
export interface IndexingEstimateResponse {
  tokens: number
  total_price: number
  currency: string
  total_segments: number
  preview: ChunkPreview[]
  qa_preview?: QAPreview[]
}

// ============================================================================
// Task 5 Enhancement: Default Model API types
// ============================================================================

/**
 * Model type enum for Dify model providers
 */
export type ModelType = 'llm' | 'text-embedding' | 'rerank' | 'speech2text' | 'moderation' | 'tts'

/**
 * Default model response from API
 * Endpoint: GET /console/api/workspaces/current/default-model?model_type=text-embedding
 */
export interface DefaultModelResponse {
  model: string
  provider: string
}

/**
 * Model status enum
 * Source: web/app/components/header/account-setting/model-provider-page/declarations.ts
 */
export type ModelStatus = 'active' | 'no-configure' | 'quota-exceeded' | 'no-permission' | 'disabled' | 'credential-removed'

/**
 * Individual model within a provider
 */
export interface ModelItem {
  model: string
  model_type: ModelType
  features?: string[] | null
  fetch_from?: string
  deprecated?: boolean
}

/**
 * Provider with models from model list API
 * Endpoint: GET /console/api/workspaces/current/models/model-types/{type}
 */
export interface ProviderWithModels {
  provider: string
  status: ModelStatus
  models: ModelItem[]
}

/**
 * Check if embedding model is available
 * null response means no default model is configured
 */
export type DefaultModelResult = DefaultModelResponse | null
