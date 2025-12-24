'use client'

import { useState } from 'react'
import { Pagination } from '@/components/common/Pagination'

export interface UserUsageData {
  accountId: string
  displayName?: string
  usageType: string
  requestCount: number
  totalTokens: number
  totalPrice: string
}

interface TopUsersTableProps {
  users: UserUsageData[]
  loading?: boolean
  onUserClick?: (accountId: string) => void
  pageSize?: number
}

function formatPrice(price: string): string {
  const num = parseFloat(price)
  return num < 0.01 ? `$${num.toFixed(6)}` : `$${num.toFixed(2)}`
}

function formatTokens(tokens: number): string {
  if (tokens >= 1000000) return `${(tokens / 1000000).toFixed(2)}M`
  if (tokens >= 1000) return `${(tokens / 1000).toFixed(1)}K`
  return tokens.toString()
}

export function TopUsersTable({
  users,
  loading = false,
  onUserClick,
  pageSize = 10,
}: TopUsersTableProps) {
  const [currentPage, setCurrentPage] = useState(1)

  // Group by accountId and aggregate
  type AggregatedUser = {
    accountId: string
    displayName?: string
    totalRequests: number
    totalTokens: number
    totalPrice: number
    usageTypes: Set<string>
  }

  const aggregatedUsers: Record<string, AggregatedUser> = {}
  for (const user of users) {
    const existing = aggregatedUsers[user.accountId]
    if (existing) {
      existing.totalRequests += user.requestCount
      existing.totalTokens += user.totalTokens
      existing.totalPrice += parseFloat(user.totalPrice)
      existing.usageTypes.add(user.usageType)
    } else {
      aggregatedUsers[user.accountId] = {
        accountId: user.accountId,
        displayName: user.displayName,
        totalRequests: user.requestCount,
        totalTokens: user.totalTokens,
        totalPrice: parseFloat(user.totalPrice),
        usageTypes: new Set<string>([user.usageType]),
      }
    }
  }

  // Sort by total price (descending)
  const sortedUsers = Object.values(aggregatedUsers).sort((a, b) => b.totalPrice - a.totalPrice)

  const totalPages = Math.ceil(sortedUsers.length / pageSize)
  const paginatedUsers = sortedUsers.slice((currentPage - 1) * pageSize, currentPage * pageSize)

  if (loading) {
    return (
      <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
        <div className="animate-pulse p-8">
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-10 rounded bg-gray-200" />
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">순위</th>
            <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">사용자</th>
            <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">API 타입</th>
            <th className="px-4 py-3 text-right text-sm font-medium text-gray-500">요청 수</th>
            <th className="px-4 py-3 text-right text-sm font-medium text-gray-500">토큰</th>
            <th className="px-4 py-3 text-right text-sm font-medium text-gray-500">비용</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200">
          {paginatedUsers.length === 0 ? (
            <tr>
              <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                사용자별 데이터가 없습니다.
              </td>
            </tr>
          ) : (
            paginatedUsers.map((user, index) => (
              <tr
                key={user.accountId}
                className={onUserClick ? 'cursor-pointer hover:bg-gray-50' : ''}
                onClick={() => onUserClick?.(user.accountId)}
              >
                <td className="px-4 py-3 text-gray-500">
                  {(currentPage - 1) * pageSize + index + 1}
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-200 text-xs font-medium text-gray-600">
                      {user.displayName?.charAt(0) || user.accountId.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div className="font-medium text-gray-900">
                        {user.displayName || `User ${user.accountId.slice(0, 8)}`}
                      </div>
                      <div className="text-xs text-gray-500">{user.accountId.slice(0, 12)}...</div>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-1">
                    {Array.from(user.usageTypes).map((type) => (
                      <span
                        key={type}
                        className="inline-flex rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-800"
                      >
                        {type.toUpperCase()}
                      </span>
                    ))}
                  </div>
                </td>
                <td className="px-4 py-3 text-right text-gray-600">
                  {user.totalRequests.toLocaleString()}
                </td>
                <td className="px-4 py-3 text-right text-gray-600">
                  {formatTokens(user.totalTokens)}
                </td>
                <td className="px-4 py-3 text-right font-medium text-gray-900">
                  {formatPrice(user.totalPrice.toString())}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>

      {totalPages > 1 && (
        <div className="border-t border-gray-200 bg-gray-50 px-4 py-3">
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            totalItems={sortedUsers.length}
            itemsPerPage={pageSize}
            onPageChange={setCurrentPage}
          />
        </div>
      )}
    </div>
  )
}
