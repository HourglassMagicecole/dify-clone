'use client'

import React, { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { BulkCreateModal } from '@/components/admin/BulkCreateModal'
import { CreateUserModal } from '@/components/admin/CreateUserModal'
import { DeleteConfirmDialog } from '@/components/admin/DeleteConfirmDialog'
import { EditUserModal } from '@/components/admin/EditUserModal'
import { UserTable } from '@/components/admin/UserTable'
import { UserManagementAPI } from '@/service/user-management-api'
import { useAuth } from '@/hooks/useAuth'
import type { CreateUserRequest, UpdateUserRequest, UserAccount } from '@/types/user-management'

export default function UserManagementPage() {
  const { t } = useTranslation('user-management')
  const { user: currentUser } = useAuth()
  const [users, setUsers] = useState<UserAccount[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [isLoading, setIsLoading] = useState(true)

  // 필터 상태 (Owner만 사용)
  const [creatorFilter, setCreatorFilter] = useState<string>('all')
  const isOwner = currentUser?.actualRole === 'owner'

  // 모달 상태
  const [createModalOpen, setCreateModalOpen] = useState(false)
  const [editModalOpen, setEditModalOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [bulkCreateModalOpen, setBulkCreateModalOpen] = useState(false)
  const [selectedUser, setSelectedUser] = useState<UserAccount | null>(null)

  // 사용자 목록 로드
  const loadUsers = useCallback(async () => {
    setIsLoading(true)
    try {
      const data = await UserManagementAPI.listUsers(page, 20)
      setUsers(data.users)
      setTotal(data.total)
    }
    catch (error) {
      console.error('Failed to load users:', error)
    }
    finally {
      setIsLoading(false)
    }
  }, [page])

  useEffect(() => {
    loadUsers()
  }, [loadUsers])

  // 사용자 생성
  const handleCreateUser = async (data: CreateUserRequest) => {
    await UserManagementAPI.createUser(data)
    await loadUsers()
  }

  // 사용자 수정
  const handleUpdateUser = async (userId: string, data: UpdateUserRequest) => {
    await UserManagementAPI.updateUser(userId, data)
    await loadUsers()
  }

  // 사용자 삭제
  const handleDeleteUser = async (userId: string, deleteResources: boolean) => {
    await UserManagementAPI.deleteUser(userId, deleteResources)
    await loadUsers()
  }

  // 이벤트 핸들러
  const handleEdit = (user: UserAccount) => {
    setSelectedUser(user)
    setEditModalOpen(true)
  }

  const handleDelete = (user: UserAccount) => {
    setSelectedUser(user)
    setDeleteDialogOpen(true)
  }

  // 필터링 및 정렬된 사용자 목록
  const filteredUsers = React.useMemo(() => {
    // 1. 필터링
    let filtered = users
    if (creatorFilter !== 'all') {
      filtered = users.filter(user => user.created_by === creatorFilter)
    }

    // 2. 정렬: 역할별 (owner > admin > student), 같은 역할 내에서는 이름순
    return filtered.sort((a, b) => {
      // 역할 우선순위 정의
      const roleOrder = { owner: 0, admin: 1, student: 2 }
      const roleA = roleOrder[a.role || 'student']
      const roleB = roleOrder[b.role || 'student']

      // 역할이 다르면 역할 순서로 정렬
      if (roleA !== roleB) {
        return roleA - roleB
      }

      // 역할이 같으면 이름 순서로 정렬
      return (a.name || '').localeCompare(b.name || '', 'ko-KR')
    })
  }, [users, creatorFilter])

  // 고유 생성자 목록 추출
  const creators = React.useMemo(() => {
    const creatorMap = new Map<string, { id: string; name: string }>()
    users.forEach((user) => {
      if (user.created_by && user.created_by_name) {
        creatorMap.set(user.created_by, {
          id: user.created_by,
          name: user.created_by_name,
        })
      }
    })
    return Array.from(creatorMap.values())
  }, [users])

  return (
    <div className="container mx-auto px-4 py-8">
      {/* 헤더 */}
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900">
          {t('userManagement.title')}
        </h1>
        <div className="flex gap-3">
          <button
            onClick={() => setBulkCreateModalOpen(true)}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
          >
            {t('userManagement.bulkCreate')}
          </button>
          <button
            onClick={() => setCreateModalOpen(true)}
            className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700"
          >
            {t('userManagement.createUser')}
          </button>
        </div>
      </div>

      {/* 필터 (Owner만 표시) */}
      {isOwner && creators.length > 0 && (
        <div className="mb-4 flex items-center gap-2">
          <label className="text-sm font-medium text-gray-700">
            {t('userManagement.filter.createdBy')}:
          </label>
          <select
            value={creatorFilter}
            onChange={(e) => setCreatorFilter(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="all">{t('userManagement.filter.all')}</option>
            {creators.map((creator) => (
              <option key={creator.id} value={creator.id}>
                {creator.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* 사용자 테이블 */}
      {isLoading
        ? (
            <div className="text-center py-12 text-gray-500">
              {t('userManagement.messages.loading')}
            </div>
          )
        : (
            <UserTable
              users={filteredUsers}
              onEdit={handleEdit}
              onDelete={handleDelete}
            />
          )}

      {/* 페이지네이션 */}
      {total > 20 && (
        <div className="flex justify-center mt-6">
          <button
            onClick={() => setPage(page - 1)}
            disabled={page === 1}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-l-md hover:bg-gray-50 disabled:opacity-50"
          >
            이전
          </button>
          <span className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border-t border-b border-gray-300">
            {page}
            {' '}
            /
            {' '}
            {Math.ceil(total / 20)}
          </span>
          <button
            onClick={() => setPage(page + 1)}
            disabled={page >= Math.ceil(total / 20)}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-r-md hover:bg-gray-50 disabled:opacity-50"
          >
            다음
          </button>
        </div>
      )}

      {/* 모달들 */}
      <CreateUserModal
        isOpen={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        onSubmit={handleCreateUser}
      />

      <EditUserModal
        isOpen={editModalOpen}
        onClose={() => setEditModalOpen(false)}
        onSubmit={handleUpdateUser}
        user={selectedUser}
      />

      <DeleteConfirmDialog
        isOpen={deleteDialogOpen}
        onClose={() => setDeleteDialogOpen(false)}
        onConfirm={handleDeleteUser}
        user={selectedUser}
      />

      <BulkCreateModal
        isOpen={bulkCreateModalOpen}
        onClose={() => setBulkCreateModalOpen(false)}
        onSuccess={loadUsers}
        onSubmit={UserManagementAPI.bulkCreateUsers}
        onCheckStatus={UserManagementAPI.getBulkCreateStatus}
      />
    </div>
  )
}
