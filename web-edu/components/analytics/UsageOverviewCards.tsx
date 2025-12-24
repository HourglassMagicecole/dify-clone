'use client'

export interface UsageTypeStats {
  usageType: string
  totalPrice: number
  requestCount: number
}

interface UsageOverviewCardsProps {
  totalCost: number
  totalRequests: number
  byType: UsageTypeStats[]
  loading?: boolean
  onTotalClick?: () => void
  onTypeClick?: (usageType: string) => void
}

const USAGE_TYPE_CONFIG: Record<string, { label: string; color: string; order: number }> = {
  llm: { label: 'LLM', color: 'from-green-500 to-green-600', order: 1 },
  embedding: { label: 'Embedding', color: 'from-blue-500 to-blue-600', order: 2 },
  rerank: { label: 'Rerank', color: 'from-purple-500 to-purple-600', order: 3 },
  tts: { label: 'TTS', color: 'from-orange-500 to-orange-600', order: 4 },
  stt: { label: 'STT', color: 'from-pink-500 to-pink-600', order: 5 },
  image_gen: { label: 'Image Gen', color: 'from-teal-500 to-teal-600', order: 6 },
  tool: { label: 'Tool', color: 'from-amber-500 to-amber-600', order: 7 },
}

function formatPrice(price: number): string {
  if (price === 0) return '$0.00'
  if (price < 0.01) return `$${price.toFixed(6)}`
  return `$${price.toFixed(2)}`
}

export function UsageOverviewCards({
  totalCost,
  totalRequests,
  byType,
  loading = false,
  onTotalClick,
  onTypeClick,
}: UsageOverviewCardsProps) {
  if (loading) {
    return (
      <div className="flex flex-wrap gap-3">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="animate-pulse rounded-lg bg-gray-200 px-5 py-4">
            <div className="h-4 w-16 rounded bg-gray-300" />
            <div className="mt-1 h-6 w-24 rounded bg-gray-300" />
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="flex flex-wrap gap-3">
      {/* Total Cost Card */}
      <button
        onClick={onTotalClick}
        className="group rounded-lg bg-gradient-to-r from-gray-700 to-gray-800 px-5 py-4 text-left text-white shadow transition-all hover:scale-105 hover:shadow-lg"
      >
        <div className="text-xs font-medium opacity-80">총 비용</div>
        <div className="mt-1 text-2xl font-bold">{formatPrice(totalCost)}</div>
        <div className="mt-0.5 text-xs opacity-60">{totalRequests.toLocaleString()}회</div>
        <div className="mt-1 text-[10px] opacity-50 group-hover:opacity-80">클릭하여 추이 보기</div>
      </button>

      {/* Type Cards - sorted by predefined order */}
      {[...byType]
        .sort((a, b) => {
          const orderA = USAGE_TYPE_CONFIG[a.usageType]?.order ?? 99
          const orderB = USAGE_TYPE_CONFIG[b.usageType]?.order ?? 99
          return orderA - orderB
        })
        .map((type) => {
          const config = USAGE_TYPE_CONFIG[type.usageType] || {
            label: type.usageType.toUpperCase(),
            color: 'from-gray-500 to-gray-600',
            order: 99,
          }

        return (
          <button
            key={type.usageType}
            onClick={() => onTypeClick?.(type.usageType)}
            className={`group rounded-lg bg-gradient-to-r ${config.color} px-5 py-4 text-left text-white shadow transition-all hover:scale-105 hover:shadow-lg`}
          >
            <div className="text-xs font-medium opacity-80">{config.label}</div>
            <div className="mt-1 text-2xl font-bold">{formatPrice(type.totalPrice)}</div>
            <div className="mt-0.5 text-xs opacity-60">{type.requestCount.toLocaleString()}회</div>
            <div className="mt-1 text-[10px] opacity-50 group-hover:opacity-80">클릭하여 추이 보기</div>
          </button>
        )
      })}
    </div>
  )
}
