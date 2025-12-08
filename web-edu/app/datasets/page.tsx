/**
 * Dataset List Page
 * Story 3.3: RAG List and Management
 * Pattern: Agent 페이지 참조
 */

'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslation } from 'react-i18next'
import { PlusIcon, ArrowPathIcon, ExclamationCircleIcon } from '@heroicons/react/24/outline'
import { datasetAPI } from '@/service/dataset-api'
import type { Dataset, DatasetSortField } from '@/types/dataset'
import { useSession } from '@/context/SessionContext'
import { useAuth } from '@/hooks/useAuth'
import { Button } from '@/components/common/Button'
import { DatasetCard } from '@/components/rag/DatasetCard'
import { DatasetTable } from '@/components/rag/DatasetTable'
import { DeleteConfirmDialog } from '@/components/common/DeleteConfirmDialog'
import { EmptyState } from '@/components/common/EmptyState'
import { Pagination } from '@/components/common/Pagination'
import { useToast } from '@/context/ToastContext'

export default function DatasetsPage() {
  const { t } = useTranslation('dataset')
  const router = useRouter()
  const { user } = useAuth()
  const { currentSession, isLoading: sessionLoading } = useSession()
  const { showToast } = useToast()
  const [datasets, setDatasets] = useState<Dataset[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [sortBy, setSortBy] = useState<DatasetSortField>('created_at')
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [datasetToDelete, setDatasetToDelete] = useState<Dataset | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)

  // Pagination settings
  const ITEMS_PER_PAGE = 12

  // Determine if user should see table view (Owner and Administrator)
  const useTableView = user?.actualRole === 'owner' || user?.actualRole === 'admin'

  const loadDatasets = useCallback(async () => {
    if (!currentSession) return

    try {
      setIsLoading(true)
      setError(null)
      const response = await datasetAPI.getDatasets({
        limit: 100,
        session_id: currentSession.id,
      })
      if (response.result === 'success' && response.data) {
        // getDifyNative unwraps { data: [...] } to just [...], so response.data is already the array
        const datasetsArray = Array.isArray(response.data) ? response.data : response.data.data || []
        setDatasets(datasetsArray)
      }
    } catch (err) {
      console.error('Failed to load datasets:', err)
      setError(err instanceof Error ? err.message : 'Failed to load datasets')
    } finally {
      setIsLoading(false)
    }
  }, [currentSession])

  useEffect(() => {
    if (sessionLoading) return

    if (!currentSession || !user) {
      // No session or user, stop loading
      setIsLoading(false)
      return
    }

    loadDatasets()
  }, [currentSession, sessionLoading, loadDatasets, user])

  const handleCreateDataset = () => {
    router.push('/datasets/create')
  }

  const handleView = (datasetId: string) => {
    router.push(`/datasets/${datasetId}`)
  }

  const handleViewDataset = (dataset: Dataset) => {
    router.push(`/datasets/${dataset.id}`)
  }

  // Delete handlers
  const handleDelete = (datasetId: string) => {
    const dataset = datasets.find(d => d.id === datasetId)
    if (!dataset) {
      showToast(t('delete.notFound'), 'error')
      return
    }
    setDatasetToDelete(dataset)
    setIsDeleteDialogOpen(true)
  }

  const handleDeleteDataset = (dataset: Dataset) => {
    setDatasetToDelete(dataset)
    setIsDeleteDialogOpen(true)
  }

  const handleDeleteConfirm = async () => {
    if (!datasetToDelete) return

    try {
      setIsDeleting(true)
      await datasetAPI.deleteDataset(datasetToDelete.id)
      showToast(t('delete.success', { name: datasetToDelete.name }), 'success')

      // Remove from list
      setDatasets(prev => prev.filter(d => d.id !== datasetToDelete.id))

      // Close dialog
      setIsDeleteDialogOpen(false)
      setDatasetToDelete(null)
    } catch (err) {
      console.error('Failed to delete dataset:', err)
      showToast(t('delete.deleteFailed'), 'error')
    } finally {
      setIsDeleting(false)
    }
  }

  const handleDeleteCancel = () => {
    setIsDeleteDialogOpen(false)
    setDatasetToDelete(null)
  }

  // Filter and sort datasets
  const filteredDatasets = useMemo(() => {
    // 1. Filter by search query
    const filtered = datasets.filter((dataset) => {
      if (!searchQuery) return true

      const query = searchQuery.toLowerCase()
      const matchesName = dataset.name.toLowerCase().includes(query)
      const matchesDescription = dataset.description?.toLowerCase().includes(query)
      const matchesAuthor = useTableView && dataset.author_name?.toLowerCase().includes(query)

      return matchesName || matchesDescription || matchesAuthor
    })

    // 2. Sort
    if (sortBy === 'created_at') {
      filtered.sort((a, b) => b.created_at - a.created_at) // newest first
    } else if (sortBy === 'name') {
      filtered.sort((a, b) => a.name.localeCompare(b.name))
    } else if (sortBy === 'document_count') {
      filtered.sort((a, b) => b.document_count - a.document_count)
    } else if (sortBy === 'author_name') {
      filtered.sort((a, b) => {
        const aOwner = a.author_name || ''
        const bOwner = b.author_name || ''
        return aOwner.localeCompare(bOwner)
      })
    }

    return filtered
  }, [datasets, searchQuery, sortBy, useTableView])

  // Reset to page 1 when filter/sort changes
  useEffect(() => {
    setCurrentPage(1)
  }, [searchQuery, sortBy])

  // Paginate filtered datasets
  const paginatedDatasets = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE
    const endIndex = startIndex + ITEMS_PER_PAGE
    return filteredDatasets.slice(startIndex, endIndex)
  }, [filteredDatasets, currentPage])

  // Calculate total pages
  const totalPages = Math.ceil(filteredDatasets.length / ITEMS_PER_PAGE)

  // Handle page change
  const handlePageChange = (page: number) => {
    setCurrentPage(page)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                {t('list.title')}
              </h1>
              <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                {t('list.description')}
              </p>
            </div>
            <Button onClick={handleCreateDataset}>
              <PlusIcon className="h-5 w-5 mr-2" />
              {t('list.createButton')}
            </Button>
          </div>

          {/* Search and Sort */}
          {!isLoading && !error && currentSession && datasets.length > 0 && (
            <div className="flex gap-4">
              {/* Search Input */}
              <div className="relative flex-1">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={useTableView ? t('search.placeholderWithOwner') : t('search.placeholder')}
                  className="w-full px-4 py-2 pl-10 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-800 dark:border-gray-600 dark:text-white dark:placeholder-gray-400"
                  aria-label={t('search.placeholder')}
                />
                <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                  <svg
                    className="w-5 h-5 text-gray-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                    />
                  </svg>
                </div>
              </div>

              {/* Sort Dropdown */}
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as DatasetSortField)}
                className="px-4 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-800 dark:border-gray-600 dark:text-white"
                aria-label={t('sort.label')}
              >
                <option value="created_at">{t('sort.createdAt')}</option>
                <option value="name">{t('sort.name')}</option>
                <option value="document_count">{t('sort.documentCount')}</option>
                {useTableView && <option value="author_name">{t('sort.owner')}</option>}
              </select>
            </div>
          )}
        </div>

        {/* Loading State */}
        {(isLoading || sessionLoading) && (
          <div className="flex items-center justify-center py-12">
            <ArrowPathIcon className="h-8 w-8 animate-spin text-gray-400" />
          </div>
        )}

        {/* No Session Warning */}
        {!sessionLoading && !currentSession && !isLoading && (
          <div className="bg-white rounded-lg shadow p-8 dark:bg-gray-800">
            <div className="text-center">
              <ExclamationCircleIcon className="h-16 w-16 text-yellow-500 mx-auto mb-4" />
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                {t('list.sessionRequired')}
              </h2>
              <p className="text-gray-600 dark:text-gray-400 mb-6">
                {t('list.sessionRequiredDescription')}
              </p>
              <Button
                variant="default"
                onClick={() => router.push('/dashboard')}
              >
                {t('list.backToDashboard')}
              </Button>
            </div>
          </div>
        )}

        {/* Error State */}
        {error && !isLoading && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 dark:bg-red-900/20 dark:border-red-800">
            <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
          </div>
        )}

        {/* Empty State */}
        {!isLoading && !error && currentSession && filteredDatasets.length === 0 && (
          <EmptyState
            icon={<PlusIcon className="h-8 w-8 text-gray-400" />}
            title={t('list.emptyTitle')}
            description={t('list.emptyDescription')}
            actionLabel={t('list.createButton')}
            onAction={handleCreateDataset}
          />
        )}

        {/* Dataset List - Owner/Admin: Table View, Student: Card Grid */}
        {!isLoading && !error && currentSession && filteredDatasets.length > 0 && (
          <>
            {useTableView ? (
              <DatasetTable
                datasets={paginatedDatasets}
                isLoading={isLoading}
                onView={handleViewDataset}
                onDelete={handleDeleteDataset}
              />
            ) : (
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {paginatedDatasets.map(dataset => (
                  <DatasetCard
                    key={dataset.id}
                    dataset={dataset}
                    onView={handleView}
                    onDelete={handleDelete}
                  />
                ))}
              </div>
            )}

            {/* Pagination */}
            {totalPages > 1 && (
              <Pagination
                currentPage={currentPage}
                totalPages={totalPages}
                totalItems={filteredDatasets.length}
                itemsPerPage={ITEMS_PER_PAGE}
                onPageChange={handlePageChange}
                previousLabel={t('pagination.previous')}
                nextLabel={t('pagination.next')}
                itemsLabel={t('pagination.items')}
                ariaLabelPagination={t('pagination.ariaLabel')}
                ariaLabelPrevious={t('pagination.ariaPrevious')}
                ariaLabelNext={t('pagination.ariaNext')}
                className="mt-6"
              />
            )}
          </>
        )}
      </div>

      {/* Delete Confirmation Dialog */}
      <DeleteConfirmDialog
        isOpen={isDeleteDialogOpen}
        onClose={handleDeleteCancel}
        onConfirm={handleDeleteConfirm}
        title={t('delete.title')}
        message={
          datasetToDelete
            ? t('delete.confirmMessage', { name: datasetToDelete.name })
            : ''
        }
        confirmLabel={t('delete.confirm')}
        cancelLabel={t('delete.cancel')}
        loadingLabel={t('delete.deleting')}
        closeAriaLabel={t('delete.close')}
        isLoading={isDeleting}
      />

    </div>
  )
}
