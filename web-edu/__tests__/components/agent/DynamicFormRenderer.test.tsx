/**
 * Tests for DynamicFormRenderer component (Task 10.1)
 */

import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { DynamicFormRenderer } from '@/components/agent/DynamicFormRenderer'
import type { UserInputForm } from '@/types/agent'

// Mock react-i18next
jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, unknown>) => {
      const translations: Record<string, string> = {
        'execute.inputForm.title': '입력 정보',
        'execute.inputForm.description': 'Agent 실행에 필요한 정보를 입력하세요',
        'execute.inputForm.submit': '실행',
        'execute.inputForm.reset': '초기화',
        'execute.inputForm.submitting': '실행 중...',
        'execute.inputForm.selectPlaceholder': '선택하세요',
        'execute.inputForm.validation.required': `${options?.field}은(는) 필수 입력입니다`,
        'execute.inputForm.validation.invalidNumber': `${options?.field}은(는) 숫자여야 합니다`,
        'execute.inputForm.validation.maxLength': `${options?.field}은(는) 최대 ${options?.maxLength}자까지 입력 가능합니다`,
      }
      return translations[key] || key
    },
  }),
}))

// Mock FileUploadField
jest.mock('@/components/agent/FileUploadField', () => ({
  FileUploadField: ({ name, label, required, onChange }: {
    name: string
    label: string
    required: boolean
    onChange: (value: unknown) => void
  }) => (
    <div data-testid={`file-upload-${name}`}>
      <label htmlFor={name}>{label}{required && '*'}</label>
      <input
        id={name}
        type="file"
        onChange={(e) => {
          if (e.target.files?.[0]) {
            onChange({
              id: 'test-file-id',
              name: e.target.files[0].name,
              type: e.target.files[0].type,
              size: e.target.files[0].size,
              url: '/files/test-file-id',
            })
          }
        }}
      />
    </div>
  ),
}))

describe('DynamicFormRenderer', () => {
  const mockOnSubmit = jest.fn()

  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('Field Type Rendering', () => {
    it('should render text-input field', () => {
      const formSchema: UserInputForm[] = [
        {
          variable: 'name',
          label: '이름',
          input_type: 'text-input',
          required: true,
        },
      ]

      render(
        <DynamicFormRenderer
          formSchema={formSchema}
          onSubmit={mockOnSubmit}
          isSubmitting={false}
        />,
      )

      const input = screen.getByLabelText('이름*')
      expect(input).toBeInTheDocument()
      expect(input).toHaveAttribute('type', 'text')
    })

    it('should render paragraph field', () => {
      const formSchema: UserInputForm[] = [
        {
          variable: 'description',
          label: '설명',
          input_type: 'paragraph',
          required: false,
        },
      ]

      render(
        <DynamicFormRenderer
          formSchema={formSchema}
          onSubmit={mockOnSubmit}
          isSubmitting={false}
        />,
      )

      const textarea = screen.getByLabelText('설명')
      expect(textarea.tagName).toBe('TEXTAREA')
    })

    it('should render number field', () => {
      const formSchema: UserInputForm[] = [
        {
          variable: 'age',
          label: '나이',
          input_type: 'number',
          required: true,
        },
      ]

      render(
        <DynamicFormRenderer
          formSchema={formSchema}
          onSubmit={mockOnSubmit}
          isSubmitting={false}
        />,
      )

      const input = screen.getByLabelText('나이*')
      expect(input).toHaveAttribute('type', 'number')
    })

    it('should render select field with options', () => {
      const formSchema: UserInputForm[] = [
        {
          variable: 'language',
          label: '언어',
          input_type: 'select',
          required: true,
          options: ['English', 'Korean', 'Japanese'],
        },
      ]

      render(
        <DynamicFormRenderer
          formSchema={formSchema}
          onSubmit={mockOnSubmit}
          isSubmitting={false}
        />,
      )

      const select = screen.getByLabelText('언어*')
      expect(select.tagName).toBe('SELECT')
      expect(screen.getByText('English')).toBeInTheDocument()
      expect(screen.getByText('Korean')).toBeInTheDocument()
      expect(screen.getByText('Japanese')).toBeInTheDocument()
    })

    it('should render checkbox field', () => {
      const formSchema: UserInputForm[] = [
        {
          variable: 'agree',
          label: '동의합니다',
          input_type: 'checkbox',
          required: false,
        },
      ]

      render(
        <DynamicFormRenderer
          formSchema={formSchema}
          onSubmit={mockOnSubmit}
          isSubmitting={false}
        />,
      )

      const checkbox = screen.getByLabelText('동의합니다')
      expect(checkbox).toHaveAttribute('type', 'checkbox')
    })

    it('should render file field', () => {
      const formSchema: UserInputForm[] = [
        {
          variable: 'document',
          label: '문서',
          input_type: 'file',
          required: true,
        },
      ]

      render(
        <DynamicFormRenderer
          formSchema={formSchema}
          onSubmit={mockOnSubmit}
          isSubmitting={false}
        />,
      )

      expect(screen.getByTestId('file-upload-document')).toBeInTheDocument()
    })
  })

  describe('Form Validation', () => {
    it('should show validation error for required text field', async () => {
      const user = userEvent.setup()
      const formSchema: UserInputForm[] = [
        {
          variable: 'name',
          label: '이름',
          input_type: 'text-input',
          required: true,
        },
      ]

      render(
        <DynamicFormRenderer
          formSchema={formSchema}
          onSubmit={mockOnSubmit}
          isSubmitting={false}
        />,
      )

      const submitButton = screen.getByRole('button', { name: /실행/i })
      await user.click(submitButton)

      await waitFor(() => {
        expect(screen.getByText(/이름은\(는\) 필수 입력입니다/)).toBeInTheDocument()
      })
      expect(mockOnSubmit).not.toHaveBeenCalled()
    })

    it('should validate max_length constraint', async () => {
      const user = userEvent.setup()
      const formSchema: UserInputForm[] = [
        {
          variable: 'name',
          label: '이름',
          input_type: 'text-input',
          required: true,
          max_length: 5,
        },
      ]

      render(
        <DynamicFormRenderer
          formSchema={formSchema}
          onSubmit={mockOnSubmit}
          isSubmitting={false}
        />,
      )

      const input = screen.getByLabelText('이름*')
      await user.type(input, 'VeryLongName')

      const submitButton = screen.getByRole('button', { name: /실행/i })
      await user.click(submitButton)

      await waitFor(() => {
        expect(screen.getByText(/최대 5자까지 입력 가능합니다/)).toBeInTheDocument()
      })
      expect(mockOnSubmit).not.toHaveBeenCalled()
    })

    it('should validate number field type', async () => {
      const formSchema: UserInputForm[] = [
        {
          variable: 'age',
          label: '나이',
          input_type: 'number',
          required: true,
        },
      ]

      render(
        <DynamicFormRenderer
          formSchema={formSchema}
          onSubmit={mockOnSubmit}
          isSubmitting={false}
        />,
      )

      // Number input automatically validates type
      const input = screen.getByLabelText('나이*')
      expect(input).toHaveAttribute('type', 'number')
    })
  })

  describe('Form Submission', () => {
    it('should call onSubmit with form values on valid submission', async () => {
      const user = userEvent.setup()
      const formSchema: UserInputForm[] = [
        {
          variable: 'name',
          label: '이름',
          input_type: 'text-input',
          required: true,
        },
        {
          variable: 'age',
          label: '나이',
          input_type: 'number',
          required: false,
        },
      ]

      render(
        <DynamicFormRenderer
          formSchema={formSchema}
          onSubmit={mockOnSubmit}
          isSubmitting={false}
        />,
      )

      await user.type(screen.getByLabelText('이름*'), 'John Doe')
      await user.type(screen.getByLabelText('나이'), '25')

      const submitButton = screen.getByRole('button', { name: /실행/i })
      await user.click(submitButton)

      await waitFor(() => {
        expect(mockOnSubmit).toHaveBeenCalled()
        const callArgs = mockOnSubmit.mock.calls[0]
        expect(callArgs[0]).toEqual({
          name: 'John Doe',
          age: 25,
        })
      })
    })

    it('should disable submit button when isSubmitting is true', () => {
      const formSchema: UserInputForm[] = [
        {
          variable: 'name',
          label: '이름',
          input_type: 'text-input',
          required: true,
        },
      ]

      render(
        <DynamicFormRenderer
          formSchema={formSchema}
          onSubmit={mockOnSubmit}
          isSubmitting={true}
        />,
      )

      const submitButton = screen.getByRole('button', { name: /실행 중.../i })
      expect(submitButton).toBeDisabled()
    })

    it('should show loading state when submitting', () => {
      const formSchema: UserInputForm[] = [
        {
          variable: 'name',
          label: '이름',
          input_type: 'text-input',
          required: true,
        },
      ]

      render(
        <DynamicFormRenderer
          formSchema={formSchema}
          onSubmit={mockOnSubmit}
          isSubmitting={true}
        />,
      )

      expect(screen.getByText('실행 중...')).toBeInTheDocument()
    })
  })

  describe('Default Values', () => {
    it('should populate form with default values', () => {
      const formSchema: UserInputForm[] = [
        {
          variable: 'name',
          label: '이름',
          input_type: 'text-input',
          required: true,
        },
        {
          variable: 'age',
          label: '나이',
          input_type: 'number',
          required: false,
        },
      ]

      const defaultValues = {
        name: 'Jane Doe',
        age: 30,
      }

      render(
        <DynamicFormRenderer
          formSchema={formSchema}
          onSubmit={mockOnSubmit}
          isSubmitting={false}
          defaultValues={defaultValues}
        />,
      )

      expect(screen.getByLabelText('이름*')).toHaveValue('Jane Doe')
      expect(screen.getByLabelText('나이')).toHaveValue(30)
    })
  })

  // Regression suite for hotfix_20260414_agent-execute-select-default
  describe('Select field default value (hotfix)', () => {
    it('select field initializes with field.default_value when present in options', () => {
      const formSchema: UserInputForm[] = [
        {
          variable: 'language',
          label: '언어',
          input_type: 'select',
          required: true,
          options: ['English', 'Korean', 'Japanese'],
          default_value: 'Korean',
        },
      ]

      render(
        <DynamicFormRenderer
          formSchema={formSchema}
          onSubmit={mockOnSubmit}
          isSubmitting={false}
        />,
      )

      const select = screen.getByLabelText('언어*') as HTMLSelectElement
      expect(select.value).toBe('Korean')
    })

    it('select field stays empty when no default_value is provided', () => {
      const formSchema: UserInputForm[] = [
        {
          variable: 'language',
          label: '언어',
          input_type: 'select',
          required: true,
          options: ['English', 'Korean'],
        },
      ]

      render(
        <DynamicFormRenderer
          formSchema={formSchema}
          onSubmit={mockOnSubmit}
          isSubmitting={false}
        />,
      )

      const select = screen.getByLabelText('언어*') as HTMLSelectElement
      expect(select.value).toBe('')
    })

    it('select field falls back to empty when default_value is not in options (stale default)', () => {
      const formSchema: UserInputForm[] = [
        {
          variable: 'language',
          label: '언어',
          input_type: 'select',
          required: true,
          options: ['English', 'Korean'],
          default_value: 'French', // No longer in options
        },
      ]

      render(
        <DynamicFormRenderer
          formSchema={formSchema}
          onSubmit={mockOnSubmit}
          isSubmitting={false}
        />,
      )

      const select = screen.getByLabelText('언어*') as HTMLSelectElement
      expect(select.value).toBe('')
    })

    it('explicit defaultValues prop overrides schema-derived select default', () => {
      const formSchema: UserInputForm[] = [
        {
          variable: 'language',
          label: '언어',
          input_type: 'select',
          required: true,
          options: ['English', 'Korean', 'Japanese'],
          default_value: 'Korean',
        },
      ]

      render(
        <DynamicFormRenderer
          formSchema={formSchema}
          onSubmit={mockOnSubmit}
          isSubmitting={false}
          defaultValues={{ language: 'Japanese' }}
        />,
      )

      const select = screen.getByLabelText('언어*') as HTMLSelectElement
      expect(select.value).toBe('Japanese')
    })

    it('user can change select after default is applied (interaction not broken)', async () => {
      const user = userEvent.setup()
      const formSchema: UserInputForm[] = [
        {
          variable: 'language',
          label: '언어',
          input_type: 'select',
          required: true,
          options: ['English', 'Korean', 'Japanese'],
          default_value: 'Korean',
        },
      ]

      render(
        <DynamicFormRenderer
          formSchema={formSchema}
          onSubmit={mockOnSubmit}
          isSubmitting={false}
        />,
      )

      const select = screen.getByLabelText('언어*') as HTMLSelectElement
      expect(select.value).toBe('Korean')
      await user.selectOptions(select, 'Japanese')
      expect(select.value).toBe('Japanese')

      const submitButton = screen.getByRole('button', { name: /실행/i })
      await user.click(submitButton)

      await waitFor(() => {
        expect(mockOnSubmit).toHaveBeenCalled()
        const callArgs = mockOnSubmit.mock.calls[0]
        expect(callArgs[0]).toEqual({ language: 'Japanese' })
      })
    })

    it('does not regress non-select types (text/number left untouched by schema defaults)', () => {
      // Other types currently expose default_value as placeholder only; this hotfix
      // intentionally does not change that behavior. This test guards against
      // accidental over-application of schema defaults to non-select inputs.
      const formSchema: UserInputForm[] = [
        {
          variable: 'name',
          label: '이름',
          input_type: 'text-input',
          required: false,
          default_value: 'placeholder-name',
        },
        {
          variable: 'age',
          label: '나이',
          input_type: 'number',
          required: false,
          default_value: '42',
        },
      ]

      render(
        <DynamicFormRenderer
          formSchema={formSchema}
          onSubmit={mockOnSubmit}
          isSubmitting={false}
        />,
      )

      expect(screen.getByLabelText('이름')).toHaveValue('')
      expect(screen.getByLabelText('나이')).toHaveValue(null)
    })
  })
})
