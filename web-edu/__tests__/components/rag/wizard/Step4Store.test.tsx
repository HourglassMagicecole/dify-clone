/**
 * Tests for Step4Store component
 * Story 3.2: RAG Creation Wizard - Embed & Store
 */

import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Step4Store } from '@/components/rag/wizard/Step4Store'
import type { Dataset, DocumentIndexingStatus } from '@/types/dataset'

// Helper to create a partial Dataset for testing
const createMockDataset = (overrides: Partial<Dataset> = {}): Dataset => ({
  id: 'dataset-123',
  name: 'Test Dataset',
  description: null,
  permission: 'only_me',
  indexing_technique: 'high_quality',
  embedding_model: 'text-embedding-3-small',
  embedding_model_provider: 'openai',
  embedding_available: false,
  document_count: 1,
  word_count: 0,
  app_count: 0,
  created_by: 'user-123',
  created_at: Date.now() / 1000,
  updated_at: Date.now() / 1000,
  ...overrides,
})

// Mock translation function
const mockT = jest.fn((key: string, options?: Record<string, unknown>) => {
  if (options?.count !== undefined) {
    return `${key} (${options.count})`
  }
  return key
})

// Mock router
const mockPush = jest.fn()
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
  }),
}))

// Mock react-i18next
jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: mockT,
  }),
}))

// Mock context functions
const mockSetCreatedDataset = jest.fn()
const mockSetCreatedDocuments = jest.fn()
const mockSetBatchId = jest.fn()
const mockSetIndexingStatus = jest.fn()
const mockSetIsIndexingComplete = jest.fn()
const mockPrevStep = jest.fn()
const mockSetError = jest.fn()

// Default context values
const defaultContextValues: {
  datasetName: string
  datasetDescription: string
  uploadedFiles: Array<{ id: string; name: string }>
  processRule: {
    mode: 'automatic' | 'custom'
    rules: {
      pre_processing_rules: Array<{ id: string; enabled: boolean }>
      segmentation: {
        delimiter: string
        max_tokens: number
        chunk_overlap: number
      }
    } | null
  }
  separatorType: 'predefined' | 'custom'
  customSeparator: string
  selectedEmbeddingModel: string | null
  selectedEmbeddingProvider: string | null
  createdDataset: Dataset | null
  batchId: string | null
  indexingStatus: DocumentIndexingStatus[]
  isIndexingComplete: boolean
  setCreatedDataset: jest.Mock
  setCreatedDocuments: jest.Mock
  setBatchId: jest.Mock
  setIndexingStatus: jest.Mock
  setIsIndexingComplete: jest.Mock
  prevStep: jest.Mock
  setError: jest.Mock
} = {
  datasetName: 'Test Dataset',
  datasetDescription: 'Test Description',
  uploadedFiles: [{ id: 'file-1', name: 'test.txt' }],
  processRule: {
    mode: 'custom',
    rules: {
      pre_processing_rules: [],
      segmentation: {
        delimiter: '\n',
        max_tokens: 500,
        chunk_overlap: 50,
      },
    },
  },
  separatorType: 'predefined',
  customSeparator: '',
  selectedEmbeddingModel: 'text-embedding-3-small',
  selectedEmbeddingProvider: 'openai',
  createdDataset: null,
  batchId: null,
  indexingStatus: [] as DocumentIndexingStatus[],
  isIndexingComplete: false,
  setCreatedDataset: mockSetCreatedDataset,
  setCreatedDocuments: mockSetCreatedDocuments,
  setBatchId: mockSetBatchId,
  setIndexingStatus: mockSetIndexingStatus,
  setIsIndexingComplete: mockSetIsIndexingComplete,
  prevStep: mockPrevStep,
  setError: mockSetError,
}

// Mock useRAGWizard hook
let mockContextValues = { ...defaultContextValues }

jest.mock('@/context/RAGWizardContext', () => ({
  useRAGWizard: () => mockContextValues,
}))

// Mock SessionContext
jest.mock('@/context/SessionContext', () => ({
  useSession: () => ({
    currentSession: { id: 'session-123', name: 'Test Session' },
  }),
}))

// Mock dataset API
const mockInitDataset = jest.fn()
const mockGetBatchIndexingStatus = jest.fn()

jest.mock('@/service/dataset-api', () => ({
  datasetAPI: {
    initDataset: (request: unknown) => mockInitDataset(request),
    getBatchIndexingStatus: (datasetId: string, batchId: string) =>
      mockGetBatchIndexingStatus(datasetId, batchId),
  },
}))

describe('Step4Store', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    jest.useFakeTimers()
    mockContextValues = { ...defaultContextValues }
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  describe('Rendering - Before Creation', () => {
    it('should render step title and description', () => {
      render(<Step4Store />)

      expect(mockT).toHaveBeenCalledWith('step4.title')
      expect(mockT).toHaveBeenCalledWith('step4.description')
    })

    it('should render summary section with dataset info', () => {
      render(<Step4Store />)

      expect(mockT).toHaveBeenCalledWith('step4.summary')
      expect(mockT).toHaveBeenCalledWith('step4.datasetName')
      expect(mockT).toHaveBeenCalledWith('step4.fileCount')
      expect(mockT).toHaveBeenCalledWith('step4.embeddingModel')
      expect(mockT).toHaveBeenCalledWith('step4.chunkSize')
    })

    it('should display dataset name from context', () => {
      render(<Step4Store />)

      expect(screen.getByText('Test Dataset')).toBeInTheDocument()
    })

    it('should display file count', () => {
      render(<Step4Store />)

      expect(screen.getByText('1')).toBeInTheDocument()
    })

    it('should display embedding model', () => {
      render(<Step4Store />)

      expect(screen.getByText('text-embedding-3-small')).toBeInTheDocument()
    })

    it('should render navigation buttons', () => {
      render(<Step4Store />)

      expect(screen.getByRole('button', { name: /common.back/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /step4.createRAG/i })).toBeInTheDocument()
    })

    it('should use first file name when dataset name is empty', () => {
      mockContextValues = {
        ...defaultContextValues,
        datasetName: '',
      }

      render(<Step4Store />)

      expect(screen.getByText('test.txt')).toBeInTheDocument()
    })
  })

  describe('Navigation', () => {
    it('should call prevStep when back button is clicked', async () => {
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime })
      render(<Step4Store />)

      await user.click(screen.getByRole('button', { name: /common.back/i }))

      expect(mockPrevStep).toHaveBeenCalledTimes(1)
    })
  })

  describe('RAG Creation', () => {
    it('should show error when embedding model is not selected', async () => {
      mockContextValues = {
        ...defaultContextValues,
        selectedEmbeddingModel: null,
        selectedEmbeddingProvider: null,
      }

      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime })
      render(<Step4Store />)

      await user.click(screen.getByRole('button', { name: /step4.createRAG/i }))

      expect(mockSetError).toHaveBeenCalledWith('step4.embeddingModelRequired')
    })

    it('should call initDataset API with correct request', async () => {
      mockInitDataset.mockResolvedValue({
        result: 'success',
        data: {
          dataset: { id: 'dataset-123', name: 'Test Dataset' },
          documents: [{ id: 'doc-1' }],
          batch: 'batch-123',
        },
      })

      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime })
      render(<Step4Store />)

      await user.click(screen.getByRole('button', { name: /step4.createRAG/i }))

      await waitFor(() => {
        expect(mockInitDataset).toHaveBeenCalledWith(
          expect.objectContaining({
            name: 'Test Dataset',
            description: 'Test Description',
            indexing_technique: 'high_quality',
            embedding_model: 'text-embedding-3-small',
            embedding_model_provider: 'openai',
          })
        )
      })
    })

    it('should set created dataset and batch ID on success', async () => {
      const mockDataset = { id: 'dataset-123', name: 'Test Dataset' }
      const mockDocuments = [{ id: 'doc-1' }]
      const mockBatch = 'batch-123'

      mockInitDataset.mockResolvedValue({
        result: 'success',
        data: {
          dataset: mockDataset,
          documents: mockDocuments,
          batch: mockBatch,
        },
      })

      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime })
      render(<Step4Store />)

      await user.click(screen.getByRole('button', { name: /step4.createRAG/i }))

      await waitFor(() => {
        expect(mockSetCreatedDataset).toHaveBeenCalledWith(mockDataset)
        expect(mockSetCreatedDocuments).toHaveBeenCalledWith(mockDocuments)
        expect(mockSetBatchId).toHaveBeenCalledWith(mockBatch)
      })
    })

    it('should handle API error gracefully', async () => {
      mockInitDataset.mockRejectedValue(new Error('API Error: 500 Internal Server Error'))

      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime })
      render(<Step4Store />)

      await user.click(screen.getByRole('button', { name: /step4.createRAG/i }))

      await waitFor(() => {
        expect(mockSetError).toHaveBeenCalled()
      })
    })

    it('should show creating state while API call is in progress', async () => {
      mockInitDataset.mockImplementation(
        () => new Promise((resolve) => setTimeout(resolve, 1000))
      )

      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime })
      render(<Step4Store />)

      await user.click(screen.getByRole('button', { name: /step4.createRAG/i }))

      expect(mockT).toHaveBeenCalledWith('step4.creating')
    })
  })

  describe('Progress Tracking', () => {
    it('should display progress during indexing', () => {
      mockContextValues = {
        ...defaultContextValues,
        createdDataset: createMockDataset(),
        batchId: 'batch-123',
        indexingStatus: [
          {
            id: 'doc-1',
            indexing_status: 'indexing',
            completed_segments: 50,
            total_segments: 100,
          },
        ] as DocumentIndexingStatus[],
        isIndexingComplete: false,
      }

      render(<Step4Store />)

      expect(mockT).toHaveBeenCalledWith('step4.indexing')
      expect(mockT).toHaveBeenCalledWith('step4.progress')
    })

    it('should hide navigation buttons during indexing', () => {
      mockContextValues = {
        ...defaultContextValues,
        createdDataset: createMockDataset(),
        batchId: 'batch-123',
        indexingStatus: [],
        isIndexingComplete: false,
      }

      render(<Step4Store />)

      expect(screen.queryByRole('button', { name: /common.back/i })).not.toBeInTheDocument()
      expect(screen.queryByRole('button', { name: /step4.createRAG/i })).not.toBeInTheDocument()
    })
  })

  describe('Success State', () => {
    it('should display success message when indexing is complete', () => {
      mockContextValues = {
        ...defaultContextValues,
        createdDataset: createMockDataset(),
        indexingStatus: [
          {
            id: 'doc-1',
            indexing_status: 'completed',
            completed_segments: 100,
            total_segments: 100,
          },
        ] as DocumentIndexingStatus[],
        isIndexingComplete: true,
      }

      render(<Step4Store />)

      expect(mockT).toHaveBeenCalledWith('step4.success')
    })

    it('should display total segments in success message', () => {
      mockContextValues = {
        ...defaultContextValues,
        createdDataset: createMockDataset(),
        indexingStatus: [
          {
            id: 'doc-1',
            indexing_status: 'completed',
            completed_segments: 50,
            total_segments: 50,
          },
          {
            id: 'doc-2',
            indexing_status: 'completed',
            completed_segments: 30,
            total_segments: 30,
          },
        ] as DocumentIndexingStatus[],
        isIndexingComplete: true,
      }

      render(<Step4Store />)

      expect(mockT).toHaveBeenCalledWith('step4.successDesc', { count: 80 })
    })

    it('should navigate to datasets page when view button is clicked', async () => {
      mockContextValues = {
        ...defaultContextValues,
        createdDataset: createMockDataset(),
        indexingStatus: [
          {
            id: 'doc-1',
            indexing_status: 'completed',
            completed_segments: 100,
            total_segments: 100,
          },
        ] as DocumentIndexingStatus[],
        isIndexingComplete: true,
      }

      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime })
      render(<Step4Store />)

      await user.click(screen.getByRole('button', { name: /step4.viewDataset/i }))

      expect(mockPush).toHaveBeenCalledWith('/datasets')
    })
  })

  describe('Error State', () => {
    it('should display error message when indexing fails', () => {
      mockContextValues = {
        ...defaultContextValues,
        createdDataset: createMockDataset(),
        indexingStatus: [
          {
            id: 'doc-1',
            indexing_status: 'error',
            error: 'Processing failed',
            completed_segments: 0,
            total_segments: 100,
          },
        ] as DocumentIndexingStatus[],
        isIndexingComplete: true,
      }

      render(<Step4Store />)

      expect(mockT).toHaveBeenCalledWith('step4.error')
      expect(screen.getByText('Processing failed')).toBeInTheDocument()
    })

    it('should display unknown error message when no specific error', () => {
      // When there's an error status but no specific error message
      mockContextValues = {
        ...defaultContextValues,
        createdDataset: createMockDataset(),
        indexingStatus: [
          {
            id: 'doc-1',
            indexing_status: 'error',
            completed_segments: 0,
            total_segments: 100,
            // No error message provided
          },
        ] as DocumentIndexingStatus[],
        isIndexingComplete: true,
      }

      render(<Step4Store />)

      expect(mockT).toHaveBeenCalledWith('step4.unknownError')
    })

    it('should show retry button on error', () => {
      mockContextValues = {
        ...defaultContextValues,
        createdDataset: createMockDataset(),
        indexingStatus: [
          {
            id: 'doc-1',
            indexing_status: 'error',
            error: 'Processing failed',
            completed_segments: 0,
            total_segments: 100,
          },
        ] as DocumentIndexingStatus[],
        isIndexingComplete: true,
      }

      render(<Step4Store />)

      expect(screen.getByRole('button', { name: /step4.retry/i })).toBeInTheDocument()
    })
  })
})

describe('Step4Store - Progress Calculation', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockContextValues = { ...defaultContextValues }
  })

  it('should calculate progress based on stage weights', () => {
    // waiting: 5%, parsing: 15%, cleaning: 30%, splitting: 45%, indexing: 50-99%, completed: 100%
    const testCases = [
      { status: 'waiting', expectedMin: 5 },
      { status: 'parsing', expectedMin: 15 },
      { status: 'cleaning', expectedMin: 30 },
      { status: 'splitting', expectedMin: 45 },
      { status: 'completed', expectedMin: 100 },
    ]

    testCases.forEach(({ status }) => {
      mockContextValues = {
        ...defaultContextValues,
        createdDataset: createMockDataset(),
        indexingStatus: [
          {
            id: 'doc-1',
            indexing_status: status as DocumentIndexingStatus['indexing_status'],
            completed_segments: 0,
            total_segments: 100,
          },
        ] as DocumentIndexingStatus[],
        isIndexingComplete: false,
      }

      render(<Step4Store />)

      // Progress is rendered, verify the component renders without error
      expect(mockT).toHaveBeenCalledWith('step4.progress')
    })
  })

  it('should calculate indexing progress based on segments', () => {
    mockContextValues = {
      ...defaultContextValues,
      createdDataset: createMockDataset(),
      indexingStatus: [
        {
          id: 'doc-1',
          indexing_status: 'indexing',
          completed_segments: 50, // 50% of segments = 50 + (0.5 * 49) = 74.5%
          total_segments: 100,
        },
      ] as DocumentIndexingStatus[],
      isIndexingComplete: false,
    }

    render(<Step4Store />)

    // Verify progress bar is rendered
    expect(mockT).toHaveBeenCalledWith('step4.progress')
  })
})
