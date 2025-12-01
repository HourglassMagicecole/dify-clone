/**
 * Dataset API Client
 * Story 3.1: RAG Creation Wizard - Load & Split
 *
 * Wraps Dify's native Dataset/File APIs for use in EduAI Studio
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
   * Endpoint: DELETE /console/api/datasets/:id
   */
  async deleteDataset(datasetId: string): Promise<ApiResponse<void>> {
    return apiClient.delete(`/console/api/datasets/${datasetId}`)
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
   * Checks both: 1) default model is configured, 2) provider status is 'active'
   */
  async isEmbeddingModelAvailable(): Promise<boolean> {
    try {
      // Step 1: Get default model
      const defaultModelResponse = await this.getDefaultModel('text-embedding')

      if (defaultModelResponse.result !== 'success' || defaultModelResponse.data == null || !defaultModelResponse.data.model) {
        return false
      }

      const defaultModel = defaultModelResponse.data.model

      // Step 2: Get model list to check provider status
      const modelListResponse = await this.getModelList('text-embedding')

      if (modelListResponse.result !== 'success' || !modelListResponse.data) {
        return false
      }

      // Step 3: Find the provider that contains the default model
      for (const provider of modelListResponse.data) {
        const modelFound = provider.models.some(m => m.model === defaultModel)
        if (modelFound) {
          return provider.status === 'active'
        }
      }

      return false
    } catch {
      return false
    }
  }
}

export const datasetAPI = new DatasetAPI()
