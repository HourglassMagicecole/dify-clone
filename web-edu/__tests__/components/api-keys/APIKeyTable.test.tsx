import { render, screen } from '@testing-library/react';
import { APIKeyTable } from '@/components/api-keys/APIKeyTable';
import type { APIKeyConfig } from '@/types/api-key';

// Mock react-i18next
jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

// Mock APIKeyRow component
jest.mock('@/components/api-keys/APIKeyRow', () => ({
  APIKeyRow: ({ apiKey }: { apiKey: APIKeyConfig }) => (
    <tr data-testid={`api-key-row-${apiKey.id}`}>
      <td>{apiKey.key_name}</td>
    </tr>
  ),
}));

describe('APIKeyTable', () => {
  const mockOnEdit = jest.fn();
  const mockOnDelete = jest.fn();
  const mockOnTest = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('로딩 중일 때 로딩 스피너를 표시해야 함', () => {
    render(
      <APIKeyTable
        apiKeys={undefined}
        isLoading={true}
        onEdit={mockOnEdit}
        onDelete={mockOnDelete}
        onTest={mockOnTest}
      />
    );

    expect(screen.getByText('table.loading')).toBeInTheDocument();
  });

  it('API Key가 없을 때 빈 상태 메시지를 표시해야 함', () => {
    render(
      <APIKeyTable
        apiKeys={[]}
        isLoading={false}
        onEdit={mockOnEdit}
        onDelete={mockOnDelete}
        onTest={mockOnTest}
      />
    );

    expect(screen.getByText('table.noKeys')).toBeInTheDocument();
    expect(screen.getByText('table.noKeysDescription')).toBeInTheDocument();
  });

  it('API Key 목록을 테이블로 렌더링해야 함', () => {
    const mockApiKeys: APIKeyConfig[] = [
      {
        id: 'key-1',
        key_name: 'Test Key 1',
        provider: 'openai',
        api_key_masked: 'sk-proj****ABCD',
        is_active: true,
        priority: 'primary',
        created_at: '2025-10-26T00:00:00Z',
        updated_at: '2025-10-26T00:00:00Z',
      },
      {
        id: 'key-2',
        key_name: 'Test Key 2',
        provider: 'anthropic',
        api_key_masked: 'sk-ant****EFGH',
        is_active: false,
        priority: 'secondary',
        created_at: '2025-10-26T00:00:00Z',
        updated_at: '2025-10-26T00:00:00Z',
      },
    ];

    render(
      <APIKeyTable
        apiKeys={mockApiKeys}
        isLoading={false}
        onEdit={mockOnEdit}
        onDelete={mockOnDelete}
        onTest={mockOnTest}
      />
    );

    // Check that table is rendered
    expect(screen.getByRole('table')).toBeInTheDocument();

    // Check that rows are rendered
    expect(screen.getByTestId('api-key-row-key-1')).toBeInTheDocument();
    expect(screen.getByTestId('api-key-row-key-2')).toBeInTheDocument();
  });
});
