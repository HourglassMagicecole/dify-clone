import { render } from '@testing-library/react';
import { CreateUserModal } from '@/components/admin/CreateUserModal';

describe('CreateUserModal', () => {
  const mockOnClose = jest.fn();
  const mockOnSuccess = jest.fn();

  it('모달이 열려있을 때 렌더링되어야 함', () => {
    const { container } = render(
      <CreateUserModal
        isOpen={true}
        onClose={mockOnClose}
        onSuccess={mockOnSuccess}
      />
    );

    // Modal should be rendered
    expect(container.querySelector('form')).toBeInTheDocument();
  });

  it('모달이 닫혀있을 때 렌더링되지 않아야 함', () => {
    const { container } = render(
      <CreateUserModal
        isOpen={false}
        onClose={mockOnClose}
        onSuccess={mockOnSuccess}
      />
    );

    expect(container.querySelector('form')).not.toBeInTheDocument();
  });
});
