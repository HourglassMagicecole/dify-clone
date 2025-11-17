'use client'

import { useTranslation } from 'react-i18next'
import { TrashIcon } from '@heroicons/react/24/outline'
import type { Conversation } from '@/types/chat'

interface ConversationHistoryProps {
  conversations: Conversation[]
  currentConversationId: string | null
  onSelect: (id: string) => void
  onNewConversation: () => void
  onDelete?: (id: string) => void
}

/**
 * ConversationHistory Component
 * Displays list of previous conversations with selection
 */
export function ConversationHistory({
  conversations,
  currentConversationId,
  onSelect,
  onNewConversation,
  onDelete,
}: ConversationHistoryProps) {
  const { t } = useTranslation('chat')

  // Format date safely - handles both ISO strings and Unix timestamps
  const formatDate = (dateValue: string): string => {
    try {
      // Try parsing as ISO string first
      let date = new Date(dateValue)

      // If invalid, try parsing as Unix timestamp (seconds)
      if (isNaN(date.getTime())) {
        const timestamp = parseInt(dateValue, 10)
        if (!isNaN(timestamp)) {
          date = new Date(timestamp * 1000)
        }
      }

      if (isNaN(date.getTime())) {
        return '-'
      }

      return date.toLocaleDateString('ko-KR')
    }
    catch {
      return '-'
    }
  }

  return (
    <aside className="w-64 border-r bg-gray-50 flex flex-col h-full">
      {/* Header with New Conversation button - Sticky */}
      <div className="p-4 border-b bg-white flex justify-between items-center sticky top-0 z-10 flex-shrink-0">
        <h3 className="font-bold text-gray-900">{t('conversationHistory')}</h3>
        <button
          onClick={onNewConversation}
          className="px-3 py-1 bg-blue-500 text-white rounded text-sm hover:bg-blue-600"
          aria-label={t('newConversationButton')}
        >
          +
        </button>
      </div>

      {/* Conversation List - Scrollable */}
      <div className="flex-1 overflow-y-auto p-4">
        {conversations.length === 0 ? (
          <p className="text-sm text-gray-500">{t('noConversations')}</p>
        ) : (
          <div className="space-y-2">
            {conversations.map((conversation) => (
              <div
                key={conversation.id}
                className={`relative rounded-lg transition-colors ${
                  conversation.id === currentConversationId
                    ? 'bg-blue-50 border-2 border-blue-500'
                    : 'border border-gray-200 bg-white'
                }`}
              >
                <button
                  onClick={() => onSelect(conversation.id)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      onSelect(conversation.id)
                    }
                  }}
                  className="w-full text-left p-3 pr-10 hover:bg-gray-100 rounded-lg"
                  aria-label={`Select conversation: ${conversation.name}`}
                  aria-current={conversation.id === currentConversationId ? 'true' : 'false'}
                >
                  <div className={`font-medium truncate text-sm ${conversation.id === 'temp-new-conversation' ? 'italic text-blue-600' : ''}`}>
                    {conversation.name}
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    {conversation.id === 'temp-new-conversation' ? '-' : formatDate(conversation.updatedAt)}
                  </div>
                  <div className="text-xs text-gray-400">
                    {conversation.messageCount}개 메시지
                  </div>
                </button>
                {onDelete && conversation.id !== 'temp-new-conversation' && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      onDelete(conversation.id)
                    }}
                    className="absolute top-2 right-2 p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                    aria-label={`Delete conversation: ${conversation.name}`}
                  >
                    <TrashIcon className="h-4 w-4" />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </aside>
  )
}
