import { render, screen } from '@testing-library/react';
import { EditAPIKeyModal } from '@/components/api-keys/EditAPIKeyModal';
import type { APIKeyConfig } from '@/types/api-key';

// Mock react-i18next
jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

// Mock API service
jest.mock('@/service/api-key-api', () => ({
  updateAPIKey: jest.fn(),
}));

describe('EditAPIKeyModal', () => {
  const mockApiKey: APIKeyConfig = {
    id: 'test-key-id',
    key_name: 'Test API Key',
    provider: 'openai',
    api_key_masked: 'sk-proj****ABCD',
    is_active: true,
    priority: 'primary',
    created_at: '2025-10-26T00:00:00Z',
    updated_at: '2025-10-26T00:00:00Z',
  };

  const mockOnClose = jest.fn();
  const mockOnSuccess = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('모달이 열려있을 때 렌더링되어야 함', () => {
    const { container } = render(
      <EditAPIKeyModal
        apiKey={mockApiKey}
        isOpen={true}
        onClose={mockOnClose}
        onSuccess={mockOnSuccess}
      />
    );

    // Modal should be rendered with form
    expect(container.querySelector('form')).toBeInTheDocument();
  });

  it('모달이 닫혀있을 때 렌더링되지 않아야 함', () => {
    const { container } = render(
      <EditAPIKeyModal
        apiKey={mockApiKey}
        isOpen={false}
        onClose={mockOnClose}
        onSuccess={mockOnSuccess}
      />
    );

    expect(container.querySelector('form')).not.toBeInTheDocument();
  });

  it('Key 이름 입력 필드가 기본값으로 표시되어야 함', () => {
    render(
      <EditAPIKeyModal
        apiKey={mockApiKey}
        isOpen={true}
        onClose={mockOnClose}
        onSuccess={mockOnSuccess}
      />
    );

    // Key name input should have default value
    const inputElement = screen.getByDisplayValue('Test API Key');
    expect(inputElement).toBeInTheDocument();
  });
});
