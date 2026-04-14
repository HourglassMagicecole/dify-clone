import type { ToolProvider } from '@/types/tool'

/**
 * Fixed display order for tool providers in the Agent wizard / edit screen.
 *
 * Matched by stable backend provider name (identity.name from YAML), not by
 * localized label. Provider names are defined in:
 *   api/services/education_management/tool_registry_service.py (allowed_providers)
 *
 * Display order (top → bottom, mirroring the product requirement):
 *   1.  Markdown 변환기   → md_exporter
 *   2.  OpenAI            → openai_tool
 *   3.  웹 스크래퍼       → webscraper
 *   4.  수학              → maths
 *   5.  Google 번역       → google_translate
 *   6.  markitdown        → markitdown
 *   7.  데이터 분석       → data_analysis
 *   8.  Google            → google
 *   9.  JSON 처리         → json_process
 *   10. 시간              → time
 *   11. 오디오            → audio
 *   12. OpenWeather       → openweather
 *   13. Yahoo 금융        → yahoo
 *   14. 데이터 시각화     → data_alchemy
 *   15. 위키백과          → wikipedia
 *
 * Fallback rule: any provider not in this list is appended AFTER the 15 items,
 * preserving the original server response order. We never hide or
 * alphabet-resort unknown providers.
 */
export const TOOL_PROVIDER_ORDER: readonly string[] = [
  'md_exporter',
  'openai_tool',
  'webscraper',
  'maths',
  'google_translate',
  'markitdown',
  'data_analysis',
  'google',
  'json_process',
  'time',
  'audio',
  'openweather',
  'yahoo',
  'data_alchemy',
  'wikipedia',
]

/**
 * Pure, immutable sort. Returns a new array; does not mutate the input.
 *
 * - Known providers (listed in TOOL_PROVIDER_ORDER) appear first, in that exact order.
 * - Unknown providers keep their original relative order and are appended after.
 */
export function sortToolProviders<T extends Pick<ToolProvider, 'name'>>(providers: readonly T[]): T[] {
  const orderIndex = new Map<string, number>()
  TOOL_PROVIDER_ORDER.forEach((name, idx) => orderIndex.set(name, idx))

  const known: Array<{ idx: number; item: T }> = []
  const unknown: T[] = []

  providers.forEach((p) => {
    const idx = orderIndex.get(p.name)
    if (idx === undefined)
      unknown.push(p)
    else
      known.push({ idx, item: p })
  })

  known.sort((a, b) => a.idx - b.idx)
  return [...known.map(k => k.item), ...unknown]
}
