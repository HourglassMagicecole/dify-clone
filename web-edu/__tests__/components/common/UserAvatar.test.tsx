import { render, screen } from '@testing-library/react';
import { UserAvatar } from '@/components/common/UserAvatar';

describe('UserAvatar', () => {
  it('사용자 이름의 첫 글자를 표시해야 함', () => {
    render(<UserAvatar name="John Doe" />);
    expect(screen.getByText('J')).toBeInTheDocument();
  });

  it('아바타 이미지가 제공되면 이미지를 표시해야 함', () => {
    render(<UserAvatar name="John Doe" avatarUrl="https://example.com/avatar.jpg" />);
    const img = screen.getByAltText('John Doe');
    expect(img).toBeInTheDocument();
    // Next.js Image component transforms src URL, so check if it contains the original URL
    expect(img).toHaveAttribute('src');
    expect(img.getAttribute('src')).toContain('https%3A%2F%2Fexample.com%2Favatar.jpg');
  });

  it('size prop에 따라 크기가 변경되어야 함', () => {
    const { container } = render(<UserAvatar name="John Doe" size="lg" />);
    expect(container.firstChild).toHaveClass('w-12 h-12');
  });

  it('기본 크기는 md여야 함', () => {
    const { container } = render(<UserAvatar name="Jane Smith" />);
    expect(container.firstChild).toHaveClass('w-10 h-10');
  });

  it('한글 이름의 첫 글자를 표시해야 함', () => {
    render(<UserAvatar name="홍길동" />);
    expect(screen.getByText('홍')).toBeInTheDocument();
  });

  it('title 속성에 전체 이름이 표시되어야 함', () => {
    const { container } = render(<UserAvatar name="Test User" />);
    expect(container.firstChild).toHaveAttribute('title', 'Test User');
  });

  it('커스텀 className을 추가할 수 있어야 함', () => {
    const { container } = render(<UserAvatar name="John" className="custom-class" />);
    expect(container.firstChild).toHaveClass('custom-class');
  });

  it('small 크기일 때 올바른 클래스를 가져야 함', () => {
    const { container } = render(<UserAvatar name="User" size="sm" />);
    expect(container.firstChild).toHaveClass('w-8 h-8 text-sm');
  });
});
