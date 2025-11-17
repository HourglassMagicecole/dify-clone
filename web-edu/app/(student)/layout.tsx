'use client'

import { usePathname } from 'next/navigation'

export default function StudentLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const isChatPage = pathname?.includes('/chat')

  // For chat pages, don't apply container constraints
  if (isChatPage) {
    return <>{children}</>
  }

  // For other pages, apply normal layout
  return (
    <main className="py-10">
      <div className="mx-auto max-w-7xl sm:px-6 lg:px-8">
        {children}
      </div>
    </main>
  )
}
