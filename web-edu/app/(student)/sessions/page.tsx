'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

/**
 * Redirect /sessions to /my-session
 * This page is deprecated in favor of the new My Session page
 */
export default function SessionsRedirect() {
  const router = useRouter()

  useEffect(() => {
    router.replace('/my-session')
  }, [router])

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="text-center">
        <p className="text-gray-600">Redirecting...</p>
      </div>
    </div>
  )
}
