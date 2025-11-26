/**
 * Tests for AgentThoughtTimeline component (Task 10.2)
 */

import React from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AgentThoughtTimeline } from '@/components/agent/AgentThoughtTimeline'
import type { AgentThought } from '@/types/agent'

// Mock react-i18next
jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const translations: Record<string, string> = {
        'execute.timeline.empty': 'Agent 실행 시 처리 단계가 여기에 표시됩니다',
        'execute.timeline.thought': 'Agent 사고',
        'execute.timeline.input': '입력',
        'execute.timeline.output': '출력',
        'execute.timeline.whyButton': 'Why?',
      }
      return translations[key] || key
    },
  }),
}))

describe('AgentThoughtTimeline', () => {
  const mockThoughts: AgentThought[] = [
    {
      id: 'thought-1',
      thought: 'I need to search for information',
      tool: 'google_search',
      tool_input: { query: 'AI trends 2024' },
      tool_output: 'Search results: AI is evolving rapidly...',
      observation: 'Successfully retrieved search results',
      created_at: Date.now() - 5000,
    },
    {
      id: 'thought-2',
      thought: 'Now I will summarize the findings',
      tool: 'summarizer',
      tool_input: { text: 'AI is evolving rapidly...' },
      tool_output: 'Summary: AI trends include...',
      observation: 'Summarization completed',
      created_at: Date.now() - 2000,
    },
    {
      id: 'thought-3',
      thought: 'Final thought without tool',
      tool: null,
      tool_input: {},
      tool_output: null,
      observation: '',
      created_at: Date.now() - 1000,
    },
  ]

  describe('Rendering', () => {
    it('should render empty state when no thoughts provided', () => {
      render(<AgentThoughtTimeline thoughts={[]} />)

      expect(screen.getByText(/Agent 실행 시 처리 단계가 여기에 표시됩니다/)).toBeInTheDocument()
    })

    it('should render all thoughts in timeline', () => {
      render(<AgentThoughtTimeline thoughts={mockThoughts} />)

      expect(screen.getByText('I need to search for information')).toBeInTheDocument()
      expect(screen.getByText('Now I will summarize the findings')).toBeInTheDocument()
      expect(screen.getByText('Final thought without tool')).toBeInTheDocument()
    })

    it('should render tool information when present', () => {
      render(<AgentThoughtTimeline thoughts={mockThoughts} />)

      expect(screen.getByText(/google_search/)).toBeInTheDocument()
      expect(screen.getByText(/summarizer/)).toBeInTheDocument()
    })

    it('should not render tool card for thoughts without tools', () => {
      const thoughtsWithoutTool: AgentThought[] = [
        {
          id: 'thought-1',
          thought: 'Just thinking',
          tool: null,
          tool_input: {},
          tool_output: null,
          observation: '',
          created_at: Date.now(),
        },
      ]

      render(<AgentThoughtTimeline thoughts={thoughtsWithoutTool} />)

      expect(screen.getByText('Just thinking')).toBeInTheDocument()
      // Should not render tool-related elements
      expect(screen.queryByText(/입력/)).not.toBeInTheDocument()
    })
  })

  describe('Tool Input/Output Expansion', () => {
    it('should toggle tool input visibility when clicked', async () => {
      const user = userEvent.setup()
      render(<AgentThoughtTimeline thoughts={mockThoughts} />)

      // Find all input buttons
      const inputButtons = screen.getAllByRole('button', { name: /입력/ })
      const firstInputButton = inputButtons[0]

      // Initially, detailed input should not be visible
      expect(screen.queryByText(/"query"/)).not.toBeInTheDocument()

      // Click to expand
      await user.click(firstInputButton)

      // Now input should be visible
      expect(screen.getByText(/"query"/)).toBeInTheDocument()
      expect(screen.getByText(/"AI trends 2024"/)).toBeInTheDocument()

      // Click to collapse
      await user.click(firstInputButton)

      // Input should be hidden again
      expect(screen.queryByText(/"query"/)).not.toBeInTheDocument()
    })

    it('should toggle tool output visibility when clicked', async () => {
      const user = userEvent.setup()
      render(<AgentThoughtTimeline thoughts={mockThoughts} />)

      // Find all output buttons
      const outputButtons = screen.getAllByRole('button', { name: /출력/ })
      const firstOutputButton = outputButtons[0]

      // Initially, detailed output should not be visible
      expect(screen.queryByText(/Search results: AI is evolving rapidly.../)).not.toBeInTheDocument()

      // Click to expand
      await user.click(firstOutputButton)

      // Now output should be visible
      expect(screen.getByText(/Search results: AI is evolving rapidly.../)).toBeInTheDocument()

      // Click to collapse
      await user.click(firstOutputButton)

      // Output should be hidden again
      expect(screen.queryByText(/Search results: AI is evolving rapidly.../)).not.toBeInTheDocument()
    })

    it('should handle multiple expanded items independently', async () => {
      const user = userEvent.setup()
      render(<AgentThoughtTimeline thoughts={mockThoughts} />)

      const inputButtons = screen.getAllByRole('button', { name: /입력/ })

      // Expand first input
      await user.click(inputButtons[0])
      expect(screen.getByText(/"query"/)).toBeInTheDocument()

      // Expand second input
      await user.click(inputButtons[1])
      expect(screen.getByText(/"text"/)).toBeInTheDocument()

      // Both should be visible
      expect(screen.getByText(/"query"/)).toBeInTheDocument()
      expect(screen.getByText(/"text"/)).toBeInTheDocument()
    })
  })

  describe('Why Button', () => {
    it('should render Why button when onWhyClick is provided', () => {
      const mockOnWhyClick = jest.fn()
      render(<AgentThoughtTimeline thoughts={mockThoughts} onWhyClick={mockOnWhyClick} />)

      const whyButtons = screen.getAllByRole('button', { name: /Why\?/ })
      expect(whyButtons).toHaveLength(2) // Only for thoughts with tools
    })

    it('should not render Why button when onWhyClick is not provided', () => {
      render(<AgentThoughtTimeline thoughts={mockThoughts} />)

      expect(screen.queryByRole('button', { name: /Why\?/ })).not.toBeInTheDocument()
    })

    it('should call onWhyClick with correct thought when clicked', async () => {
      const user = userEvent.setup()
      const mockOnWhyClick = jest.fn()
      render(<AgentThoughtTimeline thoughts={mockThoughts} onWhyClick={mockOnWhyClick} />)

      const whyButtons = screen.getAllByRole('button', { name: /Why\?/ })
      await user.click(whyButtons[0])

      expect(mockOnWhyClick).toHaveBeenCalledWith(mockThoughts[0])
    })
  })

  describe('Time Formatting', () => {
    it('should display relative time correctly', () => {
      const recentThought: AgentThought[] = [
        {
          id: 'thought-1',
          thought: 'Recent thought',
          tool: null,
          tool_input: {},
          tool_output: null,
          observation: '',
          created_at: Date.now() - 30000, // 30 seconds ago
        },
      ]

      render(<AgentThoughtTimeline thoughts={recentThought} />)

      // Check for relative time display (30초 전)
      expect(screen.getByText(/30초 전/)).toBeInTheDocument()
    })
  })

})
