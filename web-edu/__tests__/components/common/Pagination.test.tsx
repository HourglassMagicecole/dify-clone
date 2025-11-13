import { render, screen, fireEvent } from '@testing-library/react'
import { Pagination } from '@/components/common/Pagination'

describe('Pagination', () => {
  const mockOnPageChange = jest.fn()

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('현재 페이지와 전체 페이지를 표시해야 함', () => {
    render(
      <Pagination
        currentPage={2}
        totalPages={5}
        totalItems={50}
        itemsPerPage={10}
        onPageChange={mockOnPageChange}
      />
    )

    expect(screen.getByText('2')).toBeInTheDocument()
    expect(screen.getByText('5')).toBeInTheDocument()
  })

  it('아이템 범위를 표시해야 함', () => {
    render(
      <Pagination
        currentPage={2}
        totalPages={5}
        totalItems={50}
        itemsPerPage={10}
        onPageChange={mockOnPageChange}
      />
    )

    expect(screen.getByText('11')).toBeInTheDocument()
    expect(screen.getByText('20')).toBeInTheDocument()
    expect(screen.getByText('50')).toBeInTheDocument()
  })

  it('첫 페이지일 때 아이템 범위를 올바르게 표시해야 함', () => {
    const { container } = render(
      <Pagination
        currentPage={1}
        totalPages={5}
        totalItems={50}
        itemsPerPage={10}
        onPageChange={mockOnPageChange}
      />
    )

    // Check if the range text is displayed (1 - 10 / 50 항목)
    const text = container.textContent
    expect(text).toContain('1')
    expect(text).toContain('10')
    expect(text).toContain('50')
  })

  it('마지막 페이지일 때 아이템 범위를 올바르게 표시해야 함', () => {
    const { container } = render(
      <Pagination
        currentPage={5}
        totalPages={5}
        totalItems={48}
        itemsPerPage={10}
        onPageChange={mockOnPageChange}
      />
    )

    // Check if the text contains the range numbers
    const text = container.textContent
    expect(text).toContain('41')
    expect(text).toContain('48')
  })

  it('이전 버튼 클릭 시 onPageChange를 호출해야 함', () => {
    render(
      <Pagination
        currentPage={3}
        totalPages={5}
        totalItems={50}
        itemsPerPage={10}
        onPageChange={mockOnPageChange}
      />
    )

    const previousButton = screen.getByLabelText('이전 페이지')
    fireEvent.click(previousButton)

    expect(mockOnPageChange).toHaveBeenCalledTimes(1)
    expect(mockOnPageChange).toHaveBeenCalledWith(2)
  })

  it('다음 버튼 클릭 시 onPageChange를 호출해야 함', () => {
    render(
      <Pagination
        currentPage={3}
        totalPages={5}
        totalItems={50}
        itemsPerPage={10}
        onPageChange={mockOnPageChange}
      />
    )

    const nextButton = screen.getByLabelText('다음 페이지')
    fireEvent.click(nextButton)

    expect(mockOnPageChange).toHaveBeenCalledTimes(1)
    expect(mockOnPageChange).toHaveBeenCalledWith(4)
  })

  it('첫 페이지일 때 이전 버튼을 비활성화해야 함', () => {
    render(
      <Pagination
        currentPage={1}
        totalPages={5}
        totalItems={50}
        itemsPerPage={10}
        onPageChange={mockOnPageChange}
      />
    )

    const previousButton = screen.getByLabelText('이전 페이지')
    expect(previousButton).toBeDisabled()
  })

  it('마지막 페이지일 때 다음 버튼을 비활성화해야 함', () => {
    render(
      <Pagination
        currentPage={5}
        totalPages={5}
        totalItems={50}
        itemsPerPage={10}
        onPageChange={mockOnPageChange}
      />
    )

    const nextButton = screen.getByLabelText('다음 페이지')
    expect(nextButton).toBeDisabled()
  })

  it('첫 페이지에서 이전 버튼 클릭 시 onPageChange를 호출하지 않아야 함', () => {
    render(
      <Pagination
        currentPage={1}
        totalPages={5}
        totalItems={50}
        itemsPerPage={10}
        onPageChange={mockOnPageChange}
      />
    )

    const previousButton = screen.getByLabelText('이전 페이지')
    fireEvent.click(previousButton)

    expect(mockOnPageChange).not.toHaveBeenCalled()
  })

  it('마지막 페이지에서 다음 버튼 클릭 시 onPageChange를 호출하지 않아야 함', () => {
    render(
      <Pagination
        currentPage={5}
        totalPages={5}
        totalItems={50}
        itemsPerPage={10}
        onPageChange={mockOnPageChange}
      />
    )

    const nextButton = screen.getByLabelText('다음 페이지')
    fireEvent.click(nextButton)

    expect(mockOnPageChange).not.toHaveBeenCalled()
  })

  it('1페이지 이하일 때 렌더링하지 않아야 함', () => {
    const { container } = render(
      <Pagination
        currentPage={1}
        totalPages={1}
        totalItems={5}
        itemsPerPage={10}
        onPageChange={mockOnPageChange}
      />
    )

    expect(container.firstChild).toBeNull()
  })

  it('0페이지일 때 렌더링하지 않아야 함', () => {
    const { container } = render(
      <Pagination
        currentPage={1}
        totalPages={0}
        totalItems={0}
        itemsPerPage={10}
        onPageChange={mockOnPageChange}
      />
    )

    expect(container.firstChild).toBeNull()
  })

  it('커스텀 previousLabel을 사용해야 함', () => {
    render(
      <Pagination
        currentPage={2}
        totalPages={5}
        totalItems={50}
        itemsPerPage={10}
        onPageChange={mockOnPageChange}
        previousLabel="Prev"
      />
    )

    expect(screen.getByText('Prev')).toBeInTheDocument()
  })

  it('커스텀 nextLabel을 사용해야 함', () => {
    render(
      <Pagination
        currentPage={2}
        totalPages={5}
        totalItems={50}
        itemsPerPage={10}
        onPageChange={mockOnPageChange}
        nextLabel="Next"
      />
    )

    expect(screen.getByText('Next')).toBeInTheDocument()
  })

  it('커스텀 itemsLabel을 사용해야 함', () => {
    render(
      <Pagination
        currentPage={1}
        totalPages={5}
        totalItems={50}
        itemsPerPage={10}
        onPageChange={mockOnPageChange}
        itemsLabel="items"
      />
    )

    expect(screen.getByText(/items/)).toBeInTheDocument()
  })

  it('커스텀 ariaLabelPagination을 사용해야 함', () => {
    render(
      <Pagination
        currentPage={1}
        totalPages={5}
        totalItems={50}
        itemsPerPage={10}
        onPageChange={mockOnPageChange}
        ariaLabelPagination="Pagination navigation"
      />
    )

    expect(screen.getByLabelText('Pagination navigation')).toBeInTheDocument()
  })

  it('커스텀 ariaLabelPrevious를 사용해야 함', () => {
    render(
      <Pagination
        currentPage={2}
        totalPages={5}
        totalItems={50}
        itemsPerPage={10}
        onPageChange={mockOnPageChange}
        ariaLabelPrevious="Go to previous page"
      />
    )

    expect(screen.getByLabelText('Go to previous page')).toBeInTheDocument()
  })

  it('커스텀 ariaLabelNext를 사용해야 함', () => {
    render(
      <Pagination
        currentPage={2}
        totalPages={5}
        totalItems={50}
        itemsPerPage={10}
        onPageChange={mockOnPageChange}
        ariaLabelNext="Go to next page"
      />
    )

    expect(screen.getByLabelText('Go to next page')).toBeInTheDocument()
  })

  it('커스텀 className을 적용해야 함', () => {
    const { container } = render(
      <Pagination
        currentPage={2}
        totalPages={5}
        totalItems={50}
        itemsPerPage={10}
        onPageChange={mockOnPageChange}
        className="custom-pagination"
      />
    )

    expect(container.firstChild).toHaveClass('custom-pagination')
  })

  it('totalItems가 0일 때 아이템 범위를 0으로 표시해야 함', () => {
    render(
      <Pagination
        currentPage={1}
        totalPages={2}
        totalItems={0}
        itemsPerPage={10}
        onPageChange={mockOnPageChange}
      />
    )

    // When totalItems is 0, startItem and endItem should be 0
    expect(screen.getAllByText('0').length).toBeGreaterThanOrEqual(2)
  })
})
