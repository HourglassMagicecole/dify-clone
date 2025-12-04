/**
 * RAG Wizard Context - Manages state for multi-step RAG creation wizard
 * Story 3.1: Load & Split steps
 * Pattern: Based on AgentWizardContext.tsx
 */

'use client'

import React, { createContext, useContext, useState, useCallback, useMemo, useEffect, useRef } from 'react'
import { useAuth } from '@/hooks/useAuth'
import {
  RAGWizardStep,
  RAGWizardState,
  FileUploadResponse,
  FileUploadProgress,
  ProcessRule,
  DEFAULT_PROCESS_RULE,
  ChunkPreview,
  FileChunkPreview,
  SeparatorType,
  // Story 3.2: Embed & Store types
  EmbeddingModelProvider,
  Dataset,
  DocumentInfo,
  DocumentIndexingStatus,
} from '@/types/dataset'

// ============================================================================
// Task 4.1: Context 타입 및 초기 상태 정의
// ============================================================================

/**
 * Context value interface
 */
interface RAGWizardContextValue extends RAGWizardState {
  // Step 1: Load actions
  setDatasetName: (name: string) => void
  setDatasetDescription: (description: string) => void
  addUploadedFile: (file: FileUploadResponse) => void
  removeUploadedFile: (fileId: string) => void
  updateUploadProgress: (fileName: string, progress: Partial<Omit<FileUploadProgress, 'file'>>) => void
  addUploadProgress: (progress: FileUploadProgress) => void

  // Step 2: Split actions
  setProcessRule: (rule: ProcessRule) => void

  // Step 2: Preview Chunk actions (Task 5.3)
  previewChunks: ChunkPreview[]
  previewLoading: boolean
  previewError: string | null
  totalSegments: number
  setPreviewChunks: (chunks: ChunkPreview[], totalSegments: number) => void
  setPreviewLoading: (loading: boolean) => void
  setPreviewError: (error: string | null) => void
  clearPreview: () => void

  // Task 11.2: File-specific preview state
  previewByFile: FileChunkPreview[]
  setPreviewByFile: (previews: FileChunkPreview[]) => void
  updateFilePreview: (fileId: string, update: Partial<Omit<FileChunkPreview, 'fileId' | 'fileName'>>) => void
  clearPreviewByFile: () => void

  // Task 12.2: Separator type state
  separatorType: SeparatorType
  customSeparator: string
  setSeparatorType: (type: SeparatorType) => void
  setCustomSeparator: (separator: string) => void

  // Story 3.2 - Step 3: Embed actions
  embeddingModels: EmbeddingModelProvider[]
  selectedEmbeddingModel: string | null
  selectedEmbeddingProvider: string | null
  setEmbeddingModels: (models: EmbeddingModelProvider[]) => void
  setSelectedEmbeddingModel: (model: string | null, provider: string | null) => void

  // Story 3.2 - Step 4: Store actions
  createdDataset: Dataset | null
  createdDocuments: DocumentInfo[]
  batchId: string | null
  indexingStatus: DocumentIndexingStatus[]
  isIndexingComplete: boolean
  setCreatedDataset: (dataset: Dataset | null) => void
  setCreatedDocuments: (documents: DocumentInfo[]) => void
  setBatchId: (batchId: string | null) => void
  setIndexingStatus: (status: DocumentIndexingStatus[]) => void
  setIsIndexingComplete: (complete: boolean) => void

  // Navigation
  nextStep: () => void
  prevStep: () => void
  goToStep: (step: RAGWizardStep) => void

  // Common
  setLoading: (loading: boolean) => void
  setError: (error: string | null) => void
  resetWizard: () => void

  // Story 3.3: Draft management
  isDraft: boolean
  showDraftPrompt: boolean
  draftData: Partial<RAGWizardState> | null
  saveAsDraft: () => Promise<void>
  restoreDraft: () => void
  discardDraft: () => void
  clearDraft: () => void
}

/**
 * Initial state
 */
const initialState: RAGWizardState = {
  currentStep: RAGWizardStep.LOAD,
  // Step 1: Load
  datasetName: '',
  datasetDescription: '',
  uploadedFiles: [],
  uploadProgress: [],
  // Step 2: Split
  processRule: DEFAULT_PROCESS_RULE,
  // Step 3: Embed (Story 3.2)
  selectedEmbeddingModel: null,
  selectedEmbeddingProvider: null,
  embeddingModels: [],
  // Step 4: Store (Story 3.2)
  createdDataset: null,
  createdDocuments: [],
  batchId: null,
  indexingStatus: [],
  isIndexingComplete: false,
  // Common
  isLoading: false,
  error: null,
}

/**
 * Create context
 */
const RAGWizardContext = createContext<RAGWizardContextValue | undefined>(undefined)

/**
 * Custom hook to use RAG wizard context
 */
export function useRAGWizard(): RAGWizardContextValue {
  const context = useContext(RAGWizardContext)
  if (!context) {
    throw new Error('useRAGWizard must be used within RAGWizardProvider')
  }
  return context
}

// ============================================================================
// Task 4.2: Provider 컴포넌트 구현
// ============================================================================

/**
 * Provider component props
 */
interface RAGWizardProviderProps {
  children: React.ReactNode
}

/**
 * Provider component
 */
export function RAGWizardProvider({ children }: RAGWizardProviderProps): React.ReactElement {
  const { user } = useAuth()
  const [state, setState] = useState<RAGWizardState>(initialState)
  const hasLoadedRef = useRef(false)

  // Story 3.3: Draft management state
  const [isDraft, setIsDraft] = useState(false)
  const [showDraftPrompt, setShowDraftPrompt] = useState(false)
  const [draftData, setDraftData] = useState<Partial<RAGWizardState> | null>(null)

  // Task 5.3: Preview Chunk state
  const [previewChunks, setPreviewChunksState] = useState<ChunkPreview[]>([])
  const [previewLoading, setPreviewLoadingState] = useState(false)
  const [previewError, setPreviewErrorState] = useState<string | null>(null)
  const [totalSegments, setTotalSegments] = useState(0)

  // Task 11.2: File-specific preview state
  const [previewByFile, setPreviewByFileState] = useState<FileChunkPreview[]>([])

  // Task 12.2: Separator type state
  const [separatorType, setSeparatorTypeState] = useState<SeparatorType>('predefined')
  const [customSeparator, setCustomSeparatorState] = useState<string>('')

  // Story 3.2: Step 3 Embed state
  const [embeddingModels, setEmbeddingModelsState] = useState<EmbeddingModelProvider[]>([])
  const [selectedEmbeddingModel, setSelectedEmbeddingModelState] = useState<string | null>(null)
  const [selectedEmbeddingProvider, setSelectedEmbeddingProviderState] = useState<string | null>(null)

  // Story 3.2: Step 4 Store state
  const [createdDataset, setCreatedDatasetState] = useState<Dataset | null>(null)
  const [createdDocuments, setCreatedDocumentsState] = useState<DocumentInfo[]>([])
  const [batchId, setBatchIdState] = useState<string | null>(null)
  const [indexingStatus, setIndexingStatusState] = useState<DocumentIndexingStatus[]>([])
  const [isIndexingComplete, setIsIndexingCompleteState] = useState(false)

  // Step 1: Load actions
  const setDatasetName = useCallback((name: string) => {
    setState(prev => ({ ...prev, datasetName: name }))
  }, [])

  const setDatasetDescription = useCallback((description: string) => {
    setState(prev => ({ ...prev, datasetDescription: description }))
  }, [])

  const addUploadedFile = useCallback((file: FileUploadResponse) => {
    setState(prev => ({
      ...prev,
      uploadedFiles: [...prev.uploadedFiles, file],
    }))
  }, [])

  const removeUploadedFile = useCallback((fileId: string) => {
    setState(prev => ({
      ...prev,
      uploadedFiles: prev.uploadedFiles.filter(f => f.id !== fileId),
      uploadProgress: prev.uploadProgress.filter(p => p.response?.id !== fileId),
    }))
  }, [])

  const updateUploadProgress = useCallback((fileName: string, progress: Partial<Omit<FileUploadProgress, 'file'>>) => {
    setState(prev => {
      const existingIndex = prev.uploadProgress.findIndex(p => p.file.name === fileName)
      if (existingIndex >= 0) {
        const updated = [...prev.uploadProgress]
        const existing = prev.uploadProgress[existingIndex]
        if (existing) {
          updated[existingIndex] = {
            file: existing.file,
            progress: progress.progress ?? existing.progress,
            status: progress.status ?? existing.status,
            response: progress.response ?? existing.response,
            error: progress.error ?? existing.error,
          }
        }
        return { ...prev, uploadProgress: updated }
      }
      return prev
    })
  }, [])

  const addUploadProgress = useCallback((progress: FileUploadProgress) => {
    setState(prev => ({
      ...prev,
      uploadProgress: [...prev.uploadProgress, progress],
    }))
  }, [])

  // Step 2: Split actions
  const setProcessRule = useCallback((rule: ProcessRule) => {
    setState(prev => ({ ...prev, processRule: rule }))
  }, [])

  // Task 5.3: Preview Chunk actions
  const setPreviewChunks = useCallback((chunks: ChunkPreview[], total: number) => {
    setPreviewChunksState(chunks)
    setTotalSegments(total)
    setPreviewErrorState(null)
  }, [])

  const setPreviewLoading = useCallback((loading: boolean) => {
    setPreviewLoadingState(loading)
  }, [])

  const setPreviewError = useCallback((error: string | null) => {
    setPreviewErrorState(error)
    if (error) {
      setPreviewChunksState([])
      setTotalSegments(0)
    }
  }, [])

  const clearPreview = useCallback(() => {
    setPreviewChunksState([])
    setPreviewErrorState(null)
    setTotalSegments(0)
  }, [])

  // Task 11.2: File-specific preview actions
  const setPreviewByFile = useCallback((previews: FileChunkPreview[]) => {
    setPreviewByFileState(previews)
  }, [])

  const updateFilePreview = useCallback((fileId: string, update: Partial<Omit<FileChunkPreview, 'fileId' | 'fileName'>>) => {
    setPreviewByFileState(prev => prev.map(p =>
      p.fileId === fileId ? { ...p, ...update } : p
    ))
  }, [])

  const clearPreviewByFile = useCallback(() => {
    setPreviewByFileState([])
  }, [])

  // Task 12.2: Separator type actions
  const setSeparatorType = useCallback((type: SeparatorType) => {
    setSeparatorTypeState(type)
  }, [])

  const setCustomSeparator = useCallback((separator: string) => {
    setCustomSeparatorState(separator)
  }, [])

  // Story 3.2: Step 3 Embed actions
  const setEmbeddingModels = useCallback((models: EmbeddingModelProvider[]) => {
    setEmbeddingModelsState(models)
  }, [])

  const setSelectedEmbeddingModel = useCallback((model: string | null, provider: string | null) => {
    setSelectedEmbeddingModelState(model)
    setSelectedEmbeddingProviderState(provider)
  }, [])

  // Story 3.2: Step 4 Store actions
  const setCreatedDataset = useCallback((dataset: Dataset | null) => {
    setCreatedDatasetState(dataset)
  }, [])

  const setCreatedDocuments = useCallback((documents: DocumentInfo[]) => {
    setCreatedDocumentsState(documents)
  }, [])

  const setBatchId = useCallback((id: string | null) => {
    setBatchIdState(id)
  }, [])

  const setIndexingStatus = useCallback((status: DocumentIndexingStatus[]) => {
    setIndexingStatusState(status)
  }, [])

  const setIsIndexingComplete = useCallback((complete: boolean) => {
    setIsIndexingCompleteState(complete)
  }, [])

  // Navigation
  const nextStep = useCallback(() => {
    setState(prev => {
      // Story 3.2: LOAD -> SPLIT -> EMBED -> STORE
      if (prev.currentStep < RAGWizardStep.STORE) {
        return { ...prev, currentStep: prev.currentStep + 1 }
      }
      return prev
    })
  }, [])

  const prevStep = useCallback(() => {
    setState(prev => {
      if (prev.currentStep > RAGWizardStep.LOAD) {
        return { ...prev, currentStep: prev.currentStep - 1 }
      }
      return prev
    })
  }, [])

  const goToStep = useCallback((step: RAGWizardStep) => {
    setState(prev => ({ ...prev, currentStep: step }))
  }, [])

  // Common
  const setLoading = useCallback((loading: boolean) => {
    setState(prev => ({ ...prev, isLoading: loading }))
  }, [])

  const setError = useCallback((error: string | null) => {
    setState(prev => ({ ...prev, error }))
  }, [])

  // ============================================================================
  // Story 3.3: Draft management (localStorage persistence)
  // ============================================================================

  /**
   * Get localStorage key for current user
   */
  const localStorageKey = useMemo(() => {
    if (typeof window === 'undefined') {
      return 'rag-wizard-draft-anonymous'
    }
    const userId = user?.id || 'anonymous'
    return `rag-wizard-draft-${userId}`
  }, [user?.id])

  /**
   * Save to localStorage
   */
  const saveToLocalStorage = useCallback(() => {
    if (typeof window === 'undefined') {
      return
    }

    try {
      const data = {
        currentStep: state.currentStep,
        datasetName: state.datasetName,
        datasetDescription: state.datasetDescription,
        uploadedFiles: state.uploadedFiles,
        processRule: state.processRule,
        selectedEmbeddingModel,
        selectedEmbeddingProvider,
        separatorType,
        customSeparator,
        timestamp: new Date().toISOString(),
      }
      localStorage.setItem(localStorageKey, JSON.stringify(data))
    } catch (error) {
      console.error('Failed to save draft to localStorage:', error)
    }
  }, [state, localStorageKey, selectedEmbeddingModel, selectedEmbeddingProvider, separatorType, customSeparator])

  /**
   * Reset hasLoadedRef when localStorageKey changes (e.g., after user login)
   */
  useEffect(() => {
    hasLoadedRef.current = false
  }, [localStorageKey])

  /**
   * Load draft from localStorage on mount
   */
  useEffect(() => {
    if (typeof window === 'undefined' || hasLoadedRef.current) {
      return
    }

    hasLoadedRef.current = true

    try {
      const saved = localStorage.getItem(localStorageKey)

      if (saved) {
        const data = JSON.parse(saved)

        // Show draft restore prompt instead of auto-restoring
        setDraftData(data)
        setShowDraftPrompt(true)
      }
    } catch (error) {
      console.error('Failed to load draft from localStorage:', error)
    }
  }, [localStorageKey])

  /**
   * Save as draft (manual save with confirmation)
   */
  const saveAsDraft = useCallback(async () => {
    setState(prev => ({ ...prev, isLoading: true }))

    try {
      saveToLocalStorage()
      setIsDraft(true)
      setState(prev => ({ ...prev, isLoading: false }))
    } catch (error) {
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: 'Failed to save draft',
      }))
      throw error
    }
  }, [saveToLocalStorage])

  /**
   * Auto-save to localStorage when state changes (matching AgentWizardContext pattern)
   */
  useEffect(() => {
    // Skip if no meaningful data to save
    if (state.uploadedFiles.length === 0 && !state.datasetName && !state.datasetDescription) {
      return
    }

    saveToLocalStorage()
  }, [state.uploadedFiles, state.datasetName, state.datasetDescription, state.processRule, state.currentStep, selectedEmbeddingModel, selectedEmbeddingProvider, separatorType, customSeparator, saveToLocalStorage])

  /**
   * Restore draft from draftData
   */
  const restoreDraft = useCallback(() => {
    if (!draftData) {
      return
    }

    setState(prev => ({
      ...prev,
      currentStep: (draftData.currentStep as RAGWizardStep) || RAGWizardStep.LOAD,
      datasetName: (draftData.datasetName as string) || '',
      datasetDescription: (draftData.datasetDescription as string) || '',
      uploadedFiles: (draftData.uploadedFiles as FileUploadResponse[]) || [],
      processRule: (draftData.processRule as typeof DEFAULT_PROCESS_RULE) || DEFAULT_PROCESS_RULE,
    }))

    // Restore separate useState values
    // Use type assertion since draftData includes fields not in RAGWizardState
    const draft = draftData as Record<string, unknown>
    setSelectedEmbeddingModelState((draft.selectedEmbeddingModel as string | null) || null)
    setSelectedEmbeddingProviderState((draft.selectedEmbeddingProvider as string | null) || null)
    setSeparatorTypeState((draft.separatorType as SeparatorType) || 'predefined')
    setCustomSeparatorState((draft.customSeparator as string) || '')

    setIsDraft(true)
    setShowDraftPrompt(false)
    setDraftData(null)
  }, [draftData])

  /**
   * Discard draft and start fresh
   */
  const discardDraft = useCallback(() => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem(localStorageKey)
    }

    setShowDraftPrompt(false)
    setDraftData(null)
  }, [localStorageKey])

  /**
   * Clear draft from localStorage only (without resetting state)
   * Used after successful RAG creation
   */
  const clearDraft = useCallback(() => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem(localStorageKey)
    }
    setIsDraft(false)
  }, [localStorageKey])

  /**
   * Reset wizard state and clear localStorage draft
   */
  const resetWizard = useCallback(() => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem(localStorageKey)
    }
    setState(initialState)
    setIsDraft(false)
    setShowDraftPrompt(false)
    setDraftData(null)
  }, [localStorageKey])

  const value = useMemo<RAGWizardContextValue>(() => ({
    ...state,
    setDatasetName,
    setDatasetDescription,
    addUploadedFile,
    removeUploadedFile,
    updateUploadProgress,
    addUploadProgress,
    setProcessRule,
    // Task 5.3: Preview Chunk state and actions
    previewChunks,
    previewLoading,
    previewError,
    totalSegments,
    setPreviewChunks,
    setPreviewLoading,
    setPreviewError,
    clearPreview,
    // Task 11.2: File-specific preview state and actions
    previewByFile,
    setPreviewByFile,
    updateFilePreview,
    clearPreviewByFile,
    // Task 12.2: Separator type state and actions
    separatorType,
    customSeparator,
    setSeparatorType,
    setCustomSeparator,
    // Story 3.2: Step 3 Embed state and actions
    embeddingModels,
    selectedEmbeddingModel,
    selectedEmbeddingProvider,
    setEmbeddingModels,
    setSelectedEmbeddingModel,
    // Story 3.2: Step 4 Store state and actions
    createdDataset,
    createdDocuments,
    batchId,
    indexingStatus,
    isIndexingComplete,
    setCreatedDataset,
    setCreatedDocuments,
    setBatchId,
    setIndexingStatus,
    setIsIndexingComplete,
    // Navigation
    nextStep,
    prevStep,
    goToStep,
    setLoading,
    setError,
    resetWizard,
    // Story 3.3: Draft management
    isDraft,
    showDraftPrompt,
    draftData,
    saveAsDraft,
    restoreDraft,
    discardDraft,
    clearDraft,
  }), [
    state,
    setDatasetName,
    setDatasetDescription,
    addUploadedFile,
    removeUploadedFile,
    updateUploadProgress,
    addUploadProgress,
    setProcessRule,
    previewChunks,
    previewLoading,
    previewError,
    totalSegments,
    setPreviewChunks,
    setPreviewLoading,
    setPreviewError,
    clearPreview,
    previewByFile,
    setPreviewByFile,
    updateFilePreview,
    clearPreviewByFile,
    separatorType,
    customSeparator,
    setSeparatorType,
    setCustomSeparator,
    embeddingModels,
    selectedEmbeddingModel,
    selectedEmbeddingProvider,
    setEmbeddingModels,
    setSelectedEmbeddingModel,
    createdDataset,
    createdDocuments,
    batchId,
    indexingStatus,
    isIndexingComplete,
    setCreatedDataset,
    setCreatedDocuments,
    setBatchId,
    setIndexingStatus,
    setIsIndexingComplete,
    nextStep,
    prevStep,
    goToStep,
    setLoading,
    setError,
    resetWizard,
    // Story 3.3: Draft management dependencies
    isDraft,
    showDraftPrompt,
    draftData,
    saveAsDraft,
    restoreDraft,
    discardDraft,
    clearDraft,
  ])

  return (
    <RAGWizardContext.Provider value={value}>
      {children}
    </RAGWizardContext.Provider>
  )
}
