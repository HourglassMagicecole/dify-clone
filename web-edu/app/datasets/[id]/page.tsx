'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { useTranslation } from 'react-i18next'
import {
  ArrowLeftIcon,
  ArrowPathIcon,
  DocumentTextIcon,
  TrashIcon,
} from '@heroicons/react/24/outline'
import { datasetAPI } from '@/service/dataset-api'
import type { Dataset, DocumentInfo } from '@/types/dataset'
import { Button } from '@/components/common/Button'
import { Pagination } from '@/components/common/Pagination'
import { DeleteConfirmDialog } from '@/components/common/DeleteConfirmDialog'

const ITEMS_PER_PAGE = 20

/**
 * Dataset Detail Page
 * Shows dataset info and document list with pagination
 */
export default function DatasetDetailPage() {
  const { t } = useTranslation('dataset')
  const router = useRouter()
  const params = useParams()
  const datasetId = params.id as string

  const [dataset, setDataset] = useState<Dataset | null>(null)
  const [documents, setDocuments] = useState<DocumentInfo[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [totalItems, setTotalItems] = useState(0)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  const loadDataset = useCallback(async () => {
    try {
      setIsLoading(true)
      setError(null)

      const response = await datasetAPI.getDataset(datasetId)
      if (response.result === 'success' && response.data) {
        setDataset(response.data)
      }
    } catch (err) {
      console.error('Failed to load dataset:', err)
      setError(err instanceof Error ? err.message : 'Failed to load dataset')
    } finally {
      setIsLoading(false)
    }
  }, [datasetId])

  const loadDocuments = useCallback(async (page: number) => {
    try {
      const response = await datasetAPI.getDocuments(datasetId, {
        page,
        limit: ITEMS_PER_PAGE,
      })

      if (response.result === 'success' && response.data) {
        // getDifyNativeFull returns full response: { data: [...], total, page, ... }
        const data = response.data
        setDocuments(data.data || [])
        setTotalPages(Math.ceil((data.total || 0) / ITEMS_PER_PAGE))
        setTotalItems(data.total || 0)
      }
    } catch (err) {
      console.error('Failed to load documents:', err)
    }
  }, [datasetId])

  useEffect(() => {
    loadDataset()
    loadDocuments(1)
  }, [loadDataset, loadDocuments])

  const handlePageChange = (page: number) => {
    setCurrentPage(page)
    loadDocuments(page)
  }

  const handleDocumentClick = (documentId: string) => {
    router.push(`/datasets/${datasetId}/documents/${documentId}`)
  }

  const handleDelete = async () => {
    try {
      setIsDeleting(true)
      await datasetAPI.deleteDataset(datasetId)
      router.push('/datasets')
    } catch (err) {
      console.error('Failed to delete dataset:', err)
      setError(err instanceof Error ? err.message : 'Failed to delete dataset')
    } finally {
      setIsDeleting(false)
      setIsDeleteDialogOpen(false)
    }
  }

  const formatDate = (timestamp: number) => {
    return new Date(timestamp * 1000).toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-700'
      case 'indexing':
      case 'parsing':
      case 'splitting':
        return 'bg-yellow-100 text-yellow-700'
      case 'error':
        return 'bg-red-100 text-red-700'
      default:
        return 'bg-gray-100 text-gray-700'
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <ArrowPathIcon className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    )
  }

  if (error || !dataset) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-sm text-red-800">{error || 'Dataset not found'}</p>
          </div>
          <Button
            variant="outline"
            className="mt-4"
            onClick={() => router.push('/datasets')}
          >
            <ArrowLeftIcon className="h-4 w-4 mr-2" />
            {t('detail.backToList')}
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={() => router.push('/datasets')}
            className="flex items-center text-sm text-gray-500 hover:text-gray-700 mb-4"
          >
            <ArrowLeftIcon className="h-4 w-4 mr-1" />
            {t('detail.backToList')}
          </button>

          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                {dataset.name}
              </h1>
            </div>
            <Button
              variant="outline"
              className="text-red-600 hover:bg-red-50"
              onClick={() => setIsDeleteDialogOpen(true)}
            >
              <TrashIcon className="h-4 w-4 mr-2" />
              {t('detail.delete')}
            </Button>
          </div>
        </div>

        {/* Dataset Info */}
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6 mb-8">
          <h2 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
            {t('detail.info')}
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <span className="text-gray-500">{t('detail.documentCount')}</span>
              <p className="font-medium text-gray-900 dark:text-white">
                {dataset.document_count}
              </p>
            </div>
            <div>
              <span className="text-gray-500">{t('detail.wordCount')}</span>
              <p className="font-medium text-gray-900 dark:text-white">
                {dataset.word_count.toLocaleString()}
              </p>
            </div>
            <div>
              <span className="text-gray-500">{t('detail.embeddingModel')}</span>
              <p className="font-medium text-gray-900 dark:text-white">
                {dataset.embedding_model || '-'}
              </p>
            </div>
            <div>
              <span className="text-gray-500">{t('detail.createdAt')}</span>
              <p className="font-medium text-gray-900 dark:text-white">
                {formatDate(dataset.created_at)}
              </p>
            </div>
          </div>
        </div>

        {/* Document List */}
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
          <div className="p-4 border-b border-gray-200 dark:border-gray-700">
            <h2 className="text-lg font-medium text-gray-900 dark:text-white">
              {t('detail.documents')} ({totalItems})
            </h2>
          </div>

          {documents.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              {t('detail.noDocuments')}
            </div>
          ) : (
            <div className="divide-y divide-gray-200 dark:divide-gray-700">
              {documents.map((doc) => (
                <div
                  key={doc.id}
                  className="p-4 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer transition-colors"
                  onClick={() => handleDocumentClick(doc.id)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <DocumentTextIcon className="h-5 w-5 text-gray-400 flex-shrink-0" />
                      <div className="min-w-0">
                        <p className="font-medium text-gray-900 dark:text-white truncate">
                          {doc.name}
                        </p>
                        <p className="text-sm text-gray-500">
                          {(doc.word_count ?? 0).toLocaleString()} {t('detail.words')} · {(doc.tokens ?? 0).toLocaleString()} tokens
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className={`px-2 py-1 text-xs rounded ${getStatusColor(doc.indexing_status)}`}>
                        {t(`detail.status.${doc.indexing_status}`)}
                      </span>
                      <span className="text-sm text-gray-500">
                        {formatDate(doc.created_at)}
                      </span>
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

      {/* Delete Confirmation Dialog */}
      <DeleteConfirmDialog
        isOpen={isDeleteDialogOpen}
        onClose={() => setIsDeleteDialogOpen(false)}
        onConfirm={handleDelete}
        title={t('detail.deleteDialog.title')}
        message={t('detail.deleteDialog.message', { name: dataset.name })}
        confirmLabel={t('detail.deleteDialog.confirm')}
        cancelLabel={t('detail.deleteDialog.cancel')}
        isLoading={isDeleting}
      />
    </div>
  )
}
