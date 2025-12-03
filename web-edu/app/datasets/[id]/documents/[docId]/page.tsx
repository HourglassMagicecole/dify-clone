'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { useTranslation } from 'react-i18next'
import {
  ArrowLeftIcon,
  ArrowPathIcon,
  DocumentTextIcon,
} from '@heroicons/react/24/outline'
import { datasetAPI } from '@/service/dataset-api'
import type { Dataset, DocumentInfo, Segment } from '@/types/dataset'
import { Pagination } from '@/components/common/Pagination'

const ITEMS_PER_PAGE = 20

/**
 * Find the longest common substring between end of str1 and start of str2
 */
function findOverlap(str1: string, str2: string): string {
  if (!str1 || !str2) return ''

  // Check for overlap at the end of str1 and start of str2
  const maxLen = Math.min(str1.length, str2.length, 500) // Limit search for performance
  let overlap = ''

  for (let len = 1; len <= maxLen; len++) {
    const endOfStr1 = str1.slice(-len)
    const startOfStr2 = str2.slice(0, len)
    if (endOfStr1 === startOfStr2) {
      overlap = endOfStr1
    }
  }

  return overlap
}

interface OverlapInfo {
  overlapWithPrev: string
  overlapWithNext: string
}

/**
 * Document Detail Page (Segments/Chunks View)
 * Shows document info and all segments with pagination
 */
export default function DocumentDetailPage() {
  const { t } = useTranslation('dataset')
  const router = useRouter()
  const params = useParams()
  const datasetId = params.id as string
  const documentId = params.docId as string

  const [dataset, setDataset] = useState<Dataset | null>(null)
  const [segments, setSegments] = useState<Segment[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [totalItems, setTotalItems] = useState(0)
  const [documentName, setDocumentName] = useState<string>('')

  const loadDataset = useCallback(async () => {
    try {
      const response = await datasetAPI.getDataset(datasetId)
      if (response.result === 'success' && response.data) {
        setDataset(response.data)
      }
    } catch (err) {
      console.error('Failed to load dataset:', err)
    }
  }, [datasetId])

  const loadDocumentInfo = useCallback(async () => {
    try {
      // Get document info from documents list
      const response = await datasetAPI.getDocuments(datasetId, { limit: 100 })
      if (response.result === 'success' && response.data) {
        // getDifyNativeFull returns full response: { data: [...], total, ... }
        const docs = response.data.data || []
        const doc = docs.find((d: DocumentInfo) => d.id === documentId)
        if (doc) {
          setDocumentName(doc.name)
        }
      }
    } catch (err) {
      console.error('Failed to load document info:', err)
    }
  }, [datasetId, documentId])

  const loadSegments = useCallback(async (page: number) => {
    try {
      setIsLoading(true)
      setError(null)

      const response = await datasetAPI.getSegments(datasetId, documentId, {
        page,
        limit: ITEMS_PER_PAGE,
      })

      if (response.result === 'success' && response.data) {
        // getDifyNativeFull returns full response: { data: [...], total, total_pages, ... }
        const data = response.data
        setSegments(data.data || [])
        setTotalPages(data.total_pages || Math.ceil((data.total || 0) / ITEMS_PER_PAGE))
        setTotalItems(data.total || 0)
      }
    } catch (err) {
      console.error('Failed to load segments:', err)
      setError(err instanceof Error ? err.message : 'Failed to load segments')
    } finally {
      setIsLoading(false)
    }
  }, [datasetId, documentId])

  useEffect(() => {
    loadDataset()
    loadDocumentInfo()
    loadSegments(1)
  }, [loadDataset, loadDocumentInfo, loadSegments])

  const handlePageChange = (page: number) => {
    setCurrentPage(page)
    loadSegments(page)
  }

  /**
   * Calculate overlaps between adjacent segments
   */
  const overlaps = useMemo((): Map<string, OverlapInfo> => {
    const map = new Map<string, OverlapInfo>()

    segments.forEach((segment, index) => {
      const prevSegment = index > 0 ? segments[index - 1] : null
      const nextSegment = index < segments.length - 1 ? segments[index + 1] : null

      const overlapWithPrev = prevSegment ? findOverlap(prevSegment.content, segment.content) : ''
      const overlapWithNext = nextSegment ? findOverlap(segment.content, nextSegment.content) : ''

      map.set(segment.id, { overlapWithPrev, overlapWithNext })
    })

    return map
  }, [segments])

  /**
   * Render segment content with overlap highlighting
   */
  const renderSegmentContent = (segment: Segment) => {
    const overlapInfo = overlaps.get(segment.id)
    if (!overlapInfo) {
      return <span>{segment.content}</span>
    }

    const { overlapWithPrev, overlapWithNext } = overlapInfo
    const content = segment.content

    // No overlaps
    if (!overlapWithPrev && !overlapWithNext) {
      return <span>{content}</span>
    }

    const parts: React.ReactNode[] = []

    // Calculate positions
    const prevOverlapEnd = overlapWithPrev.length
    const nextOverlapStart = content.length - overlapWithNext.length

    // Handle overlapping regions (when prev and next overlaps intersect)
    if (prevOverlapEnd > nextOverlapStart && overlapWithPrev && overlapWithNext) {
      // Entire content is overlapped from both sides
      parts.push(
        <span key="all" className="bg-yellow-200 dark:bg-yellow-800/50" title={t('document.overlapBoth')}>
          {content}
        </span>
      )
    } else {
      // Overlap with previous (start of content)
      if (overlapWithPrev) {
        parts.push(
          <span key="prev" className="bg-orange-200 dark:bg-orange-800/50" title={t('document.overlapPrev')}>
            {content.slice(0, prevOverlapEnd)}
          </span>
        )
      }

      // Middle content (no overlap)
      const middleStart = overlapWithPrev ? prevOverlapEnd : 0
      const middleEnd = overlapWithNext ? nextOverlapStart : content.length
      if (middleStart < middleEnd) {
        parts.push(
          <span key="middle">{content.slice(middleStart, middleEnd)}</span>
        )
      }

      // Overlap with next (end of content)
      if (overlapWithNext) {
        parts.push(
          <span key="next" className="bg-blue-200 dark:bg-blue-800/50" title={t('document.overlapNext')}>
            {content.slice(nextOverlapStart)}
          </span>
        )
      }
    }

    return <>{parts}</>
  }

  if (isLoading && segments.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <ArrowPathIcon className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={() => router.push(`/datasets/${datasetId}`)}
            className="flex items-center text-sm text-gray-500 hover:text-gray-700 mb-4"
          >
            <ArrowLeftIcon className="h-4 w-4 mr-1" />
            {t('document.backToDataset')}
          </button>

          <div className="flex items-center gap-3">
            <DocumentTextIcon className="h-8 w-8 text-gray-400" />
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                {documentName || t('document.title')}
              </h1>
              {dataset && (
                <p className="text-sm text-gray-500">
                  {dataset.name}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Error State */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <p className="text-sm text-red-800">{error}</p>
          </div>
        )}

        {/* Segments Header */}
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
          <div className="p-4 border-b border-gray-200 dark:border-gray-700">
            <h2 className="text-lg font-medium text-gray-900 dark:text-white">
              {t('document.segments')} ({totalItems})
            </h2>
            <p className="text-sm text-gray-500 mt-1">
              {t('document.segmentsDescription')}
            </p>
            {/* Overlap Legend */}
            <div className="flex items-center gap-4 mt-3 text-xs">
              <span className="flex items-center gap-1">
                <span className="w-3 h-3 bg-orange-200 dark:bg-orange-800/50 rounded" />
                {t('document.overlapPrev')}
              </span>
              <span className="flex items-center gap-1">
                <span className="w-3 h-3 bg-blue-200 dark:bg-blue-800/50 rounded" />
                {t('document.overlapNext')}
              </span>
            </div>
          </div>

          {segments.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              {t('document.noSegments')}
            </div>
          ) : (
            <div className="divide-y divide-gray-200 dark:divide-gray-700">
              {segments.map((segment, index) => (
                <div
                  key={segment.id}
                  className="p-4"
                >
                  <div className="flex items-start gap-4">
                    {/* Segment Number */}
                    <div className="flex-shrink-0 w-12 h-12 bg-blue-50 dark:bg-blue-900/20 rounded-lg flex items-center justify-center">
                      <span className="text-sm font-medium text-blue-600 dark:text-blue-400">
                        #{(currentPage - 1) * ITEMS_PER_PAGE + index + 1}
                      </span>
                    </div>

                    {/* Segment Content */}
                    <div className="flex-1 min-w-0">
                      <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4 mb-2">
                        <pre className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap break-words font-sans">
                          {renderSegmentContent(segment)}
                        </pre>
                      </div>

                      {/* Segment Metadata */}
                      <div className="flex items-center gap-4 text-xs text-gray-500">
                        <span>{segment.word_count} {t('document.words')}</span>
                        <span>{segment.tokens} tokens</span>
                        {segment.hit_count > 0 && (
                          <span className="text-blue-600">
                            {t('document.hitCount', { count: segment.hit_count })}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {totalPages > 1 && (
            <div className="p-4 border-t border-gray-200 dark:border-gray-700">
              <Pagination
                currentPage={currentPage}
                totalPages={totalPages}
                totalItems={totalItems}
                itemsPerPage={ITEMS_PER_PAGE}
                onPageChange={handlePageChange}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
