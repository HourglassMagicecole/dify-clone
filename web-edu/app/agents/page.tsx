'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslation } from 'react-i18next'
import { PlusIcon, ArrowPathIcon, ExclamationCircleIcon } from '@heroicons/react/24/outline'
import { agentAPI } from '@/service/agent-api'
import type { Agent } from '@/types/agent'
import { useSession } from '@/context/SessionContext'
import { useAuth } from '@/hooks/useAuth'
import { ContextBanner } from '@/components/dashboard/ContextBanner'
import { Button } from '@/components/common/Button'
import { AgentTable } from '@/components/agent/AgentTable'
import { AgentCard } from '@/components/agent/AgentCard'
import { DeleteConfirmDialog } from '@/components/common/DeleteConfirmDialog'
import { EmptyState } from '@/components/common/EmptyState'
import { Pagination } from '@/components/common/Pagination'
import { useToast } from '@/context/ToastContext'

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
  const { user } = useAuth()
  const { currentSession, isLoading: sessionLoading } = useSession()
  const { showToast } = useToast()
  const [agents, setAgents] = useState<Agent[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [sortBy, setSortBy] = useState<'latest' | 'name' | 'owner'>('latest')
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [agentToDelete, setAgentToDelete] = useState<Agent | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)

  // Pagination settings
  const ITEMS_PER_PAGE = 12

  // Determine if user should see table view (Owner and Administrator)
  const useTableView = user?.actualRole === 'owner' || user?.actualRole === 'admin'

  const loadAgents = useCallback(async () => {
    if (!currentSession) return

    try {
      setIsLoading(true)
      setError(null)
      const params: Record<string, string> = { session_id: currentSession.id }

      // Owner/Admin: session_id만으로 필터링 (세션 내 모든 Agent 표시)
      // admin_id 파라미터는 사용하지 않음

      const response = await agentAPI.getAgents(params)
      setAgents(response.data)
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
    if (sessionLoading) return

    if (!currentSession || !user) {
      // No session or user, stop loading
      setIsLoading(false)
      return
    }

    loadAgents()
  }, [currentSession, sessionLoading, loadAgents, user])

  const handleCreateAgent = () => {
    router.push('/agents/create')
  }

  const handleChat = (agentId: string) => {
    // Check if agent is task-based (completion mode or has user_input_form)
    const agent = agents.find(a => a.id === agentId)
    if (agent?.mode === 'completion' || (agent?.user_input_form && agent.user_input_form.length > 0)) {
      // Task-based agent → execute page
      router.push(`/agents/${agentId}/execute`)
    }
    else {
      // Conversational agent → chat page
      router.push(`/agents/${agentId}/chat`)
    }
  }

  const handleEdit = (agentId: string) => {
    router.push(`/agents/${agentId}/edit`)
  }

  /**
   * Internal function to handle agent copying logic
   * Consolidates duplicate code from handleDuplicate and handleCopyAgent
   */
  const handleCopyAgentInternal = async (agentId: string, agentName: string): Promise<void> => {
    try {
      await agentAPI.copyAgent(agentId, `${agentName} (복사본)`)
      showToast(`Agent "${agentName}"이(가) 복제되었습니다`, 'success')
      await loadAgents()
    }
    catch (err) {
      console.error('Failed to copy agent:', err)
      showToast('Agent 복제에 실패했습니다', 'error')
    }
  }

  /**
   * Handle duplicate action from AgentCard (Student view)
   * Accepts agentId and looks up the agent from the list
   */
  const handleDuplicate = async (agentId: string) => {
    const agent = agents.find(a => a.id === agentId)
    if (!agent) {
      showToast('Agent를 찾을 수 없습니다', 'error')
      return
    }
    await handleCopyAgentInternal(agentId, agent.name)
  }

  const handleChatAgent = (agent: Agent) => {
    // Check if agent is task-based (completion mode or has user_input_form)
    if (agent.mode === 'completion' || (agent.user_input_form && agent.user_input_form.length > 0)) {
      // Task-based agent → execute page
      router.push(`/agents/${agent.id}/execute`)
    }
    else {
      // Conversational agent → chat page
      router.push(`/agents/${agent.id}/chat`)
    }
  }

  const handleEditAgent = (agent: Agent) => {
    router.push(`/agents/${agent.id}/edit`)
  }

  /**
   * Handle copy action from AgentTable (Owner/Admin view)
   * Accepts full agent object
   */
  const handleCopyAgent = async (agent: Agent) => {
    await handleCopyAgentInternal(agent.id, agent.name)
  }

  const handleDeleteAgent = (agent: Agent) => {
    setAgentToDelete(agent)
    setIsDeleteDialogOpen(true)
  }

  const handleDelete = (agentId: string) => {
    const agent = agents.find(a => a.id === agentId)
    if (!agent) {
      showToast(t('list.deleteDialog.notFound'), 'error')
      return
    }

    setAgentToDelete(agent)
    setIsDeleteDialogOpen(true)
  }

  const handleDeleteConfirm = async () => {
    if (!agentToDelete)
      return

    try {
      setIsDeleting(true)
      await agentAPI.deleteAgent(agentToDelete.id)
      showToast(t('list.deleteDialog.success', { name: agentToDelete.name }), 'success')

      // 목록에서 삭제된 Agent 제거
      setAgents(prevAgents => prevAgents.filter(a => a.id !== agentToDelete.id))

      // 다이얼로그 닫기
      setIsDeleteDialogOpen(false)
      setAgentToDelete(null)
    }
    catch (err) {
      console.error('Failed to delete agent:', err)
      showToast(t('list.deleteDialog.error'), 'error')
    }
    finally {
      setIsDeleting(false)
    }
  }

  const handleDeleteCancel = () => {
    setIsDeleteDialogOpen(false)
    setAgentToDelete(null)
  }

  // Filter and sort agents
  const filteredAgents = useMemo(() => {
    // 1. Filter by search query
    const filtered = agents.filter((agent) => {
      if (!searchQuery)
        return true

      const query = searchQuery.toLowerCase()
      const matchesName = agent.name.toLowerCase().includes(query)
      const matchesDescription = agent.description && agent.description.toLowerCase().includes(query)
      const matchesAuthor = useTableView && agent.author_name && agent.author_name.toLowerCase().includes(query)

      return matchesName || matchesDescription || matchesAuthor
    })

    // 2. Sort
    if (sortBy === 'latest') {
      filtered.sort((a, b) => {
        const aTime = typeof a.created_at === 'number' ? a.created_at : new Date(a.created_at).getTime()
        const bTime = typeof b.created_at === 'number' ? b.created_at : new Date(b.created_at).getTime()
        return bTime - aTime // 내림차순 (최신이 먼저)
      })
    }
    else if (sortBy === 'name') {
      filtered.sort((a, b) => a.name.localeCompare(b.name)) // 오름차순 (ㄱ-ㅎ, A-Z)
    }
    else if (sortBy === 'owner') {
      filtered.sort((a, b) => {
        const aOwner = a.author_name || ''
        const bOwner = b.author_name || ''
        return aOwner.localeCompare(bOwner) // 오름차순 (ㄱ-ㅎ, A-Z)
      })
    }

    return filtered
  }, [agents, searchQuery, sortBy, useTableView])

  // Reset to page 1 when filter/sort changes
  useEffect(() => {
    setCurrentPage(1)
  }, [searchQuery, sortBy])

  // Paginate filtered agents
  const paginatedAgents = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE
    const endIndex = startIndex + ITEMS_PER_PAGE
    return filteredAgents.slice(startIndex, endIndex)
  }, [filteredAgents, currentPage, ITEMS_PER_PAGE])

  // Calculate total pages
  const totalPages = Math.ceil(filteredAgents.length / ITEMS_PER_PAGE)

  // Handle page change
  const handlePageChange = (page: number) => {
    setCurrentPage(page)
    // Scroll to top when page changes
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Context Banner */}
        {currentSession && user && user.actualRole && (
          <ContextBanner
            role={user.actualRole}
            scope={user.actualRole === 'student' ? 'my_resources' : 'session'}
            sessionName={currentSession.session_name}
          />
        )}

        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-6">
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

          {/* Search and Sort */}
          {!isLoading && !error && currentSession && agents.length > 0 && (
            <div className="flex gap-4">
              {/* Search Input */}
              <div className="relative flex-1">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={useTableView ? t('list.searchPlaceholderWithOwner') : t('list.searchPlaceholder')}
                  className="w-full px-4 py-2 pl-10 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-800 dark:border-gray-600 dark:text-white dark:placeholder-gray-400"
                  aria-label="Agent 검색"
                />
                <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                  <svg
                    className="w-5 h-5 text-gray-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                    />
                  </svg>
                </div>
              </div>

              {/* Sort Dropdown */}
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as 'latest' | 'name' | 'owner')}
                className="px-4 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-800 dark:border-gray-600 dark:text-white"
                aria-label="Agent 정렬 방식"
              >
                <option value="latest">{t('list.sortLatest')}</option>
                <option value="name">{t('list.sortName')}</option>
                {useTableView && <option value="owner">{t('list.sortOwner')}</option>}
              </select>
            </div>
          )}
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
        {!isLoading && !error && currentSession && filteredAgents.length === 0 && (
          <EmptyState
            icon={<PlusIcon className="h-8 w-8 text-gray-400" />}
            title={t('list.emptyTitle')}
            description={t('list.emptyDescription')}
            actionLabel={t('list.createButton')}
            onAction={handleCreateAgent}
          />
        )}

        {/* Agent List - Owner/Administrator: Table View, Student: Card Grid */}
        {!isLoading && !error && currentSession && filteredAgents.length > 0 && (
          <>
            {useTableView ? (
              <AgentTable
                agents={paginatedAgents}
                isLoading={isLoading}
                onChat={handleChatAgent}
                onEdit={handleEditAgent}
                onCopy={handleCopyAgent}
                onDelete={handleDeleteAgent}
              />
            ) : (
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {paginatedAgents.map(agent => (
                  <AgentCard
                    key={agent.id}
                    agent={agent}
                    onChat={handleChat}
                    onEdit={handleEdit}
                    onDuplicate={handleDuplicate}
                    onDelete={handleDelete}
                  />
                ))}
              </div>
            )}

            {/* Pagination */}
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              totalItems={filteredAgents.length}
              itemsPerPage={ITEMS_PER_PAGE}
              onPageChange={handlePageChange}
              previousLabel={t('list.pagination.previous')}
              nextLabel={t('list.pagination.next')}
              itemsLabel={t('list.pagination.items')}
              ariaLabelPagination={t('list.pagination.ariaLabel')}
              ariaLabelPrevious={t('list.pagination.ariaPrevious')}
              ariaLabelNext={t('list.pagination.ariaNext')}
              className="mt-6"
            />
          </>
        )}
      </div>

      {/* Delete Confirmation Dialog */}
      <DeleteConfirmDialog
        isOpen={isDeleteDialogOpen}
        onClose={handleDeleteCancel}
        onConfirm={handleDeleteConfirm}
        title={t('list.deleteDialog.title')}
        message={
          agentToDelete
            ? t('list.deleteDialog.messageWithName', { name: agentToDelete.name })
            : t('list.deleteDialog.message')
        }
        confirmLabel={t('list.deleteDialog.confirm')}
        cancelLabel={t('list.deleteDialog.cancel')}
        loadingLabel={t('list.deleteDialog.deleting')}
        closeAriaLabel={t('list.deleteDialog.close')}
        isLoading={isDeleting}
      />
    </div>
  )
}
