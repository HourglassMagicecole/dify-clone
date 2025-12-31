import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { UsageOverviewCards } from '@/components/analytics/UsageOverviewCards'

describe('UsageOverviewCards', () => {
  const mockByType = [
    { usageType: 'llm', totalPrice: 0.15, requestCount: 100 },
    { usageType: 'embedding', totalPrice: 0.01, requestCount: 50 },
  ]

  // 4.1-FE-001: 기본 렌더링
  it('총 비용과 타입별 카드를 표시', () => {
    render(
      <UsageOverviewCards
        totalCost={0.16}
        totalRequests={150}
        byType={mockByType}
      />
    )

    // 총 비용 표시
    expect(screen.getByText('총 비용')).toBeInTheDocument()
    expect(screen.getByText('$0.16')).toBeInTheDocument()
    expect(screen.getByText('150회')).toBeInTheDocument()

    // 타입별 카드 표시
    expect(screen.getByText('LLM')).toBeInTheDocument()
    expect(screen.getByText('Embedding')).toBeInTheDocument()
  })

  // 4.1-FE-002: 로딩 상태
  it('로딩 상태에서 스켈레톤 표시', () => {
    const { container } = render(
      <UsageOverviewCards
        totalCost={0}
        totalRequests={0}
        byType={[]}
        loading={true}
      />
    )

    const skeletons = container.querySelectorAll('.animate-pulse')
    expect(skeletons.length).toBeGreaterThan(0)
  })

  // 4.1-FE-003: 빈 데이터
  it('빈 데이터에서 총 비용만 표시', () => {
    render(
      <UsageOverviewCards
        totalCost={0}
        totalRequests={0}
        byType={[]}
      />
    )

    expect(screen.getByText('총 비용')).toBeInTheDocument()
    expect(screen.getByText('$0.00')).toBeInTheDocument()
    expect(screen.getByText('0회')).toBeInTheDocument()
  })

  // 4.1-FE-004: 클릭 이벤트
  it('총 비용 클릭 시 onTotalClick 호출', () => {
    const onTotalClick = jest.fn()
    render(
      <UsageOverviewCards
        totalCost={0.16}
        totalRequests={150}
        byType={mockByType}
        onTotalClick={onTotalClick}
      />
    )

    const totalCard = screen.getByText('총 비용').closest('button')
    if (totalCard) {
      fireEvent.click(totalCard)
    }

    expect(onTotalClick).toHaveBeenCalled()
  })

  // 4.1-FE-005: 타입 클릭 이벤트
  it('타입 카드 클릭 시 onTypeClick 호출', () => {
    const onTypeClick = jest.fn()
    render(
      <UsageOverviewCards
        totalCost={0.16}
        totalRequests={150}
        byType={mockByType}
        onTypeClick={onTypeClick}
      />
    )

    const llmCard = screen.getByText('LLM').closest('button')
    if (llmCard) {
      fireEvent.click(llmCard)
    }

    expect(onTypeClick).toHaveBeenCalledWith('llm')
  })

  // 4.1-FE-006: 가격 포맷팅
  it('작은 가격을 6자리 소수점으로 표시', () => {
    render(
      <UsageOverviewCards
        totalCost={0.001234}
        totalRequests={10}
        byType={[{ usageType: 'llm', totalPrice: 0.001234, requestCount: 10 }]}
      />
    )

    // 작은 가격 포맷
    expect(screen.getAllByText('$0.001234').length).toBeGreaterThan(0)
  })

  // 4.1-FE-007: 타입 정렬 순서
  it('타입 카드가 정해진 순서로 정렬됨', () => {
    const mixedTypes = [
      { usageType: 'tts', totalPrice: 0.03, requestCount: 30 },
      { usageType: 'llm', totalPrice: 0.15, requestCount: 100 },
      { usageType: 'embedding', totalPrice: 0.01, requestCount: 50 },
    ]

    render(
      <UsageOverviewCards
        totalCost={0.19}
        totalRequests={180}
        byType={mixedTypes}
      />
    )

    const buttons = screen.getAllByRole('button')
    // 첫 번째는 총 비용, 그 다음 llm, embedding, tts 순서
    expect(buttons[0]).toHaveTextContent('총 비용')
    expect(buttons[1]).toHaveTextContent('LLM')
    expect(buttons[2]).toHaveTextContent('Embedding')
    expect(buttons[3]).toHaveTextContent('TTS')
  })

  // 4.1-FE-008: 힌트 텍스트
  it('클릭 힌트 텍스트 표시', () => {
    render(
      <UsageOverviewCards
        totalCost={0.16}
        totalRequests={150}
        byType={mockByType}
      />
    )

    expect(screen.getByText(/카드를 클릭하면 추이를 볼 수 있습니다/)).toBeInTheDocument()
  })
})
