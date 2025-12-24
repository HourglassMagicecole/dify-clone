'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

/**
 * Redirect to unified usage analytics page.
 * Owner and Admin now use the same page with tabs.
 */
export default function OwnerUsageAnalyticsRedirect() {
  const router = useRouter()

  useEffect(() => {
    router.replace('/admin/usage-analytics')
  }, [router])

  return (
    <div className="flex h-64 items-center justify-center">
      <div className="text-gray-500">리다이렉트 중...</div>
    </div>
  )
}
