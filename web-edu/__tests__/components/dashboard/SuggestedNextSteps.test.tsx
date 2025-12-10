import { render, screen } from '@testing-library/react'
import { SuggestedNextSteps } from '@/components/dashboard/SuggestedNextSteps'

// Mock next/link
jest.mock('next/link', () => {
  const MockLink = ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  )
  MockLink.displayName = 'Link'
  return MockLink
})

// Mock useTranslation
jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const translations: Record<string, string> = {
        'suggestedNextSteps.title': '학습 진행 상황',
        'suggestedNextSteps.checklist.agent': 'Agent 생성',
        'suggestedNextSteps.checklist.dataset': 'Dataset 생성',
        'suggestedNextSteps.steps.createAgent.title': 'Agent 만들기',
        'suggestedNextSteps.steps.createAgent.description': 'AI Agent를 생성하여 대화형 도우미를 만들어보세요',
        'suggestedNextSteps.steps.createDataset.title': 'RAG 지식베이스 만들기',
        'suggestedNextSteps.steps.createDataset.description': 'Dataset을 생성하여 AI에게 지식을 제공하세요',
        'suggestedNextSteps.steps.connectAll.title': 'Agent와 RAG 연결하기',
        'suggestedNextSteps.steps.connectAll.description': 'Agent에 Dataset을 연결하여 더 똑똑하게 만드세요',
        'suggestedNextSteps.startButton': '시작하기',
      }
      return translations[key] || key
    },
  }),
}))

describe('SuggestedNextSteps', () => {
  it('suggests creating agent when no agents exist', () => {
    render(<SuggestedNextSteps resourceSummary={{ agents: 0, datasets: 0 }} />)

    expect(screen.getByText('학습 진행 상황')).toBeInTheDocument()
    expect(screen.getByText('Agent 만들기')).toBeInTheDocument()
    expect(screen.getByText(/AI Agent를 생성하여/)).toBeInTheDocument()
    expect(screen.getByText('🤖')).toBeInTheDocument()
  })

  it('suggests creating dataset when agents exist but no datasets', () => {
    render(<SuggestedNextSteps resourceSummary={{ agents: 1, datasets: 0 }} />)

    expect(screen.getByText('RAG 지식베이스 만들기')).toBeInTheDocument()
    expect(screen.getByText(/Dataset을 생성하여/)).toBeInTheDocument()
    expect(screen.getByText('📚')).toBeInTheDocument()
  })

  it('suggests connecting all when agents and datasets exist', () => {
    render(<SuggestedNextSteps resourceSummary={{ agents: 1, datasets: 1 }} />)

    expect(screen.getByText('Agent와 RAG 연결하기')).toBeInTheDocument()
    expect(screen.getByText(/Agent에 Dataset을 연결/)).toBeInTheDocument()
    expect(screen.getByText('🔗')).toBeInTheDocument()
  })

  it('displays checklist with completed and incomplete items', () => {
    render(<SuggestedNextSteps resourceSummary={{ agents: 1, datasets: 0 }} />)

    // Check for checklist items
    expect(screen.getByText('Agent 생성')).toBeInTheDocument()
    expect(screen.getByText('Dataset 생성')).toBeInTheDocument()

    // Agent should be checked (✅)
    expect(screen.getByText('✅')).toBeInTheDocument()

    // Dataset should be unchecked (⬜)
    const unchecked = screen.getAllByText('⬜')
    expect(unchecked).toHaveLength(1)
  })

  it('renders start button with correct link', () => {
    render(<SuggestedNextSteps resourceSummary={{ agents: 0, datasets: 0 }} />)

    const startButton = screen.getByText('시작하기')
    expect(startButton).toBeInTheDocument()
    expect(startButton.closest('a')).toHaveAttribute('href', '/agents/create')
  })
})
