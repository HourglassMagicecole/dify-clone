/**
 * Radio Group Component
 * Card-style radio buttons for selecting options
 */

'use client'

import React from 'react'

export interface RadioOption {
  value: string
  title: string
  description: string
  icon?: string
}

export interface RadioGroupProps {
  name: string
  options: RadioOption[]
  value: string
  onChange: (value: string) => void
  label?: string
  error?: string
  required?: boolean
}

export function RadioGroup({
  name,
  options,
  value,
  onChange,
  label,
  error,
  required = false,
}: RadioGroupProps): React.ReactElement {
  return (
    <div className="space-y-2">
      {/* Label */}
      {label && (
        <label className="block text-sm font-medium text-gray-700">
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}

      {/* Radio Options */}
      <div
        role="radiogroup"
        aria-label={label}
        aria-required={required}
        className="grid grid-cols-1 gap-4 sm:grid-cols-3"
      >
        {options.map((option) => {
          const isSelected = value === option.value

          return (
            <div key={option.value} className="relative">
              <input
                type="radio"
                id={`${name}-${option.value}`}
                name={name}
                value={option.value}
                checked={isSelected}
                onChange={(e) => onChange(e.target.value)}
                className="sr-only peer"
                aria-label={option.title}
              />
              <label
                htmlFor={`${name}-${option.value}`}
                className={`
                  flex flex-col h-full cursor-pointer rounded-lg border-2 p-4
                  transition-all duration-200 hover:bg-gray-50
                  ${
                    isSelected
                      ? 'border-blue-600 bg-blue-50 ring-2 ring-blue-600 ring-offset-2'
                      : 'border-gray-300 bg-white'
                  }
                `}
              >
                {/* Icon */}
                {option.icon && (
                  <div className="mb-2 text-2xl">{option.icon}</div>
                )}

                {/* Title */}
                <div
                  className={`
                    text-sm font-semibold mb-1
                    ${isSelected ? 'text-blue-900' : 'text-gray-900'}
                  `}
                >
                  {option.title}
                </div>

                {/* Description */}
                <div
                  className={`
                    text-xs
                    ${isSelected ? 'text-blue-700' : 'text-gray-500'}
                  `}
                >
                  {option.description}
                </div>

                {/* Selection Indicator */}
                {isSelected && (
                  <div className="absolute top-3 right-3">
                    <div className="h-5 w-5 rounded-full bg-blue-600 flex items-center justify-center">
                      <svg
                        className="h-3 w-3 text-white"
                        fill="currentColor"
                        viewBox="0 0 20 20"
                      >
                        <path
                          fillRule="evenodd"
                          d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                          clipRule="evenodd"
                        />
                      </svg>
                    </div>
                  </div>
                )}
              </label>
            </div>
          )
        })}
      </div>

      {/* Error Message */}
      {error && (
        <p className="mt-1 text-sm text-red-600" role="alert">
          {error}
        </p>
      )}
    </div>
  )
}
