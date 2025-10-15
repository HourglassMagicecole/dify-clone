'use client';

import React from 'react';
import { useTranslation } from 'react-i18next';
import { Dropdown } from './Dropdown';
import { DropdownItem } from './DropdownItem';
import type { SupportedLanguage, LanguageOption } from '@/types/user';

const LANGUAGE_OPTIONS: LanguageOption[] = [
  { code: 'ko-KR', label: '한국어', flag: '🇰🇷' },
  { code: 'en-US', label: 'English', flag: '🇺🇸' },
];

/**
 * LanguageSelector component for selecting UI language
 *
 * Features:
 * - Display current language with flag
 * - Toggle between Korean and English
 * - Save preference to localStorage
 * - Update all i18n texts immediately
 */
export function LanguageSelector() {
  const { i18n } = useTranslation('navigation');
  const currentLanguage = i18n.language as SupportedLanguage;

  const handleLanguageChange = (languageCode: SupportedLanguage) => {
    i18n.changeLanguage(languageCode);
    // Save to localStorage (persist across sessions)
    if (typeof window !== 'undefined') {
      localStorage.setItem('preferred_language', languageCode);
    }
  };

  const currentLanguageOption =
    LANGUAGE_OPTIONS.find((lang) => lang.code === currentLanguage) || LANGUAGE_OPTIONS[0];

  return (
    <Dropdown
      trigger={
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-gray-100 transition-colors">
          <span>{currentLanguageOption?.flag}</span>
          <span className="text-sm font-medium">{currentLanguageOption?.label}</span>
        </div>
      }
      align="right"
    >
      {LANGUAGE_OPTIONS.map((lang) => (
        <DropdownItem
          key={lang.code}
          label={lang.label}
          icon={<span>{lang.flag}</span>}
          onClick={() => handleLanguageChange(lang.code)}
        />
      ))}
    </Dropdown>
  );
}
