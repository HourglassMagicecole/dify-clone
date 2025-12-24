'use client'

interface UsageSummaryCardsProps {
  totalCost: number
  totalTokens: number
  totalRequests: number
  loading?: boolean
}

function formatPrice(price: number): string {
  return price < 0.01 ? `$${price.toFixed(6)}` : `$${price.toFixed(2)}`
}

function formatTokens(tokens: number): string {
  if (tokens >= 1000000) return `${(tokens / 1000000).toFixed(2)}M`
  if (tokens >= 1000) return `${(tokens / 1000).toFixed(1)}K`
  return tokens.toString()
}

export function UsageSummaryCards({
  totalCost,
  totalTokens,
  totalRequests,
  loading = false,
}: UsageSummaryCardsProps) {
  const cards = [
    {
      title: '총 비용',
      value: formatPrice(totalCost),
      gradient: 'from-blue-500 to-blue-600',
      icon: (
        <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
      ),
    },
    {
      title: '총 토큰',
      value: formatTokens(totalTokens),
      gradient: 'from-green-500 to-green-600',
      icon: (
        <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01"
          />
        </svg>
      ),
    },
    {
      title: '총 요청',
      value: totalRequests.toLocaleString(),
      gradient: 'from-purple-500 to-purple-600',
      icon: (
        <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M13 10V3L4 14h7v7l9-11h-7z"
          />
        </svg>
      ),
    },
  ]

  if (loading) {
    return (
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="animate-pulse rounded-lg bg-gray-200 p-6">
            <div className="h-4 w-20 rounded bg-gray-300" />
            <div className="mt-2 h-8 w-32 rounded bg-gray-300" />
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
      {cards.map((card, index) => (
        <div
          key={index}
          className={`rounded-lg bg-gradient-to-r ${card.gradient} p-6 text-white shadow`}
        >
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm opacity-80">{card.title}</div>
              <div className="mt-2 text-3xl font-bold">{card.value}</div>
            </div>
            <div className="opacity-80">{card.icon}</div>
          </div>
        </div>
      ))}
    </div>
  )
}
