'use client'

import type { FC } from 'react'
import { useTranslation } from 'react-i18next'
import type { Agent } from '@/types/agent'

interface AgentTableProps {
  agents: Agent[]
  isLoading?: boolean
}

/**
 * AgentTable Component (Administrator View)
 * Displays agents in table format with owner information
 */
export const AgentTable: FC<AgentTableProps> = ({ agents, isLoading = false }) => {
  const { t } = useTranslation('agent')

  if (isLoading) {
    return (
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="animate-pulse p-4">
          <div className="h-4 bg-gray-200 rounded w-full mb-2"></div>
          <div className="h-4 bg-gray-200 rounded w-full mb-2"></div>
          <div className="h-4 bg-gray-200 rounded w-full"></div>
        </div>
      </div>
    )
  }

  if (agents.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow p-8 text-center">
        <div className="text-4xl mb-4">🤖</div>
        <p className="text-gray-600">{t('list.emptyTitle')}</p>
      </div>
    )
  }

  const getAgentTypeLabel = (mode: string) => {
    if (mode === 'agent-chat' || mode === 'chat') return t('types.chat.title')
    if (mode === 'completion') return t('types.completion.title')
    return mode
  }

  return (
    <div className="bg-white rounded-lg shadow overflow-hidden">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                {t('table.name')}
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                {t('table.owner')}
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                {t('table.type')}
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                {t('table.createdAt')}
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {agents.map((agent) => (
              <tr key={agent.id} className="hover:bg-gray-50 transition-colors">
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center">
                    <div
                      className="h-10 w-10 rounded-lg flex items-center justify-center text-xl flex-shrink-0"
                      style={{ backgroundColor: agent.icon_background || '#3B82F6' }}
                    >
                      {agent.icon || '🤖'}
                    </div>
                    <div className="ml-4">
                      <div className="text-sm font-medium text-gray-900">{agent.name}</div>
                      {agent.description && (
                        <div className="text-sm text-gray-500 truncate max-w-xs">{agent.description}</div>
                      )}
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm text-gray-900">{agent.author_name || '-'}</div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className="px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-blue-100 text-blue-800">
                    {getAgentTypeLabel(agent.mode)}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {new Date(typeof agent.created_at === 'number' ? agent.created_at * 1000 : agent.created_at).toLocaleDateString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
