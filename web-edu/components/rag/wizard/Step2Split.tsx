/**
 * Step 2: Split - Chunking Settings
 * Story 3.1: RAG Creation Wizard - Load & Split
 *
 * Features:
 * - Pre-processing rules toggle
 * - Segmentation settings with sensible defaults
 * - All settings visible and editable from start
 */

'use client'

import React, { useEffect, useState, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { useRAGWizard } from '@/context/RAGWizardContext'
import { datasetAPI } from '@/service/dataset-api'
import { Button } from '@/components/common/Button'
import { Tooltip } from '@/components/common/Tooltip'
import type { ProcessRuleLimits, IndexingEstimateRequest, ProcessRuleForAPI } from '@/types/dataset'

// Default values matching backend DocumentService.DEFAULT_RULES
const DEFAULT_RULES = {
  pre_processing_rules: [
    { id: 'remove_extra_spaces' as const, enabled: true },
    { id: 'remove_urls_emails' as const, enabled: false },
  ],
  segmentation: {
    delimiter: '\n',
    max_tokens: 1024,
    chunk_overlap: 50,
  },
}

// Delimiter display options
const DELIMITER_OPTIONS = [
  { value: '\n', label: '\\n (newline)' },
  { value: '\n\n', label: '\\n\\n (double newline)' },
  { value: ' ', label: 'Space' },
  { value: '.', label: '. (period)' },
]

/**
 * Find overlap between two adjacent chunks
 * Returns the common suffix of chunk1 that matches prefix of chunk2
 */
function findOverlap(chunk1: string, chunk2: string): string {
  // Try to find the longest common substring where
  // chunk1 ends with it and chunk2 starts with it
  const maxOverlapLength = Math.min(chunk1.length, chunk2.length, 500) // Limit search for performance

  for (let len = maxOverlapLength; len > 0; len--) {
    const suffix = chunk1.slice(-len)
    if (chunk2.startsWith(suffix)) {
      return suffix
    }
  }
  return ''
}

export function Step2Split(): React.ReactElement {
  const { t } = useTranslation('dataset')
  const {
    processRule,
    setProcessRule,
    prevStep,
    isLoading,
    setLoading,
    // Task 5.4: Preview Chunk state and actions
    uploadedFiles,
    previewChunks,
    previewLoading,
    previewError,
    totalSegments,
    setPreviewChunks,
    setPreviewLoading,
    setPreviewError,
    clearPreview,
  } = useRAGWizard()

  // Limits from API
  const [limits, setLimits] = useState<ProcessRuleLimits | null>(null)
  // Help modal state
  const [showHelp, setShowHelp] = useState(false)
  // Embedding model availability
  const [embeddingModelAvailable, setEmbeddingModelAvailable] = useState<boolean | null>(null)
  // Track previous uploaded files to detect changes
  const [prevFileIds, setPrevFileIds] = useState<string[]>([])

  /**
   * Clear preview when uploaded files change
   */
  useEffect(() => {
    const currentFileIds = uploadedFiles.map(f => f.id).sort().join(',')
    const prevFileIdsStr = prevFileIds.sort().join(',')

    if (currentFileIds !== prevFileIdsStr) {
      // Files changed, clear preview
      clearPreview()
      setPrevFileIds(uploadedFiles.map(f => f.id))
    }
  }, [uploadedFiles, prevFileIds, clearPreview])

  /**
   * Initialize with default rules and load limits from API
   */
  useEffect(() => {
    const initialize = async () => {
      // Set default rules if not already set
      if (!processRule.rules) {
        setProcessRule({
          mode: 'custom',
          rules: DEFAULT_RULES,
        })
      }

      // Load limits from API
      try {
        setLoading(true)
        const response = await datasetAPI.getProcessRule()
        if (response.result === 'success' && response.data) {
          setLimits(response.data.limits)
        }
      } catch (error) {
        console.error('Failed to load process rule limits:', error)
      } finally {
        setLoading(false)
      }

      // Check embedding model availability
      try {
        const isAvailable = await datasetAPI.isEmbeddingModelAvailable()
        setEmbeddingModelAvailable(isAvailable)
      } catch (error) {
        console.error('Failed to check embedding model availability:', error)
        setEmbeddingModelAvailable(false)
      }
    }
    initialize()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Ensure we have rules to work with
  const rules = processRule.rules || DEFAULT_RULES

  /**
   * Handle pre-processing rule toggle
   */
  const handlePreProcessingToggle = (ruleId: 'remove_extra_spaces' | 'remove_urls_emails') => {
    setProcessRule({
      mode: 'custom',
      rules: {
        ...rules,
        pre_processing_rules: rules.pre_processing_rules.map(rule =>
          rule.id === ruleId ? { ...rule, enabled: !rule.enabled } : rule
        ),
      },
    })
  }

  /**
   * Handle segmentation change
   * When max_tokens changes, auto-adjust chunk_overlap if it exceeds 50% of new max_tokens
   */
  const handleSegmentationChange = (field: 'delimiter' | 'max_tokens' | 'chunk_overlap', value: string | number) => {
    const newSegmentation = {
      ...rules.segmentation,
      [field]: value,
    }

    // If max_tokens changed, ensure chunk_overlap doesn't exceed 50% of new max_tokens
    if (field === 'max_tokens') {
      const newMaxTokens = value as number
      const maxOverlap = Math.floor(newMaxTokens * 0.5)
      if (newSegmentation.chunk_overlap > maxOverlap) {
        newSegmentation.chunk_overlap = maxOverlap
      }
    }

    setProcessRule({
      mode: 'custom',
      rules: {
        ...rules,
        segmentation: newSegmentation,
      },
    })
  }

  /**
   * Task 5.4: Handle preview chunk request
   */
  const handlePreviewChunk = useCallback(async () => {
    if (uploadedFiles.length === 0) {
      setPreviewError(t('step2.previewNoFiles'))
      return
    }

    setPreviewLoading(true)
    setPreviewError(null)
    clearPreview()

    try {
      // Convert delimiter to separator for API compatibility
      // Backend GET /process-rule returns 'delimiter', but POST /indexing-estimate expects 'separator'
      const apiProcessRule: ProcessRuleForAPI = {
        mode: processRule.mode,
        rules: processRule.rules ? {
          pre_processing_rules: processRule.rules.pre_processing_rules,
          segmentation: {
            separator: processRule.rules.segmentation.delimiter, // delimiter → separator
            max_tokens: processRule.rules.segmentation.max_tokens,
            chunk_overlap: processRule.rules.segmentation.chunk_overlap,
          },
        } : null,
      }

      const request: IndexingEstimateRequest = {
        info_list: {
          data_source_type: 'upload_file',
          file_info_list: {
            file_ids: uploadedFiles.map(f => f.id),
          },
        },
        indexing_technique: 'high_quality',
        process_rule: apiProcessRule,
        doc_form: 'text_model',
        doc_language: 'English',
        dataset_id: '', // Empty for new dataset
      }

      const response = await datasetAPI.getIndexingEstimate(request)
      if (response.result === 'success' && response.data) {
        setPreviewChunks(response.data.preview, response.data.total_segments)
      } else {
        setPreviewError(t('step2.previewError'))
      }
    } catch (error) {
      console.error('Failed to get indexing estimate:', error)
      setPreviewError(t('step2.previewError'))
    } finally {
      setPreviewLoading(false)
    }
  }, [uploadedFiles, processRule, t, setPreviewLoading, setPreviewError, clearPreview, setPreviewChunks])

  /**
   * Handle next step
   * Note: Story 3.1 ends here. Story 3.2 will implement Embed & Store.
   */
  const handleNext = () => {
    // For Story 3.1, just show a message that Embed & Store are coming
    // Story 3.2 will implement actual nextStep() to EMBED
    alert(t('common.comingSoon'))
  }

  return (
    <div className="space-y-6">
      {/* Title */}
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-lg font-medium text-gray-900">{t('step2.title')}</h3>
          <p className="text-sm text-gray-500 mt-1">{t('step2.subtitle')}</p>
        </div>
        <button
          type="button"
          onClick={() => setShowHelp(true)}
          className="text-sm text-blue-600 hover:text-blue-800 underline"
        >
          {t('step2.helpButton')}
        </button>
      </div>

      {/* Settings */}
      <div className="space-y-6 p-4 bg-gray-50 rounded-lg">
        {/* Pre-processing Rules */}
        <div>
          <h4 className="text-sm font-medium text-gray-700 mb-3">
            {t('step2.preprocessing')}
          </h4>
          <div className="space-y-2">
            {rules.pre_processing_rules.map(rule => (
              <label
                key={rule.id}
                className="flex items-center gap-3 cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={rule.enabled}
                  onChange={() => handlePreProcessingToggle(rule.id)}
                  className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                />
                <span className="flex items-center gap-1 text-sm text-gray-700">
                  {t(`step2.${rule.id.replace(/_/g, '')}`)}
                  <Tooltip content={t(`step2.${rule.id.replace(/_/g, '')}Tooltip`)} />
                </span>
              </label>
            ))}
          </div>
        </div>

        {/* Segmentation Settings */}
        <div>
          <h4 className="text-sm font-medium text-gray-700 mb-3">
            {t('step2.segmentation')}
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Delimiter */}
            <div>
              <label className="flex items-center gap-1 text-sm font-medium text-gray-700 mb-1">
                {t('step2.separator')}
                <Tooltip content={t('step2.separatorTooltip')} />
              </label>
              <select
                value={rules.segmentation.delimiter}
                onChange={(e) => handleSegmentationChange('delimiter', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                aria-label={t('step2.separator')}
              >
                {DELIMITER_OPTIONS.map(option => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <p className="text-xs text-gray-500 mt-1">{t('step2.separatorHelp')}</p>
            </div>

            {/* Max Tokens */}
            <div>
              <label className="flex items-center gap-1 text-sm font-medium text-gray-700 mb-1">
                {t('step2.maxTokens')}
                <Tooltip content={t('step2.maxTokensTooltip')} />
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="range"
                  min={50}
                  max={limits?.indexing_max_segmentation_tokens_length || 4000}
                  step={10}
                  value={rules.segmentation.max_tokens}
                  onChange={(e) => handleSegmentationChange('max_tokens', parseInt(e.target.value))}
                  className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                  aria-label={t('step2.maxTokens')}
                />
                <input
                  type="number"
                  min={50}
                  max={limits?.indexing_max_segmentation_tokens_length || 4000}
                  step={10}
                  value={rules.segmentation.max_tokens || ''}
                  onChange={(e) => {
                    const val = parseInt(e.target.value)
                    if (!isNaN(val)) handleSegmentationChange('max_tokens', val)
                  }}
                  onBlur={(e) => {
                    const val = parseInt(e.target.value)
                    if (isNaN(val) || val < 50) handleSegmentationChange('max_tokens', 50)
                  }}
                  className="w-20 px-2 py-1 text-center border border-gray-300 rounded-md text-sm font-medium"
                />
              </div>
              <div className="flex justify-between text-xs text-gray-500 mt-1">
                <span>50</span>
                <span>{limits?.indexing_max_segmentation_tokens_length || 4000}</span>
              </div>
            </div>

            {/* Chunk Overlap */}
            <div>
              <label className="flex items-center gap-1 text-sm font-medium text-gray-700 mb-1">
                {t('step2.chunkOverlap')}
                <Tooltip content={t('step2.chunkOverlapTooltip')} />
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="range"
                  min={0}
                  max={Math.floor(rules.segmentation.max_tokens * 0.5)}
                  step={1}
                  value={Math.min(rules.segmentation.chunk_overlap, Math.floor(rules.segmentation.max_tokens * 0.5))}
                  onChange={(e) => handleSegmentationChange('chunk_overlap', parseInt(e.target.value))}
                  className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                  aria-label={t('step2.chunkOverlap')}
                />
                <input
                  type="number"
                  min={0}
                  max={Math.floor(rules.segmentation.max_tokens * 0.5)}
                  step={1}
                  value={rules.segmentation.chunk_overlap}
                  onChange={(e) => {
                    const val = parseInt(e.target.value)
                    if (!isNaN(val)) handleSegmentationChange('chunk_overlap', val)
                  }}
                  onBlur={(e) => {
                    const val = parseInt(e.target.value)
                    const maxOverlap = Math.floor(rules.segmentation.max_tokens * 0.5)
                    if (isNaN(val) || val < 0) handleSegmentationChange('chunk_overlap', 0)
                    else if (val > maxOverlap) handleSegmentationChange('chunk_overlap', maxOverlap)
                  }}
                  className="w-20 px-2 py-1 text-center border border-gray-300 rounded-md text-sm font-medium"
                />
              </div>
              <div className="flex justify-between text-xs text-gray-500 mt-1">
                <span>0</span>
                <span>{Math.floor(rules.segmentation.max_tokens * 0.5)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Task 5.4: Preview Chunk Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-end">
          <Button
            type="button"
            variant="outline"
            onClick={handlePreviewChunk}
            disabled={previewLoading || uploadedFiles.length === 0 || embeddingModelAvailable === false}
          >
            {previewLoading ? t('step2.previewing') : t('step2.previewChunk')}
          </Button>
        </div>

        {/* Preview Error */}
        {previewError && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-md">
            <p className="text-sm text-red-600">{previewError}</p>
          </div>
        )}

        {/* Preview Loading */}
        {previewLoading && (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <span className="ml-2 text-sm text-gray-600">{t('step2.previewing')}</span>
          </div>
        )}

        {/* Preview Results */}
        {previewChunks.length > 0 && !previewLoading && (
          <div className="space-y-3">
            <div className="flex items-center justify-between text-sm text-gray-600">
              <span>{t('step2.previewResult', { count: totalSegments })}</span>
              <span className="text-xs text-gray-400">
                {t('step2.previewShowing', { showing: previewChunks.length, total: totalSegments })}
              </span>
            </div>
            <div className="max-h-96 overflow-y-auto space-y-2">
              {previewChunks.map((chunk, idx) => {
                // Find overlap with previous chunk (highlight at start)
                const prevChunk = idx > 0 ? previewChunks[idx - 1] : null
                const overlapWithPrev = prevChunk ? findOverlap(prevChunk.content, chunk.content) : ''

                // Find overlap with next chunk (highlight at end)
                const nextChunk = idx < previewChunks.length - 1 ? previewChunks[idx + 1] : null
                const overlapWithNext = nextChunk ? findOverlap(chunk.content, nextChunk.content) : ''

                // Split content for highlighting
                const startOverlapLen = overlapWithPrev.length
                const endOverlapLen = overlapWithNext.length

                const startPart = chunk.content.slice(0, startOverlapLen)
                const middlePart = chunk.content.slice(startOverlapLen, chunk.content.length - endOverlapLen || undefined)
                const endPart = endOverlapLen > 0 ? chunk.content.slice(-endOverlapLen) : ''

                return (
                  <div
                    key={idx}
                    className="p-3 bg-white border border-gray-200 rounded-md shadow-sm"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium text-blue-600 bg-blue-50 px-2 py-0.5 rounded">
                          Chunk {idx + 1}
                        </span>
                        {(startOverlapLen > 0 || endOverlapLen > 0) && (
                          <span className="text-xs text-orange-600 bg-orange-50 px-2 py-0.5 rounded">
                            {startOverlapLen > 0 && `↑${startOverlapLen}`}
                            {startOverlapLen > 0 && endOverlapLen > 0 && ' / '}
                            {endOverlapLen > 0 && `↓${endOverlapLen}`}
                            {' chars overlap'}
                          </span>
                        )}
                      </div>
                      <span className="text-xs text-gray-400">
                        {chunk.content.length} chars
                      </span>
                    </div>
                    <p className="text-sm text-gray-700 whitespace-pre-wrap break-words">
                      {startPart && (
                        <span className="bg-orange-100 text-orange-800 rounded px-0.5" title={`Overlap with Chunk ${idx}`}>
                          {startPart}
                        </span>
                      )}
                      {middlePart}
                      {endPart && (
                        <span className="bg-green-100 text-green-800 rounded px-0.5" title={`Overlap with Chunk ${idx + 2}`}>
                          {endPart}
                        </span>
                      )}
                    </p>
                  </div>
                )
              })}
            </div>
            {/* Legend */}
            {previewChunks.length > 1 && (
              <div className="flex items-center gap-4 text-xs text-gray-500 pt-2 border-t">
                <span className="flex items-center gap-1">
                  <span className="inline-block w-3 h-3 bg-orange-100 rounded"></span>
                  {t('step2.overlapPrev')}
                </span>
                <span className="flex items-center gap-1">
                  <span className="inline-block w-3 h-3 bg-green-100 rounded"></span>
                  {t('step2.overlapNext')}
                </span>
              </div>
            )}
          </div>
        )}

        {/* No files uploaded message */}
        {uploadedFiles.length === 0 && !previewLoading && !previewError && (
          <div className="text-center py-6 text-sm text-gray-500">
            {t('step2.previewNoFilesHint')}
          </div>
        )}
      </div>

      {/* Navigation */}
      <div className="flex justify-between pt-4 border-t">
        <Button
          type="button"
          variant="outline"
          onClick={prevStep}
        >
          {t('common.previous')}
        </Button>
        <Button
          type="button"
          onClick={handleNext}
          disabled={isLoading}
        >
          {t('common.next')}
        </Button>
      </div>

      {/* Help Modal */}
      {showHelp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[80vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-semibold text-gray-900">
                  {t('step2.helpTitle')}
                </h2>
                <button
                  type="button"
                  onClick={() => setShowHelp(false)}
                  className="text-gray-400 hover:text-gray-600"
                  aria-label={t('step2.helpClose')}
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="space-y-4 text-sm text-gray-700">
                <p className="font-medium">{t('step2.helpOverview')}</p>

                {/* Stage 1 */}
                <div className="bg-blue-50 p-4 rounded-lg">
                  <h3 className="font-semibold text-blue-900 mb-2">
                    {t('step2.helpStage1Title')}
                  </h3>
                  <p className="text-blue-800">{t('step2.helpStage1Desc')}</p>
                </div>

                {/* Stage 2 */}
                <div className="bg-amber-50 p-4 rounded-lg">
                  <h3 className="font-semibold text-amber-900 mb-2">
                    {t('step2.helpStage2Title')}
                  </h3>
                  <p className="text-amber-800 mb-2">{t('step2.helpStage2Desc')}</p>
                  <p className="text-amber-700 font-mono text-xs bg-amber-100 p-2 rounded">
                    {t('step2.helpFallbackSeparators')}
                  </p>
                </div>

                {/* Merge */}
                <div className="bg-green-50 p-4 rounded-lg">
                  <p className="text-green-800">{t('step2.helpMerge')}</p>
                </div>

                {/* Example */}
                <div className="bg-gray-100 p-4 rounded-lg space-y-3">
                  <div className="flex justify-between items-center">
                    <h3 className="font-semibold text-gray-900">
                      {t('step2.helpExample')}
                    </h3>
                    <span className="text-xs bg-gray-200 px-2 py-1 rounded font-mono">
                      {t('step2.helpExampleSettings')}
                    </span>
                  </div>

                  {/* Original */}
                  <div>
                    <p className="text-xs font-medium text-gray-600">{t('step2.helpExampleOriginal')}</p>
                    <pre className="text-xs text-gray-800 bg-white p-2 rounded mt-1 whitespace-pre-wrap font-mono border">
                      {t('step2.helpExampleOriginalText')}
                    </pre>
                  </div>

                  {/* Step 1 - Split */}
                  <div>
                    <p className="text-xs font-medium text-blue-600">{t('step2.helpExampleStep1')}</p>
                    <pre className="text-xs text-gray-800 bg-blue-50 p-2 rounded mt-1 whitespace-pre-wrap font-mono">
                      {t('step2.helpExampleStep1Result')}
                    </pre>
                  </div>

                  {/* Step 2 - Check size */}
                  <div>
                    <p className="text-xs font-medium text-purple-600">{t('step2.helpExampleStep2')}</p>
                    <pre className="text-xs text-gray-800 bg-purple-50 p-2 rounded mt-1 whitespace-pre-wrap font-mono">
                      {t('step2.helpExampleStep2Result')}
                    </pre>
                  </div>

                  {/* Step 3 - Merge */}
                  <div>
                    <p className="text-xs font-medium text-amber-600">{t('step2.helpExampleStep3')}</p>
                    <pre className="text-xs text-gray-800 bg-amber-50 p-2 rounded mt-1 whitespace-pre-wrap font-mono">
                      {t('step2.helpExampleStep3Result')}
                    </pre>
                  </div>

                  {/* Step 4 - Overlap */}
                  <div>
                    <p className="text-xs font-medium text-green-600">{t('step2.helpExampleStep4')}</p>
                    <pre className="text-xs text-gray-800 bg-green-50 p-2 rounded mt-1 whitespace-pre-wrap font-mono">
                      {t('step2.helpExampleStep4Result')}
                    </pre>
                  </div>

                  {/* Final */}
                  <div className="text-center pt-2 border-t">
                    <p className="text-sm font-medium text-gray-700">{t('step2.helpExampleFinal')}</p>
                  </div>
                </div>
              </div>

              <div className="mt-6 flex justify-end">
                <Button type="button" onClick={() => setShowHelp(false)}>
                  {t('step2.helpClose')}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
