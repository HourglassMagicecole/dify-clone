import { render, screen } from '@testing-library/react';
import { EditUserModal } from '@/components/admin/EditUserModal';

// Mock useAuth hook
jest.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({
    user: { id: '2', role: 'admin', email: 'admin@example.com', name: 'Admin User' },
  }),
}));

describe('EditUserModal', () => {
  const mockUser = {
    id: '1',
    email: 'test@example.com',
    name: 'Test User',
    role: 'student' as const,
    status: 'active' as const,
    created_at: '2025-01-01T00:00:00Z',
  };

  const mockOnClose = jest.fn();
  const mockOnSuccess = jest.fn();

  it('모달이 열려있을 때 렌더링되어야 함', () => {
    const { container } = render(
      <EditUserModal
        isOpen={true}
        user={mockUser}
        onClose={mockOnClose}
        onSuccess={mockOnSuccess}
      />
    );

    // Modal should be present
    expect(container.querySelector('form')).toBeInTheDocument();
  });

  it('모달이 닫혀있을 때 렌더링되지 않아야 함', () => {
    render(
      <EditUserModal
        isOpen={false}
        user={mockUser}
        onClose={mockOnClose}
        onSuccess={mockOnSuccess}
      />
    );

    expect(screen.queryByDisplayValue(mockUser.name)).not.toBeInTheDocument();
  });
});
