'use client'

import Image from 'next/image'
import { useTranslation } from 'react-i18next'
import type { Tool } from '@/types/tool'

interface ToolCardProps {
  tool: Tool
  selected: boolean
  onToggle: (toolName: string) => void
  onConfigure: (tool: Tool) => void
}

export default function ToolCard({ tool, selected, onToggle, onConfigure }: ToolCardProps) {
  const { t, i18n } = useTranslation('agent')
  // Convert i18n language code (ko-KR) to API format (ko_KR)
  const currentLang = (i18n.language.replace('-', '_') || 'en_US') as 'en_US' | 'ko_KR'

  return (
    <div
      className={`relative border rounded-lg p-4 cursor-pointer transition-all ${
        selected
          ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
          : 'border-gray-200 hover:border-gray-300'
      } ${!tool.available ? 'opacity-50 cursor-not-allowed' : ''}`}
      onClick={() => tool.available && onToggle(tool.name)}
    >
      {/* Checkbox */}
      <input
        type="checkbox"
        checked={selected}
        disabled={!tool.available}
        onChange={() => onToggle(tool.name)}
        className="absolute top-4 right-4"
        onClick={(e) => e.stopPropagation()}
      />

      {/* Icon */}
      <div className="w-12 h-12 mb-3 flex items-center justify-center bg-gray-100 rounded-lg">
        {tool.icon ? (
          <Image src={tool.icon} alt={tool.name} width={32} height={32} className="w-8 h-8" />
        ) : (
          <span className="text-2xl">🔧</span>
        )}
      </div>

      {/* Tool Name */}
      <h3 className="text-lg font-semibold mb-1">
        {tool.label[currentLang] || tool.label.en_US}
      </h3>

      {/* Description */}
      <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
        {tool.description.human[currentLang] || tool.description.human.en_US}
      </p>

      {/* Availability Status */}
      {!tool.available && (
        <div className="text-xs text-red-500 mb-2">
          {tool.unavailable_reason}
        </div>
      )}

      {/* Configure Button */}
      {tool.available && selected && (
        <button
          onClick={(e) => {
            e.stopPropagation()
            onConfigure(tool)
          }}
          className="text-sm text-blue-600 hover:text-blue-700"
        >
          {t('tools.configure')}
        </button>
      )}
    </div>
  )
}
