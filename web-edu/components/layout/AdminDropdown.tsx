'use client'

import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import { useTranslation } from 'react-i18next'
import { ChevronDownIcon } from '@heroicons/react/24/outline'

interface AdminDropdownProps {
  isOwner: boolean
}

/**
 * 관리 드롭다운 메뉴 컴포넌트
 * AC: 5, 6, 7 - Sessions, Users, API Keys, Monitoring 통합
 */
export function AdminDropdown({ isOwner }: AdminDropdownProps) {
  const { t } = useTranslation('common')
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // 외부 클릭 시 드롭다운 닫기
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const menuItems = [
    { href: '/admin/sessions', label: t('nav.sessions'), showFor: 'all' as const },
    { href: '/admin/users', label: t('nav.users'), showFor: 'all' as const },
    { href: '/admin/usage-analytics', label: t('nav.system_usage'), showFor: 'owner' as const },
    { href: '/admin/api-keys', label: t('nav.api_keys'), showFor: 'owner' as const },
    { href: '/owner/price-configs', label: t('nav.price_configs'), showFor: 'owner' as const },
    { href: '/owner/monitoring', label: t('nav.monitoring'), showFor: 'owner' as const },
  ]

  const visibleItems = menuItems.filter(
    (item) => item.showFor === 'all' || (item.showFor === 'owner' && isOwner)
  )

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="inline-flex items-center gap-1 border-b-2 border-transparent px-1 pt-1 text-sm font-medium text-gray-500 hover:border-gray-300 hover:text-gray-700"
      >
        {t('nav.admin')}
        <ChevronDownIcon
          className={`h-4 w-4 transition-transform ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>

      {isOpen && (
        <div className="absolute left-0 top-full mt-1 w-48 rounded-md bg-white shadow-lg ring-1 ring-black ring-opacity-5 z-50">
          <div className="py-1">
            {visibleItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setIsOpen(false)}
                className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
              >
                {item.label}
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
