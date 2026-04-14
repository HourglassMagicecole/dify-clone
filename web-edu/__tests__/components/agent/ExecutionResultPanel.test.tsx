/**
 * Regression test for hotfix_20260414_agent-result-dark-bg
 *
 * Ensures the task-agent execute result body stays on a light palette.
 * web-edu is a single-theme (light) app; any `dark:` variant on the
 * result surface has previously leaked a dark background that made the
 * rendered text unreadable. This test locks the light palette in place.
 */

import React from 'react'
import { render } from '@testing-library/react'

// react-markdown / remark-gfm / rehype-sanitize are ESM-only and not
// transformed by our Jest pipeline — mock them out. The test only checks
// the wrapper element's classes/style, not markdown rendering itself.
jest.mock('react-markdown', () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) =>
    React.createElement('div', { 'data-testid': 'mock-markdown' }, children),
}))
jest.mock('remark-gfm', () => ({ __esModule: true, default: () => null }))
jest.mock('rehype-sanitize', () => ({ __esModule: true, default: () => null }))

// dompurify — avoid touching jsdom's trusted-types machinery in the mock
jest.mock('dompurify', () => ({
  __esModule: true,
  default: { sanitize: (s: string) => s },
}))

// docx / file-saver — unused in these assertions but imported by the module
jest.mock('docx', () => ({
  Document: class {},
  Packer: { toBlob: jest.fn() },
  Paragraph: class {},
  TextRun: class {},
  HeadingLevel: {},
}))
jest.mock('file-saver', () => ({ saveAs: jest.fn() }))

// i18n
jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, opts?: { defaultValue?: string }) => opts?.defaultValue ?? key,
  }),
}))

import { ExecutionResultPanel } from '@/components/agent/ExecutionResultPanel'

// sonner toast (side-effect only in this test)
jest.mock('sonner', () => ({
  toast: { success: jest.fn(), error: jest.fn() },
}))

// usage API — not exercised here but imported by the module
jest.mock('@/service/usage-analytics-api', () => ({
  getMessageUsageCost: jest.fn().mockResolvedValue({ result: 'error' }),
}))

// next/image — render as plain img to avoid Next runtime
jest.mock('next/image', () => ({
  __esModule: true,
  default: (props: Record<string, unknown>) =>
    React.createElement('img', props as React.ImgHTMLAttributes<HTMLImageElement>),
}))

describe('ExecutionResultPanel — light-theme result surface (hotfix_20260414)', () => {
  const baseProps = {
    result: '# Hello\n\nSome **markdown** body.',
    tokenUsage: null,
    executionTime: null,
    agentThoughts: [],
    messageId: null,
    onRetry: jest.fn(),
  }

  function getResultContainer(container: HTMLElement): HTMLElement | null {
    // The result body container is the first .prose element inside the panel.
    return container.querySelector('.prose')
  }

  it('renders result body with a light background (no dark: variants)', () => {
    const { container } = render(<ExecutionResultPanel {...baseProps} textFormat="markdown" />)
    const surface = getResultContainer(container)
    expect(surface).not.toBeNull()

    const cls = surface!.className
    // Light palette pinned
    expect(cls).toContain('bg-white')
    expect(cls).toContain('text-gray-900')

    // No dark-mode variants allowed on the result surface
    expect(cls).not.toMatch(/\bdark:/)
    expect(cls).not.toContain('prose-invert')
    expect(cls).not.toContain('bg-gray-900')
  })

  it('overrides @tailwindcss/typography CSS variables so code blocks stay readable', () => {
    const { container } = render(<ExecutionResultPanel {...baseProps} textFormat="markdown" />)
    const surface = getResultContainer(container) as HTMLElement
    // Inline style locks the prose palette to light tokens
    expect(surface.style.getPropertyValue('--tw-prose-pre-bg')).toBe('#f3f4f6')
    expect(surface.style.getPropertyValue('--tw-prose-pre-code')).toBe('#111827')
    expect(surface.style.getPropertyValue('--tw-prose-body')).toBe('#111827')
  })

  it('plain_text format also renders on the light surface', () => {
    const { container } = render(
      <ExecutionResultPanel {...baseProps} textFormat="plain_text" result="plain text body" />,
    )
    const surface = getResultContainer(container)
    expect(surface).not.toBeNull()
    expect(surface!.className).toContain('bg-white')
    expect(surface!.className).not.toMatch(/\bdark:/)
  })
})
