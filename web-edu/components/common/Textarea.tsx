/**
 * Textarea Component
 * Reusable textarea with validation and character count support
 */

'use client'

import React, { forwardRef } from 'react'

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string
  error?: string
  helperText?: string
  showCharCount?: boolean
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ label, error, helperText, showCharCount = false, className = '', required, maxLength, value, ...props }, ref) => {
    const currentLength = typeof value === 'string' ? value.length : 0

    return (
      <div className="space-y-1">
        {/* Label */}
        {label && (
          <label
            htmlFor={props.id}
            className="block text-sm font-medium text-gray-700"
          >
            {label}
            {required && <span className="text-red-500 ml-1">*</span>}
          </label>
        )}

        {/* Textarea */}
        <textarea
          ref={ref}
          className={`
            block w-full rounded-md border shadow-sm
            px-3 py-2 text-sm
            focus:outline-none focus:ring-2 focus:ring-offset-0
            disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-500
            resize-none
            ${
              error
                ? 'border-red-300 text-red-900 placeholder-red-300 focus:border-red-500 focus:ring-red-500'
                : 'border-gray-300 text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:ring-blue-500'
            }
            ${className}
          `}
          aria-invalid={error ? 'true' : 'false'}
          aria-describedby={error ? `${props.id}-error` : undefined}
          required={required}
          maxLength={maxLength}
          value={value}
          {...props}
        />

        {/* Character Count and Helper Text Row */}
        <div className="flex items-center justify-between">
          {/* Helper Text */}
          {helperText && !error && (
            <p className="text-xs text-gray-500">{helperText}</p>
          )}

          {/* Character Count */}
          {showCharCount && maxLength && (
            <p className="text-xs text-gray-500 ml-auto">
              {currentLength} / {maxLength}
            </p>
          )}
        </div>

        {/* Error Message */}
        {error && (
          <p
            className="text-sm text-red-600"
            id={`${props.id}-error`}
            role="alert"
          >
            {error}
          </p>
        )}
      </div>
    )
  }
)

Textarea.displayName = 'Textarea'
