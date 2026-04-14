import {
  sortToolProviders,
  TOOL_PROVIDER_ORDER,
} from '@/components/agent/wizard/sortToolProviders'
import type { ToolProvider } from '@/types/tool'

// Minimal provider factory — only fields sortToolProviders cares about.
const mkProvider = (name: string): ToolProvider => ({
  name,
  label: { en_US: name, ko_KR: name },
  icon: '',
  tools: [],
})

describe('sortToolProviders', () => {
  it('sorts all 15 known providers into the exact specified order regardless of input order', () => {
    // Reverse order as input
    const shuffled = [...TOOL_PROVIDER_ORDER].reverse().map(mkProvider)

    const sorted = sortToolProviders(shuffled)

    expect(sorted.map(p => p.name)).toEqual([...TOOL_PROVIDER_ORDER])
  })

  it('appends unknown providers AFTER the 15 known ones, preserving their input order', () => {
    const input: ToolProvider[] = [
      mkProvider('future_tool_b'), // unknown #1
      mkProvider('wikipedia'), // known (should move to order slot 15)
      mkProvider('future_tool_a'), // unknown #2
      mkProvider('md_exporter'), // known (should move to order slot 1)
    ]

    const sorted = sortToolProviders(input)

    expect(sorted.map(p => p.name)).toEqual([
      'md_exporter',
      'wikipedia',
      'future_tool_b', // preserved input order (came before future_tool_a)
      'future_tool_a',
    ])
  })

  it('preserves specified order for a partial subset (only some of the 15 present)', () => {
    // Only 7 known providers, in a scrambled order
    const input = [
      mkProvider('yahoo'),
      mkProvider('google'),
      mkProvider('time'),
      mkProvider('md_exporter'),
      mkProvider('wikipedia'),
      mkProvider('audio'),
      mkProvider('data_analysis'),
    ]

    const sorted = sortToolProviders(input)

    // Expected: the specified order, filtered to only the providers present
    expect(sorted.map(p => p.name)).toEqual([
      'md_exporter',
      'data_analysis',
      'google',
      'time',
      'audio',
      'yahoo',
      'wikipedia',
    ])
  })

  it('does not mutate the input array', () => {
    const input = [
      mkProvider('wikipedia'),
      mkProvider('md_exporter'),
    ]
    const snapshot = input.map(p => p.name)

    sortToolProviders(input)

    expect(input.map(p => p.name)).toEqual(snapshot)
  })

  it('returns an empty array for an empty input', () => {
    expect(sortToolProviders([])).toEqual([])
  })
})
