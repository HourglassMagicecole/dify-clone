'use client'

import { useTranslation } from 'react-i18next'
import {
  ChatBubbleLeftRightIcon,
  PencilIcon,
  DocumentDuplicateIcon,
  TrashIcon,
} from '@heroicons/react/24/outline'
import type { Agent } from '@/types/agent'

interface AgentCardProps {
  agent: Agent
  onClick?: () => void
  onChat?: (agentId: string) => void
  onEdit?: (agentId: string) => void
  onDuplicate?: (agentId: string) => void
  onDelete?: (agentId: string) => void
}

/**
 * AgentCard Component
 *
 * Displays individual Agent information in a card layout.
 * Features:
 * - Agent icon with custom background color
 * - Agent name, description, and type
 * - Creation date
 * - Action buttons (edit, duplicate, delete)
 * - Hover effects
 * - Responsive design
 */
export function AgentCard({
  agent,
  onClick,
  onChat,
  onEdit,
  onDuplicate,
  onDelete,
}: AgentCardProps) {
  const { t } = useTranslation('agent')

  const handleClick = () => {
    if (onClick) {
      onClick()
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.key === 'Enter' || e.key === ' ') && onClick) {
      e.preventDefault()
      onClick()
    }
  }

  const handleChat = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (onChat) {
      onChat(agent.id)
    }
  }

  const handleEdit = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (onEdit) {
      onEdit(agent.id)
    }
  }

  const handleDuplicate = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (onDuplicate) {
      onDuplicate(agent.id)
    }
  }

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (onDelete) {
      onDelete(agent.id)
    }
  }

  return (
    <div
      className="bg-white border border-gray-200 rounded-lg p-6 hover:shadow-lg transition-shadow dark:bg-gray-800 dark:border-gray-700"
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      tabIndex={0}
      role="button"
      aria-label={`${agent.name} Agent 카드`}
    >
      <div className="flex items-start gap-4">
        {/* Agent Icon */}
        <div
          className="h-12 w-12 rounded-lg flex items-center justify-center text-2xl flex-shrink-0"
          style={{ backgroundColor: agent.icon_background || '#3B82F6' }}
          aria-hidden="true"
        >
          {agent.icon || '🤖'}
        </div>

        {/* Agent Information */}
        <div className="flex-1 min-w-0">
          <h3 className="text-lg font-medium text-gray-900 dark:text-white truncate">
            {agent.name}
          </h3>

          {/* Agent Description */}
          {agent.description && (
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1 line-clamp-2">
              {agent.description}
            </p>
          )}

          {/* Agent Type */}
          <p className="text-sm text-gray-500 dark:text-gray-500 mt-2">
            {t(`types.${agent.mode === 'agent-chat' ? 'chat' : agent.mode}.title`)}
          </p>

          {/* Creation Date */}
          <p className="text-xs text-gray-400 dark:text-gray-600 mt-1">
            {new Date(
              typeof agent.created_at === 'number'
                ? agent.created_at * 1000
                : agent.created_at
            ).toLocaleDateString('ko-KR', {
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            })}
          </p>
        </div>
      </div>

      {/* Action Buttons */}
      {(onChat || onEdit || onDuplicate || onDelete) && (
        <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700 flex items-center gap-2">
          {onChat && (
            <button
              type="button"
              onClick={handleChat}
              className="flex-1 inline-flex items-center justify-center gap-1 px-3 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:bg-blue-500 dark:hover:bg-blue-600"
              aria-label={`${agent.name} Agent와 채팅`}
            >
              <ChatBubbleLeftRightIcon className="h-4 w-4" />
              <span>{t('list.actions.chat')}</span>
            </button>
          )}
          {onEdit && (
            <button
              type="button"
              onClick={handleEdit}
              className="flex-1 inline-flex items-center justify-center gap-1 px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:bg-gray-700 dark:text-gray-200 dark:border-gray-600 dark:hover:bg-gray-600"
              aria-label={`${agent.name} Agent 편집`}
            >
              <PencilIcon className="h-4 w-4" />
              <span>{t('list.actions.edit')}</span>
            </button>
          )}
          {onDuplicate && (
            <button
              type="button"
              onClick={handleDuplicate}
              className="flex-1 inline-flex items-center justify-center gap-1 px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:bg-gray-700 dark:text-gray-200 dark:border-gray-600 dark:hover:bg-gray-600"
              aria-label={`${agent.name} Agent 복제`}
            >
              <DocumentDuplicateIcon className="h-4 w-4" />
              <span>{t('list.actions.duplicate')}</span>
            </button>
          )}
          {onDelete && (
            <button
              type="button"
              onClick={handleDelete}
              className="flex-1 inline-flex items-center justify-center gap-1 px-3 py-2 text-sm font-medium text-red-700 bg-white border border-red-300 rounded-md hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 dark:bg-gray-700 dark:text-red-400 dark:border-red-600 dark:hover:bg-red-900/20"
              aria-label={`${agent.name} Agent 삭제`}
            >
              <TrashIcon className="h-4 w-4" />
              <span>{t('list.actions.delete')}</span>
            </button>
          )}
        </div>
      )}
    </div>
  )
}
