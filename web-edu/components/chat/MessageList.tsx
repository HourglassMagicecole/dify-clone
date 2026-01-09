'use client'

import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import dynamic from 'next/dynamic'
import Image from 'next/image'
import { MessageMetadata } from './MessageMetadata'
import { RetrieverResources } from './RetrieverResources'
import type { Message } from '@/types/chat'

// Dynamically import ECharts to avoid SSR issues
const ReactECharts = dynamic(() => import('echarts-for-react'), { ssr: false })

interface MessageListProps {
  messages: Message[]
  isStreaming: boolean
  streamingContent: string
  onRegenerate?: () => void
  hasConversationSelected?: boolean
}

/**
 * MessageList Component
 * Displays a scrollable list of chat messages with auto-scroll and streaming support
 */
export function MessageList({
  messages,
  isStreaming,
  streamingContent,
  onRegenerate,
  hasConversationSelected = false,
}: MessageListProps) {
  const { t } = useTranslation('chat')
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const [expandedThoughts, setExpandedThoughts] = useState<Set<string>>(new Set())

  // Find last assistant message for regenerate button
  const lastAssistantMessage = messages.findLast((m) => m.role === 'assistant')

  // Toggle thought expansion
  const toggleThought = (messageId: string) => {
    setExpandedThoughts((prev) => {
      const newSet = new Set(prev)
      if (newSet.has(messageId)) {
        newSet.delete(messageId)
      }
      else {
        newSet.add(messageId)
      }
      return newSet
    })
  }

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, streamingContent])

  return (
    <div
      className="h-full overflow-y-auto p-4 space-y-4"
      role="log"
      aria-live="polite"
      aria-label={t('messageList')}
    >
      {/* No conversation selected state */}
      {!hasConversationSelected && messages.length === 0 && !isStreaming && (
        <div className="text-center text-gray-500 mt-8">
          {t('selectConversation')}
        </div>
      )}

      {/* No messages state (conversation selected but empty) */}
      {hasConversationSelected && messages.length === 0 && !isStreaming && (
        <div className="text-center text-gray-500 mt-8">
          {t('noMessages')}
        </div>
      )}

      {/* Messages */}
      {messages.map((message) => (
        <div
          key={message.id}
          className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
        >
          <div
            className={`max-w-[50%] p-3 rounded-lg ${
              message.role === 'user'
                ? 'bg-blue-500 text-white'
                : 'bg-gray-200 text-gray-900'
            }`}
          >
            <div className="whitespace-pre-wrap break-words">{message.content}</div>

            {/* Display charts from agent_thoughts observations automatically */}
            {message.role === 'assistant' && message.agent_thoughts && (() => {
              // Find first chart observation
              for (const thought of message.agent_thoughts) {
                if (!thought.observation) continue

                try {
                  const parsed = JSON.parse(thought.observation)
                  let chartOption = null

                  // Check for nested chart JSON (e.g., {"chart_auto_generator": "{...}"})
                  if (parsed && typeof parsed === 'object') {
                    // Look for chart_auto_generator or similar tool output keys
                    const chartKeys = ['chart_auto_generator', 'chart', 'echarts', 'visualization']
                    for (const key of chartKeys) {
                      if (parsed[key]) {
                        try {
                          // Parse the nested JSON string
                          const nested = typeof parsed[key] === 'string' ? JSON.parse(parsed[key]) : parsed[key]
                          if (nested && (nested.title || nested.xAxis || nested.yAxis || nested.series)) {
                            chartOption = nested
                            break
                          }
                        }
                        catch {
                          // Not valid JSON
                        }
                      }
                    }
                  }

                  // If not found in nested structure, check if parsed itself is a chart
                  if (!chartOption && parsed && (parsed.title || parsed.xAxis || parsed.yAxis || parsed.series)) {
                    chartOption = parsed
                  }

                  if (chartOption) {
                    // Found a chart, render it
                    return (
                      <div className="mt-3 bg-white p-2 rounded-lg border border-gray-200 shadow-sm w-full max-w-full overflow-x-auto">
                        <div style={{ minWidth: '280px', maxWidth: '500px' }}>
                          <ReactECharts
                            option={chartOption}
                            style={{ height: '280px', width: '100%' }}
                            notMerge={true}
                            lazyUpdate={true}
                            opts={{ renderer: 'canvas' }}
                          />
                        </div>
                      </div>
                    )
                  }
                }
                catch {
                  // Not a valid chart, continue
                }
              }
              return null
            })()}

            {/* Display file attachments for user messages */}
            {message.role === 'user' && message.files && message.files.length > 0 && (
              <div className="mt-2 space-y-1">
                {message.files.map((file) => (
                  <div key={file.id} className="text-sm opacity-75">
                    📎 {file.name} ({Math.round(file.size / 1024)}KB)
                  </div>
                ))}
              </div>
            )}

            {/* Display generated files from agent_thoughts for assistant messages */}
            {message.role === 'assistant' && message.agent_thoughts && (() => {
              // Collect all message_files from agent_thoughts
              const allFiles = message.agent_thoughts
                .filter(thought => thought.message_files && thought.message_files.length > 0)
                .flatMap(thought => thought.message_files || [])

              if (allFiles.length === 0) return null

              return (
                <div className="mt-3 space-y-2 -mx-1">
                  {allFiles.map((file, idx) => {
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
                      <div key={file.id || idx}>
                        {isImage && (
                          <a
                            href={file.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="block group relative"
                            style={{ maxHeight: '400px' }}
                          >
                            <Image
                              src={file.url}
                              alt={file.filename || `Generated image ${idx + 1}`}
                              width={800}
                              height={400}
                              className="w-full rounded-lg shadow-md group-hover:shadow-xl transition-all cursor-pointer object-cover"
                              loading="lazy"
                              style={{ maxHeight: '400px' }}
                              unoptimized={url.startsWith('/files/')}
                            />
                          </a>
                        )}
                        {isAudio && (
                          <div className="bg-white bg-opacity-90 rounded-lg p-2 shadow-sm">
                            {file.filename && <p className="text-xs text-gray-600 mb-1">{file.filename}</p>}
                            <audio src={file.url} controls className="w-full">
                              <track kind="captions" />
                            </audio>
                          </div>
                        )}
                        {isVideo && (
                          <video src={file.url} controls className="w-full rounded-lg shadow-md" style={{ maxHeight: '400px' }}>
                            <track kind="captions" />
                          </video>
                        )}
                        {!isImage && !isAudio && !isVideo && (
                          <a
                            href={file.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-2 bg-white bg-opacity-90 rounded-lg p-2 shadow-sm hover:shadow-md transition-all"
                          >
                            <span>📄</span>
                            <span className="text-gray-700 text-sm">{file.filename || 'Download file'}</span>
                            <span className="text-blue-500 ml-auto">↓</span>
                          </a>
                        )}
                      </div>
                    )
                  })}
                </div>
              )
            })()}

            {/* Display RAG references (Story 3.5) */}
            {message.role === 'assistant' && message.retriever_resources && message.retriever_resources.length > 0 && (
              <RetrieverResources resources={message.retriever_resources} />
            )}

            {/* Display agent thoughts (tool usage) for assistant messages - only when tools were actually used */}
            {message.role === 'assistant' && message.agent_thoughts && (() => {
              // Filter to only show thoughts that have actual tool calls
              const toolThoughts = message.agent_thoughts.filter(thought => thought.tool)
              if (toolThoughts.length === 0) return null

              return (
              <div className="mt-3 border-t border-gray-300 pt-2">
                <button
                  onClick={() => toggleThought(message.id)}
                  className="flex items-center gap-2 text-sm text-gray-700 hover:text-gray-900 w-full"
                >
                  <span className={`transform transition-transform ${expandedThoughts.has(message.id) ? 'rotate-90' : ''}`}>
                    ▶
                  </span>
                  <span className="font-medium">
                    {t('toolUsageHistory')} ({toolThoughts.length})
                  </span>
                </button>

                {expandedThoughts.has(message.id) && (
                  <div className="mt-2 space-y-2 max-h-96 overflow-y-auto break-words">
                    {toolThoughts.map((thought, index) => (
                      <div
                        key={thought.id}
                        className="bg-white bg-opacity-50 rounded p-2 text-sm border border-gray-300"
                      >
                        <div className="font-semibold text-gray-800 mb-1">
                          {index + 1}. {thought.tool || t('thinking')}
                        </div>

                        {thought.thought && (
                          <div className="text-gray-600 mb-1">
                            <span className="font-medium">{t('thought')}:</span> {thought.thought}
                          </div>
                        )}

                        {thought.tool_input && (
                          <div className="text-gray-600 mb-1">
                            <span className="font-medium">{t('toolInput')}:</span>
                            <pre className="mt-1 text-xs bg-gray-100 p-1 rounded max-h-40 overflow-y-auto whitespace-pre-wrap break-words">
                              {thought.tool_input}
                            </pre>
                          </div>
                        )}

                        {thought.observation && (() => {
                          // Try to parse observation as chart JSON
                          let chartOption = null
                          try {
                            const parsed = JSON.parse(thought.observation)

                            // Check for nested chart JSON (e.g., {"chart_auto_generator": "{...}"})
                            if (parsed && typeof parsed === 'object') {
                              // Look for chart_auto_generator or similar tool output keys
                              const chartKeys = ['chart_auto_generator', 'chart', 'echarts', 'visualization']
                              for (const key of chartKeys) {
                                if (parsed[key]) {
                                  try {
                                    // Parse the nested JSON string
                                    const nested = typeof parsed[key] === 'string' ? JSON.parse(parsed[key]) : parsed[key]
                                    if (nested && (nested.title || nested.xAxis || nested.yAxis || nested.series)) {
                                      chartOption = nested
                                      break
                                    }
                                  }
                                  catch {
                                    // Not valid JSON
                                  }
                                }
                              }
                            }

                            // If not found in nested structure, check if parsed itself is a chart
                            if (!chartOption && parsed && (parsed.title || parsed.xAxis || parsed.yAxis || parsed.series)) {
                              chartOption = parsed
                            }
                          }
                          catch {
                            // Not valid JSON or not a chart, show as text
                          }

                          if (chartOption) {
                            // Render as ECharts
                            return (
                              <div className="text-gray-600">
                                <span className="font-medium">{t('observation')}:</span>
                                <div className="mt-2 bg-white p-2 rounded border border-gray-200 w-full max-w-full overflow-x-auto">
                                  <div style={{ minWidth: '280px', maxWidth: '500px' }}>
                                    <ReactECharts
                                      option={chartOption}
                                      style={{ height: '280px', width: '100%' }}
                                      notMerge={true}
                                      lazyUpdate={true}
                                      opts={{ renderer: 'canvas' }}
                                    />
                                  </div>
                                </div>
                              </div>
                            )
                          }
                          else {
                            // Render as text
                            return (
                              <div className="text-gray-600">
                                <span className="font-medium">{t('observation')}:</span>
                                <div className="mt-1 text-xs bg-green-50 p-1 rounded max-h-40 overflow-y-auto break-words">
                                  {thought.observation}
                                </div>
                              </div>
                            )
                          }
                        })()}

                        {/* Display generated files (images, audio, documents) */}
                        {thought.message_files && thought.message_files.length > 0 && (
                          <div className="mt-3 border-t border-gray-300 pt-2">
                            <p className="text-sm font-medium text-gray-700 mb-2">
                              {t('generatedFiles')} ({thought.message_files.length})
                            </p>
                            <div className="space-y-3">
                              {thought.message_files.map((file, idx) => {
                                // Improved file type detection
                                const mimeType = file.mime_type || ''
                                const fileType = file.type || '' // MessageFile.type field
                                const url = file.url || ''

                                // Check multiple sources for file type
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
                                  <div key={file.id || idx} className="bg-gradient-to-br from-gray-50 to-white rounded-lg p-3 border border-gray-200 shadow-sm">
                                    {isImage && (
                                      <div className="space-y-2">
                                        <a
                                          href={file.url}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="block group relative"
                                        >
                                          <Image
                                            src={file.url}
                                            alt={file.filename || `Generated image ${idx + 1}`}
                                            width={600}
                                            height={400}
                                            className="w-full rounded-md border border-gray-300 group-hover:border-blue-500 group-hover:shadow-lg transition-all cursor-pointer object-cover"
                                            loading="lazy"
                                            unoptimized={url.startsWith('/files/')}
                                            onError={(e) => {
                                              if (process.env.NODE_ENV === 'development') {
                                                console.error('[ERROR] Failed to load image:', file.url)
                                              }
                                              e.currentTarget.parentElement?.classList.add('hidden')
                                            }}
                                          />
                                        </a>
                                        {file.filename && (
                                          <p className="text-xs text-gray-500 text-center">{file.filename}</p>
                                        )}
                                      </div>
                                    )}
                                    {isAudio && (
                                      <div className="space-y-2">
                                        {file.filename && <p className="text-sm font-medium text-gray-700">{file.filename}</p>}
                                        <audio src={file.url} controls className="w-full">
                                          <track kind="captions" />
                                        </audio>
                                      </div>
                                    )}
                                    {isVideo && (
                                      <div className="space-y-2">
                                        {file.filename && <p className="text-sm font-medium text-gray-700">{file.filename}</p>}
                                        <video src={file.url} controls className="w-full rounded-md">
                                          <track kind="captions" />
                                        </video>
                                      </div>
                                    )}
                                    {!isImage && !isAudio && !isVideo && (
                                      <a
                                        href={file.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="flex items-center gap-3 p-2 hover:bg-gray-100 rounded transition-colors"
                                      >
                                        <span className="text-3xl">📄</span>
                                        <div className="flex-1">
                                          <p className="text-sm font-medium text-gray-900">
                                            {file.filename || t('downloadFile')}
                                          </p>
                                          {file.size && (
                                            <p className="text-xs text-gray-500">
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
                      </div>
                    ))}
                  </div>
                )}
              </div>
              )
            })()}

            {/* Display metadata for assistant messages */}
            {message.role === 'assistant' && (
              <>
                <MessageMetadata tokenUsage={message.tokenUsage} responseTime={message.responseTime} />
                {/* Regenerate button for last assistant message */}
                {message.id === lastAssistantMessage?.id && onRegenerate && !isStreaming && (
                  <button
                    onClick={onRegenerate}
                    className="mt-2 text-sm text-blue-500 hover:underline"
                    aria-label={t('regenerateButton')}
                  >
                    🔄 {t('regenerateButton')}
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      ))}

      {/* Preparing response indicator */}
      {isStreaming && !streamingContent && (
        <div className="flex justify-start">
          <div className="max-w-[50%] p-3 rounded-lg bg-gray-200 text-gray-900">
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <div className="flex gap-1">
                <span className="animate-bounce" style={{ animationDelay: '0ms' }}>●</span>
                <span className="animate-bounce" style={{ animationDelay: '150ms' }}>●</span>
                <span className="animate-bounce" style={{ animationDelay: '300ms' }}>●</span>
              </div>
              <span>{t('preparingResponse')}</span>
            </div>
          </div>
        </div>
      )}

      {/* Streaming message */}
      {isStreaming && streamingContent && (
        <div className="flex justify-start">
          <div className="max-w-[50%] p-3 rounded-lg bg-gray-200 text-gray-900">
            <div className="whitespace-pre-wrap break-words">
              {streamingContent}
              <span className="animate-pulse">▋</span>
            </div>
          </div>
        </div>
      )}

      {/* Screen reader announcement for streaming */}
      {isStreaming && (
        <div role="status" aria-live="polite" className="sr-only">
          {t('assistantTyping')}
        </div>
      )}

      {/* Auto-scroll anchor */}
      <div ref={messagesEndRef} />
    </div>
  )
}
