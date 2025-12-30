'use client'

import type React from 'react'
import { useState, useEffect } from 'react'
import Image from 'next/image'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeSanitize from 'rehype-sanitize'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import type { TokenUsage, ExecutionTime, AgentThought } from '@/types/agent'
import type { MessageFile } from '@/types/chat'
import { getMessageUsageCost } from '@/service/usage-analytics-api'

/**
 * Execution result panel props
 */
export interface ExecutionResultPanelProps {
  result: string | null
  tokenUsage: TokenUsage | null
  executionTime: ExecutionTime | null
  agentThoughts?: AgentThought[]
  messageId?: string | null
  onRetry: () => void
  isRetrying?: boolean
}

/**
 * Format execution time in human-readable format
 */
function formatTime(ms: number): string {
  if (ms < 1000) {
    return `${ms.toFixed(2)}ms`
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
  agentThoughts = [],
  messageId,
  onRetry,
  isRetrying = false,
}: ExecutionResultPanelProps) {
  const { t } = useTranslation('agent')
  const [isCopied, setIsCopied] = useState(false)
  const [showDebugModal, setShowDebugModal] = useState(false)

  // Cost loading state
  const [cost, setCost] = useState<string | null>(null)
  const [costLoading, setCostLoading] = useState(false)

  // Fetch cost when messageId is available
  useEffect(() => {
    if (!messageId) {
      setCost(null)
      return
    }

    let cancelled = false
    const fetchCostWithRetry = async (retries = 3, delay = 2000) => {
      setCostLoading(true)
      try {
        for (let attempt = 0; attempt < retries && !cancelled; attempt++) {
          // Wait before each attempt to allow backend to process the usage log
          await new Promise(resolve => setTimeout(resolve, delay))

          const response = await getMessageUsageCost(messageId)
          if (!cancelled && response.result === 'success' && response.data) {
            const price = parseFloat(response.data.total_price)
            // If price is 0 and we have retries left, try again
            if (price === 0 && attempt < retries - 1) {
              continue
            }
            setCost(price > 0 ? `$${price.toFixed(4)}` : '$0.0000')
            return
          }
        }
        // All retries exhausted with 0 cost
        if (!cancelled) {
          setCost('$0.0000')
        }
      } catch (error) {
        console.error('Failed to fetch message cost:', error)
        if (!cancelled) {
          setCost(null)
        }
      } finally {
        if (!cancelled) {
          setCostLoading(false)
        }
      }
    }

    fetchCostWithRetry()

    return () => {
      cancelled = true
    }
  }, [messageId])

  // Extract all message_files from agent_thoughts
  // Method 1: Direct message_files field (standard way)
  const filesFromMessageFiles = agentThoughts
    .filter(thought => thought.message_files && thought.message_files.length > 0)
    .flatMap(thought => thought.message_files || [])

  // Method 2: Extract from tool_output (for tools that return file paths as strings)
  // Only extract from tool_output if message_files is not available (to avoid duplicates)
  const filesFromToolOutput = agentThoughts
    .filter(thought => thought.tool_output && typeof thought.tool_output === 'string' && (!thought.message_files || thought.message_files.length === 0))
    .flatMap((thought) => {
      if (!thought.tool_output) return []

      try {
        // Look for file path patterns like: text='/files/tools/xxx.docx'
        const filePathRegex = /(?:text=)?['"]?(\/files\/[^'"]+)['"]?/
        const match = thought.tool_output.match(filePathRegex)

        if (match && match[1]) {
          const filePath = match[1]
          const filename = filePath.split('/').pop() || 'download'

          // Convert relative path to absolute URL (use API base URL, not frontend URL)
          const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL !== undefined
            ? process.env.NEXT_PUBLIC_API_BASE_URL
            : 'http://localhost:5001'
          const fileUrl = `${apiBaseUrl}${filePath}`

          // Determine file type from extension
          const ext = filename.split('.').pop()?.toLowerCase() || ''
          let fileType = 'document'
          if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg'].includes(ext)) {
            fileType = 'image'
          }
          else if (['mp3', 'wav', 'ogg', 'm4a', 'aac'].includes(ext)) {
            fileType = 'audio'
          }
          else if (['mp4', 'webm', 'ogg'].includes(ext)) {
            fileType = 'video'
          }

          return [{
            id: `extracted-${Date.now()}-${Math.random()}`,
            type: fileType,
            url: fileUrl,
            filename,
            mime_type: `application/${ext}`,
          }]
        }
      }
      catch {
        // Not JSON or no match
      }
      return []
    })

  // Combine both methods
  const allFiles = [...filesFromMessageFiles, ...filesFromToolOutput]

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
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
                📄
                {' '}
                {t('execute.result.title', { defaultValue: '결과' })}
              </h3>
              {/* DEBUG Button */}
              {agentThoughts.length > 0 && (
                <button
                  type="button"
                  onClick={() => setShowDebugModal(true)}
                  className="px-2 py-1 text-xs font-medium text-yellow-700 dark:text-yellow-300 bg-yellow-100 dark:bg-yellow-900/30 border border-yellow-300 dark:border-yellow-700 rounded hover:bg-yellow-200 dark:hover:bg-yellow-900/50 transition-colors"
                >
                  🔍 DEBUG
                </button>
              )}
            </div>
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

      {/* Generated Files Section */}
      {allFiles.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">
            📎
            {' '}
            {t('execute.result.files', { defaultValue: '생성된 파일' })}
            {' '}
            ({allFiles.length})
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {allFiles.map((file: MessageFile, idx: number) => {
              const mimeType = file.mime_type || ''
              const fileType = file.type || ''
              const url = file.url || ''

              const isImage = fileType === 'image'
                || mimeType.startsWith('image/')
                || /\.(jpg|jpeg|png|gif|webp|bmp|svg)(\?|$)/i.test(url)

              const isAudio = fileType === 'audio'
                || mimeType.startsWith('audio/')
                || /\.(mp3|wav|ogg|m4a|aac)(\?|$)/i.test(url)

              const isVideo = fileType === 'video'
                || mimeType.startsWith('video/')
                || /\.(mp4|webm|ogg)(\?|$)/i.test(url)

              return (
                <div key={file.id || idx} className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
                  {isImage && (
                    <a
                      href={file.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block group relative"
                    >
                      <Image
                        src={file.url}
                        alt={file.filename || `Generated image ${idx + 1}`}
                        width={800}
                        height={400}
                        className="w-full rounded-lg shadow-md group-hover:shadow-xl transition-all cursor-pointer object-cover"
                        loading="lazy"
                        style={{ maxHeight: '400px' }}
                      />
                      {file.filename && (
                        <p className="text-xs text-gray-500 dark:text-gray-400 text-center mt-2">{file.filename}</p>
                      )}
                    </a>
                  )}
                  {isAudio && (
                    <div className="space-y-2">
                      {file.filename && <p className="text-sm font-medium text-gray-700 dark:text-gray-300">{file.filename}</p>}
                      <audio src={file.url} controls className="w-full">
                        <track kind="captions" />
                      </audio>
                    </div>
                  )}
                  {isVideo && (
                    <div className="space-y-2">
                      {file.filename && <p className="text-sm font-medium text-gray-700 dark:text-gray-300">{file.filename}</p>}
                      <video src={file.url} controls className="w-full rounded-lg" style={{ maxHeight: '400px' }}>
                        <track kind="captions" />
                      </video>
                    </div>
                  )}
                  {!isImage && !isAudio && !isVideo && (
                    <a
                      href={file.url}
                      download={file.filename || 'download'}
                      className="flex items-center gap-3 p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded transition-colors cursor-pointer"
                    >
                      <span className="text-3xl">📄</span>
                      <div className="flex-1">
                        <p className="text-sm font-medium text-gray-900 dark:text-white">
                          {file.filename || t('execute.result.downloadFile', { defaultValue: '파일 다운로드' })}
                        </p>
                        {file.size && (
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            {(file.size / 1024).toFixed(2)} KB
                          </p>
                        )}
                      </div>
                      <span className="text-blue-500 text-sm">↓</span>
                    </a>
                  )}
                </div>
              )
            })}
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
                <p className="text-lg font-bold text-gray-900 dark:text-white mb-3">
                  {formatNumber(tokenUsage.total_tokens)}
                </p>
                <div className="space-y-2">
                  {/* Input Tokens */}
                  <div className="bg-white/50 dark:bg-gray-800/50 rounded p-2">
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
                        {t('execute.result.metrics.inputTokens', { defaultValue: '입력 (Prompt)' })}
                      </span>
                      <span className="text-sm font-semibold text-gray-900 dark:text-white">
                        {formatNumber(tokenUsage.prompt_tokens)}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {t('execute.result.metrics.inputTokensDesc', { defaultValue: '사용자 입력, 시스템 프롬프트, 도구 정의, 대화 컨텍스트 등' })}
                    </p>
                  </div>
                  {/* Output Tokens */}
                  <div className="bg-white/50 dark:bg-gray-800/50 rounded p-2">
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
                        {t('execute.result.metrics.outputTokens', { defaultValue: '출력 (Completion)' })}
                      </span>
                      <span className="text-sm font-semibold text-gray-900 dark:text-white">
                        {formatNumber(tokenUsage.completion_tokens)}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {t('execute.result.metrics.outputTokensDesc', { defaultValue: 'LLM이 생성한 응답, 도구 호출, 최종 답변 등' })}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Execution Time */}
            {executionTime && (
              <div className="bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg p-4">
                <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">
                  {t('execute.result.metrics.time', { defaultValue: '실행 시간' })}
                </p>
                <p className="text-lg font-bold text-gray-900 dark:text-white mb-3">
                  {formatTime(executionTime.total)}
                </p>
                <div className="space-y-2">
                  {/* LLM Time */}
                  <div className="bg-white/50 dark:bg-gray-800/50 rounded p-2">
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
                        {t('execute.result.metrics.llmTime', { defaultValue: 'LLM' })}
                      </span>
                      <span className="text-sm font-semibold text-gray-900 dark:text-white">
                        {formatTime(executionTime.llm)}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {t('execute.result.metrics.llmTimeDesc', { defaultValue: '모델 응답 대기 시간' })}
                    </p>
                  </div>
                  {/* Tool Time */}
                  <div className="bg-white/50 dark:bg-gray-800/50 rounded p-2">
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
                        {t('execute.result.metrics.toolTime', { defaultValue: 'Tool' })}
                      </span>
                      <span className="text-sm font-semibold text-gray-900 dark:text-white">
                        {formatTime(executionTime.tool)}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {t('execute.result.metrics.toolTimeDesc', { defaultValue: '도구 실행 시간' })}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Cost */}
            <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
              <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">
                {t('execute.result.metrics.cost', { defaultValue: '비용' })}
              </p>
              <p className="text-lg font-bold text-gray-900 dark:text-white mb-3">
                {costLoading ? (
                  <span className="inline-flex items-center gap-2">
                    <svg className="animate-spin h-4 w-4 text-green-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <span className="text-sm font-normal text-gray-500">
                      {t('execute.result.metrics.costLoading', { defaultValue: '계산 중...' })}
                    </span>
                  </span>
                ) : cost !== null ? (
                  cost
                ) : (
                  <span className="text-gray-400">-</span>
                )}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {t('execute.result.metrics.costDesc', { defaultValue: 'API 사용 비용 (가격 설정 반영)' })}
              </p>
            </div>
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
                  <span>{t('execute.result.running', { defaultValue: '작성중...' })}</span>
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

      {/* DEBUG Modal */}
      {showDebugModal && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
          onClick={() => setShowDebugModal(false)}
        >
          <div
            className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-4xl w-full mx-4 max-h-[80vh] overflow-hidden flex flex-col"
            onClick={e => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="sticky top-0 bg-yellow-50 dark:bg-yellow-900/30 border-b border-yellow-300 dark:border-yellow-700 p-4 flex justify-between items-center">
              <h3 className="text-lg font-bold text-yellow-900 dark:text-yellow-200">
                🔍 DEBUG: Agent Thoughts 구조
              </h3>
              <button
                type="button"
                onClick={() => setShowDebugModal(false)}
                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 text-xl font-bold"
                aria-label={t('execute.close', { defaultValue: '닫기' })}
              >
                ✕
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-4 overflow-y-auto flex-1">
              <div className="text-sm space-y-4">
                <p className="text-yellow-800 dark:text-yellow-300 font-medium">
                  총 {agentThoughts.length}개의 thoughts
                </p>
                <pre className="bg-gray-100 dark:bg-gray-900 p-4 rounded-lg max-h-96 overflow-auto text-xs text-gray-900 dark:text-gray-100 border border-gray-200 dark:border-gray-700">
                  {JSON.stringify(agentThoughts, null, 2)}
                </pre>
                <p className="text-yellow-800 dark:text-yellow-300 font-semibold">
                  추출된 파일: {allFiles.length}개
                </p>
                {allFiles.length > 0 && (
                  <pre className="bg-gray-100 dark:bg-gray-900 p-4 rounded-lg max-h-48 overflow-auto text-xs text-gray-900 dark:text-gray-100 border border-gray-200 dark:border-gray-700">
                    {JSON.stringify(allFiles, null, 2)}
                  </pre>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
