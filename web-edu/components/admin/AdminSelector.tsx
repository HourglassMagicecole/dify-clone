'use client'

import { useMemo } from 'react'
import type { Session } from '@/types/session'

interface Admin {
  id: string
  name: string
}

interface AdminSelectorProps {
  sessions: Session[]
  selectedAdminId: string | null
  onAdminChange: (adminId: string | null) => void
}

/**
 * AdminSelector Component (Owner Only)
 * Allows Owner to filter sessions by Administrator
 */
export const AdminSelector: React.FC<AdminSelectorProps> = ({
  sessions,
  selectedAdminId,
  onAdminChange,
}) => {
  // Extract unique administrators from sessions
  const admins = useMemo(() => {
    const uniqueAdmins = new Map<string, Admin>()
    sessions.forEach((session) => {
      if (!uniqueAdmins.has(session.instructor_account_id)) {
        uniqueAdmins.set(session.instructor_account_id, {
          id: session.instructor_account_id,
          name: session.instructor_name || '이름 없음',
        })
      }
    })
    const adminList = Array.from(uniqueAdmins.values())
    return adminList
  }, [sessions])

  if (admins.length === 0) {
    return null
  }

  return (
    <div className="flex items-center gap-2">
      <span className="text-sm text-gray-600">관리자:</span>
      <select
        value={selectedAdminId || ''}
        onChange={(e) => onAdminChange(e.target.value || null)}
        className="px-3 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
      >
        {admins.map((admin) => (
          <option key={admin.id} value={admin.id}>
            {admin.name}
          </option>
        ))}
      </select>
    </div>
  )
}
