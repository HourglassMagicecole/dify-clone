'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

/**
 * Owner Dashboard 리다이렉트 페이지
 * Story 2.2B: 공용 /dashboard로 통합됨
 */
export default function OwnerDashboardRedirect() {
  const router = useRouter()

  useEffect(() => {
    router.replace('/dashboard')
  }, [router])

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 text-center">
      <p className="text-gray-500">리다이렉트 중...</p>
    </div>
  )
}
