import { render, screen } from '@testing-library/react';
import { AssignRoleModal } from '@/components/admin/AssignRoleModal';

// Mock i18next
jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

describe('AssignRoleModal', () => {
  const mockUser = {
    id: '1',
    email: 'test@example.com',
    name: 'Test User',
    status: 'active' as const,
    role: 'student' as const,
    created_at: '2025-01-01T00:00:00Z',
  };

  const mockOnClose = jest.fn();
  const mockOnSubmit = jest.fn().mockResolvedValue(undefined);
  const mockSessionId = 'session-123';

  it('모달이 열려있을 때 렌더링되어야 함', () => {
    render(
      <AssignRoleModal
        isOpen={true}
        user={mockUser}
        onClose={mockOnClose}
        onSubmit={mockOnSubmit}
        sessionId={mockSessionId}
      />
    );

    // Modal should be rendered with user info
    expect(screen.getByText('Test User')).toBeInTheDocument();
    expect(screen.getByText('test@example.com')).toBeInTheDocument();
  });

  it('모달이 닫혀있을 때 렌더링되지 않아야 함', () => {
    const { container } = render(
      <AssignRoleModal
        isOpen={false}
        user={mockUser}
        onClose={mockOnClose}
        onSubmit={mockOnSubmit}
        sessionId={mockSessionId}
      />
    );

    // Modal should not be visible
    expect(container.firstChild).toBeNull();
  });
});
