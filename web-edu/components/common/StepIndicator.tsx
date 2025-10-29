/**
 * Step Indicator Component for Multi-step Wizards
 * Displays a horizontal stepper with completed, current, and upcoming steps
 */

'use client'

import React from 'react'

export interface Step {
  number: number
  title: string
  isCompleted: boolean
  isCurrent: boolean
}

export interface StepIndicatorProps {
  steps: Step[]
  currentStep: number
  onStepClick?: (stepNumber: number) => void
}

export function StepIndicator({ steps, onStepClick }: StepIndicatorProps): React.ReactElement {
  return (
    <nav aria-label="Progress" className="w-full">
      <ol role="list" className="flex items-center justify-between">
        {steps.map((step, index) => {
          const isLast = index === steps.length - 1

          return (
            <li key={step.number} className="relative flex-1">
              <div className="flex items-center">
                {/* Step Circle */}
                <div className="relative flex items-center justify-center">
                  {step.isCompleted && onStepClick ? (
                    // Clickable completed step
                    <button
                      type="button"
                      onClick={() => onStepClick(step.number)}
                      className="focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 rounded-full"
                      aria-label={`Go to ${step.title}`}
                    >
                      <span
                        className={`
                          flex h-10 w-10 items-center justify-center rounded-full
                          border-2 transition-all duration-300
                          border-green-600 bg-green-600 hover:bg-green-700 hover:border-green-700 cursor-pointer
                        `}
                      >
                        <svg className="h-6 w-6 text-white" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
                          <path
                            fillRule="evenodd"
                            d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                            clipRule="evenodd"
                          />
                        </svg>
                      </span>
                    </button>
                  ) : (
                    // Non-clickable current or upcoming step
                    <span
                      className={`
                        flex h-10 w-10 items-center justify-center rounded-full
                        border-2 transition-all duration-300
                        ${
                          step.isCompleted
                            ? 'border-green-600 bg-green-600'
                            : step.isCurrent
                              ? 'border-blue-600 bg-white'
                              : 'border-gray-300 bg-white'
                        }
                      `}
                      aria-current={step.isCurrent ? 'step' : undefined}
                    >
                      {step.isCompleted ? (
                        <svg className="h-6 w-6 text-white" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
                          <path
                            fillRule="evenodd"
                            d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                            clipRule="evenodd"
                          />
                        </svg>
                      ) : (
                        <span
                          className={`
                            text-sm font-semibold
                            ${
                              step.isCurrent
                                ? 'text-blue-600'
                                : 'text-gray-500'
                            }
                          `}
                        >
                          {step.number}
                        </span>
                      )}
                    </span>
                  )}
                </div>

                {/* Step Title */}
                <div className="ml-3 hidden md:block">
                  <p
                    className={`
                      text-sm font-medium
                      ${
                        step.isCompleted
                          ? 'text-green-600'
                          : step.isCurrent
                            ? 'text-blue-600'
                            : 'text-gray-500'
                      }
                    `}
                  >
                    {step.title}
                  </p>
                </div>

                {/* Connector Line */}
                {!isLast && (
                  <div
                    className={`
                      ml-4 mr-4 h-0.5 flex-1 transition-all duration-300
                      ${
                        step.isCompleted
                          ? 'bg-green-600'
                          : 'bg-gray-300'
                      }
                    `}
                    aria-hidden="true"
                  />
                )}
              </div>
            </li>
          )
        })}
      </ol>

      {/* Mobile: Show current step title below */}
      <div className="mt-4 md:hidden">
        <p className="text-center text-sm font-medium text-gray-700">
          {steps.find(s => s.isCurrent)?.title}
        </p>
      </div>
    </nav>
  )
}
