/**
 * Tests for AgentWizardContext
 */

import React from 'react'
import { renderHook, act, waitFor } from '@testing-library/react'
import { AgentWizardProvider, useAgentWizard } from '@/context/AgentWizardContext'
import { AgentWizardStep, AgentType } from '@/types/agent'

// Mock useAuth hook
jest.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({
    user: { id: 'test-user-123', name: 'Test User', email: 'test@test.com' },
    isAuthenticated: true,
    isLoading: false,
  }),
}))

// Mock useToast hook
jest.mock('@/context/ToastContext', () => ({
  useToast: () => ({
    showToast: jest.fn(),
  }),
}))

// Mock useSession hook
jest.mock('@/context/SessionContext', () => ({
  useSession: () => ({
    currentSession: { id: 'test-session-123', session_name: 'Test Session', is_active: true },
    sessions: [{ id: 'test-session-123', session_name: 'Test Session', is_active: true }],
    isLoading: false,
    error: null,
    selectSession: jest.fn(),
    refreshSessions: jest.fn(),
  }),
}))

// Mock react-i18next
jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}))

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {}

  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value.toString()
    },
    removeItem: (key: string) => {
      delete store[key]
    },
    clear: () => {
      store = {}
    },
  }
})()

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
})

// Wrapper component with Provider
const wrapper = ({ children }: { children: React.ReactNode }) => (
  <AgentWizardProvider>{children}</AgentWizardProvider>
)

describe('AgentWizardContext', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('should have correct initial state', () => {
    const { result } = renderHook(() => useAgentWizard(), { wrapper })

    expect(result.current.currentStep).toBe(AgentWizardStep.BASIC)
    expect(result.current.basicSettings).toBeNull()
    expect(result.current.isDraft).toBe(false)
    expect(result.current.isLoading).toBe(false)
    // isInitializing will be false after loadDraft completes
    expect(result.current.error).toBeNull()
  })

  it('should update basic settings when setBasicSettings is called', () => {
    const { result } = renderHook(() => useAgentWizard(), { wrapper })

    const testSettings = {
      name: 'Test Agent',
      description: 'Test Description',
      mode: AgentType.CHAT,
      role: 'You are a helpful assistant',
      tool_enabled: false,
      icon_type: 'emoji' as const,
      icon: '🤖',
      icon_background: '#3B82F6',
    }

    act(() => {
      result.current.setBasicSettings(testSettings)
    })

    expect(result.current.basicSettings).toEqual(testSettings)
    expect(result.current.isDraft).toBe(true)
  })

  it('should increment currentStep when nextStep is called', () => {
    const { result } = renderHook(() => useAgentWizard(), { wrapper })

    expect(result.current.currentStep).toBe(AgentWizardStep.BASIC)

    act(() => {
      result.current.nextStep()
    })

    expect(result.current.currentStep).toBe(AgentWizardStep.PROMPT)

    act(() => {
      result.current.nextStep()
    })

    expect(result.current.currentStep).toBe(AgentWizardStep.MODEL)
  })

  it('should decrement currentStep when previousStep is called', () => {
    const { result } = renderHook(() => useAgentWizard(), { wrapper })

    // Move to step 3
    act(() => {
      result.current.goToStep(AgentWizardStep.MODEL)
    })

    expect(result.current.currentStep).toBe(AgentWizardStep.MODEL)

    // Go back
    act(() => {
      result.current.previousStep()
    })

    expect(result.current.currentStep).toBe(AgentWizardStep.PROMPT)
  })

  it('should navigate to specific step when goToStep is called', () => {
    const { result } = renderHook(() => useAgentWizard(), { wrapper })

    act(() => {
      result.current.goToStep(AgentWizardStep.TOOLS)
    })

    expect(result.current.currentStep).toBe(AgentWizardStep.TOOLS)
  })

  it('should not go beyond the last step', () => {
    const { result } = renderHook(() => useAgentWizard(), { wrapper })

    // Move to last step
    act(() => {
      result.current.goToStep(AgentWizardStep.REVIEW)
    })

    expect(result.current.currentStep).toBe(AgentWizardStep.REVIEW)

    // Try to go next (should stay at REVIEW)
    act(() => {
      result.current.nextStep()
    })

    expect(result.current.currentStep).toBe(AgentWizardStep.REVIEW)
  })

  it('should not go before the first step', () => {
    const { result } = renderHook(() => useAgentWizard(), { wrapper })

    expect(result.current.currentStep).toBe(AgentWizardStep.BASIC)

    // Try to go previous (should stay at BASIC)
    act(() => {
      result.current.previousStep()
    })

    expect(result.current.currentStep).toBe(AgentWizardStep.BASIC)
  })

  it('should save draft to localStorage', async () => {
    const { result } = renderHook(() => useAgentWizard(), { wrapper })

    const testSettings = {
      name: 'Test Agent',
      description: 'Test Description',
      mode: AgentType.CHAT,
      role: 'You are a helpful assistant',
      tool_enabled: false,
      icon_type: 'emoji' as const,
      icon: '🤖',
      icon_background: '#3B82F6',
    }

    act(() => {
      result.current.setBasicSettings(testSettings)
    })

    // Wait for debounced save (1 second)
    await waitFor(
      () => {
        const savedData = localStorage.getItem('agent-wizard-draft-test-user-123')
        expect(savedData).not.toBeNull()
      },
      { timeout: 2000 }
    )

    const savedData = localStorage.getItem('agent-wizard-draft-test-user-123')
    if (savedData) {
      const parsed = JSON.parse(savedData)
      expect(parsed.basicSettings).toEqual(testSettings)
    }
  })

  it('should load draft from localStorage on mount', () => {
    const testSettings = {
      name: 'Saved Agent',
      description: 'Saved Description',
      mode: AgentType.COMPLETION,
      role: 'You are a saved assistant',
      tool_enabled: true,
      icon_type: 'emoji' as const,
      icon: '🔧',
      icon_background: '#10B981',
    }

    const draftData = {
      currentStep: AgentWizardStep.PROMPT,
      basicSettings: testSettings,
      timestamp: new Date().toISOString(),
    }

    localStorage.setItem('agent-wizard-draft-test-user-123', JSON.stringify(draftData))

    const { result } = renderHook(() => useAgentWizard(), { wrapper })

    // Context should show draft prompt and store draft data
    expect(result.current.showDraftPrompt).toBe(true)
    expect(result.current.draftData).toEqual(draftData)
    expect(result.current.currentStep).toBe(AgentWizardStep.BASIC) // Not yet restored

    // Restore the draft
    act(() => {
      result.current.restoreDraft()
    })

    // After restore, draft should be applied
    expect(result.current.currentStep).toBe(AgentWizardStep.PROMPT)
    expect(result.current.basicSettings).toEqual(testSettings)
    expect(result.current.isDraft).toBe(true)
    expect(result.current.showDraftPrompt).toBe(false)
  })

  it('should reset wizard to initial state', async () => {
    const { result } = renderHook(() => useAgentWizard(), { wrapper })

    const testSettings = {
      name: 'Test Agent',
      description: 'Test Description',
      mode: AgentType.CHAT,
      role: 'You are a helpful assistant',
      tool_enabled: false,
      icon_type: 'emoji' as const,
      icon: '🤖',
      icon_background: '#3B82F6',
    }

    // Set some state
    act(() => {
      result.current.setBasicSettings(testSettings)
      result.current.goToStep(AgentWizardStep.MODEL)
    })

    expect(result.current.currentStep).toBe(AgentWizardStep.MODEL)
    expect(result.current.basicSettings).not.toBeNull()

    // Reset
    act(() => {
      result.current.resetWizard()
    })

    expect(result.current.currentStep).toBe(AgentWizardStep.BASIC)
    expect(result.current.basicSettings).toBeNull()
    expect(result.current.isDraft).toBe(false)

    // localStorage should be cleared
    const savedData = localStorage.getItem('agent-wizard-draft-test-user-123')
    expect(savedData).toBeNull()
  })

  it('should manually save as draft', async () => {
    const { result } = renderHook(() => useAgentWizard(), { wrapper })

    const testSettings = {
      name: 'Test Agent',
      description: 'Test Description',
      mode: AgentType.CHAT,
      role: 'You are a helpful assistant',
      tool_enabled: false,
      icon_type: 'emoji' as const,
      icon: '🤖',
      icon_background: '#3B82F6',
    }

    act(() => {
      result.current.setBasicSettings(testSettings)
    })

    await act(async () => {
      await result.current.saveAsDraft()
    })

    expect(result.current.isDraft).toBe(true)
    expect(result.current.isLoading).toBe(false)

    // Check localStorage
    const savedData = localStorage.getItem('agent-wizard-draft-test-user-123')
    expect(savedData).not.toBeNull()
  })

  it('should throw error when used outside provider', () => {
    // Suppress console.error for this test
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {})

    expect(() => {
      renderHook(() => useAgentWizard())
    }).toThrow('useAgentWizard must be used within AgentWizardProvider')

    consoleError.mockRestore()
  })
})
