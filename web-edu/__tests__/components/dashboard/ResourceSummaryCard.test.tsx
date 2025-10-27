import React from 'react'
import { render, screen } from '@testing-library/react'
import { ResourceSummaryCard, EmptyResourceState } from '@/components/dashboard/ResourceSummaryCard'

describe('ResourceSummaryCard', () => {
  it('리소스 요약을 올바르게 표시', () => {
    const mockSummary = {
      agents: 5,
      workflows: 3,
      datasets: 2,
      total: 10,
    }

    render(<ResourceSummaryCard summary={mockSummary} />)

    expect(screen.getByText('5')).toBeInTheDocument()
    expect(screen.getByText('3')).toBeInTheDocument()
    expect(screen.getByText('2')).toBeInTheDocument()
  })

  it('로딩 상태를 표시', () => {
    const mockSummary = {
      agents: 0,
      workflows: 0,
      datasets: 0,
      total: 0,
    }

    const { container } = render(<ResourceSummaryCard summary={mockSummary} isLoading />)

    // 로딩 스켈레톤이 표시되는지 확인
    const loadingElements = container.querySelectorAll('.animate-pulse')
    expect(loadingElements.length).toBeGreaterThan(0)
  })

  it('각 리소스 타입에 맞는 라벨을 표시', () => {
    const mockSummary = {
      agents: 5,
      workflows: 3,
      datasets: 2,
      total: 10,
    }

    render(<ResourceSummaryCard summary={mockSummary} />)

    // i18n 키가 렌더링되는지 확인 (mock 없이 테스트)
    expect(screen.getByText(/dashboard\.resourceSummary\.agents/)).toBeInTheDocument()
    expect(screen.getByText(/dashboard\.resourceSummary\.workflows/)).toBeInTheDocument()
    expect(screen.getByText(/dashboard\.resourceSummary\.datasets/)).toBeInTheDocument()
  })
})

describe('EmptyResourceState', () => {
  it('빈 상태를 올바르게 표시', () => {
    render(<EmptyResourceState />)

    // i18n 키가 렌더링되는지 확인 (mock 없이 테스트)
    expect(screen.getByText(/dashboard\.empty\.title/)).toBeInTheDocument()
    expect(screen.getByText(/dashboard\.empty\.description/)).toBeInTheDocument()
  })

  it('시작하기 버튼이 렌더링됨', () => {
    render(<EmptyResourceState />)

    // i18n 키로 버튼 검색 (mock 없이 테스트)
    const button = screen.getByRole('button', { name: /dashboard\.empty\.button/ })
    expect(button).toBeInTheDocument()
  })
})
