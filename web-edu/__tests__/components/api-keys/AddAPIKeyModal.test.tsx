import { render, screen } from '@testing-library/react';
import { AddAPIKeyModal } from '@/components/api-keys/AddAPIKeyModal';

// Mock react-i18next
jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

// Mock API service
jest.mock('@/service/api-key-api', () => ({
  createAPIKey: jest.fn(),
}));

describe('AddAPIKeyModal', () => {
  const mockOnClose = jest.fn();
  const mockOnSuccess = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('모달이 열려있을 때 렌더링되어야 함', () => {
    const { container } = render(
      <AddAPIKeyModal
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
      <AddAPIKeyModal
        isOpen={false}
        onClose={mockOnClose}
        onSuccess={mockOnSuccess}
      />
    );

    expect(container.querySelector('form')).not.toBeInTheDocument();
  });

  it('Provider 선택 드롭다운이 표시되어야 함', () => {
    render(
      <AddAPIKeyModal
        isOpen={true}
        onClose={mockOnClose}
        onSuccess={mockOnSuccess}
      />
    );

    // Provider select should be rendered
    const selectElement = screen.getByRole('combobox', { name: /provider/i });
    expect(selectElement).toBeInTheDocument();
  });
});
