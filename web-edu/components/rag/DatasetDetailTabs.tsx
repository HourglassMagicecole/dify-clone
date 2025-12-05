/**
 * Dataset Detail Tabs Component
 * Story 3.4: RAG Search Test Interface
 *
 * Provides tab navigation for dataset detail page
 * - Documents tab: Document list (existing)
 * - Retrieval Test tab: Search testing interface (Story 3.4)
 */

'use client'

import React from 'react'
import { useTranslation } from 'react-i18next'
import {
  DocumentTextIcon,
  MagnifyingGlassIcon,
} from '@heroicons/react/24/outline'

export type DatasetDetailTab = 'documents' | 'retrieval-test'

interface DatasetDetailTabsProps {
  activeTab: DatasetDetailTab
  onTabChange: (tab: DatasetDetailTab) => void
  documentCount: number
}

export function DatasetDetailTabs({
  activeTab,
  onTabChange,
  documentCount,
}: DatasetDetailTabsProps): React.ReactElement {
  const { t } = useTranslation('dataset')

  const tabs = [
    {
      id: 'documents' as const,
      label: t('detail.tabs.documents'),
      icon: DocumentTextIcon,
      count: documentCount,
    },
    {
      id: 'retrieval-test' as const,
      label: t('detail.tabs.retrievalTest'),
      icon: MagnifyingGlassIcon,
    },
  ]

  return (
    <div className="border-b border-gray-200 dark:border-gray-700">
      <nav className="flex space-x-8" aria-label="Tabs">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id
          const Icon = tab.icon

          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={`
                flex items-center gap-2 py-4 px-1 border-b-2 font-medium text-sm
                ${isActive
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
                }
              `}
              aria-current={isActive ? 'page' : undefined}
            >
              <Icon className="h-5 w-5" />
              <span>{tab.label}</span>
              {tab.count !== undefined && (
                <span className={`
                  ml-1 px-2 py-0.5 rounded-full text-xs
                  ${isActive
                    ? 'bg-blue-100 text-blue-600 dark:bg-blue-900 dark:text-blue-300'
                    : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'
                  }
                `}>
                  {tab.count}
                </span>
              )}
            </button>
          )
        })}
      </nav>
    </div>
  )
}
