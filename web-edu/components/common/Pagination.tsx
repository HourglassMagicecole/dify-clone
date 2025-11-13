/**
 * Pagination Component
 * Reusable pagination component for list views
 * Features:
 * - Previous/Next navigation
 * - Current page and total pages display
 * - Item range display (e.g., "Showing 1-12 of 50")
 * - Accessibility support
 */

'use client'

import { ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/outline'

interface PaginationProps {
  currentPage: number
  totalPages: number
  totalItems: number
  itemsPerPage: number
  onPageChange: (page: number) => void
  className?: string
  // i18n labels
  previousLabel?: string
  nextLabel?: string
  itemsLabel?: string
  ariaLabelPagination?: string
  ariaLabelPrevious?: string
  ariaLabelNext?: string
}

export function Pagination({
  currentPage,
  totalPages,
  totalItems,
  itemsPerPage,
  onPageChange,
  className = '',
  previousLabel = '이전',
  nextLabel = '다음',
  itemsLabel = '항목',
  ariaLabelPagination = '페이지네이션',
  ariaLabelPrevious = '이전 페이지',
  ariaLabelNext = '다음 페이지',
}: PaginationProps) {
  // Calculate item range for current page
  const startItem = totalItems === 0 ? 0 : (currentPage - 1) * itemsPerPage + 1
  const endItem = Math.min(currentPage * itemsPerPage, totalItems)

  const handlePrevious = () => {
    if (currentPage > 1) {
      onPageChange(currentPage - 1)
    }
  }

  const handleNext = () => {
    if (currentPage < totalPages) {
      onPageChange(currentPage + 1)
    }
  }

  // Don't render pagination if there's only one page or no items
  if (totalPages <= 1) {
    return null
  }

  return (
    <nav
      className={`flex items-center justify-between border-t border-gray-200 dark:border-gray-700 px-4 py-3 sm:px-6 ${className}`}
      aria-label={ariaLabelPagination}
    >
      {/* Item range display (mobile hidden) */}
      <div className="hidden sm:block">
        <p className="text-sm text-gray-700 dark:text-gray-300">
          <span className="font-medium">{startItem}</span>
          {' - '}
          <span className="font-medium">{endItem}</span>
          {' / '}
          <span className="font-medium">{totalItems}</span>
          {` ${itemsLabel}`}
        </p>
      </div>

      {/* Navigation buttons */}
      <div className="flex flex-1 justify-between sm:justify-end gap-2">
        {/* Previous button */}
        <button
          type="button"
          onClick={handlePrevious}
          disabled={currentPage === 1}
          className="relative inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed dark:bg-gray-800 dark:text-gray-300 dark:border-gray-600 dark:hover:bg-gray-700"
          aria-label={ariaLabelPrevious}
        >
          <ChevronLeftIcon className="h-5 w-5" />
          <span className="hidden sm:inline">{previousLabel}</span>
        </button>

        {/* Page indicator */}
        <div className="flex items-center px-4 text-sm text-gray-700 dark:text-gray-300">
          <span className="font-medium">{currentPage}</span>
          <span className="mx-1">/</span>
          <span className="font-medium">{totalPages}</span>
        </div>

        {/* Next button */}
        <button
          type="button"
          onClick={handleNext}
          disabled={currentPage === totalPages}
          className="relative inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed dark:bg-gray-800 dark:text-gray-300 dark:border-gray-600 dark:hover:bg-gray-700"
          aria-label={ariaLabelNext}
        >
          <span className="hidden sm:inline">{nextLabel}</span>
          <ChevronRightIcon className="h-5 w-5" />
        </button>
      </div>
    </nav>
  )
}
