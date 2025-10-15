/**
 * User-related TypeScript type definitions for Navigation Header
 *
 * This file contains type definitions for:
 * - User basic information (UserInfo)
 * - Dropdown menu items (DropdownMenuItem)
 * - Supported languages (SupportedLanguage)
 * - Language options (LanguageOption)
 */

import type React from 'react';

/**
 * User basic information type
 */
export interface UserInfo {
  id: string;
  email: string;
  name: string;
  avatarUrl?: string; // Avatar image URL (optional)
}

/**
 * Dropdown menu item type
 */
export interface DropdownMenuItem {
  id: string;
  label: string; // Display text (i18n key)
  icon?: React.ReactNode; // Icon component (optional)
  onClick: () => void; // Click handler
  divider?: boolean; // Show divider below (optional)
}

/**
 * Supported language type
 */
export type SupportedLanguage = 'ko-KR' | 'en-US';

/**
 * Language option type
 */
export interface LanguageOption {
  code: SupportedLanguage;
  label: string; // Display text (e.g., "한국어", "English")
  flag?: string; // Flag emoji (optional)
}
