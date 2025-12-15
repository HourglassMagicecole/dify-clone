import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { NavigationHeader } from '@/components/layout/NavigationHeader';
import { useAuth } from '@/hooks/useAuth';
import { useTranslation } from 'react-i18next';

// Mock hooks
jest.mock('@/hooks/useAuth');
jest.mock('react-i18next', () => ({
  useTranslation: jest.fn(),
}));
jest.mock('@/context/SessionContext', () => ({
  useSession: () => ({
    sessions: [],
    filteredSessions: [],
    currentSession: null,
    selectedAdminId: null,
    selectAdmin: jest.fn(),
    selectSession: jest.fn(),
    refreshSessions: jest.fn(),
    isLoading: false,
  }),
}));

describe('NavigationHeader', () => {
  const mockSignOut = jest.fn();
  const mockT = jest.fn((key: string) => {
    const translations: Record<string, string> = {
      'header.loading': '로딩 중...',
      'header.userMenu.profile': '프로필',
      'header.userMenu.settings': '설정',
      'header.userMenu.signOut': '로그아웃',
    };
    return translations[key] || key;
  });

  const mockUser = {
    id: 'user-123',
    email: 'test@example.com',
    name: 'Test User',
    avatar: undefined,
    role: 'normal' as const,
    actualRole: 'student' as const,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (useTranslation as jest.Mock).mockReturnValue({
      t: mockT,
      i18n: { language: 'ko-KR', changeLanguage: jest.fn() },
    });
  });

  it('로딩 중일 때 로딩 메시지를 표시해야 함', () => {
    (useAuth as jest.Mock).mockReturnValue({
      user: null,
      isLoading: true,
      signOut: mockSignOut,
    });

    render(<NavigationHeader />);
    expect(screen.getByText('로딩 중...')).toBeInTheDocument();
  });

  it('사용자 정보가 표시되어야 함', () => {
    (useAuth as jest.Mock).mockReturnValue({
      user: mockUser,
      isLoading: false,
      signOut: mockSignOut,
    });

    render(<NavigationHeader />);
    expect(screen.getByText('Test User')).toBeInTheDocument();
  });

  it('로그인하지 않은 경우 헤더를 표시하지 않아야 함', () => {
    (useAuth as jest.Mock).mockReturnValue({
      user: null,
      isLoading: false,
      signOut: mockSignOut,
    });

    const { container } = render(<NavigationHeader />);
    expect(container.firstChild).toBeNull();
  });

  it('사용자 메뉴를 클릭하면 드롭다운이 열려야 함', () => {
    (useAuth as jest.Mock).mockReturnValue({
      user: mockUser,
      isLoading: false,
      signOut: mockSignOut,
    });

    render(<NavigationHeader />);

    const userMenu = screen.getByText('Test User');
    fireEvent.click(userMenu);

    // Story 3.8: 프로필, 설정 제거 - 로그아웃만 표시
    expect(screen.getByText('로그아웃')).toBeInTheDocument();
  });

  it('로그아웃 클릭 시 signOut 함수가 호출되어야 함', async () => {
    (useAuth as jest.Mock).mockReturnValue({
      user: mockUser,
      isLoading: false,
      signOut: mockSignOut,
    });

    render(<NavigationHeader />);

    fireEvent.click(screen.getByText('Test User'));
    fireEvent.click(screen.getByText('로그아웃'));

    await waitFor(() => {
      expect(mockSignOut).toHaveBeenCalledTimes(1);
    });
  });

  it('EduAI Studio 로고가 표시되어야 함', () => {
    (useAuth as jest.Mock).mockReturnValue({
      user: mockUser,
      isLoading: false,
      signOut: mockSignOut,
    });

    render(<NavigationHeader />);
    expect(screen.getByText('EduAI Studio')).toBeInTheDocument();
  });

  it('사용자 아바타가 표시되어야 함', () => {
    (useAuth as jest.Mock).mockReturnValue({
      user: mockUser,
      isLoading: false,
      signOut: mockSignOut,
    });

    render(<NavigationHeader />);

    // UserAvatar는 이름의 첫 글자를 표시
    expect(screen.getByText('T')).toBeInTheDocument();
  });
});
