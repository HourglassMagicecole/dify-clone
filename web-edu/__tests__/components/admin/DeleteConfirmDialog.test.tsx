import { render, screen } from '@testing-library/react';
import { DeleteConfirmDialog } from '@/components/admin/DeleteConfirmDialog';

describe('DeleteConfirmDialog', () => {
  const mockUser = {
    id: '1',
    email: 'test@example.com',
    name: 'Test User',
  };

  const mockOnClose = jest.fn();
  const mockOnConfirm = jest.fn();

  it('다이얼로그가 열려있을 때 렌더링되어야 함', () => {
    const { container } = render(
      <DeleteConfirmDialog
        isOpen={true}
        user={mockUser}
        onClose={mockOnClose}
        onConfirm={mockOnConfirm}
      />
    );

    // Dialog should show user information
    expect(screen.getByText('Test User')).toBeInTheDocument();
    expect(screen.getByText('test@example.com')).toBeInTheDocument();
    // Dialog should have buttons
    expect(container.querySelector('button[type="button"]')).toBeInTheDocument();
  });

  it('다이얼로그가 닫혀있을 때 렌더링되지 않아야 함', () => {
    render(
      <DeleteConfirmDialog
        isOpen={false}
        user={mockUser}
        onClose={mockOnClose}
        onConfirm={mockOnConfirm}
      />
    );

    // Dialog should not show user information when closed
    expect(screen.queryByText('Test User')).not.toBeInTheDocument();
    expect(screen.queryByText('test@example.com')).not.toBeInTheDocument();
  });
});
