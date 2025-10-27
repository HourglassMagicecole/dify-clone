import React from 'react'
import { render, screen } from '@testing-library/react'
import { RecentActivityTimeline } from '@/components/dashboard/RecentActivityTimeline'

describe('RecentActivityTimeline', () => {
  it('활동 목록을 올바르게 표시', () => {
    const mockActivities = [
      {
        id: '1',
        type: 'agent' as const,
        resourceName: 'Test Agent',
        action: 'created' as const,
        timestamp: new Date().toISOString(),
        status: 'success' as const,
      },
    ]

    render(<RecentActivityTimeline activities={mockActivities} />)

    expect(screen.getByText('Test Agent')).toBeInTheDocument()
    expect(screen.getByText('생성됨')).toBeInTheDocument()
  })

  it('빈 활동 목록 상태를 표시', () => {
    render(<RecentActivityTimeline activities={[]} />)

    // i18n 키가 렌더링되는지 확인 (mock 없이 테스트)
    expect(screen.getByText(/dashboard\.recentActivity\.empty/)).toBeInTheDocument()
  })

  it('로딩 상태를 표시', () => {
    const { container } = render(<RecentActivityTimeline activities={[]} isLoading />)

    const loadingElements = container.querySelectorAll('.animate-pulse')
    expect(loadingElements.length).toBeGreaterThan(0)
  })

  it('여러 활동을 올바르게 렌더링', () => {
    const mockActivities = [
      {
        id: '1',
        type: 'agent' as const,
        resourceName: 'Agent 1',
        action: 'created' as const,
        timestamp: new Date().toISOString(),
        status: 'success' as const,
      },
      {
        id: '2',
        type: 'workflow' as const,
        resourceName: 'Workflow 1',
        action: 'updated' as const,
        timestamp: new Date().toISOString(),
        status: 'success' as const,
      },
      {
        id: '3',
        type: 'dataset' as const,
        resourceName: 'Dataset 1',
        action: 'executed' as const,
        timestamp: new Date().toISOString(),
        status: 'failed' as const,
      },
    ]

    render(<RecentActivityTimeline activities={mockActivities} />)

    expect(screen.getByText('Agent 1')).toBeInTheDocument()
    expect(screen.getByText('Workflow 1')).toBeInTheDocument()
    expect(screen.getByText('Dataset 1')).toBeInTheDocument()
    expect(screen.getByText('생성됨')).toBeInTheDocument()
    expect(screen.getByText('수정됨')).toBeInTheDocument()
    expect(screen.getByText('실행됨')).toBeInTheDocument()
  })

  it('타임스탬프를 상대 시간으로 표시', () => {
    const oneHourAgo = new Date(Date.now() - 3600 * 1000).toISOString()
    const mockActivities = [
      {
        id: '1',
        type: 'agent' as const,
        resourceName: 'Test Agent',
        action: 'created' as const,
        timestamp: oneHourAgo,
        status: 'success' as const,
      },
    ]

    render(<RecentActivityTimeline activities={mockActivities} />)

    // "1시간 전" 텍스트가 있는지 확인
    expect(screen.getByText(/시간 전/)).toBeInTheDocument()
  })
})
