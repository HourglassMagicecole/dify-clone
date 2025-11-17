'use client'

import { useTranslation } from 'react-i18next'
import type { TokenUsage } from '@/types/chat'

interface MessageMetadataProps {
  tokenUsage?: TokenUsage
  responseTime?: number // milliseconds
}

/**
 * MessageMetadata Component
 * Displays token usage and response time for assistant messages
 */
export function MessageMetadata({ tokenUsage, responseTime }: MessageMetadataProps) {
  const { t } = useTranslation('chat')

  if (!tokenUsage && !responseTime) return null

  return (
    <div className="mt-2 text-xs text-gray-500 flex gap-4">
      {tokenUsage && (
        <div className="flex gap-2">
          <span>
            {t('tokenUsage')}: {tokenUsage.totalTokens}
          </span>
          {tokenUsage.cost && <span>(${tokenUsage.cost.toFixed(4)})</span>}
        </div>
      )}
      {responseTime && (
        <span>
          {t('responseTime')}: {(responseTime / 1000).toFixed(2)}s
        </span>
      )}
    </div>
  )
}
