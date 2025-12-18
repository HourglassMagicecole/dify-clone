import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { ResourceDeleteDialog } from '@/components/session/ResourceDeleteDialog'
import { sessionAPI } from '@/service/session-api'

// Mock the API
jest.mock('@/service/session-api', () => ({
  sessionAPI: {
    deleteSessionResources: jest.fn(),
    getDeleteStatus: jest.fn(),
  },
}))

// Mock i18next
jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}))

describe('ResourceDeleteDialog', () => {
  const defaultProps = {
    isOpen: true,
    sessionId: 'test-session',
    resourceSummary: { total_apps: 5, total_datasets: 3 },
    onClose: jest.fn(),
    onDeleteComplete: jest.fn(),
  }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should not render when isOpen is false', () => {
    render(
      <ResourceDeleteDialog
        {...defaultProps}
        isOpen={false}
      />,
    )

    expect(screen.queryByText('delete_warning')).not.toBeInTheDocument()
  })

  it('should display confirmation with resource count', () => {
    render(<ResourceDeleteDialog {...defaultProps} />)

    expect(screen.getByText('delete_warning')).toBeInTheDocument()
    expect(screen.getByText(/5/)).toBeInTheDocument()
    expect(screen.getByText(/3/)).toBeInTheDocument()
  })

  it('should display account name when provided', () => {
    render(
      <ResourceDeleteDialog
        {...defaultProps}
        accountId="account-1"
        accountName="Test User"
      />,
    )

    expect(screen.getByText('Test User')).toBeInTheDocument()
  })

  it('should call API when confirm delete is clicked', async () => {
    (sessionAPI.deleteSessionResources as jest.Mock).mockResolvedValue({
      task_id: 'task-123',
      message: 'Started',
    });
    (sessionAPI.getDeleteStatus as jest.Mock).mockResolvedValue({
      status: 'completed',
      result: {
        deleted_apps: 5,
        deleted_datasets: 3,
      },
    })

    render(<ResourceDeleteDialog {...defaultProps} />)

    fireEvent.click(screen.getByText('confirm_delete'))

    await waitFor(() => {
      expect(sessionAPI.deleteSessionResources).toHaveBeenCalledWith(
        'test-session',
        undefined,
      )
    })
  })

  it('should call onClose when cancel is clicked', () => {
    const mockOnClose = jest.fn()

    render(
      <ResourceDeleteDialog
        {...defaultProps}
        onClose={mockOnClose}
      />,
    )

    fireEvent.click(screen.getByText('cancel'))

    expect(mockOnClose).toHaveBeenCalled()
  })

  it('should show progress during deletion', async () => {
    (sessionAPI.deleteSessionResources as jest.Mock).mockResolvedValue({
      task_id: 'task-123',
      message: 'Started',
    });
    (sessionAPI.getDeleteStatus as jest.Mock).mockResolvedValue({
      status: 'progress',
      progress: {
        current: 2,
        total: 8,
        deleted_apps: 2,
        deleted_datasets: 0,
        phase: 'deleting_apps',
      },
    })

    render(<ResourceDeleteDialog {...defaultProps} />)

    fireEvent.click(screen.getByText('confirm_delete'))

    await waitFor(() => {
      expect(screen.getByText('deleting_resources')).toBeInTheDocument()
    })
  })

  it('should show completion results', async () => {
    (sessionAPI.deleteSessionResources as jest.Mock).mockResolvedValue({
      task_id: 'task-123',
      message: 'Started',
    });
    (sessionAPI.getDeleteStatus as jest.Mock).mockResolvedValue({
      status: 'completed',
      result: {
        status: 'completed',
        deleted_apps: 5,
        deleted_datasets: 3,
        verified_tags_remaining: 0,
        errors: [],
      },
    })

    render(<ResourceDeleteDialog {...defaultProps} />)

    fireEvent.click(screen.getByText('confirm_delete'))

    await waitFor(
      () => {
        expect(screen.getByText('delete_completed')).toBeInTheDocument()
      },
      { timeout: 5000 },
    )
  })

  it('should show error state on failure', async () => {
    (sessionAPI.deleteSessionResources as jest.Mock).mockRejectedValue(
      new Error('API Error'),
    )

    render(<ResourceDeleteDialog {...defaultProps} />)

    fireEvent.click(screen.getByText('confirm_delete'))

    await waitFor(() => {
      expect(screen.getByText('delete_failed')).toBeInTheDocument()
    })
  })

  it('should call onDeleteComplete when closing after completion', async () => {
    (sessionAPI.deleteSessionResources as jest.Mock).mockResolvedValue({
      task_id: 'task-123',
      message: 'Started',
    });
    (sessionAPI.getDeleteStatus as jest.Mock).mockResolvedValue({
      status: 'completed',
      result: {
        deleted_apps: 5,
        deleted_datasets: 3,
      },
    })

    const mockOnDeleteComplete = jest.fn()

    render(
      <ResourceDeleteDialog
        {...defaultProps}
        onDeleteComplete={mockOnDeleteComplete}
      />,
    )

    fireEvent.click(screen.getByText('confirm_delete'))

    await waitFor(
      () => {
        expect(screen.getByText('delete_completed')).toBeInTheDocument()
      },
      { timeout: 5000 },
    )

    fireEvent.click(screen.getByText('close'))

    expect(mockOnDeleteComplete).toHaveBeenCalled()
  })
})
