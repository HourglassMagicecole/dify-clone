import { render, screen, fireEvent } from '@testing-library/react'
import { DeleteConfirmDialog } from '@/components/common/DeleteConfirmDialog'

describe('DeleteConfirmDialog (Common)', () => {
  const mockOnClose = jest.fn()
  const mockOnConfirm = jest.fn()

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('isOpen이 false일 때 렌더링하지 않아야 함', () => {
    render(
      <DeleteConfirmDialog
        isOpen={false}
        onClose={mockOnClose}
        onConfirm={mockOnConfirm}
        title="삭제 확인"
        message="정말 삭제하시겠습니까?"
      />
    )

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('isOpen이 true일 때 다이얼로그를 렌더링해야 함', () => {
    render(
      <DeleteConfirmDialog
        isOpen={true}
        onClose={mockOnClose}
        onConfirm={mockOnConfirm}
        title="삭제 확인"
        message="정말 삭제하시겠습니까?"
      />
    )

    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('title과 message를 표시해야 함', () => {
    render(
      <DeleteConfirmDialog
        isOpen={true}
        onClose={mockOnClose}
        onConfirm={mockOnConfirm}
        title="Agent 삭제"
        message="이 작업은 되돌릴 수 없습니다."
      />
    )

    expect(screen.getByText('Agent 삭제')).toBeInTheDocument()
    expect(screen.getByText('이 작업은 되돌릴 수 없습니다.')).toBeInTheDocument()
  })

  it('기본 버튼 레이블을 표시해야 함', () => {
    render(
      <DeleteConfirmDialog
        isOpen={true}
        onClose={mockOnClose}
        onConfirm={mockOnConfirm}
        title="삭제 확인"
        message="정말 삭제하시겠습니까?"
      />
    )

    expect(screen.getByText('취소')).toBeInTheDocument()
    expect(screen.getByText('삭제')).toBeInTheDocument()
  })

  it('커스텀 버튼 레이블을 표시해야 함', () => {
    render(
      <DeleteConfirmDialog
        isOpen={true}
        onClose={mockOnClose}
        onConfirm={mockOnConfirm}
        title="삭제 확인"
        message="정말 삭제하시겠습니까?"
        confirmLabel="확인"
        cancelLabel="아니오"
      />
    )

    expect(screen.getByText('아니오')).toBeInTheDocument()
    expect(screen.getByText('확인')).toBeInTheDocument()
  })

  it('취소 버튼 클릭 시 onClose를 호출해야 함', () => {
    render(
      <DeleteConfirmDialog
        isOpen={true}
        onClose={mockOnClose}
        onConfirm={mockOnConfirm}
        title="삭제 확인"
        message="정말 삭제하시겠습니까?"
      />
    )

    const cancelButton = screen.getByText('취소')
    fireEvent.click(cancelButton)

    expect(mockOnClose).toHaveBeenCalledTimes(1)
    expect(mockOnConfirm).not.toHaveBeenCalled()
  })

  it('확인 버튼 클릭 시 onConfirm을 호출해야 함', () => {
    render(
      <DeleteConfirmDialog
        isOpen={true}
        onClose={mockOnClose}
        onConfirm={mockOnConfirm}
        title="삭제 확인"
        message="정말 삭제하시겠습니까?"
      />
    )

    const confirmButton = screen.getByText('삭제')
    fireEvent.click(confirmButton)

    expect(mockOnConfirm).toHaveBeenCalledTimes(1)
    expect(mockOnClose).not.toHaveBeenCalled()
  })

  it('닫기 버튼 클릭 시 onClose를 호출해야 함', () => {
    render(
      <DeleteConfirmDialog
        isOpen={true}
        onClose={mockOnClose}
        onConfirm={mockOnConfirm}
        title="삭제 확인"
        message="정말 삭제하시겠습니까?"
      />
    )

    const closeButton = screen.getByLabelText('닫기')
    fireEvent.click(closeButton)

    expect(mockOnClose).toHaveBeenCalledTimes(1)
  })

  it('ESC 키 입력 시 onClose를 호출해야 함', () => {
    render(
      <DeleteConfirmDialog
        isOpen={true}
        onClose={mockOnClose}
        onConfirm={mockOnConfirm}
        title="삭제 확인"
        message="정말 삭제하시겠습니까?"
      />
    )

    fireEvent.keyDown(window, { key: 'Escape' })

    expect(mockOnClose).toHaveBeenCalledTimes(1)
  })

  it('isLoading이 true일 때 버튼을 비활성화해야 함', () => {
    render(
      <DeleteConfirmDialog
        isOpen={true}
        onClose={mockOnClose}
        onConfirm={mockOnConfirm}
        title="삭제 확인"
        message="정말 삭제하시겠습니까?"
        isLoading={true}
      />
    )

    const cancelButton = screen.getByText('취소')
    const confirmButton = screen.getByText('삭제 중...')

    expect(cancelButton).toBeDisabled()
    expect(confirmButton).toBeDisabled()
  })

  it('isLoading이 true일 때 loadingLabel을 표시해야 함', () => {
    render(
      <DeleteConfirmDialog
        isOpen={true}
        onClose={mockOnClose}
        onConfirm={mockOnConfirm}
        title="삭제 확인"
        message="정말 삭제하시겠습니까?"
        loadingLabel="처리 중..."
        isLoading={true}
      />
    )

    expect(screen.getByText('처리 중...')).toBeInTheDocument()
  })

  it('isLoading이 true일 때 ESC 키를 무시해야 함', () => {
    render(
      <DeleteConfirmDialog
        isOpen={true}
        onClose={mockOnClose}
        onConfirm={mockOnConfirm}
        title="삭제 확인"
        message="정말 삭제하시겠습니까?"
        isLoading={true}
      />
    )

    fireEvent.keyDown(window, { key: 'Escape' })

    expect(mockOnClose).not.toHaveBeenCalled()
  })

  it('isLoading이 true일 때 취소 버튼이 비활성화되어야 함', () => {
    render(
      <DeleteConfirmDialog
        isOpen={true}
        onClose={mockOnClose}
        onConfirm={mockOnConfirm}
        title="삭제 확인"
        message="정말 삭제하시겠습니까?"
        isLoading={true}
      />
    )

    const cancelButton = screen.getByText('취소')
    fireEvent.click(cancelButton)

    // 버튼이 disabled이므로 클릭이 무시되어야 함
    expect(mockOnClose).not.toHaveBeenCalled()
  })

  it('aria-modal 속성이 설정되어야 함', () => {
    render(
      <DeleteConfirmDialog
        isOpen={true}
        onClose={mockOnClose}
        onConfirm={mockOnConfirm}
        title="삭제 확인"
        message="정말 삭제하시겠습니까?"
      />
    )

    const dialog = screen.getByRole('dialog')
    expect(dialog).toHaveAttribute('aria-modal', 'true')
  })

  it('커스텀 closeAriaLabel을 사용해야 함', () => {
    render(
      <DeleteConfirmDialog
        isOpen={true}
        onClose={mockOnClose}
        onConfirm={mockOnConfirm}
        title="삭제 확인"
        message="정말 삭제하시겠습니까?"
        closeAriaLabel="다이얼로그 닫기"
      />
    )

    expect(screen.getByLabelText('다이얼로그 닫기')).toBeInTheDocument()
  })
})
