'use client'

// 403 Forbidden Page
import Link from 'next/link'
import { useAuth } from '@/hooks/useAuth'

export default function ForbiddenPage() {
  const { user } = useAuth()

  const getDashboardUrl = () => {
    if (user?.actualRole === 'owner')
      return '/owner/dashboard'
    if (user?.actualRole === 'admin')
      return '/admin/dashboard'
    return '/dashboard'
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50">
      <div className="text-center">
        <h1 className="text-6xl font-bold text-red-600">403</h1>
        <p className="text-xl text-gray-700 mt-4">접근 권한이 없습니다</p>
        <p className="text-gray-600 mt-2">
          이 페이지에 접근할 권한이 없습니다.
        </p>
        <Link
          href={getDashboardUrl()}
          className="mt-6 inline-block px-6 py-3 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
        >
          대시보드로 돌아가기
        </Link>
      </div>
    </div>
  )
}
