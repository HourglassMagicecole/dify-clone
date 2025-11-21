'use client'

import type React from 'react'
import { useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeSanitize from 'rehype-sanitize'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import type { TokenUsage, ExecutionTime } from '@/types/agent'

/**
 * Execution result panel props
 */
export interface ExecutionResultPanelProps {
  result: string | null
  tokenUsage: TokenUsage | null
  executionTime: ExecutionTime | null
  onRetry: () => void
  isRetrying?: boolean
}

/**
 * Calculate cost based on token usage (GPT-4 pricing as reference)
 */
function calculateCost(usage: TokenUsage): number {
  if (usage.cost !== undefined) {
    return usage.cost
  }

  // GPT-4 pricing (example)
  const PROMPT_PRICE_PER_1K = 0.03 // $0.03 per 1K prompt tokens
  const COMPLETION_PRICE_PER_1K = 0.06 // $0.06 per 1K completion tokens

  return (
    (usage.prompt_tokens / 1000) * PROMPT_PRICE_PER_1K
    + (usage.completion_tokens / 1000) * COMPLETION_PRICE_PER_1K
  )
}

/**
 * Format execution time in human-readable format
 */
function formatTime(ms: number): string {
  if (ms < 1000) {
    return `${ms}ms`
  }
  return `${(ms / 1000).toFixed(2)}s`
}

/**
 * Format number with thousand separator
 */
function formatNumber(num: number): string {
  return num.toLocaleString('en-US')
}

/**
 * Execution result panel component
 *
 * Features:
 * - Markdown rendering with XSS protection (rehype-sanitize)
 * - Token usage and cost display
 * - Execution time breakdown
 * - Copy to clipboard
 * - Retry button
 */
export function ExecutionResultPanel({
  result,
  tokenUsage,
  executionTime,
  onRetry,
  isRetrying = false,
}: ExecutionResultPanelProps) {
  const { t } = useTranslation('agent')
  const [isCopied, setIsCopied] = useState(false)

  /**
   * Copy result to clipboard
   */
  const handleCopy = async () => {
    if (!result)
      return

    try {
      await navigator.clipboard.writeText(result)
      setIsCopied(true)
      toast.success(t('execute.result.copySuccess', { defaultValue: '결과가 복사되었습니다' }))
      setTimeout(() => setIsCopied(false), 2000)
    }
    catch {
      toast.error(t('execute.result.copyError', { defaultValue: '복사 실패' }))
    }
  }

  if (!result && !tokenUsage && !executionTime) {
    return (
      <div className="text-center py-8 text-gray-500 dark:text-gray-400">
        <p className="text-sm">
          {t('execute.result.empty', {
            defaultValue: 'Agent 실행 후 결과가 여기에 표시됩니다',
          })}
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Result Section */}
      {result && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
              📄
              {' '}
              {t('execute.result.title', { defaultValue: '결과' })}
            </h3>
            <button
              type="button"
              onClick={handleCopy}
              className="text-xs text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white flex items-center space-x-1"
            >
              {isCopied
                ? (
                    <>
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      <span>{t('execute.result.copied', { defaultValue: '복사됨' })}</span>
                    </>
                  )
                : (
                    <>
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                        />
                      </svg>
                      <span>{t('execute.result.copy', { defaultValue: '복사' })}</span>
                    </>
                  )}
            </button>
          </div>

          {/* Markdown result with XSS protection */}
          <div className="prose prose-sm dark:prose-invert max-w-none bg-gray-50 dark:bg-gray-900 p-4 rounded-lg border border-gray-200 dark:border-gray-700 max-h-[600px] overflow-y-auto">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              rehypePlugins={[rehypeSanitize]} // XSS protection
            >
              {result}
            </ReactMarkdown>
          </div>
        </div>
      )}

      {/* Metrics Section */}
      {(tokenUsage || executionTime) && (
        <div>
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">
            📊
            {' '}
            {t('execute.result.metrics.title', { defaultValue: '메트릭' })}
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Token Usage */}
            {tokenUsage && (
              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">
                  {t('execute.result.metrics.tokens', { defaultValue: '토큰' })}
                </p>
                <p className="text-lg font-bold text-gray-900 dark:text-white">
                  {formatNumber(tokenUsage.total_tokens)}
                </p>
                <div className="text-xs text-gray-500 dark:text-gray-400 mt-1 space-y-0.5">
                  <p>
                    {t('execute.result.metrics.promptTokens', { defaultValue: 'P' })}
                    :
                    {' '}
                    {formatNumber(tokenUsage.prompt_tokens)}
                  </p>
                  <p>
                    {t('execute.result.metrics.completionTokens', { defaultValue: 'C' })}
                    :
                    {' '}
                    {formatNumber(tokenUsage.completion_tokens)}
                  </p>
                </div>
              </div>
            )}

            {/* Cost */}
            {tokenUsage && (
              <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
                <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">
                  {t('execute.result.metrics.cost', { defaultValue: '비용' })}
                </p>
                <p className="text-lg font-bold text-gray-900 dark:text-white">
                  $
                  {calculateCost(tokenUsage).toFixed(4)}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  GPT-4
                  {' '}
                  {t('execute.result.metrics.pricing', { defaultValue: '기준' })}
                </p>
              </div>
            )}

            {/* Execution Time */}
            {executionTime && (
              <div className="bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg p-4">
                <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">
                  {t('execute.result.metrics.time', { defaultValue: '시간' })}
                </p>
                <p className="text-lg font-bold text-gray-900 dark:text-white">
                  {formatTime(executionTime.total)}
                </p>
                <div className="text-xs text-gray-500 dark:text-gray-400 mt-1 space-y-0.5">
                  <p>
                    {t('execute.result.metrics.llmTime', { defaultValue: 'LLM' })}
                    :
                    {' '}
                    {formatTime(executionTime.llm)}
                  </p>
                  <p>
                    {t('execute.result.metrics.toolTime', { defaultValue: 'Tool' })}
                    :
                    {' '}
                    {formatTime(executionTime.tool)}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Retry Button */}
      <div className="flex justify-end">
        <button
          type="button"
          onClick={onRetry}
          disabled={isRetrying}
          className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
        >
          {isRetrying
            ? (
                <>
                  <svg
                    className="animate-spin h-4 w-4 text-white"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                  </svg>
                  <span>{t('execute.result.retrying', { defaultValue: '재시도 중...' })}</span>
                </>
              )
            : (
                <>
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                    />
                  </svg>
                  <span>{t('execute.result.retry', { defaultValue: '다시 입력' })}</span>
                </>
              )}
        </button>
      </div>
    </div>
  )
}
