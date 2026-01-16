import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import { Toaster } from 'sonner'
import './globals.css'
import { Providers } from '@/context/Providers'
import { NavigationHeader } from '@/components/layout/NavigationHeader'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'MAI Studio - AI Education Platform',
  description: 'Educational AI Platform for Learning Agent and RAG',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="ko">
      <body className={inter.className}>
        <Providers>
          <NavigationHeader />
          <main className="min-h-screen bg-gray-50">
            {children}
          </main>
          <Toaster position="top-right" richColors />
        </Providers>
      </body>
    </html>
  )
}
