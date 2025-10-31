/**
 * Tests for ToolCard component (Story 2.1B - Task 12.5)
 */

import React from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import ToolCard from '@/components/agent/wizard/ToolCard'
import type { Tool } from '@/types/tool'

// Create stable mock functions
const mockT = jest.fn((key: string) => key)

// Mock react-i18next with stable function reference
jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: mockT,
    i18n: { language: 'ko_KR' },
  }),
}))

// Mock Next.js Image component
jest.mock('next/image', () => ({
  __esModule: true,
  default: (props: any) => {
    // eslint-disable-next-line jsx-a11y/alt-text, @next/next/no-img-element
    return <img {...props} />
  },
}))

const mockTool: Tool = {
  name: 'calculator',
  label: { en_US: 'Calculator', ko_KR: '계산기' },
  description: {
    human: { en_US: 'A simple calculator', ko_KR: '간단한 계산기' },
    llm: 'Calculator tool',
  },
  parameters: [],
  icon: '/icon.svg',
  available: true,
}

describe('ToolCard', () => {
  beforeEach(() => {
    // Clear mock function calls
    mockT.mockClear()
  })

  it('should render tool card with name and description', () => {
    const mockToggle = jest.fn()
    const mockConfigure = jest.fn()

    render(
      <ToolCard
        tool={mockTool}
        selected={false}
        onToggle={mockToggle}
        onConfigure={mockConfigure}
      />,
    )

    expect(screen.getByText('계산기')).toBeInTheDocument()
    expect(screen.getByText('간단한 계산기')).toBeInTheDocument()
  })

  it('should call onToggle when clicked', () => {
    const mockToggle = jest.fn()
    const mockConfigure = jest.fn()

    render(
      <ToolCard
        tool={mockTool}
        selected={false}
        onToggle={mockToggle}
        onConfigure={mockConfigure}
      />,
    )

    fireEvent.click(screen.getByText('계산기'))
    expect(mockToggle).toHaveBeenCalledWith('calculator')
  })

  it('should show configure button when selected', () => {
    const mockToggle = jest.fn()
    const mockConfigure = jest.fn()

    render(
      <ToolCard
        tool={mockTool}
        selected={true}
        onToggle={mockToggle}
        onConfigure={mockConfigure}
      />,
    )

    expect(screen.getByText(/tools.configure/)).toBeInTheDocument()
  })

  it('should not show configure button when not selected', () => {
    const mockToggle = jest.fn()
    const mockConfigure = jest.fn()

    render(
      <ToolCard
        tool={mockTool}
        selected={false}
        onToggle={mockToggle}
        onConfigure={mockConfigure}
      />,
    )

    expect(screen.queryByText(/tools.configure/)).not.toBeInTheDocument()
  })

  it('should be disabled when tool is not available', () => {
    const unavailableTool = {
      ...mockTool,
      available: false,
      unavailable_reason: 'API Key missing',
    }
    const mockToggle = jest.fn()
    const mockConfigure = jest.fn()

    render(
      <ToolCard
        tool={unavailableTool}
        selected={false}
        onToggle={mockToggle}
        onConfigure={mockConfigure}
      />,
    )

    fireEvent.click(screen.getByText('계산기'))
    expect(mockToggle).not.toHaveBeenCalled()
    expect(screen.getByText('API Key missing')).toBeInTheDocument()
  })

  it('should call onConfigure when configure button is clicked', () => {
    const mockToggle = jest.fn()
    const mockConfigure = jest.fn()

    render(
      <ToolCard
        tool={mockTool}
        selected={true}
        onToggle={mockToggle}
        onConfigure={mockConfigure}
      />,
    )

    const configureButton = screen.getByText(/tools.configure/)
    fireEvent.click(configureButton)

    expect(mockConfigure).toHaveBeenCalledWith(mockTool)
    // onToggle should not be called when configure button is clicked
    expect(mockToggle).not.toHaveBeenCalled()
  })

  it('should show checkbox in checked state when selected', () => {
    const mockToggle = jest.fn()
    const mockConfigure = jest.fn()

    render(
      <ToolCard
        tool={mockTool}
        selected={true}
        onToggle={mockToggle}
        onConfigure={mockConfigure}
      />,
    )

    const checkbox = screen.getByRole('checkbox')
    expect(checkbox).toBeChecked()
  })

  it('should show checkbox in unchecked state when not selected', () => {
    const mockToggle = jest.fn()
    const mockConfigure = jest.fn()

    render(
      <ToolCard
        tool={mockTool}
        selected={false}
        onToggle={mockToggle}
        onConfigure={mockConfigure}
      />,
    )

    const checkbox = screen.getByRole('checkbox')
    expect(checkbox).not.toBeChecked()
  })

  it('should disable checkbox when tool is not available', () => {
    const unavailableTool = {
      ...mockTool,
      available: false,
      unavailable_reason: 'API Key missing',
    }
    const mockToggle = jest.fn()
    const mockConfigure = jest.fn()

    render(
      <ToolCard
        tool={unavailableTool}
        selected={false}
        onToggle={mockToggle}
        onConfigure={mockConfigure}
      />,
    )

    const checkbox = screen.getByRole('checkbox')
    expect(checkbox).toBeDisabled()
  })

  it('should render tool icon if provided', () => {
    const mockToggle = jest.fn()
    const mockConfigure = jest.fn()

    render(
      <ToolCard
        tool={mockTool}
        selected={false}
        onToggle={mockToggle}
        onConfigure={mockConfigure}
      />,
    )

    const image = screen.getByAltText('calculator')
    expect(image).toBeInTheDocument()
    expect(image).toHaveAttribute('src', '/icon.svg')
  })

  it('should render default emoji icon when icon not provided', () => {
    const toolWithoutIcon = { ...mockTool, icon: '' }
    const mockToggle = jest.fn()
    const mockConfigure = jest.fn()

    render(
      <ToolCard
        tool={toolWithoutIcon}
        selected={false}
        onToggle={mockToggle}
        onConfigure={mockConfigure}
      />,
    )

    expect(screen.getByText('🔧')).toBeInTheDocument()
  })
})
