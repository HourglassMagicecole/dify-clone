/**
 * Tests for ProcessingSteps component
 */

import React from 'react'
import { render, screen } from '@testing-library/react'
import { ProcessingSteps } from '@/components/chat/ProcessingSteps'
import type { ProcessingStep } from '@/types/chat'

describe('ProcessingSteps', () => {
  const mockSteps: ProcessingStep[] = [
    {
      id: 'step-1',
      name: 'Analyzing input',
      status: 'completed',
      startedAt: '2025-01-01T00:00:00Z',
      completedAt: '2025-01-01T00:00:02Z',
      output: 'Input analysis complete',
    },
    {
      id: 'step-2',
      name: 'Searching knowledge base',
      status: 'running',
      startedAt: '2025-01-01T00:00:03Z',
    },
    {
      id: 'step-3',
      name: 'Generate response',
      status: 'pending',
    },
  ]

  it('should not render when isVisible is false', () => {
    const { container } = render(<ProcessingSteps steps={[]} isVisible={false} />)
    expect(container.firstChild).toBeNull()
  })

  it('should render empty state when no steps', () => {
    render(<ProcessingSteps steps={[]} isVisible={true} />)

    expect(screen.getByText('processingStepsEmpty')).toBeInTheDocument()
  })

  it('should render pending step with correct icon and color', () => {
    const pendingStep: ProcessingStep = {
      id: 'step-pending',
      name: 'Pending task',
      status: 'pending',
    }

    render(<ProcessingSteps steps={[pendingStep]} isVisible={true} />)

    expect(screen.getByText('Pending task')).toBeInTheDocument()
    expect(screen.getByText('⏳')).toBeInTheDocument()

    const statusIcon = screen.getByText('⏳')
    expect(statusIcon).toHaveClass('text-gray-500')
  })

  it('should render running step with correct icon and color', () => {
    const runningStep: ProcessingStep = {
      id: 'step-running',
      name: 'Running task',
      status: 'running',
      startedAt: '2025-01-01T00:00:00Z',
    }

    render(<ProcessingSteps steps={[runningStep]} isVisible={true} />)

    expect(screen.getByText('Running task')).toBeInTheDocument()
    expect(screen.getByText('🔄')).toBeInTheDocument()

    const statusIcon = screen.getByText('🔄')
    expect(statusIcon).toHaveClass('text-blue-500', 'animate-pulse')
  })

  it('should render completed step with correct icon and color', () => {
    const completedStep: ProcessingStep = {
      id: 'step-completed',
      name: 'Completed task',
      status: 'completed',
      startedAt: '2025-01-01T00:00:00Z',
      completedAt: '2025-01-01T00:00:05Z',
    }

    render(<ProcessingSteps steps={[completedStep]} isVisible={true} />)

    expect(screen.getByText('Completed task')).toBeInTheDocument()
    expect(screen.getByText('✅')).toBeInTheDocument()

    const statusIcon = screen.getByText('✅')
    expect(statusIcon).toHaveClass('text-green-500')
  })

  it('should render failed step with correct icon and color', () => {
    const failedStep: ProcessingStep = {
      id: 'step-failed',
      name: 'Failed task',
      status: 'failed',
      startedAt: '2025-01-01T00:00:00Z',
    }

    render(<ProcessingSteps steps={[failedStep]} isVisible={true} />)

    expect(screen.getByText('Failed task')).toBeInTheDocument()
    expect(screen.getByText('❌')).toBeInTheDocument()

    const statusIcon = screen.getByText('❌')
    expect(statusIcon).toHaveClass('text-red-500')
  })

  it('should render running step with blue background', () => {
    const stepWithStartTime: ProcessingStep = {
      id: 'step-1',
      name: 'Task',
      status: 'running',
      startedAt: '2025-01-01T10:30:00Z',
    }

    const { container } = render(<ProcessingSteps steps={[stepWithStartTime]} isVisible={true} />)

    // Running steps should have blue background
    const stepElement = container.querySelector('.bg-blue-50')
    expect(stepElement).toBeInTheDocument()
  })

  it('should render multiple steps in order', () => {
    render(<ProcessingSteps steps={mockSteps} isVisible={true} />)

    expect(screen.getByText('Analyzing input')).toBeInTheDocument()
    expect(screen.getByText('Searching knowledge base')).toBeInTheDocument()
    expect(screen.getByText('Generate response')).toBeInTheDocument()

    // Check different status icons
    expect(screen.getByText('✅')).toBeInTheDocument() // completed
    expect(screen.getByText('🔄')).toBeInTheDocument() // running
    expect(screen.getByText('⏳')).toBeInTheDocument() // pending
  })

  it('should render ARIA attributes correctly', () => {
    render(<ProcessingSteps steps={[]} isVisible={true} />)

    const aside = screen.getByRole('complementary')
    expect(aside).toHaveAttribute('aria-label', 'processingStepsAccessible')
  })

  it('should render header with title', () => {
    render(<ProcessingSteps steps={[]} isVisible={true} />)

    expect(screen.getByText('processingSteps')).toBeInTheDocument()
  })
})
