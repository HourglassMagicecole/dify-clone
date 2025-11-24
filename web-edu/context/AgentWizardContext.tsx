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
  SelectedTool,
  UserInputForm,
} from '@/types/agent'
import { useAuth } from '@/hooks/useAuth'
import { useSession } from '@/context/SessionContext'
import { useToast } from '@/context/ToastContext'
import { useTranslation } from 'react-i18next'
import { difyAPI } from '@/service/dify-api'
import { agentAPI } from '@/service/agent-api'
import { listTools } from '@/service/tool-api'
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
  isEditMode: boolean                                          // NEW: Edit mode flag
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
 * Provider component props
 */
interface AgentWizardProviderProps {
  children: React.ReactNode
  mode?: 'create' | 'edit'
  initialAgentId?: string
}

/**
 * Provider component
 */
export function AgentWizardProvider({
  children,
  mode = 'create',
  initialAgentId
}: AgentWizardProviderProps): React.ReactElement {
  const [state, setState] = useState<AgentWizardState>(initialState)
  const { user } = useAuth()
  const { currentSession } = useSession()
  const { showToast } = useToast()
  const { t } = useTranslation('agent')
  const hasLoadedRef = useRef(false)
  const isEditMode = mode === 'edit' && !!initialAgentId

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
   * Save to localStorage (only in create mode)
   */
  const saveToLocalStorage = useCallback(() => {
    if (typeof window === 'undefined' || isEditMode) {
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
  }, [state.basicSettings, state.promptSettings, state.modelConfig, state.toolsConfig, state.currentStep, localStorageKey, isEditMode])

  /**
   * Reset hasLoadedRef when localStorageKey changes (e.g., after user login)
   */
  useEffect(() => {
    hasLoadedRef.current = false
  }, [localStorageKey])

  /**
   * Load agent data for edit mode or draft from localStorage for create mode
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

    // Edit mode: Load agent data from API
    if (isEditMode) {
      const loadAgentData = async () => {
        try {
          const agent = await agentAPI.getAgent(initialAgentId!)
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const agentData = agent as any

          // Extract model config with proper structure
          const modelConfig = agentData.model_config || {}
          const modelInfo = modelConfig.model || {}

          // Extract pre_prompt from different possible locations
          const prePrompt = modelConfig.pre_prompt
            || agentData.pre_prompt
            || modelConfig.configs?.pre_prompt
            || ''

          // Fetch full tool information to get i18n labels
          const enrichToolsWithI18n = async (tools: SelectedTool[]) => {
            try {
              const toolsResponse = await listTools()

              if (toolsResponse.result !== 'success' || !toolsResponse.data) {
                throw new Error('Failed to fetch tools')
              }

              interface ToolProvider {
                name: string
                label: string | Record<string, string>
                tools: Array<{
                  name: string
                  label: string | Record<string, string>
                }>
              }

              const allTools = (toolsResponse.data as ToolProvider[]).flatMap((provider) =>
                provider.tools.map((tool) => ({
                  provider_name: provider.name,
                  provider_label: provider.label,
                  tool_name: tool.name,
                  tool_label: tool.label,
                }))
              )

              return tools.map((tool) => {
                const fullToolInfo = allTools.find(
                  t => t.provider_name === tool.provider_id && t.tool_name === tool.tool_name
                )

                // Convert i18n objects to strings if needed
                const providerLabel = fullToolInfo?.provider_label
                const toolLabel = fullToolInfo?.tool_label

                return {
                  provider_id: tool.provider_id || '',
                  provider_type: tool.provider_type || 'builtin',
                  provider_name: (typeof providerLabel === 'string' ? providerLabel : tool.provider_name) || '',
                  tool_name: tool.tool_name || '',
                  tool_label: (typeof toolLabel === 'string' ? toolLabel : tool.tool_label) || tool.tool_name || '',
                  tool_parameters: tool.tool_parameters || {},
                  enabled: tool.enabled !== false,
                } as SelectedTool
              })
            } catch (error) {
              console.error('[AgentWizardContext] Failed to enrich tools with i18n:', error)
              // Fallback to original tools if API fails
              return tools
            }
          }

          const enrichedTools = await enrichToolsWithI18n(modelConfig.agent_mode?.tools || [])

          // Extract user_input_form from model_config (Backend stores it there)
          const backendUserInputForm = modelConfig.user_input_form
            || agentData.user_input_form
            || []

          // Transform Backend format to Frontend format
          // Backend: [{ "text-input": { label, variable, required } }]
          // Frontend: [{ variable, label, input_type, required }]
          const userInputForm = (backendUserInputForm as Array<Record<string, unknown>>).map((item) => {
            const inputType = Object.keys(item)[0]
            if (!inputType) return null
            const fieldData = item[inputType] as Record<string, unknown>
            return {
              variable: (fieldData.variable as string) || '',
              label: (fieldData.label as string) || '',
              input_type: inputType,
              required: (fieldData.required as boolean) || false,
              default_value: (fieldData.default as string) || '',
              ...(fieldData.options ? { options: fieldData.options as string[] } : {}),
            }
          }).filter(Boolean) as UserInputForm[]

          // Map Agent data to wizard state
          setState(prev => ({
            ...prev,
            basicSettings: {
              name: agentData.name,
              description: agentData.description || '',
              mode: (agentData.mode === 'completion' ? AgentType.COMPLETION : AgentType.CHAT),
              role: prePrompt || 'No role defined',
              tool_enabled: !!modelConfig.agent_mode?.enabled,
              icon_type: agentData.icon_type || 'emoji',
              icon: agentData.icon,
              icon_background: agentData.icon_background,
            },
            promptSettings: {
              pre_prompt: prePrompt || '',
              prompt_type: 'simple',
              user_input_form: userInputForm,
              output_format: undefined, // Output format not stored in backend, will be redefined in edit mode
              opening_statement: agentData.opening_statement,
              suggested_questions: agentData.suggested_questions || [],
            },
            modelConfig: {
              provider: modelInfo.provider || '',
              original_provider: modelInfo.provider || '',
              model: modelInfo.name || '',
              mode: (agentData.mode === 'chat' || agentData.mode === 'agent-chat') ? 'chat' : 'completion',
              completion_params: {
                temperature: modelInfo.completion_params?.temperature ?? 1.0,
                top_p: modelInfo.completion_params?.top_p ?? 1.0,
                presence_penalty: modelInfo.completion_params?.presence_penalty ?? 0.0,
                frequency_penalty: modelInfo.completion_params?.frequency_penalty ?? 0.0,
                max_tokens: modelInfo.completion_params?.max_tokens ?? 4096,
                stop: modelInfo.completion_params?.stop ?? [],
              },
            },
            toolsConfig: {
              tools: enrichedTools,
            },
            createdAppId: agentData.id,
            isInitializing: false,
          }))

          hasLoadedRef.current = true
        } catch (error) {
          console.error('Failed to load agent for edit:', error)
          setState(prev => ({
            ...prev,
            error: error instanceof Error ? error.message : 'Failed to load agent',
            isInitializing: false,
          }))
          hasLoadedRef.current = true
        }
      }

      loadAgentData()
      return
    }

    // Create mode: Try to load draft from localStorage
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

  }, [state.isInitializing, localStorageKey, isEditMode, initialAgentId])

  /**
   * Auto-save to localStorage when step data changes (create mode only)
   * This triggers when user clicks "Next" button on each step
   */
  useEffect(() => {
    if (isEditMode) {
      return
    }

    if (!state.basicSettings && !state.promptSettings && !state.modelConfig && !state.toolsConfig) {
      return
    }

    saveToLocalStorage()
  }, [state.basicSettings, state.promptSettings, state.modelConfig, state.toolsConfig, state.currentStep, saveToLocalStorage, isEditMode])

  /**
   * Set basic settings (Step 1)
   */
  const setBasicSettings = useCallback((settings: AgentBasicSettings) => {
    setState(prev => ({
      ...prev,
      basicSettings: settings,
      isDraft: !isEditMode,
    }))
  }, [isEditMode])

  /**
   * Set prompt settings (Step 2)
   */
  const setPromptSettings = useCallback((settings: AgentPromptSettings) => {
    setState(prev => ({
      ...prev,
      promptSettings: settings,
      isDraft: !isEditMode,
    }))
  }, [isEditMode])

  /**
   * Set model config (Step 3)
   */
  const setModelConfig = useCallback((config: AgentModelConfig) => {
    setState(prev => ({
      ...prev,
      modelConfig: config,
      isDraft: !isEditMode,
    }))
  }, [isEditMode])

  /**
   * Set tools config (Step 4)
   */
  const setToolsConfig = useCallback((config: AgentToolsConfig) => {
    setState(prev => ({
      ...prev,
      toolsConfig: config,
      isDraft: !isEditMode,
    }))
  }, [isEditMode])

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
   * Create or update agent by calling Dify API
   * In edit mode, updates existing agent; in create mode, creates new agent
   */
  const createAgent = useCallback(async (): Promise<string | null> => {
    try {
      setState(prev => ({ ...prev, isLoading: true, error: null }))

      // 1. Validate all steps are completed
      if (!state.basicSettings || !state.promptSettings || !state.modelConfig || !state.toolsConfig) {
        throw new Error(t('validation.allStepsRequired'))
      }

      // 2. Validate current session (only for create mode)
      if (!isEditMode && !currentSession) {
        throw new Error('No active session. Please select a session first.')
      }

      let agentId: string

      // 3. Call API based on mode
      if (isEditMode && initialAgentId) {
        // Edit mode: Update existing agent

        // Step 1: Update basic info (name, description, icon)
        const basicInfoPayload = {
          name: state.basicSettings.name,
          description: state.basicSettings.description || '',
          icon: state.basicSettings.icon || '🤖',
          icon_type: state.basicSettings.icon_type || 'emoji',
          icon_background: state.basicSettings.icon_background || '#3B82F6',
          use_icon_as_answer_icon: false,
        }

        await agentAPI.updateAgent(initialAgentId, basicInfoPayload)

        // Step 2: Update model config (LLM settings, prompts, tools)
        // Transform user_input_form to Backend format
        const transformedUserInputForm = (state.promptSettings.user_input_form || []).map(field => ({
          [field.input_type]: {
            label: field.label,
            variable: field.variable,
            required: field.required,
            default: field.default_value || '',
            ...(field.options && { options: field.options }),
          },
        }))

        const modelConfigPayload = {
          pre_prompt: state.promptSettings.pre_prompt,
          prompt_type: state.promptSettings.prompt_type || 'simple',
          chat_prompt_config: {},
          completion_prompt_config: {},
          user_input_form: transformedUserInputForm,
          opening_statement: state.promptSettings.opening_statement || '',
          suggested_questions: state.promptSettings.suggested_questions || [],
          model: {
            provider: state.modelConfig.original_provider || state.modelConfig.provider,
            name: state.modelConfig.model,
            mode: state.modelConfig.mode,
            completion_params: state.modelConfig.completion_params,
          },
        }

        // Add agent_mode for tools (automatically enabled if tools exist)
        if (state.toolsConfig.tools.length > 0) {
          // Don't filter by enabled - send all tools in toolsConfig
          // enabled property might be undefined for some tools
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (modelConfigPayload as any).agent_mode = {
            enabled: true,
            strategy: 'function_call',
            tools: state.toolsConfig.tools.map(tool => ({
              provider_id: tool.provider_id,
              provider_type: tool.provider_type,
              tool_name: tool.tool_name,
              tool_parameters: tool.tool_parameters,
              enabled: tool.enabled ?? true, // Include enabled field
            })),
          }
        }

        await agentAPI.updateModelConfig(initialAgentId, modelConfigPayload)

        agentId = initialAgentId
        showToast(t('toasts.agentUpdated'), 'success')
      } else {
        // Create mode: Create new agent
        // Transform user_input_form to Backend format
        const transformedUserInputFormCreate = (state.promptSettings.user_input_form || []).map(field => ({
          [field.input_type]: {
            label: field.label,
            variable: field.variable,
            required: field.required,
            default: field.default_value || '',
            ...(field.options && { options: field.options }),
          },
        }))

        const createAppPayload: CreateAppRequest = {
          name: state.basicSettings.name,
          description: state.basicSettings.description || '',
          mode: state.basicSettings.mode === AgentType.CHAT
            ? (state.basicSettings.tool_enabled ? 'agent-chat' : 'chat')
            : 'completion',
          icon: state.basicSettings.icon || '🤖',
          icon_background: state.basicSettings.icon_background || '#3B82F6',
          session_id: currentSession!.id,
          model_config: {
            provider: state.modelConfig.original_provider || state.modelConfig.provider,
            name: state.modelConfig.model,
            mode: state.modelConfig.mode,
            completion_params: state.modelConfig.completion_params as Record<string, unknown>,
            stop: state.modelConfig.completion_params.stop || [],
          },
          pre_prompt: state.promptSettings.pre_prompt,
          opening_statement: state.promptSettings.opening_statement,
          suggested_questions: state.promptSettings.suggested_questions || [],
          user_input_form: transformedUserInputFormCreate as unknown as typeof state.promptSettings.user_input_form,
        }

        // eslint-disable-next-line no-console
        console.log('[AgentWizard] Creating agent with payload:', JSON.stringify(createAppPayload, null, 2))

        // Add agent_mode for agent-chat type (automatically enabled if tools exist)
        if (state.toolsConfig.tools.length > 0) {
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
                enabled: true, // Include enabled field (already filtered)
              })),
          }
        }

        const response = await difyAPI.createAppWithConfig(createAppPayload)

        if (response.result !== 'success' || !response.data) {
          throw new Error(response.message || t('toasts.agentCreationFailed'))
        }

        agentId = response.data.id
        showToast(t('toasts.agentCreated'), 'success')

        // Create API Token for new agent (required for execution)
        try {
          // eslint-disable-next-line no-console
          console.log('[AgentWizard] Creating API Token for agent:', agentId)

          const apiKeys = await agentAPI.getAppApiKeys(agentId)

          // eslint-disable-next-line no-console
          console.log('[AgentWizard] Current API keys:', apiKeys)

          // Only create if no API keys exist
          if (!apiKeys || apiKeys.length === 0) {
            // Create API Token using agentAPI's new method
            const createdKey = await agentAPI.createAppApiKey(agentId)

            // eslint-disable-next-line no-console
            console.log('[AgentWizard] API Token created successfully:', createdKey.id)
          } else {
            // eslint-disable-next-line no-console
            console.log('[AgentWizard] API Token already exists')
          }
        } catch (apiKeyError) {
          console.error('[AgentWizard] Failed to create API Token:', apiKeyError)
          // Don't fail the whole operation, just log the error
        }
      }

      // 6. Success handling
      setState(prev => ({
        ...prev,
        isLoading: false,
        createdAppId: agentId,
      }))

      // 7. Clear draft from localStorage (create mode only)
      if (!isEditMode && typeof window !== 'undefined') {
        localStorage.removeItem(localStorageKey)
      }

      return agentId
    } catch (error) {
      // 8. Error handling
      console.error('Failed to create/update agent:', error)
      const errorMessage = handleAPIError(error)
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: errorMessage,
      }))
      showToast(errorMessage, 'error')
      return null
    }
  }, [state, t, localStorageKey, showToast, currentSession, isEditMode, initialAgentId])

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
    isEditMode,
  }), [state, setBasicSettings, setPromptSettings, setModelConfig, setToolsConfig, nextStep, previousStep, goToStep, saveAsDraft, createAgent, resetWizard, restoreDraft, discardDraft, isEditMode])

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
