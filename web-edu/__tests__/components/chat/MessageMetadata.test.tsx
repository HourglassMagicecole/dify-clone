/**
 * Tests for MessageMetadata component
 */

import React from 'react'
import { render, screen } from '@testing-library/react'
import { MessageMetadata } from '@/components/chat/MessageMetadata'
import type { TokenUsage } from '@/types/chat'

describe('MessageMetadata', () => {
  it('should return null when no tokenUsage and no responseTime', () => {
    const { container } = render(<MessageMetadata />)
    expect(container.firstChild).toBeNull()
  })

  it('should render tokenUsage without cost', () => {
    const tokenUsage: TokenUsage = {
      promptTokens: 100,
      completionTokens: 200,
      totalTokens: 300,
    }

    render(<MessageMetadata tokenUsage={tokenUsage} />)

    expect(screen.getByText(/tokenUsage/)).toBeInTheDocument()
    expect(screen.getByText(/300/)).toBeInTheDocument()
  })

  it('should render tokenUsage with cost', () => {
    const tokenUsage: TokenUsage = {
      promptTokens: 100,
      completionTokens: 200,
      totalTokens: 300,
      cost: 0.0456,
    }

    render(<MessageMetadata tokenUsage={tokenUsage} />)

    expect(screen.getByText(/tokenUsage/)).toBeInTheDocument()
    expect(screen.getByText(/300/)).toBeInTheDocument()
    expect(screen.getByText(/\$0\.0456/)).toBeInTheDocument()
  })

  it('should format cost to 4 decimal places', () => {
    const tokenUsage: TokenUsage = {
      promptTokens: 100,
      completionTokens: 200,
      totalTokens: 300,
      cost: 0.123456789,
    }

    render(<MessageMetadata tokenUsage={tokenUsage} />)

    expect(screen.getByText(/\$0\.1235/)).toBeInTheDocument()
  })

  it('should render responseTime in seconds', () => {
    render(<MessageMetadata responseTime={1500} />)

    expect(screen.getByText(/responseTime/)).toBeInTheDocument()
    expect(screen.getByText(/1\.50s/)).toBeInTheDocument()
  })

  it('should convert milliseconds to seconds with 2 decimal places', () => {
    render(<MessageMetadata responseTime={3456} />)

    expect(screen.getByText(/3\.46s/)).toBeInTheDocument()
  })

  it('should render both tokenUsage and responseTime', () => {
    const tokenUsage: TokenUsage = {
      promptTokens: 50,
      completionTokens: 100,
      totalTokens: 150,
    }

    render(<MessageMetadata tokenUsage={tokenUsage} responseTime={2500} />)

    expect(screen.getByText(/tokenUsage/)).toBeInTheDocument()
    expect(screen.getByText(/150/)).toBeInTheDocument()
    expect(screen.getByText(/responseTime/)).toBeInTheDocument()
    expect(screen.getByText(/2\.50s/)).toBeInTheDocument()
  })

  it('should have correct styling classes', () => {
    const tokenUsage: TokenUsage = {
      promptTokens: 100,
      completionTokens: 200,
      totalTokens: 300,
    }

    const { container } = render(<MessageMetadata tokenUsage={tokenUsage} responseTime={1000} />)

    const metadataDiv = container.firstChild as HTMLElement
    expect(metadataDiv).toHaveClass('mt-2', 'text-xs', 'text-gray-500', 'flex', 'gap-4')
  })

  it('should not render when response time is zero', () => {
    const { container } = render(<MessageMetadata responseTime={0} />)

    // responseTime of 0 is falsy, so component returns null
    expect(container.firstChild).toBeNull()
  })

  it('should handle very large token counts', () => {
    const tokenUsage: TokenUsage = {
      promptTokens: 50000,
      completionTokens: 100000,
      totalTokens: 150000,
    }

    render(<MessageMetadata tokenUsage={tokenUsage} />)

    expect(screen.getByText(/150000/)).toBeInTheDocument()
  })

  it('should handle very small costs', () => {
    const tokenUsage: TokenUsage = {
      promptTokens: 10,
      completionTokens: 20,
      totalTokens: 30,
      cost: 0.0001,
    }

    render(<MessageMetadata tokenUsage={tokenUsage} />)

    expect(screen.getByText(/\$0\.0001/)).toBeInTheDocument()
  })

  it('should only render tokenUsage when responseTime is not provided', () => {
    const tokenUsage: TokenUsage = {
      promptTokens: 100,
      completionTokens: 200,
      totalTokens: 300,
    }

    render(<MessageMetadata tokenUsage={tokenUsage} />)

    expect(screen.getByText(/tokenUsage/)).toBeInTheDocument()
    expect(screen.queryByText(/responseTime/)).not.toBeInTheDocument()
  })

  it('should only render responseTime when tokenUsage is not provided', () => {
    render(<MessageMetadata responseTime={1500} />)

    expect(screen.getByText(/responseTime/)).toBeInTheDocument()
    expect(screen.queryByText(/tokenUsage/)).not.toBeInTheDocument()
  })
})
