/**
 * DatasetEditModal Component
 * Story 3.3: RAG List and Management - Task 7
 */

'use client'

import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { XMarkIcon } from '@heroicons/react/24/outline'
import { datasetAPI } from '@/service/dataset-api'
import type { Dataset } from '@/types/dataset'

interface DatasetEditModalProps {
  isOpen: boolean
  dataset: Dataset | null
  onClose: () => void
  onSuccess: (updatedDataset: Dataset) => void
}

/**
 * Modal for editing dataset name and description
 */
export function DatasetEditModal({
  isOpen,
  dataset,
  onClose,
  onSuccess,
}: DatasetEditModalProps) {
  const { t } = useTranslation('dataset')
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen && dataset) {
      setName(dataset.name)
      setDescription(dataset.description || '')
      setError(null)
    }
  }, [isOpen, dataset])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!dataset) return

    // Validation
    if (!name.trim()) {
      setError(t('edit.nameRequired'))
      return
    }

    try {
      setIsLoading(true)
      setError(null)

      const response = await datasetAPI.updateDataset(dataset.id, {
        name: name.trim(),
        description: description.trim() || undefined,
      })

      if (response.result === 'success' && response.data) {
        onSuccess(response.data)
        onClose()
      } else {
        setError(t('edit.updateFailed'))
      }
    } catch (err) {
      console.error('Failed to update dataset:', err)
      setError(t('edit.updateFailed'))
    } finally {
      setIsLoading(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal */}
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="relative bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-md transform transition-all">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              {t('edit.title')}
            </h3>
            <button
              type="button"
              onClick={onClose}
              className="text-gray-400 hover:text-gray-500 dark:hover:text-gray-300"
              aria-label={t('edit.close')}
            >
              <XMarkIcon className="h-5 w-5" />
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit}>
            <div className="p-4 space-y-4">
              {/* Name Field */}
              <div>
                <label
                  htmlFor="dataset-name"
                  className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
                >
                  {t('edit.nameLabel')}
                </label>
                <input
                  type="text"
                  id="dataset-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={t('edit.namePlaceholder')}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                  disabled={isLoading}
                  autoFocus
                />
              </div>

              {/* Description Field */}
              <div>
                <label
                  htmlFor="dataset-description"
                  className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
                >
                  {t('edit.descriptionLabel')}
                </label>
                <textarea
                  id="dataset-description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder={t('edit.descriptionPlaceholder')}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white resize-none"
                  disabled={isLoading}
                />
              </div>

              {/* Error Message */}
              {error && (
                <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                  <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-3 p-4 border-t border-gray-200 dark:border-gray-700">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600"
                disabled={isLoading}
              >
                {t('edit.cancel')}
              </button>
              <button
                type="submit"
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={isLoading}
              >
                {isLoading ? t('edit.saving') : t('edit.save')}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
