import { render, screen, fireEvent } from '@testing-library/react'
import { AgentCard } from '@/components/agent/AgentCard'
import type { Agent } from '@/types/agent'

// Mock i18n
jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const translations: Record<string, string> = {
        'list.actions.edit': '편집',
        'list.actions.duplicate': '복제',
        'list.actions.delete': '삭제',
        'types.chat.title': '대화형 Agent',
        'types.completion.title': '작업형 Agent',
      }
      return translations[key] || key
    },
  }),
}))

describe('AgentCard', () => {
  const mockAgent: Agent = {
    id: 'test-agent-id',
    name: 'Test Agent',
    description: 'This is a test agent description',
    mode: 'chat',
    icon: '🤖',
    icon_type: 'emoji',
    icon_background: '#3B82F6',
    created_at: 1700000000, // Unix timestamp in seconds (will be multiplied by 1000)
    updated_at: 1700000000,
  }

  const mockOnClick = jest.fn()
  const mockOnEdit = jest.fn()
  const mockOnDuplicate = jest.fn()
  const mockOnDelete = jest.fn()

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('Agent 정보를 렌더링해야 함', () => {
    render(<AgentCard agent={mockAgent} />)

    expect(screen.getByText('Test Agent')).toBeInTheDocument()
    expect(screen.getByText('This is a test agent description')).toBeInTheDocument()
    expect(screen.getByText('🤖')).toBeInTheDocument()
  })

  it('Agent 타입을 표시해야 함 (chat)', () => {
    render(<AgentCard agent={mockAgent} />)
    expect(screen.getByText('대화형 Agent')).toBeInTheDocument()
  })

  it('Agent 타입을 표시해야 함 (completion)', () => {
    const completionAgent = { ...mockAgent, mode: 'completion' as const }
    render(<AgentCard agent={completionAgent} />)
    expect(screen.getByText('작업형 Agent')).toBeInTheDocument()
  })

  it('생성일을 표시해야 함', () => {
    render(<AgentCard agent={mockAgent} />)
    // Created date is formatted as Korean locale with full format
    // created_at is Unix timestamp in seconds, so it's multiplied by 1000
    const createdAtNumber = typeof mockAgent.created_at === 'number' ? mockAgent.created_at : 0
    const date = new Date(createdAtNumber * 1000)
    const dateText = date.toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })
    expect(screen.getByText(dateText)).toBeInTheDocument()
  })

  it('카드 클릭 시 onClick 콜백을 호출해야 함', () => {
    render(<AgentCard agent={mockAgent} onClick={mockOnClick} />)

    const card = screen.getByRole('button')
    fireEvent.click(card)

    expect(mockOnClick).toHaveBeenCalledTimes(1)
  })

  it('Enter 키 입력 시 onClick 콜백을 호출해야 함', () => {
    render(<AgentCard agent={mockAgent} onClick={mockOnClick} />)

    const card = screen.getByRole('button')
    fireEvent.keyDown(card, { key: 'Enter' })

    expect(mockOnClick).toHaveBeenCalledTimes(1)
  })

  it('Space 키 입력 시 onClick 콜백을 호출해야 함', () => {
    render(<AgentCard agent={mockAgent} onClick={mockOnClick} />)

    const card = screen.getByRole('button')
    fireEvent.keyDown(card, { key: ' ' })

    expect(mockOnClick).toHaveBeenCalledTimes(1)
  })

  it('onEdit이 제공되면 편집 버튼을 표시해야 함', () => {
    render(<AgentCard agent={mockAgent} onEdit={mockOnEdit} />)

    expect(screen.getByLabelText('Test Agent Agent 편집')).toBeInTheDocument()
  })

  it('편집 버튼 클릭 시 onEdit 콜백을 호출해야 함', () => {
    render(<AgentCard agent={mockAgent} onEdit={mockOnEdit} />)

    const editButton = screen.getByLabelText('Test Agent Agent 편집')
    fireEvent.click(editButton)

    expect(mockOnEdit).toHaveBeenCalledTimes(1)
    expect(mockOnEdit).toHaveBeenCalledWith('test-agent-id')
  })

  it('편집 버튼 클릭 시 카드 onClick이 호출되지 않아야 함', () => {
    render(<AgentCard agent={mockAgent} onClick={mockOnClick} onEdit={mockOnEdit} />)

    const editButton = screen.getByLabelText('Test Agent Agent 편집')
    fireEvent.click(editButton)

    expect(mockOnEdit).toHaveBeenCalledTimes(1)
    expect(mockOnClick).not.toHaveBeenCalled()
  })

  it('onDuplicate이 제공되면 복제 버튼을 표시해야 함', () => {
    render(<AgentCard agent={mockAgent} onDuplicate={mockOnDuplicate} />)

    expect(screen.getByLabelText('Test Agent Agent 복제')).toBeInTheDocument()
  })

  it('복제 버튼 클릭 시 onDuplicate 콜백을 호출해야 함', () => {
    render(<AgentCard agent={mockAgent} onDuplicate={mockOnDuplicate} />)

    const duplicateButton = screen.getByLabelText('Test Agent Agent 복제')
    fireEvent.click(duplicateButton)

    expect(mockOnDuplicate).toHaveBeenCalledTimes(1)
    expect(mockOnDuplicate).toHaveBeenCalledWith('test-agent-id')
  })

  it('onDelete가 제공되면 삭제 버튼을 표시해야 함', () => {
    render(<AgentCard agent={mockAgent} onDelete={mockOnDelete} />)

    expect(screen.getByLabelText('Test Agent Agent 삭제')).toBeInTheDocument()
  })

  it('삭제 버튼 클릭 시 onDelete 콜백을 호출해야 함', () => {
    render(<AgentCard agent={mockAgent} onDelete={mockOnDelete} />)

    const deleteButton = screen.getByLabelText('Test Agent Agent 삭제')
    fireEvent.click(deleteButton)

    expect(mockOnDelete).toHaveBeenCalledTimes(1)
    expect(mockOnDelete).toHaveBeenCalledWith('test-agent-id')
  })

  it('모든 액션 버튼이 제공되면 모두 표시해야 함', () => {
    render(
      <AgentCard
        agent={mockAgent}
        onEdit={mockOnEdit}
        onDuplicate={mockOnDuplicate}
        onDelete={mockOnDelete}
      />
    )

    expect(screen.getByLabelText('Test Agent Agent 편집')).toBeInTheDocument()
    expect(screen.getByLabelText('Test Agent Agent 복제')).toBeInTheDocument()
    expect(screen.getByLabelText('Test Agent Agent 삭제')).toBeInTheDocument()
  })

  it('액션 버튼이 제공되지 않으면 표시하지 않아야 함', () => {
    render(<AgentCard agent={mockAgent} />)

    expect(screen.queryByLabelText(/편집/)).not.toBeInTheDocument()
    expect(screen.queryByLabelText(/복제/)).not.toBeInTheDocument()
    expect(screen.queryByLabelText(/삭제/)).not.toBeInTheDocument()
  })

  it('설명이 없는 Agent도 렌더링해야 함', () => {
    const agentWithoutDescription: Agent = { ...mockAgent, description: '' }
    render(<AgentCard agent={agentWithoutDescription} />)

    expect(screen.getByText('Test Agent')).toBeInTheDocument()
    expect(screen.queryByText('This is a test agent description')).not.toBeInTheDocument()
  })

  it('아이콘 배경색이 적용되어야 함', () => {
    const { container } = render(<AgentCard agent={mockAgent} />)

    const iconDiv = container.querySelector('[style*="background"]')
    expect(iconDiv).toHaveStyle({ backgroundColor: '#3B82F6' })
  })
})
