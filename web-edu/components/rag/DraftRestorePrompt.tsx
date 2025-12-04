/**
 * DraftRestorePrompt Component
 * Story 3.3: RAG List and Management - Task 12
 */

'use client'

import { useTranslation } from 'react-i18next'
import { DocumentTextIcon } from '@heroicons/react/24/outline'

interface DraftRestorePromptProps {
  isVisible: boolean
  onRestore: () => void
  onDiscard: () => void
}

/**
 * Prompt shown when there's a draft available to restore
 */
export function DraftRestorePrompt({
  isVisible,
  onRestore,
  onDiscard,
}: DraftRestorePromptProps) {
  const { t } = useTranslation('dataset')

  if (!isVisible) return null

  return (
    <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mb-6">
      <div className="flex items-start gap-3">
        <DocumentTextIcon className="h-6 w-6 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
        <div className="flex-1">
          <h4 className="text-sm font-medium text-blue-900 dark:text-blue-200">
            {t('draft.foundTitle')}
          </h4>
          <p className="mt-1 text-sm text-blue-700 dark:text-blue-300">
            {t('draft.foundDescription')}
          </p>
          <div className="mt-3 flex items-center gap-3">
            <button
              type="button"
              onClick={onRestore}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            >
              {t('draft.restore')}
            </button>
            <button
              type="button"
              onClick={onDiscard}
              className="px-4 py-2 text-sm font-medium text-blue-700 dark:text-blue-300 bg-white dark:bg-transparent border border-blue-300 dark:border-blue-600 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/30"
            >
              {t('draft.discard')}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
