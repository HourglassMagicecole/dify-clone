'use client';

import React from 'react';
import Image from 'next/image';

interface UserAvatarProps {
  name: string;
  avatarUrl?: string;
  size?: 'sm' | 'md' | 'lg'; // Size option
  className?: string;
}

/**
 * UserAvatar component displays user avatar or initial letter
 *
 * @param name - User's name (required)
 * @param avatarUrl - Avatar image URL (optional)
 * @param size - Avatar size (sm, md, lg) - default: md
 * @param className - Additional CSS classes
 */
export function UserAvatar({
  name,
  avatarUrl,
  size = 'md',
  className = '',
}: UserAvatarProps) {
  // Size-based CSS classes
  const sizeClasses = {
    sm: 'w-8 h-8 text-sm',
    md: 'w-10 h-10 text-base',
    lg: 'w-12 h-12 text-lg',
  };

  // Extract first letter of name (display when no avatar image)
  const initial = name.charAt(0).toUpperCase();

  return (
    <div
      className={`${sizeClasses[size]} rounded-full flex items-center justify-center bg-primary-500 text-white font-semibold overflow-hidden relative ${className}`}
      title={name}
    >
      {avatarUrl ? (
        <Image
          src={avatarUrl}
          alt={name}
          fill
          className="object-cover"
        />
      ) : (
        <span>{initial}</span>
      )}
    </div>
  );
}
