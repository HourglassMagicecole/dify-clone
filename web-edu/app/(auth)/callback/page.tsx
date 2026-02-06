'use client'

// External LMS SSO Callback Page
// Calls backend SSO API which reads MOAI_LOGIN_EMAIL and MOAI_LOGIN_NAME
// cookies directly from the request (handles HttpOnly cookies)

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { setTokens } from '@/utils/storage'
import { ssoLogin } from '@/service/auth'

export default function CallbackPage() {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    ssoLogin()
      .then((res) => {
        setTokens(res.data.access_token, res.data.refresh_token)
        window.location.href = '/dashboard'
      })
      .catch((err) => {
        setError(err.message || 'SSO login failed')
      })
  }, [router])

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="text-center">
          <p className="text-red-500">{error}</p>
          <button
            type="button"
            className="mt-4 text-sm text-blue-600 underline"
            onClick={() => router.replace('/signin')}
          >
            Go to Sign In
          </button>
        </div>
      </div>
    )
  }

  return null
}
