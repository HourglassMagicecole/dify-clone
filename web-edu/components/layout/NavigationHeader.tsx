'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useTranslation } from 'react-i18next';
import { UserAvatar } from '@/components/common/UserAvatar';
import { Dropdown } from '@/components/common/Dropdown';
import { DropdownItem } from '@/components/common/DropdownItem';
import { LanguageSelector } from '@/components/common/LanguageSelector';
import { useAuth } from '@/hooks/useAuth';

/**
 * NavigationHeader component displays the main navigation bar
 *
 * Features:
 * - Display user information (name, avatar)
 * - User dropdown menu (profile, settings, sign out)
 * - Language selector
 * - Main navigation links (dashboard, agents, workflows, datasets)
 * - Loading state indication
 * - Responsive layout (mobile, tablet, desktop)
 */
export function NavigationHeader() {
  const { t } = useTranslation(['navigation', 'common']);
  const { user, isLoading, signOut } = useAuth();
  const [isMounted, setIsMounted] = useState(false);

  // Prevent hydration mismatch by only rendering after client mount
  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Don't render on server or before mount
  if (!isMounted) {
    return (
      <header className="bg-white border-b border-gray-200">
        <div className="px-4 py-3">
          <div className="flex items-center justify-end">
            <div className="text-sm text-gray-500">Loading...</div>
          </div>
        </div>
      </header>
    );
  }

  // Loading state display (AC: 7)
  if (isLoading) {
    return (
      <header className="bg-white border-b border-gray-200">
        <div className="px-4 py-3">
          <div className="flex items-center justify-end">
            <div className="text-sm text-gray-500">{t('header.loading')}</div>
          </div>
        </div>
      </header>
    );
  }

  if (!user) {
    return null; // Don't display header if not logged in
  }

  const handleSignOut = () => {
    signOut();
  };

  const handleProfileClick = () => {
    // TODO: Implement profile navigation
  };

  const handleSettingsClick = () => {
    // TODO: Implement settings navigation
  };

  return (
    <header className="bg-white border-b border-gray-200">
      {/* Top bar: Logo + Language + User */}
      <div className="px-4 md:px-6 lg:px-8 py-3 border-b border-gray-100">
        <div className="flex items-center justify-between max-w-7xl mx-auto">
          {/* Logo section */}
          <div className="flex items-center gap-4">
            <h1 className="text-xl font-bold text-primary-600">EduAI Studio</h1>
          </div>

          {/* Right menu section */}
          <div className="flex items-center gap-4">
            {/* Language selector (AC: 4) */}
            <LanguageSelector />

            {/* User menu (AC: 1, 2) */}
            <Dropdown
              trigger={
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-gray-100 transition-colors">
                  <UserAvatar name={user.name} avatarUrl={user.avatar || undefined} size="sm" />
                  <span className="text-sm font-medium hidden md:inline">{user.name}</span>
                </div>
              }
              align="right"
            >
              <DropdownItem
                label={t('header.userMenu.profile')}
                onClick={handleProfileClick}
              />
              <DropdownItem
                label={t('header.userMenu.settings')}
                onClick={handleSettingsClick}
                divider
              />
              <DropdownItem
                label={t('header.userMenu.signOut')}
                onClick={handleSignOut}
              />
            </Dropdown>
          </div>
        </div>
      </div>

      {/* Bottom bar: Main navigation */}
      <nav className="px-4 md:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="flex h-12 items-center space-x-8">
            <Link
              href="/dashboard"
              className="inline-flex items-center border-b-2 border-transparent px-1 pt-1 text-sm font-medium text-gray-500 hover:border-gray-300 hover:text-gray-700"
            >
              {t('common:nav.dashboard')}
            </Link>
            <Link
              href="/agents"
              className="inline-flex items-center border-b-2 border-transparent px-1 pt-1 text-sm font-medium text-gray-500 hover:border-gray-300 hover:text-gray-700"
            >
              {t('common:nav.agents')}
            </Link>
            <Link
              href="/workflows"
              className="inline-flex items-center border-b-2 border-transparent px-1 pt-1 text-sm font-medium text-gray-500 hover:border-gray-300 hover:text-gray-700"
            >
              {t('common:nav.workflows')}
            </Link>
            <Link
              href="/datasets"
              className="inline-flex items-center border-b-2 border-transparent px-1 pt-1 text-sm font-medium text-gray-500 hover:border-gray-300 hover:text-gray-700"
            >
              {t('common:nav.datasets')}
            </Link>
          </div>
        </div>
      </nav>
    </header>
  );
}
