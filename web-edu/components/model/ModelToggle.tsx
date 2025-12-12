'use client'

import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

// Feature display names mapping
const FEATURE_LABELS: Record<string, string> = {
  'vision': 'Vision',
  'tool-call': 'Tools',
  'stream-tool-call': 'Stream Tools',
  'agent-thought': 'Agent',
  'multi-tool-call': 'Multi Tools',
  'document': 'Document',
}

interface ModelToggleProps {
  modelName: string
  modelLabel: string
  modelType: string
  features?: string[]
  enabled: boolean
  disabled?: boolean
  onToggle: (enable: boolean) => Promise<boolean>
}

/**
 * Toggle switch for individual model enable/disable
 * AC: 3 - Individual Model Toggle (Story 3.7)
 */
export function ModelToggle({
  modelName,
  modelLabel,
  modelType,
  features = [],
  enabled,
  disabled = false,
  onToggle,
}: ModelToggleProps) {
  const { t } = useTranslation('api-keys')
  const [isToggling, setIsToggling] = useState(false)
  const [localEnabled, setLocalEnabled] = useState(enabled)
  const [feedback, setFeedback] = useState<'success' | 'error' | null>(null)

  // Sync localEnabled when enabled prop changes
  useEffect(() => {
    setLocalEnabled(enabled)
  }, [enabled])

  const handleToggle = async () => {
    if (isToggling || disabled)
      return

    setIsToggling(true)
    setFeedback(null)
    const newState = !localEnabled

    try {
      const success = await onToggle(newState)
      if (success) {
        setLocalEnabled(newState)
        setFeedback('success')
      }
      else {
        setFeedback('error')
      }
    }
    catch {
      setFeedback('error')
    }
    finally {
      setIsToggling(false)
      // Clear feedback after 2 seconds
      setTimeout(() => setFeedback(null), 2000)
    }
  }

  return (
    <div className={`flex items-center justify-between p-3 border rounded-lg transition-colors ${localEnabled ? 'bg-white border-gray-200 hover:bg-gray-50' : 'bg-gray-50 border-gray-200 opacity-60'}`}>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-medium text-gray-900 truncate">{modelLabel}</span>
          <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-600 rounded">
            {modelType}
          </span>
          {/* Feature badges */}
          {features && features.length > 0 && (
            <div className="flex items-center gap-1 flex-wrap">
              {features.slice(0, 3).map(feature => (
                <span
                  key={feature}
                  className="text-xs px-1.5 py-0.5 bg-blue-50 text-blue-600 rounded"
                  title={feature}
                >
                  {FEATURE_LABELS[feature] || feature}
                </span>
              ))}
              {features.length > 3 && (
                <span className="text-xs text-gray-400">+{features.length - 3}</span>
              )}
            </div>
          )}
        </div>
        <p className="text-xs text-gray-500 truncate mt-0.5">{modelName}</p>
      </div>

      <div className="flex items-center gap-2 ml-4">
        {/* Feedback indicator */}
        {feedback === 'success' && (
          <span className="text-xs text-green-600">{t('models.toggle.success')}</span>
        )}
        {feedback === 'error' && (
          <span className="text-xs text-red-600">{t('models.toggle.error')}</span>
        )}

        {/* Toggle switch */}
        <button
          type="button"
          role="switch"
          aria-checked={localEnabled}
          aria-label={t('models.toggle.ariaLabel', { model: modelLabel })}
          disabled={isToggling || disabled}
          onClick={handleToggle}
          className={`
            relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent
            transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2
            ${localEnabled ? 'bg-blue-600' : 'bg-gray-200'}
            ${(isToggling || disabled) ? 'opacity-50 cursor-not-allowed' : ''}
          `}
        >
          <span
            className={`
              pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0
              transition duration-200 ease-in-out
              ${localEnabled ? 'translate-x-5' : 'translate-x-0'}
            `}
          />
        </button>
      </div>
    </div>
  )
}
