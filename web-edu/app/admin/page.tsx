'use client'

import { ProtectedRoute } from '@/components/auth/ProtectedRoute'

export default function AdminPage() {
  return (
    <ProtectedRoute requireAdmin={true}>
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-4xl font-bold text-gray-900">관리자 페이지</h1>
          <p className="mt-2 text-gray-600">
            이 페이지는 admin 역할을 가진 사용자만 접근할 수 있습니다.
          </p>
        </div>
      </div>
    </ProtectedRoute>
  )
}
