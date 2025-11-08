/**
 * Agent Wizard Context - Manages state for multi-step agent creation wizard
 * Features:
 * - Multi-step wizard state management
 * - Auto-save to localStorage (debounced)
 * - Step navigation
 */

'use client'

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef } from 'react'
import {
  AgentBasicSettings,
  AgentWizardStep,
  AgentPromptSettings,
  AgentModelConfig,
  AgentToolsConfig,
  CreateAppRequest,
  AgentType,
} from '@/types/agent'
import { useAuth } from '@/hooks/useAuth'
import { useSession } from '@/context/SessionContext'
import { useToast } from '@/context/ToastContext'
import { useTranslation } from 'react-i18next'
import { difyAPI } from '@/service/dify-api'
import { handleAPIError } from '@/utils/api-error'

/**
 * Wizard state interface
 */
interface AgentWizardState {
  currentStep: AgentWizardStep
  basicSettings: AgentBasicSettings | null
  promptSettings: AgentPromptSettings | null    // NEW: Step 2
  modelConfig: AgentModelConfig | null          // NEW: Step 3
  toolsConfig: AgentToolsConfig | null          // NEW: Step 4
  isDraft: boolean
  isLoading: boolean
  isInitializing: boolean
  error: string | null
  createdAppId: string | null                   // NEW: Created agent ID
  showDraftPrompt: boolean                      // NEW: Show draft restore prompt
  draftData: Partial<AgentWizardState> | null   // NEW: Temporary draft data
}

/**
 * Context value interface
 */
interface AgentWizardContextValue extends AgentWizardState {
  setBasicSettings: (settings: AgentBasicSettings) => void
  setPromptSettings: (settings: AgentPromptSettings) => void  // NEW
  setModelConfig: (config: AgentModelConfig) => void          // NEW
  setToolsConfig: (config: AgentToolsConfig) => void          // NEW
  nextStep: () => void
  previousStep: () => void
  goToStep: (step: AgentWizardStep) => void
  saveAsDraft: () => Promise<void>
  createAgent: () => Promise<string | null>                   // NEW
  resetWizard: () => void
  restoreDraft: () => void                                     // NEW: Restore draft from prompt
  discardDraft: () => void                                     // NEW: Discard draft and start fresh
}

/**
 * Initial state
 */
const initialState: AgentWizardState = {
  currentStep: AgentWizardStep.BASIC,
  basicSettings: null,
  promptSettings: null,
  modelConfig: null,
  toolsConfig: null,
  isDraft: false,
  isLoading: false,
  isInitializing: true,
  error: null,
  createdAppId: null,
  showDraftPrompt: false,
  draftData: null,
}

/**
 * Create context
 */
const AgentWizardContext = createContext<AgentWizardContextValue | undefined>(undefined)

/**
 * Provider component
 */
export function AgentWizardProvider({ children }: { children: React.ReactNode }): React.ReactElement {
  const [state, setState] = useState<AgentWizardState>(initialState)
  const { user } = useAuth()
  const { currentSession } = useSession()
  const { showToast } = useToast()
  const { t } = useTranslation('agent')
  const hasLoadedRef = useRef(false)

  /**
   * Get localStorage key for current user
   * Uses user ID from AuthContext to create unique key per user
   */
  const localStorageKey = useMemo(() => {
    if (typeof window === 'undefined') {
      return 'agent-wizard-draft-anonymous'
    }
    const userId = user?.id || 'anonymous'
    return `agent-wizard-draft-${userId}`
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
        basicSettings: state.basicSettings,
        promptSettings: state.promptSettings,
        modelConfig: state.modelConfig,
        toolsConfig: state.toolsConfig,
        timestamp: new Date().toISOString(),
      }
      localStorage.setItem(localStorageKey, JSON.stringify(data))
    } catch (error) {
      console.error('Failed to save draft to localStorage:', error)
    }
  }, [state.basicSettings, state.promptSettings, state.modelConfig, state.toolsConfig, state.currentStep, localStorageKey])

  /**
   * Reset hasLoadedRef when localStorageKey changes (e.g., after user login)
   */
  useEffect(() => {
    hasLoadedRef.current = false
  }, [localStorageKey])

  /**
   * Load draft from localStorage when component mounts
   * Uses state.isInitializing to ensure it runs only once per initialization cycle
   */
  useEffect(() => {
    // Only run during initialization phase
    if (!state.isInitializing || hasLoadedRef.current) {
      return
    }

    if (typeof window === 'undefined') {
      setState(prev => ({ ...prev, isInitializing: false }))
      hasLoadedRef.current = true
      return
    }

    try {
      // Try to load from current key
      let saved = localStorage.getItem(localStorageKey)

      // If not found and we're looking for anonymous, try to find any agent-wizard-draft-* key
      if (!saved && localStorageKey === 'agent-wizard-draft-anonymous') {
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i)
          if (key && key.startsWith('agent-wizard-draft-')) {
            saved = localStorage.getItem(key)
            break
          }
        }
      }

      if (saved) {
        const data = JSON.parse(saved)

        // Show draft restore prompt instead of auto-restoring
        setState(prev => ({
          ...prev,
          showDraftPrompt: true,
          draftData: data,
          isInitializing: false,
        }))
      } else {
        // No draft found, finish initialization
        setState(prev => ({ ...prev, isInitializing: false }))
      }

      // Mark as loaded for this localStorageKey
      hasLoadedRef.current = true
    } catch (error) {
      console.error('Failed to load draft from localStorage:', error)
      setState(prev => ({ ...prev, isInitializing: false }))
      hasLoadedRef.current = true
    }
     
  }, [state.isInitializing, localStorageKey])

  /**
   * Auto-save to localStorage when step data changes
   * This triggers when user clicks "Next" button on each step
   */
  useEffect(() => {
    if (!state.basicSettings && !state.promptSettings && !state.modelConfig && !state.toolsConfig) {
      return
    }

    saveToLocalStorage()
  }, [state.basicSettings, state.promptSettings, state.modelConfig, state.toolsConfig, state.currentStep, saveToLocalStorage])

  /**
   * Set basic settings (Step 1)
   */
  const setBasicSettings = useCallback((settings: AgentBasicSettings) => {
    setState(prev => ({
      ...prev,
      basicSettings: settings,
      isDraft: true,
    }))
  }, [])

  /**
   * Set prompt settings (Step 2)
   */
  const setPromptSettings = useCallback((settings: AgentPromptSettings) => {
    setState(prev => ({
      ...prev,
      promptSettings: settings,
      isDraft: true,
    }))
  }, [])

  /**
   * Set model config (Step 3)
   */
  const setModelConfig = useCallback((config: AgentModelConfig) => {
    setState(prev => ({
      ...prev,
      modelConfig: config,
      isDraft: true,
    }))
  }, [])

  /**
   * Set tools config (Step 4)
   */
  const setToolsConfig = useCallback((config: AgentToolsConfig) => {
    setState(prev => ({
      ...prev,
      toolsConfig: config,
      isDraft: true,
    }))
  }, [])

  /**
   * Navigate to next step
   */
  const nextStep = useCallback(() => {
    setState(prev => {
      const nextStepNumber = prev.currentStep + 1
      if (nextStepNumber > AgentWizardStep.REVIEW) {
        return prev
      }
      return {
        ...prev,
        currentStep: nextStepNumber as AgentWizardStep,
      }
    })
  }, [])

  /**
   * Navigate to previous step
   */
  const previousStep = useCallback(() => {
    setState(prev => {
      const prevStepNumber = prev.currentStep - 1
      if (prevStepNumber < AgentWizardStep.BASIC) {
        return prev
      }
      return {
        ...prev,
        currentStep: prevStepNumber as AgentWizardStep,
      }
    })
  }, [])

  /**
   * Navigate to specific step
   */
  const goToStep = useCallback((step: AgentWizardStep) => {
    setState(prev => ({
      ...prev,
      currentStep: step,
    }))
  }, [])

  /**
   * Save as draft (manual save with confirmation)
   */
  const saveAsDraft = useCallback(async () => {
    setState(prev => ({ ...prev, isLoading: true }))

    try {
      saveToLocalStorage()
      setState(prev => ({
        ...prev,
        isLoading: false,
        isDraft: true,
      }))

      // In a real app, you might show a toast notification here
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
   * Create agent by calling Dify API
   */
  const createAgent = useCallback(async (): Promise<string | null> => {
    try {
      setState(prev => ({ ...prev, isLoading: true, error: null }))

      // 1. Validate all steps are completed
      if (!state.basicSettings || !state.promptSettings || !state.modelConfig || !state.toolsConfig) {
        throw new Error(t('validation.allStepsRequired'))
      }

      // 2. Validate current session
      if (!currentSession) {
        throw new Error('No active session. Please select a session first.')
      }

      // 3. Build create app payload (Dify App API format)
      const createAppPayload: CreateAppRequest = {
        name: state.basicSettings.name,
        description: state.basicSettings.description || '',
        mode: state.basicSettings.mode === AgentType.CHAT
          ? (state.basicSettings.tool_enabled ? 'agent-chat' : 'chat')
          : 'completion',
        icon: state.basicSettings.icon || '🤖',
        icon_background: state.basicSettings.icon_background || '#3B82F6',
        session_id: currentSession.id,
        model_config: {
          provider: state.modelConfig.original_provider || state.modelConfig.provider,
          name: state.modelConfig.model,
          mode: state.modelConfig.mode,
          completion_params: state.modelConfig.completion_params,
          stop: state.modelConfig.completion_params.stop || [],
        },
        pre_prompt: state.promptSettings.pre_prompt,
        opening_statement: state.promptSettings.opening_statement,
        suggested_questions: state.promptSettings.suggested_questions || [],
        user_input_form: state.promptSettings.user_input_form,
      }

      // 4. Add agent_mode for agent-chat type (with tools)
      if (state.basicSettings.tool_enabled && state.toolsConfig.tools.length > 0) {
        createAppPayload.agent_mode = {
          enabled: true,
          strategy: 'function_call',
          tools: state.toolsConfig.tools
            .filter(tool => tool.enabled)
            .map(tool => ({
              provider_id: tool.provider_id,
              provider_type: tool.provider_type,
              tool_name: tool.tool_name,
              tool_parameters: tool.tool_parameters,
            })),
        }
      }

      // 5. Call Dify Backend API (POST /console/apps)
      const response = await difyAPI.createAppWithConfig(createAppPayload)

      if (response.result !== 'success' || !response.data) {
        throw new Error(response.message || t('toasts.agentCreationFailed'))
      }

      const createdApp = response.data

      // 5. Success handling
      setState(prev => ({
        ...prev,
        isLoading: false,
        createdAppId: createdApp.id,
      }))

      // 6. Clear draft from localStorage
      if (typeof window !== 'undefined') {
        localStorage.removeItem(localStorageKey)
      }

      // 7. Show success toast
      showToast(t('toasts.agentCreated'), 'success')

      return createdApp.id
    } catch (error) {
      // 8. Error handling
      console.error('Failed to create agent:', error)
      const errorMessage = handleAPIError(error)
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: errorMessage,
      }))
      showToast(errorMessage, 'error')
      return null
    }
  }, [state, t, localStorageKey, showToast, currentSession])

  /**
   * Reset wizard to initial state
   */
  /**
   * Restore draft from draftData
   */
  const restoreDraft = useCallback(() => {
    if (!state.draftData) {
      return
    }

    const data = state.draftData

    setState(prev => ({
      ...prev,
      currentStep: data.currentStep || AgentWizardStep.BASIC,
      basicSettings: data.basicSettings || null,
      promptSettings: data.promptSettings || null,
      modelConfig: data.modelConfig || null,
      toolsConfig: data.toolsConfig || null,
      isDraft: true,
      showDraftPrompt: false,
      draftData: null,
    }))

    showToast(t('toast.draftRestored'), 'success')
  }, [state.draftData, showToast, t])

  /**
   * Discard draft and start fresh
   */
  const discardDraft = useCallback(() => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem(localStorageKey)
    }

    setState(prev => ({
      ...prev,
      showDraftPrompt: false,
      draftData: null,
    }))
  }, [localStorageKey])

  const resetWizard = useCallback(() => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem(localStorageKey)
    }

    setState({ ...initialState, isInitializing: false })
  }, [localStorageKey])

  /**
   * Memoize context value
   */
  const contextValue = useMemo<AgentWizardContextValue>(() => ({
    ...state,
    setBasicSettings,
    setPromptSettings,
    setModelConfig,
    setToolsConfig,
    nextStep,
    previousStep,
    goToStep,
    saveAsDraft,
    createAgent,
    resetWizard,
    restoreDraft,
    discardDraft,
  }), [state, setBasicSettings, setPromptSettings, setModelConfig, setToolsConfig, nextStep, previousStep, goToStep, saveAsDraft, createAgent, resetWizard, restoreDraft, discardDraft])

  return (
    <AgentWizardContext.Provider value={contextValue}>
      {children}
    </AgentWizardContext.Provider>
  )
}

/**
 * Hook to use Agent Wizard context
 */
export function useAgentWizard(): AgentWizardContextValue {
  const context = useContext(AgentWizardContext)
  if (!context) {
    throw new Error('useAgentWizard must be used within AgentWizardProvider')
  }
  return context
}
