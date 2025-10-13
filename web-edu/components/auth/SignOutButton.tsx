'use client'

// Sign Out Button Component

import { useAuth } from '@/hooks/useAuth'

export function SignOutButton() {
  const { signOut } = useAuth()

  return (
    <button
      onClick={signOut}
      className="text-sm text-gray-700 hover:text-gray-900"
    >
      로그아웃
    </button>
  )
}
