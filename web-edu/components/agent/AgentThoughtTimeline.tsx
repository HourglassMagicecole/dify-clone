'use client'

import type React from 'react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { AgentThought } from '@/types/agent'

/**
 * Agent thought timeline props
 */
export interface AgentThoughtTimelineProps {
  thoughts: AgentThought[]
  onWhyClick?: (thought: AgentThought) => void
}

/**
 * Format execution time in human-readable format
 */
function formatExecutionTime(ms: number): string {
  if (ms < 1000) {
    return `${ms}ms`
  }
  return `${(ms / 1000).toFixed(1)}s`
}

/**
 * Format timestamp as relative time
 */
function formatRelativeTime(timestamp: number): string {
  const now = Date.now()
  const diff = now - timestamp
  const seconds = Math.floor(diff / 1000)

  if (seconds < 60) {
    return `${seconds}초 전`
  }
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) {
    return `${minutes}분 전`
  }
  const hours = Math.floor(minutes / 60)
  if (hours < 24) {
    return `${hours}시간 전`
  }
  const days = Math.floor(hours / 24)
  return `${days}일 전`
}

/**
 * Agent thought timeline component
 *
 * Displays agent's reasoning process and tool executions in a vertical timeline
 *
 * Features:
 * - Chronological display of agent thoughts
 * - Tool call information (name, input, output)
 * - Execution time tracking
 * - Collapsible tool input/output
 * - "Why?" button for educational purposes
 */
export function AgentThoughtTimeline({ thoughts, onWhyClick }: AgentThoughtTimelineProps) {
  const { t } = useTranslation()
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set())

  /**
   * Toggle expand/collapse for tool input/output
   */
  const toggleExpand = (id: string, section: 'input' | 'output') => {
    const key = `${id}-${section}`
    const newExpanded = new Set(expandedItems)
    if (newExpanded.has(key)) {
      newExpanded.delete(key)
    }
    else {
      newExpanded.add(key)
    }
    setExpandedItems(newExpanded)
  }

  const isExpanded = (id: string, section: 'input' | 'output') => {
    return expandedItems.has(`${id}-${section}`)
  }

  /**
   * Calculate execution time between thoughts
   */
  const getExecutionTime = (index: number): number | null => {
    if (index === thoughts.length - 1)
      return null
    const current = thoughts[index]
    const next = thoughts[index + 1]
    return next.created_at - current.created_at
  }

  if (thoughts.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500 dark:text-gray-400">
        <p className="text-sm">
          {t('execute.timeline.empty', {
            defaultValue: 'Agent 실행 시 처리 단계가 여기에 표시됩니다',
          })}
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {thoughts.map((thought, index) => {
        const executionTime = getExecutionTime(index)

        return (
          <div key={thought.id} className="relative">
            {/* Vertical connecting line */}
            {index < thoughts.length - 1 && (
              <div className="absolute left-5 top-12 bottom-0 w-0.5 bg-gray-300 dark:bg-gray-600" />
            )}

            {/* Agent Thought Card */}
            <div className="relative bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
              {/* Icon */}
              <div className="absolute -left-2 top-4 w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center">
                <svg
                  className="w-5 h-5 text-white"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
                  />
                </svg>
              </div>

              {/* Content */}
              <div className="ml-10">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-900 dark:text-white">
                      {t('execute.timeline.thought', { defaultValue: 'Agent 사고' })}
                    </p>
                    <p className="text-sm text-gray-700 dark:text-gray-300 mt-1">
                      {thought.thought}
                    </p>
                  </div>
                  <span className="text-xs text-gray-500 dark:text-gray-400 ml-2">
                    {formatRelativeTime(thought.created_at)}
                  </span>
                </div>
              </div>
            </div>

            {/* Tool Call Card (if exists) */}
            {thought.tool && (
              <div className="relative bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4 mt-2 ml-4">
                {/* Icon */}
                <div className="absolute -left-6 top-4 w-10 h-10 bg-green-500 rounded-full flex items-center justify-center">
                  <svg
                    className="w-5 h-5 text-white"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                    />
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                    />
                  </svg>
                </div>

                {/* Content */}
                <div className="ml-6">
                  {/* Tool name */}
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm font-semibold text-gray-900 dark:text-white">
                      🔧
                      {' '}
                      {thought.tool}
                    </p>
                    {executionTime !== null && (
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        {formatExecutionTime(executionTime)}
                      </span>
                    )}
                  </div>

                  {/* Tool Input */}
                  <div className="mb-2">
                    <button
                      type="button"
                      onClick={() => toggleExpand(thought.id, 'input')}
                      className="flex items-center text-xs font-medium text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white"
                    >
                      <span>
                        📥
                        {' '}
                        {t('execute.timeline.input', { defaultValue: '입력' })}
                      </span>
                      <svg
                        className={`w-4 h-4 ml-1 transform transition-transform ${isExpanded(thought.id, 'input') ? 'rotate-180' : ''}`}
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                    {isExpanded(thought.id, 'input') && (
                      <pre className="mt-1 text-xs bg-white dark:bg-gray-800 p-2 rounded border border-gray-200 dark:border-gray-700 overflow-x-auto">
                        {JSON.stringify(thought.tool_input, null, 2)}
                      </pre>
                    )}
                  </div>

                  {/* Tool Output */}
                  {thought.tool_output && (
                    <div className="mb-2">
                      <button
                        type="button"
                        onClick={() => toggleExpand(thought.id, 'output')}
                        className="flex items-center text-xs font-medium text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white"
                      >
                        <span>
                          📤
                          {' '}
                          {t('execute.timeline.output', { defaultValue: '출력' })}
                        </span>
                        <svg
                          className={`w-4 h-4 ml-1 transform transition-transform ${isExpanded(thought.id, 'output') ? 'rotate-180' : ''}`}
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </button>
                      {isExpanded(thought.id, 'output') && (
                        <div className="mt-1 text-xs bg-white dark:bg-gray-800 p-2 rounded border border-gray-200 dark:border-gray-700 overflow-x-auto max-h-48 overflow-y-auto">
                          {thought.tool_output}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Observation */}
                  {thought.observation && (
                    <p className="text-xs text-gray-600 dark:text-gray-400 mb-2">
                      💡
                      {' '}
                      {thought.observation}
                    </p>
                  )}

                  {/* Why button */}
                  {onWhyClick && (
                    <button
                      type="button"
                      onClick={() => onWhyClick(thought)}
                      className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 font-medium"
                    >
                      {t('execute.timeline.whyButton', { defaultValue: 'Why?' })}
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
