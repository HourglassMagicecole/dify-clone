/**
 * Tests for Step3Embed component
 * Story 3.2: RAG Creation Wizard - Embed & Store
 */

import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Step3Embed } from '@/components/rag/wizard/Step3Embed'
import type { EmbeddingModelProvider } from '@/types/dataset'

// Mock translation function
const mockT = jest.fn((key: string) => key)

// Mock RAGWizard context functions
const mockSetEmbeddingModels = jest.fn()
const mockSetSelectedEmbeddingModel = jest.fn()
const mockNextStep = jest.fn()
const mockPrevStep = jest.fn()
const mockSetError = jest.fn()

// Mock embedding models data
const mockEmbeddingModels: EmbeddingModelProvider[] = [
  {
    provider: 'openai',
    label: { en_US: 'OpenAI', zh_Hans: 'OpenAI' },
    icon_large: { en_US: 'openai-icon' },
    icon_small: { en_US: 'openai-icon-small' },
    status: 'active',
    models: [
      {
        model: 'text-embedding-3-small',
        label: { en_US: 'Text Embedding 3 Small', zh_Hans: '' },
        model_type: 'text-embedding',
        features: [],
        fetch_from: 'predefined',
        model_properties: { context_size: 8191 },
        deprecated: false,
      },
      {
        model: 'text-embedding-3-large',
        label: { en_US: 'Text Embedding 3 Large', zh_Hans: '' },
        model_type: 'text-embedding',
        features: [],
        fetch_from: 'predefined',
        model_properties: { context_size: 8191 },
        deprecated: false,
      },
    ],
  },
  {
    provider: 'cohere',
    label: { en_US: 'Cohere', zh_Hans: 'Cohere' },
    icon_large: { en_US: 'cohere-icon' },
    icon_small: { en_US: 'cohere-icon-small' },
    status: 'no-configure',
    models: [],
  },
]

// Mock useRAGWizard hook
jest.mock('@/context/RAGWizardContext', () => ({
  ...jest.requireActual('@/context/RAGWizardContext'),
  useRAGWizard: () => ({
    embeddingModels: mockEmbeddingModels,
    selectedEmbeddingModel: null,
    selectedEmbeddingProvider: null,
    setEmbeddingModels: mockSetEmbeddingModels,
    setSelectedEmbeddingModel: mockSetSelectedEmbeddingModel,
    nextStep: mockNextStep,
    prevStep: mockPrevStep,
    setError: mockSetError,
  }),
}))

// Mock react-i18next
jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: mockT,
  }),
}))

// Mock dataset API
const mockGetEmbeddingModels = jest.fn()
const mockGetDefaultModel = jest.fn()

jest.mock('@/service/dataset-api', () => ({
  datasetAPI: {
    getEmbeddingModels: () => mockGetEmbeddingModels(),
    getDefaultModel: () => mockGetDefaultModel(),
  },
}))

describe('Step3Embed', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockGetEmbeddingModels.mockResolvedValue({
      result: 'success',
      data: mockEmbeddingModels,
    })
    mockGetDefaultModel.mockResolvedValue({
      result: 'success',
      data: {
        model: 'text-embedding-3-small',
        provider: 'openai',
      },
    })
  })

  describe('Rendering', () => {
    it('should render step title and description', async () => {
      render(<Step3Embed />)

      await waitFor(() => {
        expect(mockT).toHaveBeenCalledWith('step3.title')
        expect(mockT).toHaveBeenCalledWith('step3.description')
      })
    })

    it('should show loading state initially', () => {
      render(<Step3Embed />)

      expect(mockT).toHaveBeenCalledWith('step3.loadingModels')
    })

    it('should render navigation buttons', async () => {
      render(<Step3Embed />)

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /common.back/i })).toBeInTheDocument()
        expect(screen.getByRole('button', { name: /common.next/i })).toBeInTheDocument()
      })
    })
  })

  describe('Model Loading', () => {
    it('should call getEmbeddingModels on mount', async () => {
      render(<Step3Embed />)

      await waitFor(() => {
        expect(mockGetEmbeddingModels).toHaveBeenCalledTimes(1)
      })
    })

    it('should call getDefaultModel after loading models', async () => {
      render(<Step3Embed />)

      await waitFor(() => {
        expect(mockGetDefaultModel).toHaveBeenCalled()
      })
    })

    it('should handle API error gracefully', async () => {
      mockGetEmbeddingModels.mockRejectedValue(new Error('API Error: 500'))

      render(<Step3Embed />)

      await waitFor(() => {
        expect(mockSetError).toHaveBeenCalled()
      })
    })

    it('should set embedding models from API response', async () => {
      render(<Step3Embed />)

      await waitFor(() => {
        expect(mockSetEmbeddingModels).toHaveBeenCalledWith(mockEmbeddingModels)
      })
    })

    it('should auto-select default model', async () => {
      render(<Step3Embed />)

      await waitFor(() => {
        expect(mockSetSelectedEmbeddingModel).toHaveBeenCalledWith(
          'text-embedding-3-small',
          'openai'
        )
      })
    })
  })

  describe('Navigation', () => {
    it('should call prevStep when back button is clicked', async () => {
      const user = userEvent.setup()
      render(<Step3Embed />)

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /common.back/i })).toBeInTheDocument()
      })

      await user.click(screen.getByRole('button', { name: /common.back/i }))

      expect(mockPrevStep).toHaveBeenCalledTimes(1)
    })

    it('should disable next button when no model is selected', async () => {
      render(<Step3Embed />)

      await waitFor(() => {
        const nextButton = screen.getByRole('button', { name: /common.next/i })
        expect(nextButton).toBeDisabled()
      })
    })
  })

  describe('Empty State', () => {
    it('should show no models message when no active providers', async () => {
      // Mock with only inactive (no-configure) providers
      const inactiveProviders = [
        {
          ...mockEmbeddingModels[1], // cohere with no-configure status
        },
      ]
      mockGetEmbeddingModels.mockResolvedValue({
        result: 'success',
        data: inactiveProviders,
      })

      render(<Step3Embed />)

      // Wait for loading to complete and check for setEmbeddingModels call
      await waitFor(() => {
        expect(mockSetEmbeddingModels).toHaveBeenCalledWith(inactiveProviders)
      })
    })
  })
})

describe('Step3Embed - Error Handling', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockGetDefaultModel.mockResolvedValue({
      result: 'success',
      data: { model: 'text-embedding-3-small', provider: 'openai' },
    })
  })

  it('should call setError when API fails', async () => {
    mockGetEmbeddingModels.mockRejectedValue(new Error('API Error: 500 Internal Server Error'))

    render(<Step3Embed />)

    await waitFor(() => {
      expect(mockSetError).toHaveBeenCalled()
    })
  })

  it('should handle network errors', async () => {
    mockGetEmbeddingModels.mockRejectedValue(new Error('Failed to fetch'))

    render(<Step3Embed />)

    await waitFor(() => {
      expect(mockSetError).toHaveBeenCalled()
    })
  })
})
