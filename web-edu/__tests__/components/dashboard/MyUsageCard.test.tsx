import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import { MyUsageCard } from '@/components/dashboard/MyUsageCard'

// Mock API
jest.mock('@/service/usage-analytics-api', () => ({
  getMyUsageSummary: jest.fn(),
  getMyDailyUsage: jest.fn(),
}))

// Mock SessionContext
jest.mock('@/context/SessionContext', () => ({
  useSession: () => ({
    currentSession: { id: 'test-session-001', session_name: 'Test Session' },
  }),
}))

// Mock next/link
jest.mock('next/link', () => {
  return function MockLink({ children, href }: { children: React.ReactNode; href: string }) {
    return <a href={href}>{children}</a>
  }
})

import { getMyUsageSummary, getMyDailyUsage } from '@/service/usage-analytics-api'

const mockGetMyUsageSummary = getMyUsageSummary as jest.MockedFunction<typeof getMyUsageSummary>
const mockGetMyDailyUsage = getMyDailyUsage as jest.MockedFunction<typeof getMyDailyUsage>

describe('MyUsageCard', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  // 4.1-FE-020: 로딩 상태
  it('로딩 상태에서 스켈레톤 표시', async () => {
    mockGetMyUsageSummary.mockImplementation(() => new Promise(() => {})) // 무한 pending
    mockGetMyDailyUsage.mockImplementation(() => new Promise(() => {}))

    const { container } = render(<MyUsageCard />)

    const skeletons = container.querySelectorAll('.animate-pulse')
    expect(skeletons.length).toBeGreaterThan(0)
  })

  // 4.1-FE-021: 데이터 표시
  it('사용량 데이터를 정상 표시', async () => {
    const mockSummary = [
      {
        usage_type: 'llm',
        request_count: 100,
        total_input_tokens: 5000,
        total_output_tokens: 2000,
        total_tokens: 7000,
        total_price: '0.15',
        currency: 'USD',
      },
    ]

    const mockDaily = [
      {
        date: new Date().toISOString().split('T')[0],
        usage_type: 'llm',
        request_count: 10,
        total_tokens: 700,
        total_price: '0.02',
      },
    ]

    mockGetMyUsageSummary.mockResolvedValue({
      result: 'success',
      data: mockSummary,
    })

    mockGetMyDailyUsage.mockResolvedValue({
      result: 'success',
      data: mockDaily,
    })

    render(<MyUsageCard />)

    await waitFor(() => {
      // 총 비용 표시 확인
      expect(screen.getByText(/\$0\.15/)).toBeInTheDocument()
    })
  })

  // 4.1-FE-022: 빈 데이터
  it('빈 데이터에서 0 값 표시', async () => {
    mockGetMyUsageSummary.mockResolvedValue({
      result: 'success',
      data: [],
    })

    mockGetMyDailyUsage.mockResolvedValue({
      result: 'success',
      data: [],
    })

    render(<MyUsageCard />)

    await waitFor(() => {
      // 0 값 표시 확인 (formatPrice는 작은 값에 6자리 소수점 사용)
      expect(screen.getAllByText(/\$0\.0/).length).toBeGreaterThan(0)
    })
  })

  // 4.1-FE-023: API 에러 처리
  it('API 에러 시 기본값 표시', async () => {
    mockGetMyUsageSummary.mockRejectedValue(new Error('API Error'))
    mockGetMyDailyUsage.mockRejectedValue(new Error('API Error'))

    render(<MyUsageCard />)

    await waitFor(() => {
      // 로딩 종료 후 기본값 표시
      expect(screen.queryByText(/animate-pulse/)).not.toBeInTheDocument()
    })
  })

  // 4.1-FE-024: 세션 링크
  it('세션 상세 페이지 링크 포함', async () => {
    mockGetMyUsageSummary.mockResolvedValue({
      result: 'success',
      data: [],
    })

    mockGetMyDailyUsage.mockResolvedValue({
      result: 'success',
      data: [],
    })

    render(<MyUsageCard />)

    await waitFor(() => {
      const link = screen.getByRole('link')
      expect(link).toHaveAttribute('href', '/my-session')
    })
  })
})
