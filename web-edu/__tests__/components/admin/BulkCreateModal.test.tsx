import { render, screen } from '@testing-library/react';
import { BulkCreateModal } from '@/components/admin/BulkCreateModal';

// Mock i18next
jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

describe('BulkCreateModal', () => {
  const mockOnClose = jest.fn();
  const mockOnSubmit = jest.fn().mockResolvedValue('task-123');
  const mockOnCheckStatus = jest.fn().mockResolvedValue({
    status: 'pending',
    total: 0,
    processed: 0,
    failed: 0,
  });

  it('모달이 열려있을 때 렌더링되어야 함', () => {
    render(
      <BulkCreateModal
        isOpen={true}
        onClose={mockOnClose}
        onSubmit={mockOnSubmit}
        onCheckStatus={mockOnCheckStatus}
      />
    );

    // Modal should render upload interface
    expect(screen.getByText(/userManagement.bulkCreateModal.title/)).toBeInTheDocument();
  });

  it('모달이 닫혀있을 때 렌더링되지 않아야 함', () => {
    const { container } = render(
      <BulkCreateModal
        isOpen={false}
        onClose={mockOnClose}
        onSubmit={mockOnSubmit}
        onCheckStatus={mockOnCheckStatus}
      />
    );

    // Modal should not be visible
    expect(container.firstChild).toBeNull();
  });
});
