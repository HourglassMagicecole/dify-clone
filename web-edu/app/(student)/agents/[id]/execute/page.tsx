/**
 * Task-based Agent Execution Page
 *
 * Allows users to execute completion-mode agents by filling out
 * a form and viewing the execution results and reasoning steps.
 */

'use client'

import { useState, useEffect, use, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { useToast } from '@/context/ToastContext'
import type { ExecutionState, UserInputForm, Agent } from '@/types/agent'
import { DynamicFormRenderer } from '@/components/agent/DynamicFormRenderer'
import { AgentThoughtTimeline } from '@/components/agent/AgentThoughtTimeline'
import { ExecutionResultPanel } from '@/components/agent/ExecutionResultPanel'
import { ExecutionHistoryTable, type ExecutionRecord, type ExecutionHistoryTableRef } from '@/components/agent/ExecutionHistoryTable'
import { agentAPI } from '@/service/agent-api'

interface TaskExecutionPageProps {
  params: Promise<{
    id: string
  }>
}

export default function TaskExecutionPage({ params }: TaskExecutionPageProps) {
  const { id: _agentId } = use(params)
  const { t } = useTranslation('agent')
  const { showToast } = useToast()
  const historyTableRef = useRef<ExecutionHistoryTableRef>(null)

  // Agent data state
  const [agent, setAgent] = useState<Agent | null>(null)
  const [isLoadingAgent, setIsLoadingAgent] = useState(true)

  // Execution state
  const [executionState, _setExecutionState] = useState<ExecutionState>({
    status: 'idle',
    currentInputs: {},
    result: null,
    error: null,
    agentThoughts: [],
    tokenUsage: null,
    executionTime: null,
  })

  // Load agent data on mount
  useEffect(() => {
    const loadAgent = async () => {
      try {
        setIsLoadingAgent(true)
        const agentData = await agentAPI.getAgent(_agentId)

        // eslint-disable-next-line no-console
        console.log('[TaskExecutionPage] Loaded agent data:', agentData)
        // eslint-disable-next-line no-console
        console.log('[TaskExecutionPage] enable_api:', agentData.enable_api, 'enable_site:', agentData.enable_site)
        // eslint-disable-next-line no-console
        console.log('[TaskExecutionPage] model_config (full JSON):', JSON.stringify(agentData.model_config, null, 2))

        // Extract user_input_form from model_config if it exists
        const modelConfig = agentData.model_config as unknown as Record<string, unknown>

        // eslint-disable-next-line no-console
        console.log('[TaskExecutionPage] model_config.user_input_form:', modelConfig?.user_input_form)
        // eslint-disable-next-line no-console
        console.log('[TaskExecutionPage] All model_config keys:', Object.keys(modelConfig || {}))

        if (modelConfig?.user_input_form) {
          const backendUserInputForm = modelConfig.user_input_form as Array<Record<string, unknown>>

          // Transform Backend format to Frontend format
          // Backend: [{ "text-input": { label, variable, required } }]
          // Frontend: [{ variable, label, input_type, required }]
          const transformedUserInputForm = backendUserInputForm.map((item) => {
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

          agentData.user_input_form = transformedUserInputForm
          // eslint-disable-next-line no-console
          console.log('[TaskExecutionPage] Transformed user_input_form:', agentData.user_input_form)
        }
        else {
          console.warn('[TaskExecutionPage] No user_input_form found in model_config')
        }

        setAgent(agentData)
      }
      catch (error) {
        console.error('Failed to load agent:', error)
        showToast(t('execute.error.loadFailed', { defaultValue: 'Agent 정보를 불러올 수 없습니다' }), 'error')
      }
      finally {
        setIsLoadingAgent(false)
      }
    }

    loadAgent()
  }, [_agentId, t, showToast])

  /**
   * Handle form submission (execute agent) - Streaming mode
   */
  const handleExecute = async (values: Record<string, unknown>) => {
    _setExecutionState((prev) => ({
      ...prev,
      status: 'running',
      error: null,
      currentInputs: values,
      result: null,
      agentThoughts: [],
    }))

    // Record start time
    const startTime = Date.now()

    try {
      // Extract file fields and prepare files array
      const files = Object.entries(values)
        .filter(([_key, value]) => value && typeof value === 'object' && 'id' in value && 'url' in value)
        .map(([_key, value]) => {
          const fileInfo = value as { id: string, name: string, type: string, url: string }
          return {
            type: 'document',
            transfer_method: 'remote_url',
            url: fileInfo.url,
          }
        })

      // Prepare inputs (exclude file objects, keep primitive values)
      const inputs = Object.fromEntries(
        Object.entries(values).filter(([_key, value]) => {
          return !(value && typeof value === 'object' && 'id' in value)
        }),
      )

      let fullResult = ''

      // Call API with streaming mode
      await agentAPI.executeAgent(
        _agentId,
        {
          inputs,
          response_mode: 'streaming',
          files: files.length > 0 ? files : undefined,
        },
        {
          onThought: (thought) => {
            // Update agent thoughts in real-time (with duplicate check)
            _setExecutionState((prev) => {
              // Skip if thought with same id already exists
              if (prev.agentThoughts.some(t => t.id === thought.id)) {
                return prev
              }
              return {
                ...prev,
                agentThoughts: [...prev.agentThoughts, thought],
              }
            })
          },
          onMessage: (message) => {
            // Accumulate message chunks
            fullResult += message
            _setExecutionState((prev) => ({
              ...prev,
              result: fullResult,
            }))
          },
          onComplete: (response) => {
            // Calculate execution time
            const totalTime = Date.now() - startTime

            // Update state with final results
            _setExecutionState({
              status: 'success',
              currentInputs: values,
              result: response.data.answer || fullResult,
              error: null,
              agentThoughts: response.agent_thoughts,
              tokenUsage: response.data.metadata.usage,
              executionTime: {
                total: totalTime,
                llm: response.data.metadata.usage.latency
                  ? response.data.metadata.usage.latency * 1000
                  : 0,
                tool: 0, // TODO: Calculate from agent_thoughts
              },
            })

            showToast(t('execute.result.success', { defaultValue: 'Agent 실행 성공' }), 'success')

            // Refresh execution history
            historyTableRef.current?.refresh()
          },
          onError: (error) => {
            const errorMessage = error.message || String(error)
            _setExecutionState((prev) => ({
              ...prev,
              status: 'failed',
              error: errorMessage,
            }))
            showToast(errorMessage, 'error')
          },
        }
      )
    }
    catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      _setExecutionState((prev) => ({
        ...prev,
        status: 'failed',
        error: errorMessage,
      }))
      showToast(errorMessage, 'error')
    }
  }

  /**
   * Handle retry button
   */
  const handleRetry = () => {
    // Reset execution state to idle (keep currentInputs for editing)
    _setExecutionState((prev) => ({
      ...prev,
      status: 'idle',
      error: null,
    }))

    // Scroll to top to show the form
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  /**
   * Handle rerun from history
   * TODO: Task 8 - Connect this to ExecutionHistoryTable when onRerun prop is added
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const handleRerun = (execution: ExecutionRecord) => {
    // TODO: Populate form with execution.inputs and scroll to top
    // eslint-disable-next-line no-console
    console.log('Rerunning execution:', execution.id, execution.inputs)
    alert(`Rerunning execution with inputs: ${JSON.stringify(execution.inputs, null, 2)}`)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  return (
    <div className="container mx-auto px-4 py-6">
      {/* Loading State */}
      {isLoadingAgent && (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      )}

      {/* Error State */}
      {!isLoadingAgent && !agent && (
        <div className="text-center py-12">
          <p className="text-red-600 dark:text-red-400">
            {t('execute.error.loadFailed', { defaultValue: 'Agent 정보를 불러올 수 없습니다' })}
          </p>
        </div>
      )}

      {/* Main Content */}
      {!isLoadingAgent && agent && (
        <>
          {/* Agent Information Header */}
          <div className="mb-6">
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white">
              {agent.name}
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mt-2">
              {agent.description}
            </p>
          </div>

          {/* Section 1: Input Form + Processing Steps (2-column) */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            {/* Left: Input Form */}
            <div>
              <div className="h-full border border-gray-300 dark:border-gray-600 rounded-lg p-6 bg-white dark:bg-gray-800">
                <DynamicFormRenderer
                  formSchema={agent.user_input_form || []}
                  onSubmit={handleExecute}
                  isSubmitting={executionState.status === 'running'}
                  executionStatus={executionState.status}
                  defaultValues={executionState.currentInputs}
                />
              </div>
            </div>

            {/* Right: Processing Steps */}
            <div>
              <div className="h-full border border-gray-300 dark:border-gray-600 rounded-lg p-6 bg-white dark:bg-gray-800 flex flex-col">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                  Processing Steps
                </h2>
                <div className="flex-1 overflow-y-auto">
                  <AgentThoughtTimeline
                    thoughts={executionState.agentThoughts}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Section 2: Execution Result (Full-width, shown only when result exists) */}
          {executionState.result && (
            <div className="mb-6">
              <div className="border border-gray-300 dark:border-gray-600 rounded-lg p-6 bg-white dark:bg-gray-800">
                <ExecutionResultPanel
                  result={executionState.result}
                  tokenUsage={executionState.tokenUsage}
                  executionTime={executionState.executionTime}
                  onRetry={handleRetry}
                  isRetrying={executionState.status === 'running'}
                />
              </div>
            </div>
          )}

          {/* Execution History Table */}
          <div className="overflow-x-auto">
            <div className="border border-gray-300 dark:border-gray-600 rounded-lg p-6 bg-white dark:bg-gray-800">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                {t('execute.history.title', { defaultValue: '실행 내역' })}
              </h2>
              <ExecutionHistoryTable
                ref={historyTableRef}
                agentId={_agentId}
              />
            </div>
          </div>
        </>
      )}
    </div>
  )
}
