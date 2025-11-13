import { render, screen, fireEvent } from '@testing-library/react'
import { EmptyState } from '@/components/common/EmptyState'

describe('EmptyState', () => {
  const mockOnAction = jest.fn()

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('아이콘, 제목, 설명을 렌더링해야 함', () => {
    render(
      <EmptyState
        icon={<span data-testid="test-icon">📦</span>}
        title="항목이 없습니다"
        description="항목을 추가해보세요"
      />
    )

    expect(screen.getByTestId('test-icon')).toBeInTheDocument()
    expect(screen.getByText('항목이 없습니다')).toBeInTheDocument()
    expect(screen.getByText('항목을 추가해보세요')).toBeInTheDocument()
  })

  it('액션 버튼이 제공되면 표시해야 함', () => {
    render(
      <EmptyState
        icon={<span>📦</span>}
        title="항목이 없습니다"
        description="항목을 추가해보세요"
        actionLabel="새 항목 추가"
        onAction={mockOnAction}
      />
    )

    expect(screen.getByText('새 항목 추가')).toBeInTheDocument()
  })

  it('액션 버튼이 제공되지 않으면 표시하지 않아야 함', () => {
    render(
      <EmptyState
        icon={<span>📦</span>}
        title="항목이 없습니다"
        description="항목을 추가해보세요"
      />
    )

    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it('액션 버튼 클릭 시 onAction 콜백을 호출해야 함', () => {
    render(
      <EmptyState
        icon={<span>📦</span>}
        title="항목이 없습니다"
        description="항목을 추가해보세요"
        actionLabel="새 항목 추가"
        onAction={mockOnAction}
      />
    )

    const button = screen.getByText('새 항목 추가')
    fireEvent.click(button)

    expect(mockOnAction).toHaveBeenCalledTimes(1)
  })

  it('actionLabel만 제공되고 onAction이 없으면 버튼을 표시하지 않아야 함', () => {
    render(
      <EmptyState
        icon={<span>📦</span>}
        title="항목이 없습니다"
        description="항목을 추가해보세요"
        actionLabel="새 항목 추가"
      />
    )

    expect(screen.queryByText('새 항목 추가')).not.toBeInTheDocument()
  })

  it('onAction만 제공되고 actionLabel이 없으면 버튼을 표시하지 않아야 함', () => {
    render(
      <EmptyState
        icon={<span>📦</span>}
        title="항목이 없습니다"
        description="항목을 추가해보세요"
        onAction={mockOnAction}
      />
    )

    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it('커스텀 className을 적용해야 함', () => {
    const { container } = render(
      <EmptyState
        icon={<span>📦</span>}
        title="항목이 없습니다"
        description="항목을 추가해보세요"
        className="custom-empty-state"
      />
    )

    expect(container.firstChild).toHaveClass('custom-empty-state')
  })

  it('기본 className이 적용되어야 함', () => {
    const { container } = render(
      <EmptyState
        icon={<span>📦</span>}
        title="항목이 없습니다"
        description="항목을 추가해보세요"
      />
    )

    expect(container.firstChild).toHaveClass('text-center', 'py-12')
  })

  it('아이콘 컨테이너가 적절한 스타일을 가져야 함', () => {
    const { container } = render(
      <EmptyState
        icon={<span>📦</span>}
        title="항목이 없습니다"
        description="항목을 추가해보세요"
      />
    )

    const iconContainer = container.querySelector('.inline-flex')
    expect(iconContainer).toHaveClass(
      'inline-flex',
      'items-center',
      'justify-center',
      'w-16',
      'h-16',
      'rounded-full',
      'bg-gray-100',
      'dark:bg-gray-800',
      'mb-4'
    )
  })

  it('제목이 적절한 스타일을 가져야 함', () => {
    render(
      <EmptyState
        icon={<span>📦</span>}
        title="항목이 없습니다"
        description="항목을 추가해보세요"
      />
    )

    const title = screen.getByText('항목이 없습니다')
    expect(title).toHaveClass('text-lg', 'font-medium', 'text-gray-900', 'dark:text-white', 'mb-2')
  })

  it('설명이 적절한 스타일을 가져야 함', () => {
    render(
      <EmptyState
        icon={<span>📦</span>}
        title="항목이 없습니다"
        description="항목을 추가해보세요"
      />
    )

    const description = screen.getByText('항목을 추가해보세요')
    expect(description).toHaveClass('text-sm', 'text-gray-600', 'dark:text-gray-400', 'mb-4')
  })

  it('액션 버튼이 적절한 스타일을 가져야 함', () => {
    render(
      <EmptyState
        icon={<span>📦</span>}
        title="항목이 없습니다"
        description="항목을 추가해보세요"
        actionLabel="새 항목 추가"
        onAction={mockOnAction}
      />
    )

    const button = screen.getByText('새 항목 추가')
    expect(button).toHaveClass(
      'inline-flex',
      'items-center',
      'gap-2',
      'px-4',
      'py-2',
      'text-sm',
      'font-medium',
      'text-white',
      'bg-blue-600',
      'rounded-lg',
      'hover:bg-blue-700',
      'transition-colors'
    )
  })
})
