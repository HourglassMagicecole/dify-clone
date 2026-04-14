import {
  PROVIDER_TOOL_ORDER,
  sortProviderTools,
} from '@/components/agent/wizard/sortProviderTools'
import type { Tool } from '@/types/tool'

// Minimal tool factory — only fields sortProviderTools cares about.
const mkTool = (name: string): Tool => ({
  name,
  label: { en_US: name, ko_KR: name },
  description: { human: { en_US: '', ko_KR: '' }, llm: '' },
  icon: '',
  available: true,
})

describe('sortProviderTools', () => {
  const MD_EXPORTER_ORDER = PROVIDER_TOOL_ORDER.md_exporter!

  it('sorts all 5 md_exporter tools into the exact specified order when input is reversed', () => {
    const reversed = [...MD_EXPORTER_ORDER].reverse().map(mkTool)

    const sorted = sortProviderTools('md_exporter', reversed)

    expect(sorted.map(t => t.name)).toEqual([...MD_EXPORTER_ORDER])
  })

  it('appends unknown tools AFTER the 5 known ones, preserving their input order', () => {
    const input: Tool[] = [
      mkTool('md_to_pdf'), // unknown #1 (exists in provider but not in spec)
      mkTool('md_to_html'), // known → slot 5
      mkTool('md_to_csv'), // unknown #2
      mkTool('md_to_md'), // known → slot 1
      mkTool('md_to_docx'), // known → slot 2
      mkTool('md_to_pptx'), // known → slot 3
      mkTool('md_to_xlsx'), // known → slot 4
    ]

    const sorted = sortProviderTools('md_exporter', input)

    expect(sorted.map(t => t.name)).toEqual([
      'md_to_md',
      'md_to_docx',
      'md_to_pptx',
      'md_to_xlsx',
      'md_to_html',
      'md_to_pdf', // preserved input order (came before md_to_csv)
      'md_to_csv',
    ])
  })

  it('preserves specified order for a partial subset (only some of the 5 present)', () => {
    // Only 3 of the 5 known tools, in a scrambled order
    const input = [
      mkTool('md_to_xlsx'),
      mkTool('md_to_md'),
      mkTool('md_to_pptx'),
    ]

    const sorted = sortProviderTools('md_exporter', input)

    // Expected: the specified order, filtered to only the tools present
    expect(sorted.map(t => t.name)).toEqual([
      'md_to_md',
      'md_to_pptx',
      'md_to_xlsx',
    ])
  })

  it('returns the input array as-is (noop) for providers that are not in PROVIDER_TOOL_ORDER', () => {
    const input = [
      mkTool('scrape_site'),
      mkTool('crawl_page'),
      mkTool('extract_links'),
    ]
    const inputOrder = input.map(t => t.name)

    // webscraper is intentionally out of scope for this hotfix
    const sorted = sortProviderTools('webscraper', input)

    expect(sorted.map(t => t.name)).toEqual(inputOrder)
  })

  it('does not mutate the input array', () => {
    const input = [
      mkTool('md_to_html'),
      mkTool('md_to_md'),
    ]
    const snapshot = input.map(t => t.name)

    sortProviderTools('md_exporter', input)

    expect(input.map(t => t.name)).toEqual(snapshot)
  })
})
