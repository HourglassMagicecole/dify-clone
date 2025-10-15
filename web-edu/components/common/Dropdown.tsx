'use client';

import React, { useState, useRef, useEffect } from 'react';

interface DropdownProps {
  trigger: React.ReactNode; // Trigger element that opens the dropdown
  children: React.ReactNode; // Dropdown menu content
  align?: 'left' | 'right'; // Alignment direction
  className?: string;
}

/**
 * Dropdown component for creating dropdown menus
 *
 * Features:
 * - Click trigger to toggle dropdown
 * - Click outside to close dropdown
 * - Customizable alignment (left/right)
 *
 * @param trigger - Element that opens the dropdown when clicked
 * @param children - Menu items to display in dropdown
 * @param align - Alignment direction (left or right) - default: right
 * @param className - Additional CSS classes
 */
export function Dropdown({
  trigger,
  children,
  align = 'right',
  className = '',
}: DropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  const alignmentClass = align === 'right' ? 'right-0' : 'left-0';

  return (
    <div ref={dropdownRef} className={`relative ${className}`}>
      <div onClick={() => setIsOpen(!isOpen)} className="cursor-pointer">
        {trigger}
      </div>

      {isOpen && (
        <div
          className={`absolute ${alignmentClass} mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 z-50`}
        >
          {children}
        </div>
      )}
    </div>
  );
}
