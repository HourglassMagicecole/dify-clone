/**
 * Agent Wizard Context - Manages state for multi-step agent creation wizard
 * Features:
 * - Multi-step wizard state management
 * - Auto-save to localStorage (debounced)
 * - Step navigation
 */

'use client'

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { AgentBasicSettings, AgentWizardStep } from '@/types/agent'
import { useAuth } from '@/hooks/useAuth'
import { useToast } from '@/context/ToastContext'
import { useTranslation } from 'react-i18next'

/**
 * Wizard state interface
 */
interface AgentWizardState {
  currentStep: AgentWizardStep
  basicSettings: AgentBasicSettings | null
  // Step 2-5 will be added in future stories
  isDraft: boolean
  isLoading: boolean
  isInitializing: boolean
  error: string | null
}

/**
 * Context value interface
 */
interface AgentWizardContextValue extends AgentWizardState {
  setBasicSettings: (settings: AgentBasicSettings) => void
  nextStep: () => void
  previousStep: () => void
  goToStep: (step: AgentWizardStep) => void
  saveAsDraft: () => Promise<void>
  resetWizard: () => void
}

/**
 * Initial state
 */
const initialState: AgentWizardState = {
  currentStep: AgentWizardStep.BASIC,
  basicSettings: null,
  isDraft: false,
  isLoading: false,
  isInitializing: true,
  error: null,
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
        timestamp: new Date().toISOString(),
      }
      localStorage.setItem(localStorageKey, JSON.stringify(data))
    } catch (error) {
      console.error('Failed to save draft to localStorage:', error)
    }
  }, [state.basicSettings, state.currentStep, localStorageKey])

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
      const saved = localStorage.getItem(localStorageKey)

      if (saved) {
        const data = JSON.parse(saved)
        setState(prev => ({
          ...prev,
          currentStep: data.currentStep || AgentWizardStep.BASIC,
          basicSettings: data.basicSettings || null,
          isDraft: true,
          isInitializing: false,
        }))

        // Show toast notification that draft was loaded
        // Use setTimeout to ensure Toast context is fully mounted
        setTimeout(() => {
          showToast(t('toast.draftLoaded'), 'success')
        }, 500)
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
    // eslint-disable-next-line react-hooks/exhaustive-deps -- showToast and t are only used for notifications, not needed as dependencies
  }, [state.isInitializing, localStorageKey])

  /**
   * Auto-save to localStorage (debounced)
   */
  useEffect(() => {
    if (!state.basicSettings) {
      return
    }

    const timeoutId = setTimeout(() => {
      saveToLocalStorage()
    }, 1000) // 1 second debounce

    return () => clearTimeout(timeoutId)
  }, [state.basicSettings, state.currentStep, saveToLocalStorage])

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
   * Reset wizard to initial state
   */
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
    nextStep,
    previousStep,
    goToStep,
    saveAsDraft,
    resetWizard,
  }), [state, setBasicSettings, nextStep, previousStep, goToStep, saveAsDraft, resetWizard])

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
