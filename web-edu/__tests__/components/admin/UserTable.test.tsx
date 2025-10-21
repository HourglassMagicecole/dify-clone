import { render, screen } from '@testing-library/react';
import { UserTable } from '@/components/admin/UserTable';

// Mock useAuth hook
jest.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({
    user: { id: '2', role: 'admin', email: 'admin@example.com', name: 'Admin User' },
  }),
}));

describe('UserTable', () => {
  const mockUsers = [
    {
      id: '1',
      email: 'user1@test.com',
      name: 'User 1',
      role: 'student' as const,
      status: 'active' as const,
      created_at: '2025-01-01T00:00:00Z',
    },
    {
      id: '2',
      email: 'user2@test.com',
      name: 'User 2',
      role: 'admin' as const,
      status: 'active' as const,
      created_at: '2025-01-02T00:00:00Z',
    },
  ];

  const mockHandlers = {
    onEdit: jest.fn(),
    onDelete: jest.fn(),
    onAssignRole: jest.fn(),
  };

  it('사용자 테이블이 렌더링되어야 함', () => {
    render(<UserTable users={mockUsers} {...mockHandlers} />);

    expect(screen.getByText('user1@test.com')).toBeInTheDocument();
    expect(screen.getByText('User 1')).toBeInTheDocument();
    expect(screen.getByText('user2@test.com')).toBeInTheDocument();
    expect(screen.getByText('User 2')).toBeInTheDocument();
  });

  it('빈 배열일 때 메시지가 표시되어야 함', () => {
    render(<UserTable users={[]} {...mockHandlers} />);

    expect(screen.queryByText('user1@test.com')).not.toBeInTheDocument();
  });
});
