/**
 * Dataset API Client
 * Story 3.1: RAG Creation Wizard - Load & Split
 *
 * Wraps Dify's native Dataset/File APIs for use in MAI Studio
 */

import { apiClient, type ApiResponse } from './base-api'
import { getAccessToken } from '@/utils/storage'
import type {
  Dataset,
  DatasetListResponse,
  CreateDatasetRequest,
  ProcessRuleResponse,
  FileUploadResponse,
  UploadConfig,
  IndexingEstimateRequest,
  IndexingEstimateResponse,
  ModelType,
  DefaultModelResponse,
  ProviderWithModels,
  // Story 3.2: Embed & Store types
  EmbeddingModelProvider,
  DatasetInitRequest,
  DatasetInitResponse,
  BatchIndexingStatusResponse,
  // Dataset Detail Page types
  DocumentListResponse,
  DocumentInfo,
  SegmentListResponse,
  // Story 3.3: RAG List and Management types
  UpdateDatasetRequest,
  DeleteDocumentResponse,
  CreateDocumentByFileRequest,
  CreateDocumentResponse,
  // Story 3.4: RAG Search Test Interface types
  HitTestingRequest,
  HitTestingResponse,
} from '@/types/dataset'

// ============================================================================
// Task 2.1: Dataset API 클라이언트 파일 생성
// ============================================================================

const API_BASE_URL = (() => {
  const envUrl = process.env.NEXT_PUBLIC_API_BASE_URL
  if (envUrl !== undefined) {
    return envUrl
  }
  return 'http://localhost:5001'
})()

export class DatasetAPI {
  /**
   * Get datasets list
   * Endpoint: GET /console/api/datasets
   */
  async getDatasets(params?: {
    page?: number
    limit?: number
    keyword?: string
    session_id?: string
  }): Promise<ApiResponse<DatasetListResponse>> {
    const searchParams = new URLSearchParams()
    if (params?.page) searchParams.append('page', params.page.toString())
    if (params?.limit) searchParams.append('limit', params.limit.toString())
    if (params?.keyword) searchParams.append('keyword', params.keyword)
    if (params?.session_id) searchParams.append('session_id', params.session_id)

    const query = searchParams.toString()
    return apiClient.getDifyNative(`/console/api/datasets${query ? `?${query}` : ''}`)
  }

  /**
   * Get single dataset
   * Endpoint: GET /console/api/datasets/:id
   */
  async getDataset(datasetId: string): Promise<ApiResponse<Dataset>> {
    return apiClient.getDifyNative(`/console/api/datasets/${datasetId}`)
  }

  /**
   * Create new dataset
   * Endpoint: POST /console/api/datasets
   */
  async createDataset(data: CreateDatasetRequest): Promise<ApiResponse<Dataset>> {
    return apiClient.postDifyNative('/console/api/datasets', data)
  }

  /**
   * Delete dataset
   * Endpoint: DELETE /console/api/datasets/{id}
   *
   * WARNING: This also deletes all associated vectors from the vector database
   *
   * @param datasetId - Dataset ID to delete
   * @returns Promise<void>
   */
  async deleteDataset(datasetId: string): Promise<ApiResponse<void>> {
    return apiClient.deleteDifyNative(`/console/api/datasets/${datasetId}`)
  }

  // ============================================================================
  // Story 3.3: RAG List and Management API methods
  // ============================================================================

  /**
   * Update dataset metadata
   * Endpoint: PATCH /console/api/datasets/{id}
   *
   * @param datasetId - Dataset ID to update
   * @param data - Fields to update (name, description, etc.)
   * @returns Promise<Dataset> - Updated dataset
   */
  async updateDataset(
    datasetId: string,
    data: UpdateDatasetRequest
  ): Promise<ApiResponse<Dataset>> {
    return apiClient.patchDifyNative(`/console/api/datasets/${datasetId}`, data)
  }

  // ============================================================================
  // Task 2.2: ProcessRule API 메서드 추가
  // ============================================================================

  /**
   * Get default process rules
   * Endpoint: GET /console/api/datasets/process-rule
   * Optional: ?document_id=xxx for existing document rules
   */
  async getProcessRule(documentId?: string): Promise<ApiResponse<ProcessRuleResponse>> {
    const query = documentId ? `?document_id=${documentId}` : ''
    return apiClient.getDifyNative(`/console/api/datasets/process-rule${query}`)
  }

  /**
   * Get upload configuration
   * Endpoint: GET /console/api/files/upload
   */
  async getUploadConfig(): Promise<ApiResponse<UploadConfig>> {
    return apiClient.getDifyNative('/console/api/files/upload')
  }

  // ============================================================================
  // Task 2.3: 파일 업로드 메서드 구현
  // ============================================================================

  /**
   * Upload file for dataset
   * Endpoint: POST /console/api/files/upload
   *
   * @param file - File to upload
   * @param onProgress - Progress callback (0-100)
   * @returns Promise<FileUploadResponse>
   *
   * Note: Uses XMLHttpRequest for progress tracking
   * Form fields: file (File), source ('datasets')
   */
  async uploadFile(
    file: File,
    onProgress?: (progress: number) => void
  ): Promise<FileUploadResponse> {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest()
      const formData = new FormData()

      // Dify expects 'file' field and 'source' field
      formData.append('file', file)
      formData.append('source', 'datasets')

      // Progress event
      xhr.upload.addEventListener('progress', (event) => {
        if (event.lengthComputable && onProgress) {
          const progress = Math.round((event.loaded / event.total) * 100)
          onProgress(progress)
        }
      })

      // Load event (success)
      xhr.addEventListener('load', () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            const response = JSON.parse(xhr.responseText) as FileUploadResponse
            resolve(response)
          } catch {
            reject(new Error('Failed to parse response'))
          }
        } else {
          reject(new Error(`Upload failed: ${xhr.status} ${xhr.statusText}`))
        }
      })

      // Error event
      xhr.addEventListener('error', () => {
        reject(new Error('Network error during upload'))
      })

      // Abort event
      xhr.addEventListener('abort', () => {
        reject(new Error('Upload aborted'))
      })

      // Get token from cookie storage
      const token = getAccessToken()

      xhr.open('POST', `${API_BASE_URL}/console/api/files/upload`)
      if (token) {
        xhr.setRequestHeader('Authorization', `Bearer ${token}`)
      }
      xhr.send(formData)
    })
  }

  // ============================================================================
  // Task 5.2: Indexing Estimate API 메서드 추가 (Preview Chunk)
  // ============================================================================

  /**
   * Get indexing estimate for preview chunk
   * Endpoint: POST /console/api/datasets/indexing-estimate
   *
   * @param request - Indexing estimate request parameters
   * @returns Promise<IndexingEstimateResponse> with preview chunks
   */
  async getIndexingEstimate(request: IndexingEstimateRequest): Promise<ApiResponse<IndexingEstimateResponse>> {
    return apiClient.postDifyNative('/console/api/datasets/indexing-estimate', request)
  }

  // ============================================================================
  // Task 5 Enhancement: Default Model API
  // ============================================================================

  /**
   * Get default model for a specific model type
   * Endpoint: GET /console/api/workspaces/current/default-model?model_type={type}
   *
   * @param modelType - Type of model (e.g., 'text-embedding')
   * @returns Promise<DefaultModelResponse | null> - null if no default model configured
   */
  async getDefaultModel(modelType: ModelType): Promise<ApiResponse<DefaultModelResponse | null>> {
    return apiClient.getDifyNative(`/console/api/workspaces/current/default-model?model_type=${modelType}`)
  }

  /**
   * Get model list for a specific model type
   * Endpoint: GET /console/api/workspaces/current/models/model-types/{type}
   *
   * @param modelType - Type of model (e.g., 'text-embedding')
   * @returns Promise<ProviderWithModels[]> - List of providers with models
   */
  async getModelList(modelType: ModelType): Promise<ApiResponse<ProviderWithModels[]>> {
    return apiClient.getDifyNative(`/console/api/workspaces/current/models/model-types/${modelType}`)
  }

  /**
   * Check if embedding model is available and active
   * Checks if there is at least one active provider with embedding models
   */
  async isEmbeddingModelAvailable(): Promise<boolean> {
    try {
      const modelListResponse = await this.getModelList('text-embedding')

      if (modelListResponse.result !== 'success' || !modelListResponse.data) {
        return false
      }

      // Check if any active provider has at least one embedding model
      for (const provider of modelListResponse.data) {
        if (provider.status === 'active' && provider.models.length > 0) {
          return true
        }
      }

      return false
    } catch {
      return false
    }
  }

  // ============================================================================
  // Story 3.2: Embed & Store API methods
  // ============================================================================

  /**
   * Get available embedding models with provider info
   * Endpoint: GET /console/api/workspaces/current/models/model-types/text-embedding
   *
   * @returns Promise<EmbeddingModelProvider[]> - List of providers with their embedding models
   */
  async getEmbeddingModels(): Promise<ApiResponse<EmbeddingModelProvider[]>> {
    return apiClient.getDifyNative('/console/api/workspaces/current/models/model-types/text-embedding')
  }

  /**
   * Initialize dataset with documents (creates dataset + starts indexing)
   * Endpoint: POST /console/api/datasets/init
   *
   * This is the main API for Step 4 Store:
   * 1. Creates a new Dataset
   * 2. Creates Documents from uploaded files
   * 3. Starts async indexing via Celery
   *
   * @param request - Dataset initialization parameters
   * @returns Promise<DatasetInitResponse> - Created dataset, documents, and batch ID
   */
  async initDataset(request: DatasetInitRequest): Promise<ApiResponse<DatasetInitResponse>> {
    return apiClient.postDifyNative('/console/api/datasets/init', request)
  }

  /**
   * Get batch indexing status for monitoring progress
   * Endpoint: GET /console/api/datasets/{dataset_id}/batch/{batch}/indexing-status
   *
   * Poll this API every 2 seconds to track embedding generation progress
   *
   * @param datasetId - Dataset ID
   * @param batchId - Batch ID returned from initDataset()
   * @returns Promise<BatchIndexingStatusResponse> - Status of all documents in batch
   */
  async getBatchIndexingStatus(
    datasetId: string,
    batchId: string
  ): Promise<ApiResponse<BatchIndexingStatusResponse>> {
    return apiClient.getDifyNative(
      `/console/api/datasets/${datasetId}/batch/${batchId}/indexing-status`
    )
  }

  // ============================================================================
  // Document & Segment APIs (for Dataset Detail Page)
  // ============================================================================

  /**
   * Get documents in a dataset with pagination
   * Endpoint: GET /console/api/datasets/{dataset_id}/documents
   */
  async getDocuments(
    datasetId: string,
    params?: { page?: number; limit?: number; keyword?: string }
  ): Promise<ApiResponse<DocumentListResponse>> {
    const searchParams = new URLSearchParams()
    if (params?.page) searchParams.append('page', params.page.toString())
    if (params?.limit) searchParams.append('limit', params.limit.toString())
    if (params?.keyword) searchParams.append('keyword', params.keyword)

    const query = searchParams.toString()
    // Use getDifyNativeFull to preserve pagination metadata (total, page, etc.)
    return apiClient.getDifyNativeFull(
      `/console/api/datasets/${datasetId}/documents${query ? `?${query}` : ''}`
    )
  }

  /**
   * Get segments (chunks) in a document with pagination
   * Endpoint: GET /console/api/datasets/{dataset_id}/documents/{document_id}/segments
   */
  async getSegments(
    datasetId: string,
    documentId: string,
    params?: { page?: number; limit?: number; keyword?: string }
  ): Promise<ApiResponse<SegmentListResponse>> {
    const searchParams = new URLSearchParams()
    if (params?.page) searchParams.append('page', params.page.toString())
    if (params?.limit) searchParams.append('limit', params.limit.toString())
    if (params?.keyword) searchParams.append('keyword', params.keyword)

    const query = searchParams.toString()
    // Use getDifyNativeFull to preserve pagination metadata (total, page, etc.)
    return apiClient.getDifyNativeFull(
      `/console/api/datasets/${datasetId}/documents/${documentId}/segments${query ? `?${query}` : ''}`
    )
  }

  // ============================================================================
  // Story 3.3 Extension: Document Management APIs
  // ============================================================================

  /**
   * Delete a document from dataset
   * Endpoint: DELETE /console/api/datasets/{dataset_id}/documents/{document_id}
   *
   * WARNING: This permanently deletes the document and its vectors
   *
   * @param datasetId - Dataset ID
   * @param documentId - Document ID to delete
   */
  async deleteDocument(
    datasetId: string,
    documentId: string
  ): Promise<ApiResponse<DeleteDocumentResponse>> {
    return apiClient.deleteDifyNative(
      `/console/api/datasets/${datasetId}/documents/${documentId}`
    )
  }

  /**
   * Add a document to existing dataset
   * Endpoint: POST /console/api/datasets/{dataset_id}/documents
   *
   * @param datasetId - Dataset ID to add document to
   * @param request - Document creation parameters
   * @returns Promise<CreateDocumentResponse> - Created documents and batch ID
   */
  async createDocumentByFile(
    datasetId: string,
    request: CreateDocumentByFileRequest
  ): Promise<ApiResponse<CreateDocumentResponse>> {
    return apiClient.postDifyNative(
      `/console/api/datasets/${datasetId}/documents`,
      request
    )
  }

  /**
   * Get single document info
   * Endpoint: GET /console/api/datasets/{dataset_id}/documents/{document_id}
   */
  async getDocument(
    datasetId: string,
    documentId: string
  ): Promise<ApiResponse<DocumentInfo>> {
    return apiClient.getDifyNative(
      `/console/api/datasets/${datasetId}/documents/${documentId}`
    )
  }

  // ============================================================================
  // Story 3.4: RAG Search Test Interface API methods
  // ============================================================================

  /**
   * Perform hit testing (retrieval test) on a dataset
   * Endpoint: POST /console/api/datasets/{dataset_id}/hit-testing
   *
   * @param datasetId - Dataset ID
   * @param request - Hit testing request with query and retrieval options
   * @returns Promise<HitTestingResponse> - Query and matching records with scores
   */
  async hitTesting(
    datasetId: string,
    request: HitTestingRequest
  ): Promise<ApiResponse<HitTestingResponse>> {
    return apiClient.postDifyNative(
      `/console/api/datasets/${datasetId}/hit-testing`,
      request
    )
  }

  // ============================================================================
  // Story 3.5: Connect RAG to Agent API methods
  // ============================================================================

  /**
   * Get available datasets for agent connection
   * Returns only datasets owned by the agent owner that are ready for use
   *
   * @param sessionId - Session ID for filtering
   * @param agentOwnerId - Agent owner's account ID (created_by)
   *   - Create mode: current user ID
   *   - Edit mode: Agent's created_by field
   * @returns Promise<Dataset[]> - List of available datasets
   */
  async getAvailableDatasets(
    sessionId?: string,
    agentOwnerId?: string
  ): Promise<ApiResponse<Dataset[]>> {
    const response = await this.getDatasets({
      session_id: sessionId,
      limit: 100,
    })

    // Handle response - data can be either Dataset[] directly or { data: Dataset[], ... }
    // getDifyNative returns the data directly as an array
    const datasets: Dataset[] = Array.isArray(response.data)
      ? response.data
      : response.data?.data ?? []

    if (response.result === 'success' && datasets.length > 0) {
      // Filter datasets:
      // 1. Owned by agent owner (agentOwnerId) - if provided
      // 2. Has at least one document (document_count > 0)
      // Note: embedding_available check removed - datasets with docs are usable
      const availableDatasets = datasets.filter(dataset => {
        const isOwnedByAgentOwner = agentOwnerId
          ? dataset.created_by === agentOwnerId
          : true
        const isReady = dataset.document_count > 0
        return isOwnedByAgentOwner && isReady
      })

      return {
        result: 'success',
        data: availableDatasets,
      }
    }

    // Empty data case
    if (response.result === 'success') {
      return {
        result: 'success',
        data: [],
      }
    }

    // Error case
    return {
      result: response.result,
      message: response.message,
      data: [],
    }
  }
}

export const datasetAPI = new DatasetAPI()
