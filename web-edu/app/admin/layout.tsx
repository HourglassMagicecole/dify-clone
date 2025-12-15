'use client'

import { RoleGuard } from '@/components/auth/RoleGuard'

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <RoleGuard allowedRoles={['owner', 'admin']}>
      <main className="max-w-7xl mx-auto px-4 py-8">
        {children}
      </main>
    </RoleGuard>
  )
}
