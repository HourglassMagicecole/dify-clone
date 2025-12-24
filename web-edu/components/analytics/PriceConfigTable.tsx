'use client'

import { PriceConfig, USAGE_TYPES, PRICE_UNITS } from '@/service/price-config-api'

interface PriceConfigTableProps {
  configs: PriceConfig[]
  loading?: boolean
  onEdit?: (config: PriceConfig) => void
  onDelete?: (configId: string) => void
}

function getUsageTypeLabel(type: string): string {
  return USAGE_TYPES.find((t) => t.value === type)?.label || type
}

function getPriceUnitLabel(unit: string): string {
  return PRICE_UNITS.find((u) => u.value === unit)?.label || unit
}

export function PriceConfigTable({ configs, loading = false, onEdit, onDelete }: PriceConfigTableProps) {
  if (loading) {
    return (
      <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
        <div className="animate-pulse p-8">
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-12 rounded bg-gray-200" />
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Provider</th>
            <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Model</th>
            <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">타입</th>
            <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">단위</th>
            <th className="px-4 py-3 text-right text-sm font-medium text-gray-500">입력 가격</th>
            <th className="px-4 py-3 text-right text-sm font-medium text-gray-500">출력 가격</th>
            <th className="px-4 py-3 text-center text-sm font-medium text-gray-500">모델 상태</th>
            <th className="px-4 py-3 text-center text-sm font-medium text-gray-500">액션</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200">
          {configs.length === 0 ? (
            <tr>
              <td colSpan={8} className="px-4 py-8 text-center text-gray-500">
                등록된 가격 설정이 없습니다.
              </td>
            </tr>
          ) : (
            configs.map((config) => (
              <tr key={config.id}>
                <td className="px-4 py-3 text-sm text-gray-900">{config.provider}</td>
                <td className="px-4 py-3">
                  <div className="text-sm text-gray-900">{config.model_id}</div>
                  {(config.quality || config.resolution) && (
                    <div className="mt-1 flex gap-1">
                      {config.quality && (
                        <span className="inline-flex rounded bg-purple-100 px-1.5 py-0.5 text-xs text-purple-700">
                          {config.quality}
                        </span>
                      )}
                      {config.resolution && (
                        <span className="inline-flex rounded bg-blue-100 px-1.5 py-0.5 text-xs text-blue-700">
                          {config.resolution}
                        </span>
                      )}
                    </div>
                  )}
                </td>
                <td className="px-4 py-3 text-sm text-gray-600">
                  {getUsageTypeLabel(config.usage_type)}
                </td>
                <td className="px-4 py-3 text-sm text-gray-600">
                  {getPriceUnitLabel(config.price_unit)} / {config.unit_scale.toLocaleString()}
                </td>
                <td className="px-4 py-3 text-right text-sm text-gray-900">
                  {config.input_price ? `$${parseFloat(config.input_price).toFixed(3)}` : '-'}
                </td>
                <td className="px-4 py-3 text-right text-sm text-gray-900">
                  {config.output_price ? `$${parseFloat(config.output_price).toFixed(3)}` : '-'}
                </td>
                <td className="px-4 py-3 text-center">
                  {/* Model status from provider (image_gen/tool types don't have model status) */}
                  {config.usage_type === 'image_gen' || config.usage_type === 'tool' ? (
                    <span className="text-sm text-gray-400">-</span>
                  ) : config.model_status === 'active' ? (
                    <span className="inline-flex rounded-full bg-green-100 px-2 py-1 text-xs font-medium text-green-800">
                      활성
                    </span>
                  ) : config.model_status ? (
                    <span className="inline-flex rounded-full bg-gray-100 px-2 py-1 text-xs font-medium text-gray-600">
                      비활성
                    </span>
                  ) : (
                    <span className="inline-flex rounded-full bg-orange-100 px-2 py-1 text-xs font-medium text-orange-700">
                      미등록
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-center">
                  <div className="flex items-center justify-center gap-2">
                    {onEdit && (
                      <button
                        onClick={() => onEdit(config)}
                        className="text-sm text-blue-600 hover:text-blue-800"
                      >
                        수정
                      </button>
                    )}
                    {onDelete && (
                      <button
                        onClick={() => onDelete(config.id)}
                        className="text-sm text-red-600 hover:text-red-800"
                      >
                        삭제
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  )
}
