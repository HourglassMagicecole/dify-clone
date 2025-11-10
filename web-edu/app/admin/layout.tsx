'use client'

import { ContextBanner } from '@/components/dashboard/ContextBanner'
import { RoleGuard } from '@/components/auth/RoleGuard'
import { useSession } from '@/context/SessionContext'

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { currentSession } = useSession()

  return (
    <RoleGuard allowedRoles={['owner', 'admin']}>
      <main className="max-w-7xl mx-auto px-4 py-8">
        <ContextBanner
          role="admin"
          scope="session"
          sessionName={currentSession?.session_name}
        />
        {children}
      </main>
    </RoleGuard>
  )
}
