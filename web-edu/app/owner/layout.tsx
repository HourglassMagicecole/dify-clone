'use client'

import { RoleGuard } from '@/components/auth/RoleGuard'

export default function OwnerLayout({ children }: { children: React.ReactNode }) {
  return (
    <RoleGuard allowedRoles={['owner']}>
      <main className="max-w-7xl mx-auto px-4 py-8">
        {children}
      </main>
    </RoleGuard>
  )
}
