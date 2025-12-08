/**
 * Retriever Resources Component
 * Story 3.5: Connect RAG to Agent
 *
 * Displays RAG search results (knowledge base references) in chat messages
 * with collapsible content and score visualization
 */

'use client'

import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { CircleStackIcon, DocumentTextIcon, ChevronDownIcon, ChevronUpIcon } from '@heroicons/react/24/outline'
import type { RetrieverResource } from '@/types/chat'

interface RetrieverResourcesProps {
  resources: RetrieverResource[]
}

/**
 * Score badge color based on similarity score
 */
function getScoreColor(score: number): string {
  if (score >= 0.8) return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
  if (score >= 0.6) return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400'
  return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-400'
}

export function RetrieverResources({ resources }: RetrieverResourcesProps): React.ReactElement | null {
  const { t } = useTranslation('chat')
  const [isExpanded, setIsExpanded] = useState(false)
  const [expandedItems, setExpandedItems] = useState<Set<number>>(new Set())

  if (!resources || resources.length === 0) {
    return null
  }

  const toggleItem = (position: number) => {
    setExpandedItems(prev => {
      const newSet = new Set(prev)
      if (newSet.has(position)) {
        newSet.delete(position)
      } else {
        newSet.add(position)
      }
      return newSet
    })
  }

  // Sort by position
  const sortedResources = [...resources].sort((a, b) => a.position - b.position)

  return (
    <div className="mt-3 border-t border-gray-300 dark:border-gray-600 pt-2">
      {/* Header Toggle */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white w-full"
      >
        <CircleStackIcon className="h-4 w-4 text-blue-500" />
        <span className="font-medium">
          {t('retrieverResources.title', 'Knowledge Base References')} ({resources.length})
        </span>
        {isExpanded ? (
          <ChevronUpIcon className="h-4 w-4 ml-auto" />
        ) : (
          <ChevronDownIcon className="h-4 w-4 ml-auto" />
        )}
      </button>

      {/* Expanded Content */}
      {isExpanded && (
        <div className="mt-2 space-y-2 max-h-96 overflow-y-auto">
          {sortedResources.map((resource) => {
            const isItemExpanded = expandedItems.has(resource.position)
            return (
              <div
                key={`${resource.segment_id}-${resource.position}`}
                className="bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800 overflow-hidden"
              >
                {/* Resource Header */}
                <button
                  onClick={() => toggleItem(resource.position)}
                  className="w-full px-3 py-2 flex items-center gap-2 text-left hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors"
                >
                  <span className="flex-shrink-0 w-6 h-6 flex items-center justify-center bg-blue-500 text-white rounded-full text-xs font-bold">
                    {resource.position}
                  </span>
                  <DocumentTextIcon className="h-4 w-4 text-blue-600 dark:text-blue-400 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                      {resource.document_name}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                      {resource.dataset_name}
                    </p>
                  </div>
                  <span className={`flex-shrink-0 px-2 py-0.5 text-xs font-medium rounded ${getScoreColor(resource.score)}`}>
                    {(resource.score * 100).toFixed(0)}%
                  </span>
                  {isItemExpanded ? (
                    <ChevronUpIcon className="h-4 w-4 text-gray-400" />
                  ) : (
                    <ChevronDownIcon className="h-4 w-4 text-gray-400" />
                  )}
                </button>

                {/* Resource Content */}
                {isItemExpanded && (
                  <div className="px-3 pb-3 border-t border-blue-200 dark:border-blue-800">
                    <p className="mt-2 text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap break-words">
                      {resource.content}
                    </p>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
