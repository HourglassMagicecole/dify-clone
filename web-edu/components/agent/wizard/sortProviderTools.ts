import type { Tool } from '@/types/tool'

/**
 * Fixed display order for individual tools INSIDE specific providers.
 *
 * Matched by stable backend tool name (identity.name from YAML), not by
 * localized label. Tool names are defined in each provider's
 * `api/core/tools/builtin_tool/providers/<provider>/tools/*.yaml`.
 *
 * Keyed by provider name (identity.name of the provider YAML) so that
 * we can expand this map later without touching call-sites or changing
 * behavior for providers that are not listed.
 *
 * Scope (this hotfix): only `md_exporter` is listed. Other providers'
 * internal tool ordering is intentionally untouched.
 *
 * Fallback rule (identical to sortToolProviders):
 *   - Known tools listed here appear first in the specified order.
 *   - Unknown tools keep their original input order and are appended AFTER.
 *   - If the providerName is not a key in this map, the input array is
 *     returned as-is (noop).
 */
export const PROVIDER_TOOL_ORDER: Record<string, readonly string[]> = {
  // md_exporter (Markdown 변환기) display order:
  //   1. Markdown을 MD로     → md_to_md
  //   2. Markdown을 DOCX로   → md_to_docx
  //   3. Markdown을 PPTX로   → md_to_pptx
  //   4. Markdown을 XLSX로   → md_to_xlsx
  //   5. Markdown을 HTML로   → md_to_html
  md_exporter: [
    'md_to_md',
    'md_to_docx',
    'md_to_pptx',
    'md_to_xlsx',
    'md_to_html',
  ],
}

/**
 * Pure, immutable sort for tools that live INSIDE a given provider.
 *
 * - If `providerName` is not a key in `PROVIDER_TOOL_ORDER`, returns the
 *   input array unchanged (noop, out-of-scope providers untouched).
 * - Otherwise, tools listed in the order array appear first in that exact
 *   order; any remaining tools keep their relative input order and are
 *   appended after.
 * - Never mutates the input array.
 */
export function sortProviderTools<T extends Pick<Tool, 'name'>>(
  providerName: string,
  tools: readonly T[],
): T[] {
  const order = PROVIDER_TOOL_ORDER[providerName]
  if (!order)
    return [...tools] // scope limiter: unknown provider → noop (copy to stay pure)

  const orderIndex = new Map<string, number>()
  order.forEach((name, idx) => orderIndex.set(name, idx))

  const known: Array<{ idx: number; item: T }> = []
  const unknown: T[] = []

  tools.forEach((t) => {
    const idx = orderIndex.get(t.name)
    if (idx === undefined)
      unknown.push(t)
    else
      known.push({ idx, item: t })
  })

  known.sort((a, b) => a.idx - b.idx)
  return [...known.map(k => k.item), ...unknown]
}
