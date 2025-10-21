import React from 'react'
import { render, screen } from '@testing-library/react'
import { ApiUsageChart } from '@/components/dashboard/ApiUsageChart'

// Mock react-chartjs-2
jest.mock('react-chartjs-2', () => ({
  Line: () => <div data-testid="mock-line-chart">Line Chart</div>,
}))

describe('ApiUsageChart', () => {
  it('API 사용량 정보를 올바르게 표시', () => {
    const mockUsage = {
      totalCalls: 1250,
      totalTokens: 125000,
      estimatedCost: 2.5,
      dailyUsage: [
        { date: '2025-10-01', calls: 100, tokens: 10000 },
        { date: '2025-10-02', calls: 150, tokens: 15000 },
      ],
    }

    render(<ApiUsageChart usage={mockUsage} />)

    expect(screen.getByText(/1,250/)).toBeInTheDocument()
    expect(screen.getByText(/125,000/)).toBeInTheDocument()
    expect(screen.getByText(/\$2\.50/)).toBeInTheDocument()
  })

  it('빈 사용량 상태를 표시', () => {
    const mockUsage = {
      totalCalls: 0,
      totalTokens: 0,
      estimatedCost: 0,
      dailyUsage: [],
    }

    render(<ApiUsageChart usage={mockUsage} />)

    expect(screen.getByText(/아직 API 사용 데이터가 없습니다/)).toBeInTheDocument()
  })

  it('로딩 상태를 표시', () => {
    const mockUsage = {
      totalCalls: 0,
      totalTokens: 0,
      estimatedCost: 0,
      dailyUsage: [],
    }

    const { container } = render(<ApiUsageChart usage={mockUsage} isLoading />)

    const loadingElements = container.querySelectorAll('.animate-pulse')
    expect(loadingElements.length).toBeGreaterThan(0)
  })

  it('차트 제목이 표시됨', () => {
    const mockUsage = {
      totalCalls: 1250,
      totalTokens: 125000,
      estimatedCost: 2.5,
      dailyUsage: [
        { date: '2025-10-01', calls: 100, tokens: 10000 },
        { date: '2025-10-02', calls: 150, tokens: 15000 },
      ],
    }

    render(<ApiUsageChart usage={mockUsage} />)

    expect(screen.getByText('API 사용량')).toBeInTheDocument()
  })

  it('사용량 레이블을 올바르게 표시', () => {
    const mockUsage = {
      totalCalls: 1250,
      totalTokens: 125000,
      estimatedCost: 2.5,
      dailyUsage: [
        { date: '2025-10-01', calls: 100, tokens: 10000 },
      ],
    }

    render(<ApiUsageChart usage={mockUsage} />)

    expect(screen.getByText(/총 호출/)).toBeInTheDocument()
    expect(screen.getByText(/총 토큰/)).toBeInTheDocument()
    expect(screen.getByText(/추정 비용/)).toBeInTheDocument()
  })

  it('차트가 렌더링됨', () => {
    const mockUsage = {
      totalCalls: 1250,
      totalTokens: 125000,
      estimatedCost: 2.5,
      dailyUsage: [
        { date: '2025-10-01', calls: 100, tokens: 10000 },
      ],
    }

    render(<ApiUsageChart usage={mockUsage} />)

    expect(screen.getByTestId('mock-line-chart')).toBeInTheDocument()
  })
})
