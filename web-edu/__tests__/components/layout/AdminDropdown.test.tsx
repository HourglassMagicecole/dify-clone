import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { AdminDropdown } from '@/components/layout/AdminDropdown'

// Mock next/link
jest.mock('next/link', () => {
  return function MockLink({
    children,
    href,
    onClick,
  }: {
    children: React.ReactNode
    href: string
    onClick?: () => void
  }) {
    return (
      <a href={href} onClick={onClick}>
        {children}
      </a>
    )
  }
})

// Mock react-i18next
jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const translations: Record<string, string> = {
        'nav.admin': 'Admin',
        'nav.sessions': 'Sessions',
        'nav.users': 'User Management',
        'nav.api_keys': 'API Keys',
        'nav.monitoring': 'Monitoring',
      }
      return translations[key] || key
    },
  }),
}))

// Mock @heroicons/react
jest.mock('@heroicons/react/24/outline', () => ({
  ChevronDownIcon: ({ className }: { className?: string }) => (
    <svg data-testid="chevron-icon" className={className} />
  ),
}))

describe('AdminDropdown', () => {
  // 3.8-FE-007: 드롭다운 토글 동작 확인
  it('toggles dropdown on button click', () => {
    render(<AdminDropdown isOwner={false} />)

    const button = screen.getByRole('button', { name: /admin/i })
    expect(screen.queryByText('Sessions')).not.toBeInTheDocument()

    fireEvent.click(button)
    expect(screen.getByText('Sessions')).toBeInTheDocument()

    fireEvent.click(button)
    expect(screen.queryByText('Sessions')).not.toBeInTheDocument()
  })

  // 3.8-FE-008: Admin 역할에 따른 메뉴 항목 표시 확인
  it('shows only admin menu items for non-owner', () => {
    render(<AdminDropdown isOwner={false} />)

    fireEvent.click(screen.getByRole('button', { name: /admin/i }))

    expect(screen.getByText('Sessions')).toBeInTheDocument()
    expect(screen.getByText('User Management')).toBeInTheDocument()
    expect(screen.queryByText('API Keys')).not.toBeInTheDocument()
    expect(screen.queryByText('Monitoring')).not.toBeInTheDocument()
  })

  // 3.8-FE-009: Owner 역할에 따른 추가 메뉴 항목 표시 확인
  it('shows all menu items for owner', () => {
    render(<AdminDropdown isOwner={true} />)

    fireEvent.click(screen.getByRole('button', { name: /admin/i }))

    expect(screen.getByText('Sessions')).toBeInTheDocument()
    expect(screen.getByText('User Management')).toBeInTheDocument()
    expect(screen.getByText('API Keys')).toBeInTheDocument()
    expect(screen.getByText('Monitoring')).toBeInTheDocument()
  })

  // 3.8-FE-010: 외부 클릭 시 드롭다운 닫힘 확인
  it('closes dropdown on outside click', () => {
    render(
      <div>
        <div data-testid="outside">Outside</div>
        <AdminDropdown isOwner={false} />
      </div>
    )

    fireEvent.click(screen.getByRole('button', { name: /admin/i }))
    expect(screen.getByText('Sessions')).toBeInTheDocument()

    fireEvent.mouseDown(screen.getByTestId('outside'))
    expect(screen.queryByText('Sessions')).not.toBeInTheDocument()
  })

  // 3.8-FE-011: 메뉴 항목 클릭 시 드롭다운 닫힘
  it('closes dropdown when menu item is clicked', () => {
    render(<AdminDropdown isOwner={false} />)

    fireEvent.click(screen.getByRole('button', { name: /admin/i }))
    expect(screen.getByText('Sessions')).toBeInTheDocument()

    fireEvent.click(screen.getByText('Sessions'))
    expect(screen.queryByRole('link', { name: 'Sessions' })).not.toBeInTheDocument()
  })

  // 3.8-FE-012: 올바른 링크 경로 확인
  it('has correct href for menu items', () => {
    render(<AdminDropdown isOwner={true} />)

    fireEvent.click(screen.getByRole('button', { name: /admin/i }))

    expect(screen.getByRole('link', { name: 'Sessions' })).toHaveAttribute(
      'href',
      '/admin/sessions'
    )
    expect(screen.getByRole('link', { name: 'User Management' })).toHaveAttribute(
      'href',
      '/admin/users'
    )
    expect(screen.getByRole('link', { name: 'API Keys' })).toHaveAttribute(
      'href',
      '/admin/api-keys'
    )
    expect(screen.getByRole('link', { name: 'Monitoring' })).toHaveAttribute(
      'href',
      '/owner/monitoring'
    )
  })

  // 3.8-FE-013: 화살표 아이콘 회전 확인
  it('rotates chevron icon when dropdown is open', () => {
    render(<AdminDropdown isOwner={false} />)

    const button = screen.getByRole('button', { name: /admin/i })
    const icon = screen.getByTestId('chevron-icon')

    expect(icon).not.toHaveClass('rotate-180')

    fireEvent.click(button)
    expect(icon).toHaveClass('rotate-180')
  })
})
