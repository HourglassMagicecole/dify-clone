'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useTranslation } from 'react-i18next'
import { sessionAPI } from '@/service/session-api'
import { agentAPI } from '@/service/agent-api'
import { AgentInfo } from '@/components/chat/AgentInfo'
import type { ResourceAccount, SessionResourcesResponse } from '@/types/session'
import type { Agent } from '@/types/agent'

interface SessionResourceSectionProps {
  sessionId: string
  onDeleteRequest: (accountId?: string, accountName?: string, summary?: { total_apps: number, total_datasets: number }) => void
}

export function SessionResourceSection({
  sessionId,
  onDeleteRequest,
}: SessionResourceSectionProps) {
  const { t } = useTranslation('session')

  const [resources, setResources] = useState<SessionResourcesResponse | null>(null)
  const [accounts, setAccounts] = useState<ResourceAccount[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedAccountId, setSelectedAccountId] = useState<string>('')

  // Creator search state
  const [searchQuery, setSearchQuery] = useState('')
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)
  const searchContainerRef = useRef<HTMLDivElement>(null)

  // Agent detail modal state
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null)
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null)
  const [isLoadingAgent, setIsLoadingAgent] = useState(false)

  // Collapse state for sections
  const [isAgentsExpanded, setIsAgentsExpanded] = useState(true)
  const [isDatasetsExpanded, setIsDatasetsExpanded] = useState(true)

  const loadData = useCallback(async () => {
    try {
      setIsLoading(true)
      setError(null)

      const [resourcesData, accountsData] = await Promise.all([
        sessionAPI.getSessionResources(sessionId),
        sessionAPI.getResourceAccounts(sessionId),
      ])

      setResources(resourcesData)
      setAccounts(accountsData)
    }
    catch (err) {
      setError(err instanceof Error ? err.message : t('failed_to_load'))
    }
    finally {
      setIsLoading(false)
    }
  }, [sessionId, t])

  useEffect(() => {
    loadData()
  }, [loadData])

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Filter accounts by search query
  const filteredAccounts = useMemo(() => {
    if (!searchQuery.trim())
      return accounts
    const query = searchQuery.toLowerCase()
    return accounts.filter(
      account =>
        account.name.toLowerCase().includes(query)
        || account.email.toLowerCase().includes(query),
    )
  }, [accounts, searchQuery])

  // Get selected account info
  const selectedAccount = useMemo(() => {
    return accounts.find(a => a.account_id === selectedAccountId)
  }, [accounts, selectedAccountId])

  // Filter resources by selected account
  const filteredApps = useMemo(() => {
    if (!resources)
      return []
    if (!selectedAccountId)
      return resources.apps
    return resources.apps.filter(app => app.account_id === selectedAccountId)
  }, [resources, selectedAccountId])

  const filteredDatasets = useMemo(() => {
    if (!resources)
      return []
    if (!selectedAccountId)
      return resources.datasets
    return resources.datasets.filter(dataset => dataset.account_id === selectedAccountId)
  }, [resources, selectedAccountId])

  const filteredSummary = useMemo(() => ({
    total_apps: filteredApps.length,
    total_datasets: filteredDatasets.length,
  }), [filteredApps, filteredDatasets])

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString()
  }

  const handleDeleteClick = () => {
    const accountName = selectedAccountId
      ? accounts.find(a => a.account_id === selectedAccountId)?.name
      : undefined
    onDeleteRequest(selectedAccountId || undefined, accountName, filteredSummary)
  }

  const handleSelectAccount = (accountId: string) => {
    setSelectedAccountId(accountId)
    setSearchQuery('')
    setIsDropdownOpen(false)
  }

  const handleClearSelection = () => {
    setSelectedAccountId('')
    setSearchQuery('')
  }

  // Handle Agent click to show detail modal
  const handleAgentClick = async (agentId: string) => {
    setSelectedAgentId(agentId)
    setIsLoadingAgent(true)
    setSelectedAgent(null)

    try {
      const agentData = await agentAPI.getAgent(agentId)
      setSelectedAgent(agentData)
    }
    catch (err) {
      console.error('Failed to load agent:', err)
    }
    finally {
      setIsLoadingAgent(false)
    }
  }

  const handleCloseAgentModal = () => {
    setSelectedAgentId(null)
    setSelectedAgent(null)
  }

  if (isLoading) {
    return (
      <div className="text-center py-4 text-gray-500">
        {t('loading')}
      </div>
    )
  }

  if (error) {
    return (
      <div className="text-red-600 py-4">
        {t('error_prefix')}
        {' '}
        {error}
      </div>
    )
  }

  if (!resources) {
    return null
  }

  const hasResources = resources.summary.total_apps > 0 || resources.summary.total_datasets > 0

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-blue-50 p-4 rounded-lg">
          <div className="text-2xl font-bold text-blue-700">
            {filteredSummary.total_apps}
          </div>
          <div className="text-gray-600">{t('agents')}</div>
        </div>
        <div className="bg-green-50 p-4 rounded-lg">
          <div className="text-2xl font-bold text-green-700">
            {filteredSummary.total_datasets}
          </div>
          <div className="text-gray-600">{t('datasets')}</div>
        </div>
      </div>

      {/* Filter and Actions */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <label className="text-sm text-gray-600">{t('filter_by_creator')}:</label>

          {/* Selected account badge or search input */}
          {selectedAccount
            ? (
                <div className="flex items-center gap-2 bg-blue-100 text-blue-800 px-3 py-2 rounded">
                  <span className="text-sm">
                    {selectedAccount.name}
                    {' '}
                    (
                    {selectedAccount.email}
                    )
                  </span>
                  <button
                    type="button"
                    onClick={handleClearSelection}
                    className="text-blue-600 hover:text-blue-800 font-bold"
                    aria-label={t('clear_filter')}
                  >
                    ✕
                  </button>
                </div>
              )
            : (
                <div ref={searchContainerRef} className="relative">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value)
                      setIsDropdownOpen(true)
                    }}
                    onFocus={() => setIsDropdownOpen(true)}
                    placeholder={t('search_creator_placeholder')}
                    className="border rounded px-3 py-2 text-sm w-64"
                  />

                  {/* Dropdown */}
                  {isDropdownOpen && filteredAccounts.length > 0 && (
                    <div className="absolute z-10 mt-1 w-full bg-white border rounded-lg shadow-lg max-h-60 overflow-auto">
                      {filteredAccounts.map(account => (
                        <button
                          key={account.account_id}
                          type="button"
                          onClick={() => handleSelectAccount(account.account_id)}
                          className="w-full px-3 py-2 text-left text-sm hover:bg-gray-100 flex flex-col"
                        >
                          <span className="font-medium">{account.name}</span>
                          <span className="text-gray-500 text-xs">{account.email}</span>
                        </button>
                      ))}
                    </div>
                  )}

                  {/* No results */}
                  {isDropdownOpen && searchQuery && filteredAccounts.length === 0 && (
                    <div className="absolute z-10 mt-1 w-full bg-white border rounded-lg shadow-lg p-3 text-sm text-gray-500">
                      {t('no_results')}
                    </div>
                  )}
                </div>
              )}
        </div>

        <button
          onClick={handleDeleteClick}
          disabled={!hasResources && !selectedAccountId}
          className={`px-4 py-2 rounded text-white ${
            hasResources || selectedAccountId
              ? 'bg-red-600 hover:bg-red-700'
              : 'bg-gray-400 cursor-not-allowed'
          }`}
        >
          {selectedAccountId ? t('delete_user_resources') : t('delete_all_resources')}
        </button>
      </div>

      {/* Apps Section - Collapsible */}
      {filteredApps.length > 0 && (
        <div className="border rounded-lg overflow-hidden">
          {/* Section Header - Clickable */}
          <button
            type="button"
            onClick={() => setIsAgentsExpanded(!isAgentsExpanded)}
            className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors"
          >
            <h3 className="text-md font-semibold flex items-center gap-2">
              <span className="text-gray-500 transition-transform duration-200" style={{ transform: isAgentsExpanded ? 'rotate(90deg)' : 'rotate(0deg)' }}>
                ▶
              </span>
              {t('agents')} ({filteredApps.length})
            </h3>
          </button>

          {/* Table Content - Collapsible */}
          {isAgentsExpanded && (
            <div className="max-h-64 overflow-y-auto">
              <table className="w-full">
                <thead className="bg-gray-50 sticky top-0">
                  <tr>
                    <th className="px-4 py-2 text-left text-sm font-medium text-gray-600">{t('name')}</th>
                    <th className="px-4 py-2 text-left text-sm font-medium text-gray-600">{t('creator')}</th>
                    <th className="px-4 py-2 text-left text-sm font-medium text-gray-600">{t('created_at')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {filteredApps.map(app => (
                    <tr key={app.resource_id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <button
                          type="button"
                          onClick={() => handleAgentClick(app.resource_id)}
                          className="text-blue-600 hover:underline text-left"
                        >
                          {app.resource_name}
                        </button>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {app.account_name || '-'}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {app.created_at ? formatDate(app.created_at) : '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Datasets Section - Collapsible */}
      {filteredDatasets.length > 0 && (
        <div className="border rounded-lg overflow-hidden">
          {/* Section Header - Clickable */}
          <button
            type="button"
            onClick={() => setIsDatasetsExpanded(!isDatasetsExpanded)}
            className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors"
          >
            <h3 className="text-md font-semibold flex items-center gap-2">
              <span className="text-gray-500 transition-transform duration-200" style={{ transform: isDatasetsExpanded ? 'rotate(90deg)' : 'rotate(0deg)' }}>
                ▶
              </span>
              {t('datasets')} ({filteredDatasets.length})
            </h3>
          </button>

          {/* Table Content - Collapsible */}
          {isDatasetsExpanded && (
            <div className="max-h-64 overflow-y-auto">
              <table className="w-full">
                <thead className="bg-gray-50 sticky top-0">
                  <tr>
                    <th className="px-4 py-2 text-left text-sm font-medium text-gray-600">{t('name')}</th>
                    <th className="px-4 py-2 text-left text-sm font-medium text-gray-600">{t('creator')}</th>
                    <th className="px-4 py-2 text-left text-sm font-medium text-gray-600">{t('created_at')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {filteredDatasets.map(dataset => (
                    <tr key={dataset.resource_id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <Link
                          href={`/datasets/${dataset.resource_id}`}
                          className="text-blue-600 hover:underline"
                        >
                          {dataset.resource_name}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {dataset.account_name || '-'}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {dataset.created_at ? formatDate(dataset.created_at) : '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Empty State */}
      {!hasResources && (
        <div className="text-center py-8 text-gray-500">
          {t('no_resources')}
        </div>
      )}

      {/* Agent Detail Modal */}
      {selectedAgentId && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
          onClick={handleCloseAgentModal}
        >
          <div
            className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[80vh] overflow-y-auto"
            onClick={e => e.stopPropagation()}
          >
            <div className="sticky top-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 p-4 flex justify-between items-center">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                {selectedAgent?.name || t('agent_info')}
              </h3>
              <button
                type="button"
                onClick={handleCloseAgentModal}
                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                aria-label={t('close')}
              >
                ✕
              </button>
            </div>
            <div className="p-4">
              {isLoadingAgent && (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                </div>
              )}
              {!isLoadingAgent && selectedAgent && (
                <>
                  {selectedAgent.description && (
                    <p className="text-gray-600 dark:text-gray-400 mb-4">
                      {selectedAgent.description}
                    </p>
                  )}
                  <AgentInfo agent={selectedAgent} showHeader={false} showPrompt={true} />
                </>
              )}
              {!isLoadingAgent && !selectedAgent && (
                <div className="text-center py-8 text-red-600">
                  {t('failed_to_load')}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
