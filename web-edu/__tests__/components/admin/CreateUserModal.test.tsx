import { render } from '@testing-library/react';
import { CreateUserModal } from '@/components/admin/CreateUserModal';

// Mock useAuth hook
jest.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({
    user: { id: '1', role: 'admin', actualRole: 'admin', email: 'admin@example.com', name: 'Admin User' },
  }),
}));

describe('CreateUserModal', () => {
  const mockOnClose = jest.fn();
  const mockOnSubmit = jest.fn();

  it('모달이 열려있을 때 렌더링되어야 함', () => {
    const { container } = render(
      <CreateUserModal
        isOpen={true}
        onClose={mockOnClose}
        onSubmit={mockOnSubmit}
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
        onSubmit={mockOnSubmit}
      />
    );

    expect(container.querySelector('form')).not.toBeInTheDocument();
  });
});
