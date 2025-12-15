import { render, screen } from '@testing-library/react'
import { ContextBanner } from '@/components/dashboard/ContextBanner'

// Mock useTranslation
jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, string>) => {
      const translations: Record<string, string> = {
        'contextBanner.owner.title': `세션: ${params?.sessionName || 'N/A'}`,
        'contextBanner.owner.description': '전체 리소스를 관리합니다',
        'contextBanner.admin.title': `세션: ${params?.sessionName || 'N/A'}`,
        'contextBanner.admin.description': '전체 리소스를 관리합니다',
        'contextBanner.student.title': `세션: ${params?.sessionName || 'N/A'}`,
        'contextBanner.student.description': '내 리소스',
      }
      return translations[key] || key
    },
  }),
}))

describe('ContextBanner', () => {
  it('renders owner banner with blue color and crown icon', () => {
    render(<ContextBanner role="owner" scope="system" sessionName="Test Session" />)

    expect(screen.getByText('세션: Test Session')).toBeInTheDocument()
    expect(screen.getByText('전체 리소스를 관리합니다')).toBeInTheDocument()
    expect(screen.getByText('👑')).toBeInTheDocument()
  })

  it('renders admin banner with green color and session name', () => {
    render(<ContextBanner role="admin" scope="session" sessionName="Test Session" />)

    expect(screen.getByText('세션: Test Session')).toBeInTheDocument()
    expect(screen.getByText('전체 리소스를 관리합니다')).toBeInTheDocument()
    expect(screen.getByText('👤')).toBeInTheDocument()
  })

  it('renders student banner with orange color and session name', () => {
    render(<ContextBanner role="student" scope="my_resources" sessionName="Student Session" />)

    expect(screen.getByText('세션: Student Session')).toBeInTheDocument()
    expect(screen.getByText('내 리소스')).toBeInTheDocument()
    expect(screen.getByText('🎓')).toBeInTheDocument()
  })

  it('applies correct color classes for owner role', () => {
    const { container } = render(<ContextBanner role="owner" scope="system" />)
    const banner = container.querySelector('.bg-blue-50')
    expect(banner).toBeInTheDocument()
  })

  it('applies correct color classes for admin role', () => {
    const { container } = render(<ContextBanner role="admin" scope="session" sessionName="Test" />)
    const banner = container.querySelector('.bg-green-50')
    expect(banner).toBeInTheDocument()
  })

  it('applies correct color classes for student role', () => {
    const { container } = render(<ContextBanner role="student" scope="my_resources" sessionName="Test" />)
    const banner = container.querySelector('.bg-orange-50')
    expect(banner).toBeInTheDocument()
  })
})
