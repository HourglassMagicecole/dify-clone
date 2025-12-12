import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { ModelToggle } from '@/components/model/ModelToggle'

// Mock react-i18next
jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}))

describe('ModelToggle', () => {
  const defaultProps = {
    modelName: 'gpt-4',
    modelLabel: 'GPT-4',
    modelType: 'llm',
    enabled: true,
    onToggle: jest.fn().mockResolvedValue(true),
  }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should render model information', () => {
    render(<ModelToggle {...defaultProps} />)

    expect(screen.getByText('GPT-4')).toBeInTheDocument()
    expect(screen.getByText('gpt-4')).toBeInTheDocument()
    expect(screen.getByText('llm')).toBeInTheDocument()
  })

  it('should render toggle switch with correct initial state', () => {
    render(<ModelToggle {...defaultProps} />)

    const toggle = screen.getByRole('switch')
    expect(toggle).toHaveAttribute('aria-checked', 'true')
  })

  it('should render toggle switch as disabled when enabled is false', () => {
    render(<ModelToggle {...defaultProps} enabled={false} />)

    const toggle = screen.getByRole('switch')
    expect(toggle).toHaveAttribute('aria-checked', 'false')
  })

  it('should call onToggle when clicked', async () => {
    render(<ModelToggle {...defaultProps} />)

    const toggle = screen.getByRole('switch')
    fireEvent.click(toggle)

    await waitFor(() => {
      expect(defaultProps.onToggle).toHaveBeenCalledWith(false) // toggling from true to false
    })
  })

  it('should show success feedback after successful toggle', async () => {
    render(<ModelToggle {...defaultProps} />)

    const toggle = screen.getByRole('switch')
    fireEvent.click(toggle)

    await waitFor(() => {
      expect(screen.getByText('models.toggle.success')).toBeInTheDocument()
    })
  })

  it('should show error feedback after failed toggle', async () => {
    const failingOnToggle = jest.fn().mockResolvedValue(false)
    render(<ModelToggle {...defaultProps} onToggle={failingOnToggle} />)

    const toggle = screen.getByRole('switch')
    fireEvent.click(toggle)

    await waitFor(() => {
      expect(screen.getByText('models.toggle.error')).toBeInTheDocument()
    })
  })

  it('should be disabled when disabled prop is true', () => {
    render(<ModelToggle {...defaultProps} disabled={true} />)

    const toggle = screen.getByRole('switch')
    expect(toggle).toBeDisabled()
  })

  it('should not call onToggle when disabled', () => {
    render(<ModelToggle {...defaultProps} disabled={true} />)

    const toggle = screen.getByRole('switch')
    fireEvent.click(toggle)

    expect(defaultProps.onToggle).not.toHaveBeenCalled()
  })

  it('should have correct aria-label', () => {
    render(<ModelToggle {...defaultProps} />)

    const toggle = screen.getByRole('switch')
    expect(toggle).toHaveAttribute('aria-label', 'models.toggle.ariaLabel')
  })
})
