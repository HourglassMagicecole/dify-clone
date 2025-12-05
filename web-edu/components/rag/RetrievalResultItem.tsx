/**
 * Retrieval Result Item Component
 * Story 3.4: RAG Search Test Interface
 *
 * Displays a single search result with score and content highlighting
 */

'use client'

import React, { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { DocumentTextIcon } from '@heroicons/react/24/outline'
import type { HitTestingRecord, SearchMethod } from '@/types/dataset'

interface RetrievalResultItemProps {
  record: HitTestingRecord
  rank: number
  query: string
  searchMethod: SearchMethod
}

export function RetrievalResultItem({
  record,
  rank,
  query,
  searchMethod,
}: RetrievalResultItemProps): React.ReactElement {
  const { t } = useTranslation('dataset')
  const { segment, score } = record

  /**
   * Get score color based on value
   * null: gray (no score - full-text search)
   * 0.8+: green (high relevance)
   * 0.6+: yellow (medium relevance)
   * <0.6: red (low relevance)
   */
  const getScoreColor = (score: number | null): string => {
    if (score === null) return 'text-gray-600 bg-gray-100 dark:text-gray-400 dark:bg-gray-700'
    if (score >= 0.8) return 'text-green-600 bg-green-100 dark:text-green-400 dark:bg-green-900/30'
    if (score >= 0.6) return 'text-yellow-600 bg-yellow-100 dark:text-yellow-400 dark:bg-yellow-900/30'
    return 'text-red-600 bg-red-100 dark:text-red-400 dark:bg-red-900/30'
  }

  /**
   * Highlight query keywords in content (substring matching)
   * Returns both highlighted content and matched words for hint display
   */
  const { highlightedContent, matchedWords } = useMemo(() => {
    if (!query.trim()) {
      return { highlightedContent: segment.content, matchedWords: [] as string[] }
    }

    // Split query into words (allow single char for CJK)
    const words = query.trim().split(/\s+/).filter(w => w.length >= 1)
    if (words.length === 0) {
      return { highlightedContent: segment.content, matchedWords: [] as string[] }
    }

    // Escape regex special chars
    const escapedWords = words.map(w =>
      w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    )
    // Pattern matches query words as substrings (case-insensitive)
    const pattern = new RegExp(`(${escapedWords.join('|')})`, 'gi')

    // Track which words were actually found
    const foundWords = new Set<string>()
    const parts = segment.content.split(pattern)

    const content = parts.map((part, i) => {
      // Check if this part matches any query word (substring match)
      const matchedWord = words.find(w =>
        part.toLowerCase().includes(w.toLowerCase())
      )
      if (matchedWord) {
        foundWords.add(matchedWord.toLowerCase())
        return (
          <mark
            key={i}
            className="bg-yellow-200 dark:bg-yellow-700 px-0.5 rounded"
          >
            {part}
          </mark>
        )
      }
      return part
    })

    return {
      highlightedContent: content,
      matchedWords: Array.from(foundWords),
    }
  }, [segment.content, query])

  /**
   * Get search method explanation
   */
  const getMatchHint = (): string => {
    switch (searchMethod) {
      case 'semantic_search':
        return t('retrievalTest.matchHint.semantic')
      case 'full_text_search':
        return matchedWords.length > 0
          ? t('retrievalTest.matchHint.fullTextMatched', { words: matchedWords.join(', ') })
          : t('retrievalTest.matchHint.fullText')
      case 'hybrid_search':
        return matchedWords.length > 0
          ? t('retrievalTest.matchHint.hybridMatched', { words: matchedWords.join(', ') })
          : t('retrievalTest.matchHint.hybrid')
      default:
        return ''
    }
  }

  return (
    <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:border-gray-300 dark:hover:border-gray-600 transition-colors">
      {/* Header: Rank, Score, Document */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          {/* Rank Badge */}
          <span className="flex items-center justify-center w-6 h-6 rounded-full bg-gray-100 dark:bg-gray-700 text-xs font-medium text-gray-600 dark:text-gray-400">
            {rank}
          </span>

          {/* Document Name */}
          <div className="flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400">
            <DocumentTextIcon className="h-4 w-4" />
            <span className="truncate max-w-[200px]">
              {segment.document?.name || t('retrievalTest.unknownDocument')}
            </span>
          </div>
        </div>

        {/* Score Badge */}
        <span className={`px-2 py-1 rounded text-xs font-medium ${getScoreColor(score)}`}>
          {t('retrievalTest.score')}: {score !== null ? score.toFixed(2) : '-'}
        </span>
      </div>

      {/* Content with highlighting */}
      <div className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed line-clamp-4">
        {highlightedContent}
      </div>

      {/* Match Hint - Why this chunk was retrieved */}
      <div className="mt-2 text-xs text-blue-600 dark:text-blue-400 italic">
        {getMatchHint()}
      </div>

      {/* Metadata */}
      <div className="mt-2 flex items-center gap-4 text-xs text-gray-400">
        <span>{segment.word_count} {t('retrievalTest.words')}</span>
        <span>{segment.tokens} tokens</span>
        {segment.keywords && segment.keywords.length > 0 && (
          <span className="truncate">
            {t('retrievalTest.keywords')}: {segment.keywords.slice(0, 3).join(', ')}
          </span>
        )}
      </div>
    </div>
  )
}
