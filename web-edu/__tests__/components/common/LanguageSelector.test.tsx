import { render, screen, fireEvent } from '@testing-library/react';
import { LanguageSelector } from '@/components/common/LanguageSelector';
import { useTranslation } from 'react-i18next';

// Mock react-i18next
jest.mock('react-i18next', () => ({
  useTranslation: jest.fn(),
}));

describe('LanguageSelector', () => {
  const mockChangeLanguage = jest.fn();
  const mockT = jest.fn((key: string) => key);

  beforeEach(() => {
    jest.clearAllMocks();
    (useTranslation as jest.Mock).mockReturnValue({
      i18n: { language: 'ko-KR', changeLanguage: mockChangeLanguage },
      t: mockT,
    });
  });

  it('현재 언어가 표시되어야 함', () => {
    render(<LanguageSelector />);
    expect(screen.getByText('한국어')).toBeInTheDocument();
    expect(screen.getByText('🇰🇷')).toBeInTheDocument();
  });

  it('드롭다운을 클릭하면 언어 옵션이 표시되어야 함', () => {
    render(<LanguageSelector />);

    const trigger = screen.getByText('한국어');
    fireEvent.click(trigger);

    // 두 번째 "한국어"와 "English"가 드롭다운 메뉴에 표시됨
    const items = screen.getAllByText('한국어');
    expect(items.length).toBeGreaterThan(1);
    expect(screen.getByText('English')).toBeInTheDocument();
  });

  it('언어 선택 시 i18n.changeLanguage가 호출되어야 함', () => {
    render(<LanguageSelector />);

    // 드롭다운 열기
    fireEvent.click(screen.getByText('한국어'));

    // English 선택
    fireEvent.click(screen.getByText('English'));

    expect(mockChangeLanguage).toHaveBeenCalledWith('en-US');
  });

  it('선택한 언어가 로컬 스토리지에 저장되어야 함', () => {
    const setItemSpy = jest.spyOn(Storage.prototype, 'setItem');

    render(<LanguageSelector />);

    // 드롭다운 열기
    fireEvent.click(screen.getByText('한국어'));

    // English 선택
    fireEvent.click(screen.getByText('English'));

    expect(setItemSpy).toHaveBeenCalledWith('preferred_language', 'en-US');

    setItemSpy.mockRestore();
  });

  it('현재 언어가 영어일 때 English가 표시되어야 함', () => {
    (useTranslation as jest.Mock).mockReturnValue({
      i18n: { language: 'en-US', changeLanguage: mockChangeLanguage },
      t: mockT,
    });

    render(<LanguageSelector />);
    expect(screen.getByText('English')).toBeInTheDocument();
    expect(screen.getByText('🇺🇸')).toBeInTheDocument();
  });

  it('한국어를 선택하면 i18n.changeLanguage가 ko-KR로 호출되어야 함', () => {
    (useTranslation as jest.Mock).mockReturnValue({
      i18n: { language: 'en-US', changeLanguage: mockChangeLanguage },
      t: mockT,
    });

    render(<LanguageSelector />);

    // 드롭다운 열기
    fireEvent.click(screen.getByText('English'));

    // 한국어 선택
    const koreanOptions = screen.getAllByText('한국어');
    fireEvent.click(koreanOptions[koreanOptions.length - 1]!); // 마지막 "한국어" (드롭다운 메뉴 아이템)

    expect(mockChangeLanguage).toHaveBeenCalledWith('ko-KR');
  });
});
