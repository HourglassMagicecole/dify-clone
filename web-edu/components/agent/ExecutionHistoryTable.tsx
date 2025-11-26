'use client'

import type React from 'react'
import { useState, useEffect, useImperativeHandle, forwardRef, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import type { TokenUsage } from '@/types/agent'
import { agentAPI } from '@/service/agent-api'

/**
 * Execution record for history
 */
export interface ExecutionRecord {
  id: string
  inputs: Record<string, unknown>
  result: string
  status: 'success' | 'failed'
  created_at: string // ISO 8601
  token_usage: TokenUsage
  execution_time: number // ms
}

/**
 * Execution history table props
 */
export interface ExecutionHistoryTableProps {
  agentId: string
  records?: ExecutionRecord[] // Optional: can be passed from parent or fetched internally
}

/**
 * Ref methods exposed to parent
 */
export interface ExecutionHistoryTableRef {
  refresh: () => Promise<void>
}

/**
 * Calculate cost from token usage
 * TODO: Use this when adding cost column to the table
 */
// function calculateCost(usage: TokenUsage): number {
//   if (usage.cost !== undefined) {
//     return usage.cost
//   }
//
//   const PROMPT_PRICE_PER_1K = 0.03
//   const COMPLETION_PRICE_PER_1K = 0.06
//
//   return (
//     (usage.prompt_tokens / 1000) * PROMPT_PRICE_PER_1K
//     + (usage.completion_tokens / 1000) * COMPLETION_PRICE_PER_1K
//   )
// }

/**
 * Format execution time
 * TODO: Use this when adding execution time column to the table
 */
// function formatTime(ms: number): string {
//   if (ms < 1000) {
//     return `${ms}ms`
//   }
//   return `${(ms / 1000).toFixed(2)}s`
// }

/**
 * Format date
 */
function formatDate(isoString: string): string {
  const date = new Date(isoString)
  return date.toLocaleString('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

/**
 * Summarize inputs for display
 */
function summarizeInputs(inputs: Record<string, unknown>): string {
  const entries = Object.entries(inputs)
  if (entries.length === 0)
    return '-'

  // Take first 2 fields
  const summary = entries.slice(0, 2).map(([key, value]) => {
    let displayValue = String(value)
    if (typeof value === 'object' && value !== null && 'name' in value) {
      // File object
      displayValue = (value as { name: string }).name
    }
    else if (displayValue.length > 20) {
      displayValue = `${displayValue.slice(0, 20)}...`
    }
    return `${key}: ${displayValue}`
  })

  if (entries.length > 2) {
    summary.push(`+${entries.length - 2} more`)
  }

  return summary.join(', ')
}

/**
 * Execution history table component
 *
 * Features:
 * - Display recent execution history (max 20)
 * - Show inputs, status, metrics
 * - Rerun functionality
 * - Pagination support
 * - Responsive design (mobile scrollable)
 */
export const ExecutionHistoryTable = forwardRef<ExecutionHistoryTableRef, ExecutionHistoryTableProps>(({
  agentId,
  records = [],
}, ref) => {
  const { t } = useTranslation('agent')
  const [historyRecords, setHistoryRecords] = useState<ExecutionRecord[]>(records)
  const [isLoading, setIsLoading] = useState(false)

  // Load execution history from API (via Next.js API Route)
  const loadHistory = useCallback(async () => {
    if (records.length > 0) {
      setHistoryRecords(records)
      return
    }

    try {
      setIsLoading(true)
      const response = await agentAPI.getExecutionHistory(agentId, { limit: 5 })

      // eslint-disable-next-line no-console
      console.log('[ExecutionHistoryTable] API response:', response)
      const firstItem = Array.isArray(response) ? response[0] : response.data?.[0]
      // eslint-disable-next-line no-console
      console.log('[ExecutionHistoryTable] First item:', firstItem)
      // eslint-disable-next-line no-console
      console.log('[ExecutionHistoryTable] First item.message:', firstItem?.message)
      // eslint-disable-next-line no-console
      console.log('[ExecutionHistoryTable] Token fields check:', {
        message_tokens: firstItem?.message_tokens,
        answer_tokens: firstItem?.answer_tokens,
        total_tokens: firstItem?.total_tokens,
        provider_response_latency: firstItem?.provider_response_latency,
      })

        // Handle both response formats: { data: [...] } or [...]
        const conversations = Array.isArray(response) ? response : (response.data || [])

        // Check if we have conversations
        if (!Array.isArray(conversations) || conversations.length === 0) {
          console.warn('[ExecutionHistoryTable] No conversations found:', response)
          setHistoryRecords([])
          return
        }

        // Transform API response to ExecutionRecord format
        // Note: completion-conversations API doesn't provide token/latency info
        // Use fallback values for now
        const transformedRecords: ExecutionRecord[] = conversations.map(item => {
          // Check both Conversation.status and Message.status for error detection
          // Backend sets Message.status = 'error' when execution fails
          const messageStatus = item.message?.status as string | undefined
          const conversationStatus = item.status as string
          const isError = conversationStatus !== 'normal' || messageStatus === 'error'

          return {
            id: item.id,
            inputs: item.message?.inputs || {},
            result: item.message?.answer || '',
            status: isError ? 'failed' : 'success',
            created_at: new Date(item.created_at * 1000).toISOString(), // Unix timestamp to ISO
            token_usage: {
              prompt_tokens: item.message_tokens || item.message?.message_tokens || 0,
              completion_tokens: item.answer_tokens || item.message?.answer_tokens || 0,
              total_tokens: item.total_tokens || item.message?.total_tokens || 0,
            },
            execution_time: (item.provider_response_latency || item.message?.provider_response_latency || 0) * 1000,
          }
        })

        setHistoryRecords(transformedRecords)
      }
    catch (error) {
      console.error('[ExecutionHistoryTable] Failed to load history:', error)
      setHistoryRecords([])
    }
    finally {
      setIsLoading(false)
    }
  }, [agentId, records])

  // Initial load
  useEffect(() => {
    loadHistory()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agentId])

  // Expose refresh method to parent component
  useImperativeHandle(ref, () => ({
    refresh: async () => {
      await loadHistory()
    },
  }), [loadHistory])


  // Loading state
  if (isLoading) {
    return (
      <div className="text-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
          {t('execute.history.loading', { defaultValue: '실행 내역을 불러오는 중...' })}
        </p>
      </div>
    )
  }

  if (historyRecords.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500 dark:text-gray-400">
        <p className="text-sm">
          {t('execute.history.empty', {
            defaultValue: '실행 내역이 없습니다',
          })}
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Table - Desktop */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
            <tr>
              <th className="px-4 py-3 text-left font-medium text-gray-700 dark:text-gray-300">
                {t('execute.history.columns.time', { defaultValue: '실행 시간' })}
              </th>
              <th className="px-4 py-3 text-left font-medium text-gray-700 dark:text-gray-300">
                {t('execute.history.columns.inputs', { defaultValue: '입력' })}
              </th>
              <th className="px-4 py-3 text-left font-medium text-gray-700 dark:text-gray-300">
                {t('execute.history.columns.status', { defaultValue: '상태' })}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
            {historyRecords.map(record => (
              <tr
                key={record.id}
                className="hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
              >
                <td className="px-4 py-3 text-gray-900 dark:text-white whitespace-nowrap">
                  {formatDate(record.created_at)}
                </td>
                <td className="px-4 py-3 text-gray-600 dark:text-gray-400 max-w-xs truncate">
                  {summarizeInputs(record.inputs)}
                </td>
                <td className="px-4 py-3">
                  {record.status === 'success'
                    ? (
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
                          ✅ Success
                        </span>
                      )
                    : (
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400">
                          ❌ Failed
                        </span>
                      )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Cards - Mobile */}
      <div className="md:hidden space-y-3">
        {historyRecords.map(record => (
          <div
            key={record.id}
            className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 bg-white dark:bg-gray-800"
          >
            <div className="flex items-start justify-between mb-2">
              <div className="text-sm text-gray-600 dark:text-gray-400">
                {formatDate(record.created_at)}
              </div>
              {record.status === 'success'
                ? (
                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
                      ✅ Success
                    </span>
                  )
                : (
                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400">
                      ❌ Failed
                    </span>
                  )}
            </div>

            <div className="text-sm text-gray-700 dark:text-gray-300">
              {summarizeInputs(record.inputs)}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
})

ExecutionHistoryTable.displayName = 'ExecutionHistoryTable'
