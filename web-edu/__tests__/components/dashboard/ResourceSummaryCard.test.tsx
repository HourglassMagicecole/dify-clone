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

    expect(screen.getByText('Agents')).toBeInTheDocument()
    expect(screen.getByText('Workflows')).toBeInTheDocument()
    expect(screen.getByText('Datasets')).toBeInTheDocument()
  })
})

describe('EmptyResourceState', () => {
  it('빈 상태를 올바르게 표시', () => {
    render(<EmptyResourceState />)

    expect(screen.getByText(/아직 생성한 리소스가 없습니다/)).toBeInTheDocument()
    expect(screen.getByText('시작하기')).toBeInTheDocument()
  })

  it('시작하기 버튼이 렌더링됨', () => {
    render(<EmptyResourceState />)

    const button = screen.getByRole('button', { name: '시작하기' })
    expect(button).toBeInTheDocument()
  })
})
