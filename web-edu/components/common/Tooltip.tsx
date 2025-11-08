'use client'

import { useState } from 'react'
import { QuestionMarkCircleIcon } from '@heroicons/react/24/outline'

interface TooltipProps {
  content: string
  children?: React.ReactNode
}

/**
 * Simple Tooltip Component
 * Shows a tooltip on hover with helpful information
 */
export function Tooltip({ content, children }: TooltipProps) {
  const [isVisible, setIsVisible] = useState(false)

  return (
    <div className="relative inline-block">
      <div
        onMouseEnter={() => setIsVisible(true)}
        onMouseLeave={() => setIsVisible(false)}
        className="cursor-help"
      >
        {children || (
          <QuestionMarkCircleIcon className="h-4 w-4 text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300" />
        )}
      </div>

      {isVisible && (
        <div className="absolute z-50 left-1/2 -translate-x-1/2 bottom-full mb-2 w-64 px-3 py-2 text-xs text-white bg-gray-900 rounded-lg shadow-lg dark:bg-gray-700">
          <div className="relative">
            {content}
            {/* Arrow */}
            <div className="absolute left-1/2 -translate-x-1/2 top-full w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-900 dark:border-t-gray-700"></div>
          </div>
        </div>
      )}
    </div>
  )
}
