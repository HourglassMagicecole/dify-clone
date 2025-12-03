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
 * Story 3.1: LOAD, SPLIT
 * Story 3.2: EMBED, STORE 추가
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

  // Step 3: Embed (Story 3.2)
  selectedEmbeddingModel: string | null
  selectedEmbeddingProvider: string | null
  embeddingModels: EmbeddingModelProvider[]

  // Step 4: Store (Story 3.2)
  createdDataset: Dataset | null
  createdDocuments: DocumentInfo[]
  batchId: string | null
  indexingStatus: DocumentIndexingStatus[]
  isIndexingComplete: boolean

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
 * Provider info in default model response
 * The provider field can be either a string or an object depending on the API version
 */
export interface DefaultModelProviderInfo {
  provider: string
  label?: { en_US: string; zh_Hans?: string }
  icon_small?: { en_US: string; zh_Hans?: string }
  icon_large?: { en_US: string; zh_Hans?: string }
  supported_model_types?: ModelType[]
  models?: unknown[]
  tenant_id?: string
}

/**
 * Default model response from API
 * Endpoint: GET /console/api/workspaces/current/default-model?model_type=text-embedding
 * Note: provider can be string or object depending on API response
 */
export interface DefaultModelResponse {
  model: string
  model_type?: ModelType
  provider: string | DefaultModelProviderInfo
}

/**
 * Helper to extract provider ID from DefaultModelResponse
 */
export function getProviderIdFromDefault(provider: string | DefaultModelProviderInfo): string {
  if (typeof provider === 'string') {
    return provider
  }
  return provider.provider
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

// ============================================================================
// Task 11.1: File-specific chunk preview type
// ============================================================================

/**
 * File-specific chunk preview for per-file display
 * Allows users to view chunking results for each uploaded file separately
 */
export interface FileChunkPreview {
  fileId: string
  fileName: string
  chunks: ChunkPreview[]
  totalSegments: number
  isLoading: boolean
  error: string | null
}

// ============================================================================
// Task 12.1: Separator type for custom separator support
// ============================================================================

/**
 * Separator type for chunking
 * 'predefined': Use pre-defined separators (newline, double newline, etc.)
 * 'custom': User-defined custom separator string
 */
export type SeparatorType = 'predefined' | 'custom'

// ============================================================================
// Story 3.2: Embed & Store 타입 정의
// ============================================================================

// ----------------------------------------------------------------------------
// Task 1.1: 임베딩 모델 관련 타입
// ----------------------------------------------------------------------------

/**
 * Embedding model detailed info
 * Source: GET /console/api/workspaces/current/models/model-types/text-embedding
 */
export interface EmbeddingModelInfo {
  model: string
  label: {
    en_US: string
    zh_Hans?: string
  }
  model_type: 'text-embedding'
  features?: string[] | null
  fetch_from?: string
  deprecated?: boolean
  model_properties?: {
    context_size?: number
    max_chunks?: number
  }
}

/**
 * Model provider status
 */
export type ProviderStatus = 'active' | 'no-configure' | 'quota-exceeded' | 'no-permission'

/**
 * Provider with embedding models
 */
export interface EmbeddingModelProvider {
  provider: string
  label: {
    en_US: string
    zh_Hans?: string
  }
  icon_small?: {
    en_US: string
  }
  icon_large?: {
    en_US: string
  }
  status: ProviderStatus
  models: EmbeddingModelInfo[]
}

// ----------------------------------------------------------------------------
// Task 1.2: 인덱싱 상태 관련 타입
// ----------------------------------------------------------------------------

/**
 * Document indexing status
 * Endpoint: GET /console/api/datasets/{dataset_id}/documents/{document_id}/indexing-status
 */
export type DocumentStatus = 'waiting' | 'parsing' | 'cleaning' | 'splitting' | 'indexing' | 'completed' | 'error' | 'paused'

export interface DocumentIndexingStatus {
  id: string
  indexing_status: DocumentStatus
  processing_started_at: number | null
  parsing_completed_at: number | null
  cleaning_completed_at: number | null
  splitting_completed_at: number | null
  completed_at: number | null
  paused_at: number | null
  error: string | null
  stopped_at: number | null
  completed_segments: number
  total_segments: number
}

/**
 * Batch indexing status response
 * Endpoint: GET /console/api/datasets/{dataset_id}/batch/{batch}/indexing-status
 *
 * Note: The backend returns { "data": [...] }, but getDifyNative unwraps it,
 * so the actual response is an array of DocumentIndexingStatus
 */
export type BatchIndexingStatusResponse = DocumentIndexingStatus[]

// ----------------------------------------------------------------------------
// Task 1.3: Dataset 생성 요청/응답 타입
// ----------------------------------------------------------------------------

/**
 * Dataset initialization request (with documents)
 * Endpoint: POST /console/api/datasets/init
 * Source: api/controllers/console/datasets/datasets_document.py - DatasetInitApi
 * Source: api/services/entities/knowledge_entities/knowledge_entities.py - KnowledgeConfig
 */
export interface DatasetInitRequest {
  name?: string
  description?: string
  indexing_technique: IndexingTechnique
  data_source: {
    info_list: {
      data_source_type: DataSourceType
      file_info_list?: {
        file_ids: string[]
      }
      notion_info_list?: Array<{
        credential_id: string
        workspace_id: string
        pages: Array<{
          page_id: string
          page_name: string
          type: string
        }>
      }>
      website_info_list?: {
        provider: string
        job_id: string
        urls: string[]
        only_main_content?: boolean
      }
    }
  }
  process_rule: ProcessRuleForAPI
  doc_form: ChunkingMode
  doc_language: string
  retrieval_model?: {
    search_method: 'semantic_search' | 'full_text_search' | 'hybrid_search'
    reranking_enable: boolean
    reranking_model?: {
      reranking_provider_name: string
      reranking_model_name: string
    }
    top_k: number
    score_threshold_enabled: boolean
    score_threshold?: number
  }
  embedding_model: string
  embedding_model_provider: string
}

/**
 * Document info in response
 */
export interface DocumentInfo {
  id: string
  position: number
  data_source_type: DataSourceType
  data_source_info: {
    upload_file_id: string
  }
  dataset_process_rule_id: string
  name: string
  created_from: string
  created_by: string
  created_at: number
  tokens: number
  indexing_status: DocumentStatus
  error: string | null
  enabled: boolean
  disabled_at: number | null
  disabled_by: string | null
  archived: boolean
  display_status: string
  word_count: number
  hit_count: number
  doc_form: ChunkingMode
}

/**
 * Dataset initialization response
 * Endpoint: POST /console/api/datasets/init
 */
export interface DatasetInitResponse {
  dataset: Dataset
  documents: DocumentInfo[]
  batch: string
}

// ============================================================================
// Document List & Segment Types (for Dataset Detail Page)
// ============================================================================

/**
 * Document list response with pagination
 * Endpoint: GET /console/api/datasets/{dataset_id}/documents
 */
export interface DocumentListResponse {
  data: DocumentInfo[]
  has_more: boolean
  limit: number
  total: number
  page: number
}

/**
 * Segment (chunk) in a document
 * Endpoint: GET /console/api/datasets/{dataset_id}/documents/{document_id}/segments
 */
export interface Segment {
  id: string
  position: number
  document_id: string
  content: string
  sign_content: string | null
  answer: string | null
  word_count: number
  tokens: number
  keywords: string[]
  index_node_id: string
  index_node_hash: string
  hit_count: number
  enabled: boolean
  disabled_at: number | null
  disabled_by: string | null
  status: string
  created_by: string
  created_at: number
  updated_at: number
  updated_by: string | null
  indexing_at: number | null
  completed_at: number | null
  error: string | null
  stopped_at: number | null
  child_chunks?: ChildChunk[]
}

/**
 * Child chunk within a segment
 */
export interface ChildChunk {
  id: string
  segment_id: string
  content: string
  position: number
  word_count: number
  type: string
  created_at: number
  updated_at: number
}

/**
 * Segment list response with pagination
 * Endpoint: GET /console/api/datasets/{dataset_id}/documents/{document_id}/segments
 */
export interface SegmentListResponse {
  data: Segment[]
  limit: number
  total: number
  total_pages: number
  page: number
}
