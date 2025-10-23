'use client'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import { useEffect, useState } from 'react'
import { I18nextProvider } from 'react-i18next'
import { AuthProvider } from './AuthContext'
import { SessionProvider } from './SessionContext'
import { useSessionTimer } from '@/hooks/useSessionTimer'
import i18n from '@/i18n' // Initialize i18n on client side

// Session Manager Component
function SessionManager() {
  useSessionTimer()
  return null
}

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000, // 1분
            refetchOnWindowFocus: false,
          },
        },
      })
  )

  // Load language from localStorage after client mount to avoid SSR hydration mismatch
  useEffect(() => {
    const savedLanguage = localStorage.getItem('preferred_language')
    if (savedLanguage && savedLanguage !== i18n.language) {
      i18n.changeLanguage(savedLanguage)
    }
  }, [])

  return (
    <I18nextProvider i18n={i18n}>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <SessionProvider>
            <SessionManager />
            {children}
            <ReactQueryDevtools initialIsOpen={false} />
          </SessionProvider>
        </AuthProvider>
      </QueryClientProvider>
    </I18nextProvider>
  )
}
