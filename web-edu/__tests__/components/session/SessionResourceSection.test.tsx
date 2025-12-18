import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { SessionResourceSection } from '@/components/session/SessionResourceSection'
import { sessionAPI } from '@/service/session-api'

// Mock the API
jest.mock('@/service/session-api', () => ({
  sessionAPI: {
    getSessionResources: jest.fn(),
    getResourceAccounts: jest.fn(),
  },
}))

// Mock i18next
jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}))

const mockResources = {
  apps: [
    {
      resource_id: 'app-1',
      resource_name: 'Test App 1',
      account_id: 'account-1',
      account_name: 'User 1',
      account_email: 'user1@example.com',
      tagged_at: '2025-12-17T10:00:00Z',
      created_at: '2025-12-17T09:00:00Z',
    },
  ],
  datasets: [
    {
      resource_id: 'dataset-1',
      resource_name: 'Test Dataset 1',
      account_id: 'account-2',
      account_name: 'User 2',
      account_email: 'user2@example.com',
      tagged_at: '2025-12-17T11:00:00Z',
      created_at: '2025-12-17T08:00:00Z',
    },
  ],
  summary: {
    total_apps: 1,
    total_datasets: 1,
  },
}

const mockAccounts = [
  { account_id: 'account-1', name: 'User 1', email: 'user1@example.com' },
  { account_id: 'account-2', name: 'User 2', email: 'user2@example.com' },
]

describe('SessionResourceSection', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should display loading state initially', () => {
    (sessionAPI.getSessionResources as jest.Mock).mockImplementation(
      () => new Promise(() => {}),
    );
    (sessionAPI.getResourceAccounts as jest.Mock).mockImplementation(
      () => new Promise(() => {}),
    )

    render(
      <SessionResourceSection
        sessionId="test-session"
        onDeleteRequest={jest.fn()}
      />,
    )

    expect(screen.getByText('loading')).toBeInTheDocument()
  })

  it('should display resource summary after loading', async () => {
    (sessionAPI.getSessionResources as jest.Mock).mockResolvedValue(mockResources);
    (sessionAPI.getResourceAccounts as jest.Mock).mockResolvedValue(mockAccounts)

    render(
      <SessionResourceSection
        sessionId="test-session"
        onDeleteRequest={jest.fn()}
      />,
    )

    await waitFor(() => {
      // Check that the summary cards show the counts
      const summaryCards = screen.getAllByText('1')
      expect(summaryCards.length).toBeGreaterThanOrEqual(2) // 1 app + 1 dataset
    })
  })

  it('should display app and dataset lists', async () => {
    (sessionAPI.getSessionResources as jest.Mock).mockResolvedValue(mockResources);
    (sessionAPI.getResourceAccounts as jest.Mock).mockResolvedValue(mockAccounts)

    render(
      <SessionResourceSection
        sessionId="test-session"
        onDeleteRequest={jest.fn()}
      />,
    )

    await waitFor(() => {
      expect(screen.getByText('Test App 1')).toBeInTheDocument()
      expect(screen.getByText('Test Dataset 1')).toBeInTheDocument()
    })
  })

  it('should filter resources by selected account', async () => {
    (sessionAPI.getSessionResources as jest.Mock).mockResolvedValue(mockResources);
    (sessionAPI.getResourceAccounts as jest.Mock).mockResolvedValue(mockAccounts)

    render(
      <SessionResourceSection
        sessionId="test-session"
        onDeleteRequest={jest.fn()}
      />,
    )

    await waitFor(() => {
      expect(screen.getByText('Test App 1')).toBeInTheDocument()
    })

    // Search for a specific account using the search input
    const searchInput = screen.getByPlaceholderText('search_creator_placeholder')
    fireEvent.focus(searchInput)
    fireEvent.change(searchInput, { target: { value: 'User 1' } })

    // Click on the account in dropdown
    await waitFor(() => {
      expect(screen.getByText('user1@example.com')).toBeInTheDocument()
    })
    fireEvent.click(screen.getByText('user1@example.com'))

    // After filtering, only the app from account-1 should be visible
    await waitFor(() => {
      expect(screen.getByText('Test App 1')).toBeInTheDocument()
      expect(screen.queryByText('Test Dataset 1')).not.toBeInTheDocument()
    })
  })

  it('should call onDeleteRequest when delete button is clicked', async () => {
    (sessionAPI.getSessionResources as jest.Mock).mockResolvedValue(mockResources);
    (sessionAPI.getResourceAccounts as jest.Mock).mockResolvedValue(mockAccounts)

    const mockOnDeleteRequest = jest.fn()

    render(
      <SessionResourceSection
        sessionId="test-session"
        onDeleteRequest={mockOnDeleteRequest}
      />,
    )

    await waitFor(() => {
      expect(screen.getByText('delete_all_resources')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByText('delete_all_resources'))

    expect(mockOnDeleteRequest).toHaveBeenCalledWith(
      undefined,
      undefined,
      { total_apps: 1, total_datasets: 1 },
    )
  })

  it('should display empty state when no resources', async () => {
    (sessionAPI.getSessionResources as jest.Mock).mockResolvedValue({
      apps: [],
      datasets: [],
      summary: { total_apps: 0, total_datasets: 0 },
    });
    (sessionAPI.getResourceAccounts as jest.Mock).mockResolvedValue([])

    render(
      <SessionResourceSection
        sessionId="test-session"
        onDeleteRequest={jest.fn()}
      />,
    )

    await waitFor(() => {
      expect(screen.getByText('no_resources')).toBeInTheDocument()
    })
  })

  it('should display error state on API failure', async () => {
    (sessionAPI.getSessionResources as jest.Mock).mockRejectedValue(
      new Error('API Error'),
    );
    (sessionAPI.getResourceAccounts as jest.Mock).mockRejectedValue(
      new Error('API Error'),
    )

    render(
      <SessionResourceSection
        sessionId="test-session"
        onDeleteRequest={jest.fn()}
      />,
    )

    await waitFor(() => {
      expect(screen.getByText(/error_prefix/)).toBeInTheDocument()
    })
  })
})
