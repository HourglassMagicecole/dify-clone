'use client';

import React from 'react';

interface DropdownItemProps {
  label: string;
  icon?: React.ReactNode;
  onClick: () => void;
  divider?: boolean; // Show divider below item
  className?: string;
}

/**
 * DropdownItem component for individual menu items in dropdown
 *
 * Features:
 * - Displays label and optional icon
 * - Handles click events
 * - Optional divider below item
 *
 * @param label - Text label for the item
 * @param icon - Optional icon element
 * @param onClick - Click handler function
 * @param divider - Whether to show a divider below the item
 * @param className - Additional CSS classes
 */
export function DropdownItem({
  label,
  icon,
  onClick,
  divider = false,
  className = '',
}: DropdownItemProps) {
  return (
    <>
      <button
        onClick={onClick}
        className={`w-full text-left px-4 py-2 hover:bg-gray-100 transition-colors flex items-center gap-2 ${className}`}
      >
        {icon && <span className="w-5 h-5">{icon}</span>}
        <span>{label}</span>
      </button>
      {divider && <div className="border-t border-gray-200 my-1" />}
    </>
  );
}
