'use client'

import { useTranslation } from 'react-i18next'
import type { ModelType } from '@/types/model'

interface ModelTypeFilterProps {
  selectedType: ModelType | 'all'
  onChange: (type: ModelType | 'all') => void
}

const MODEL_TYPES: Array<{ value: ModelType | 'all', labelKey: string }> = [
  { value: 'all', labelKey: 'models.filter.all' },
  { value: 'llm', labelKey: 'models.filter.llm' },
  { value: 'text-embedding', labelKey: 'models.filter.embedding' },
  { value: 'rerank', labelKey: 'models.filter.rerank' },
  { value: 'speech2text', labelKey: 'models.filter.speech2text' },
  { value: 'tts', labelKey: 'models.filter.tts' },
]

/**
 * Tab filter for model types (Story 3.7)
 * AC: 5 - Model Type Support
 */
export function ModelTypeFilter({ selectedType, onChange }: ModelTypeFilterProps) {
  const { t } = useTranslation('api-keys')

  return (
    <div className="flex items-center gap-1 p-1 bg-gray-100 rounded-lg flex-wrap">
      {MODEL_TYPES.map(({ value, labelKey }) => (
        <button
          key={value}
          type="button"
          onClick={() => onChange(value)}
          className={`
            px-4 py-2 text-sm font-medium rounded-md transition-colors whitespace-nowrap
            ${selectedType === value
              ? 'bg-white text-gray-900 shadow-sm'
              : 'text-gray-600 hover:text-gray-900'}
          `}
        >
          {t(labelKey)}
        </button>
      ))}
    </div>
  )
}
