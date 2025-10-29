/**
 * Tests for StepIndicator component
 */

import React from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { StepIndicator, Step } from '@/components/common/StepIndicator'

describe('StepIndicator', () => {
  const mockSteps: Step[] = [
    { number: 1, title: 'Step 1', isCompleted: true, isCurrent: false },
    { number: 2, title: 'Step 2', isCompleted: false, isCurrent: true },
    { number: 3, title: 'Step 3', isCompleted: false, isCurrent: false },
    { number: 4, title: 'Step 4', isCompleted: false, isCurrent: false },
    { number: 5, title: 'Step 5', isCompleted: false, isCurrent: false },
  ]

  it('should render all steps correctly', () => {
    render(<StepIndicator steps={mockSteps} currentStep={2} />)

    // Check if all steps are rendered (using getAllByText since steps appear in both desktop and mobile views)
    expect(screen.getAllByText('Step 1').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Step 2').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Step 3').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Step 4').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Step 5').length).toBeGreaterThan(0)
  })

  it('should highlight the current step', () => {
    const { container } = render(<StepIndicator steps={mockSteps} currentStep={2} />)

    // Find the element with aria-current="step"
    const currentStepElement = container.querySelector('[aria-current="step"]')
    expect(currentStepElement).toBeInTheDocument()
    expect(currentStepElement).toHaveTextContent('2')
  })

  it('should show check icon for completed steps', () => {
    const { container } = render(<StepIndicator steps={mockSteps} currentStep={2} />)

    // Step 1 should be completed
    const step1 = mockSteps[0]!
    expect(step1.isCompleted).toBe(true)

    // Check that SVG checkmark icon is rendered
    const svgs = container.querySelectorAll('svg[fill="currentColor"]')
    expect(svgs.length).toBeGreaterThan(0)
  })

  it('should show step number for uncompleted steps', () => {
    render(<StepIndicator steps={mockSteps} currentStep={2} />)

    // Steps 2, 3, 4, 5 should show their numbers
    expect(screen.getByText('2')).toBeInTheDocument()
    expect(screen.getByText('3')).toBeInTheDocument()
    expect(screen.getByText('4')).toBeInTheDocument()
    expect(screen.getByText('5')).toBeInTheDocument()
  })

  it('should have proper ARIA labels for accessibility', () => {
    render(<StepIndicator steps={mockSteps} currentStep={2} />)

    // Check for progress navigation
    const nav = screen.getByRole('navigation', { name: /progress/i })
    expect(nav).toBeInTheDocument()

    // Check for list
    const list = screen.getByRole('list')
    expect(list).toBeInTheDocument()
  })

  it('should render with only one step', () => {
    const singleStep: Step[] = [
      { number: 1, title: 'Only Step', isCompleted: false, isCurrent: true },
    ]

    render(<StepIndicator steps={singleStep} currentStep={1} />)

    expect(screen.getAllByText('Only Step').length).toBeGreaterThan(0)
    expect(screen.getByText('1')).toBeInTheDocument()
  })

  it('should handle all steps completed', () => {
    const allCompletedSteps: Step[] = [
      { number: 1, title: 'Step 1', isCompleted: true, isCurrent: false },
      { number: 2, title: 'Step 2', isCompleted: true, isCurrent: false },
      { number: 3, title: 'Step 3', isCompleted: true, isCurrent: true },
    ]

    const { container } = render(<StepIndicator steps={allCompletedSteps} currentStep={3} />)

    // All steps should have check icons (SVG elements)
    const checkIcons = container.querySelectorAll('svg[fill="currentColor"]')
    expect(checkIcons.length).toBe(3)
  })

  it('should call onStepClick when completed step is clicked', async () => {
    const user = userEvent.setup()
    const mockOnStepClick = jest.fn()

    render(<StepIndicator steps={mockSteps} currentStep={3} onStepClick={mockOnStepClick} />)

    // Find the completed step button (Step 1)
    const step1Button = screen.getByLabelText('Go to Step 1')
    await user.click(step1Button)

    expect(mockOnStepClick).toHaveBeenCalledWith(1)
  })

  it('should not render click handler for current step', () => {
    const mockOnStepClick = jest.fn()

    render(<StepIndicator steps={mockSteps} currentStep={2} onStepClick={mockOnStepClick} />)

    // Current step should not have a button
    expect(screen.queryByLabelText('Go to Step 2')).not.toBeInTheDocument()
  })

  it('should not render click handler for upcoming steps', () => {
    const mockOnStepClick = jest.fn()

    render(<StepIndicator steps={mockSteps} currentStep={2} onStepClick={mockOnStepClick} />)

    // Upcoming steps should not have buttons
    expect(screen.queryByLabelText('Go to Step 3')).not.toBeInTheDocument()
  })

  it('should work without onStepClick prop', () => {
    // Should render without errors even if onStepClick is not provided
    render(<StepIndicator steps={mockSteps} currentStep={2} />)

    // Should not have any clickable steps
    expect(screen.queryByLabelText(/Go to/)).not.toBeInTheDocument()
  })
})
