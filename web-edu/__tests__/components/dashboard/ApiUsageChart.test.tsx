import React from 'react'
import { render, screen } from '@testing-library/react'
import { ApiUsageChart } from '@/components/dashboard/ApiUsageChart'
import type { ApiUsageSummary } from '@/types/dashboard'

// Mock react-chartjs-2
jest.mock('react-chartjs-2', () => ({
  Bar: () => <div data-testid="mock-bar-chart">Bar Chart</div>,
}))

// Mock react-i18next
jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const translations: Record<string, string> = {
        'apiUsage.title': 'API Usage (Last 7 Days)',
        'apiUsage.summary.calls': 'Total Calls',
        'apiUsage.summary.tokens': 'Total Tokens',
        'apiUsage.summary.cost': 'Estimated Cost',
        'apiUsage.chart.calls': 'API Calls',
        'apiUsage.chart.tokens': 'Tokens',
        'apiUsage.chart.cost': 'Cost',
      }
      return translations[key] || key
    },
  }),
}))

describe('ApiUsageChart', () => {
  const createMockData = (overrides?: Partial<ApiUsageSummary>): ApiUsageSummary => ({
    totalCalls: 1250,
    totalTokens: 125000,
    estimatedCost: 2.5,
    dailyUsage: [
      {
        date: '2025-10-01',
        callCount: 100,
        inputTokens: 5000,
        outputTokens: 5000,
        totalTokens: 10000,
        estimatedCost: 0.2,
      },
      {
        date: '2025-10-02',
        callCount: 150,
        inputTokens: 7500,
        outputTokens: 7500,
        totalTokens: 15000,
        estimatedCost: 0.3,
      },
    ],
    ...overrides,
  })

  // 3.8-FE-001: 로딩 상태 표시 확인
  it('renders loading state correctly', () => {
    const mockData = createMockData()
    const { container } = render(<ApiUsageChart data={mockData} isLoading />)

    const loadingElements = container.querySelectorAll('.animate-pulse')
    expect(loadingElements.length).toBeGreaterThan(0)
  })

  // 3.8-FE-002: 요약 통계 렌더링 확인
  it('renders summary statistics correctly', () => {
    const mockData = createMockData()
    render(<ApiUsageChart data={mockData} />)

    expect(screen.getByText('1,250')).toBeInTheDocument()
    expect(screen.getByText('125,000')).toBeInTheDocument()
    expect(screen.getByText('$2.50')).toBeInTheDocument()
  })

  // 3.8-FE-003: 차트 렌더링 확인
  it('renders chart component', () => {
    const mockData = createMockData()
    render(<ApiUsageChart data={mockData} />)

    expect(screen.getByTestId('mock-bar-chart')).toBeInTheDocument()
  })

  // 3.8-FE-004: 빈 데이터 처리 확인
  it('handles empty daily usage data', () => {
    const mockData = createMockData({
      totalCalls: 0,
      totalTokens: 0,
      estimatedCost: 0,
      dailyUsage: [],
    })

    render(<ApiUsageChart data={mockData} />)

    // 0이 여러 개 나타나므로 getAllByText 사용
    const zeroElements = screen.getAllByText('0')
    expect(zeroElements.length).toBeGreaterThanOrEqual(2) // totalCalls, totalTokens
    expect(screen.getByText('$0.00')).toBeInTheDocument()
  })

  // 3.8-FE-005: 타이틀 표시 확인
  it('displays chart title', () => {
    const mockData = createMockData()
    render(<ApiUsageChart data={mockData} />)

    expect(screen.getByText('API Usage (Last 7 Days)')).toBeInTheDocument()
  })

  // 3.8-FE-006: 요약 라벨 표시 확인
  it('displays summary labels', () => {
    const mockData = createMockData()
    render(<ApiUsageChart data={mockData} />)

    expect(screen.getByText('Total Calls')).toBeInTheDocument()
    expect(screen.getByText('Total Tokens')).toBeInTheDocument()
    expect(screen.getByText('Estimated Cost')).toBeInTheDocument()
  })
})
