'use client'

import { useState, useEffect } from 'react'

export interface DateRange {
  startDate: string
  endDate: string
}

interface DateRangePickerProps {
  value: DateRange
  onChange: (range: DateRange) => void
  className?: string
}

type PresetKey = 'today' | 'week' | 'month' | 'quarter' | 'custom'

const presets: { key: PresetKey; label: string }[] = [
  { key: 'today', label: '오늘' },
  { key: 'week', label: '최근 7일' },
  { key: 'month', label: '최근 30일' },
  { key: 'quarter', label: '최근 90일' },
  { key: 'custom', label: '직접 선택' },
]

function formatDateString(date: Date): string {
  return date.toISOString().split('T')[0] ?? ''
}

function getPresetRange(preset: PresetKey): DateRange {
  const today = new Date()
  const endDate = formatDateString(today)

  switch (preset) {
    case 'today':
      return { startDate: endDate, endDate }
    case 'week':
      return {
        startDate: formatDateString(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)),
        endDate,
      }
    case 'month':
      return {
        startDate: formatDateString(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)),
        endDate,
      }
    case 'quarter':
      return {
        startDate: formatDateString(new Date(Date.now() - 90 * 24 * 60 * 60 * 1000)),
        endDate,
      }
    default:
      return { startDate: endDate, endDate }
  }
}

export function DateRangePicker({ value, onChange, className = '' }: DateRangePickerProps) {
  const [activePreset, setActivePreset] = useState<PresetKey>('month')
  const [showCustom, setShowCustom] = useState(false)

  useEffect(() => {
    // Determine active preset based on value
    const monthRange = getPresetRange('month')
    if (value.startDate === monthRange.startDate && value.endDate === monthRange.endDate) {
      setActivePreset('month')
      setShowCustom(false)
    }
  }, [value])

  const handlePresetClick = (preset: PresetKey) => {
    setActivePreset(preset)
    if (preset === 'custom') {
      setShowCustom(true)
    } else {
      setShowCustom(false)
      onChange(getPresetRange(preset))
    }
  }

  return (
    <div className={`flex flex-wrap items-center gap-2 ${className}`}>
      <div className="flex rounded-lg border border-gray-200 bg-white p-1">
        {presets.map((preset) => (
          <button
            key={preset.key}
            onClick={() => handlePresetClick(preset.key)}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              activePreset === preset.key
                ? 'bg-blue-600 text-white'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            {preset.label}
          </button>
        ))}
      </div>

      {showCustom && (
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={value.startDate}
            onChange={(e) => onChange({ ...value, startDate: e.target.value })}
            className="rounded-md border border-gray-300 px-3 py-1.5 text-sm"
          />
          <span className="text-gray-500">~</span>
          <input
            type="date"
            value={value.endDate}
            onChange={(e) => onChange({ ...value, endDate: e.target.value })}
            className="rounded-md border border-gray-300 px-3 py-1.5 text-sm"
          />
        </div>
      )}
    </div>
  )
}
