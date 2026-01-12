import React from 'react'
import { render, screen } from '@testing-library/react'
import { ResourceSummaryCard, EmptyResourceState } from '@/components/dashboard/ResourceSummaryCard'

// Mock useTranslation
jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const translations: Record<string, string> = {
        'resourceSummary.agents': 'Agents',
        'resourceSummary.datasets': 'Datasets',
        'resourceSummary.title': '리소스 요약',
        'scope.system': '전체',
        'scope.my': '내',
        'empty.title': '아직 리소스가 없습니다',
        'empty.description': 'Agent, Dataset을 생성하여 시작하세요',
        'empty.button': '시작하기',
      }
      return translations[key] || key
    },
  }),
}))

describe('ResourceSummaryCard', () => {
  it('리소스 요약을 올바르게 표시', () => {
    const mockSummary = {
      agents: 5,
      datasets: 2,
      total: 7,
    }

    render(<ResourceSummaryCard summary={mockSummary} scope="system" />)

    expect(screen.getByText('5')).toBeInTheDocument()
    expect(screen.getByText('2')).toBeInTheDocument()
  })

  it('로딩 상태를 표시', () => {
    const mockSummary = {
      agents: 0,
      datasets: 0,
      total: 0,
    }

    const { container } = render(<ResourceSummaryCard summary={mockSummary} scope="system" isLoading />)

    // 로딩 스켈레톤이 표시되는지 확인
    const loadingElements = container.querySelectorAll('.animate-pulse')
    expect(loadingElements.length).toBeGreaterThan(0)
  })

  it('각 리소스 타입에 맞는 라벨을 표시', () => {
    const mockSummary = {
      agents: 5,
      datasets: 2,
      total: 7,
    }

    render(<ResourceSummaryCard summary={mockSummary} scope="system" />)

    // 리소스 타입 라벨 확인
    expect(screen.getByText('Agents')).toBeInTheDocument()
    expect(screen.getByText('Datasets')).toBeInTheDocument()
  })
})

describe('EmptyResourceState', () => {
  it('빈 상태를 올바르게 표시', () => {
    render(<EmptyResourceState />)

    // 빈 상태 메시지 확인
    expect(screen.getByText('아직 리소스가 없습니다')).toBeInTheDocument()
    expect(screen.getByText(/Agent, Dataset을 생성하여/)).toBeInTheDocument()
  })
})
