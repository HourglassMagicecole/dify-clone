'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslation } from 'react-i18next'
import { PlusIcon, ArrowPathIcon, ExclamationCircleIcon } from '@heroicons/react/24/outline'
import { difyAPI, type App } from '@/service/dify-api'
import { useSession } from '@/context/SessionContext'
import { Button } from '@/components/common/Button'

/**
 * Agent List Page
 *
 * Features:
 * - Display all created agents in card layout
 * - Create new agent button
 * - Loading and empty states
 */
export default function AgentsPage() {
  const { t } = useTranslation('agent')
  const router = useRouter()
  const { currentSession, isLoading: sessionLoading } = useSession()
  const [agents, setAgents] = useState<App[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadAgents = useCallback(async () => {
    if (!currentSession) return

    try {
      setIsLoading(true)
      setError(null)
      const response = await difyAPI.getApps(currentSession.id)

      if (response.result === 'success' && Array.isArray(response.data)) {
        setAgents(response.data)
      }
    }
    catch (err) {
      console.error('Failed to load agents:', err)
      setError(err instanceof Error ? err.message : 'Failed to load agents')
    }
    finally {
      setIsLoading(false)
    }
  }, [currentSession])

  useEffect(() => {
    if (!sessionLoading && currentSession) {
      loadAgents()
    }
  }, [currentSession, sessionLoading, loadAgents])

  const handleCreateAgent = () => {
    router.push('/agents/create')
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
              {t('list.title')}
            </h1>
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
              {t('list.description')}
            </p>
          </div>
          <button
            type="button"
            onClick={handleCreateAgent}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:bg-blue-500 dark:hover:bg-blue-600"
          >
            <PlusIcon className="h-5 w-5" />
            {t('list.createButton')}
          </button>
        </div>

        {/* Loading State */}
        {(isLoading || sessionLoading) && (
          <div className="flex items-center justify-center py-12">
            <ArrowPathIcon className="h-8 w-8 animate-spin text-gray-400" />
          </div>
        )}

        {/* No Session Warning */}
        {!sessionLoading && !currentSession && !isLoading && (
          <div className="bg-white rounded-lg shadow p-8">
            <div className="text-center">
              <ExclamationCircleIcon className="h-16 w-16 text-yellow-500 mx-auto mb-4" />
              <h2 className="text-2xl font-bold text-gray-900 mb-2">
                세션이 필요합니다
              </h2>
              <p className="text-gray-600 mb-6">
                Agent 목록을 보려면 먼저 활성화된 교육 세션에 속해있어야 합니다.
                <br />
                관리자에게 문의하여 세션에 등록해주세요.
              </p>
              <Button
                variant="default"
                onClick={() => router.push('/dashboard')}
              >
                대시보드로 돌아가기
              </Button>
            </div>
          </div>
        )}

        {/* Error State */}
        {error && !isLoading && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 dark:bg-red-900/20 dark:border-red-800">
            <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
          </div>
        )}

        {/* Empty State */}
        {!isLoading && !error && currentSession && agents.length === 0 && (
          <div className="text-center py-12">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gray-100 dark:bg-gray-800 mb-4">
              <PlusIcon className="h-8 w-8 text-gray-400" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
              {t('list.emptyTitle')}
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              {t('list.emptyDescription')}
            </p>
            <button
              type="button"
              onClick={handleCreateAgent}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:bg-blue-500 dark:hover:bg-blue-600"
            >
              <PlusIcon className="h-5 w-5" />
              {t('list.createButton')}
            </button>
          </div>
        )}

        {/* Agent Grid */}
        {!isLoading && !error && currentSession && agents.length > 0 && (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {agents.map(agent => (
              <div
                key={agent.id}
                className="bg-white border border-gray-200 rounded-lg p-6 hover:shadow-md transition-shadow cursor-pointer dark:bg-gray-800 dark:border-gray-700"
                onClick={() => {
                  // TODO: Navigate to agent detail page (Story 2.3+)
                  // router.push(`/agents/${agent.id}`)
                }}
              >
                <div className="flex items-start gap-4">
                  <div
                    className="h-12 w-12 rounded-lg flex items-center justify-center text-2xl flex-shrink-0"
                    style={{ backgroundColor: agent.icon_background || '#3B82F6' }}
                  >
                    {agent.icon || '🤖'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-lg font-medium text-gray-900 dark:text-white truncate">
                      {agent.name}
                    </h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                      {t(`types.${agent.mode === 'agent-chat' ? 'chat' : agent.mode}.title`)}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-500 mt-2">
                      {new Date(agent.created_at * 1000).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
