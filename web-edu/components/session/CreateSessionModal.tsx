'use client'

import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { sessionAPI } from '@/service/session-api'
import type { CreateSessionRequest } from '@/types/session'

interface CreateSessionModalProps {
  onClose: () => void
  onSuccess?: () => void | Promise<void>
}

export const CreateSessionModal: React.FC<CreateSessionModalProps> = ({ onClose, onSuccess }) => {
  const { t } = useTranslation('session')
  const [formData, setFormData] = useState<CreateSessionRequest>({
    session_name: '',
    session_tag: '',
    start_date: '',
    end_date: '',
    max_students: 50,
    description: '',
  })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    setError(null)

    try {
      // Convert dates to ISO 8601 with user's local timezone
      const startDate = new Date(formData.start_date)
      startDate.setHours(0, 0, 0, 0)

      let endDate: Date | undefined
      if (formData.end_date) {
        endDate = new Date(formData.end_date)
        endDate.setHours(23, 59, 59, 999)
      }

      const data: CreateSessionRequest = {
        session_name: formData.session_name,
        session_tag: formData.session_tag,
        start_date: startDate.toISOString(),
        end_date: endDate?.toISOString(),
        max_students: formData.max_students || 50, // Default to 50 if empty
        description: formData.description || undefined,
      }

      await sessionAPI.createSession(data)

      // Call success callback if provided
      if (onSuccess) {
        await onSuccess()
      }

      onClose()
    }
    catch (err) {
      setError(err instanceof Error ? err.message : t('failed_to_create'))
    }
    finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md">
        <h2 className="text-xl font-bold mb-4">{t('create_session')}</h2>

        {error && <div className="mb-4 p-3 bg-red-100 text-red-700 rounded">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label className="block text-sm font-medium mb-1">
              {t('session_name')}
              {' '}
              <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              value={formData.session_name}
              onChange={e => setFormData({ ...formData, session_name: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder={t('session_name_placeholder')}
            />
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium mb-1">
              {t('session_tag')}
              {' '}
              <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              pattern="[a-z0-9-_]+"
              value={formData.session_tag}
              onChange={e => setFormData({ ...formData, session_tag: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder={t('session_tag_placeholder')}
            />
            <p className="text-xs text-gray-500 mt-1">{t('tag_hint')}</p>
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium mb-1">
              {t('start_date')}
              {' '}
              <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              required
              value={formData.start_date}
              onChange={e => setFormData({ ...formData, start_date: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium mb-1">
              {t('end_date')}
              {' '}
              ({t('optional')})
            </label>
            <input
              type="date"
              value={formData.end_date}
              onChange={e => setFormData({ ...formData, end_date: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium mb-1">{t('max_students')}</label>
            <input
              type="number"
              min="1"
              max="1000"
              value={formData.max_students || ''}
              onChange={e => setFormData({ ...formData, max_students: +e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium mb-1">
              {t('description')}
              {' '}
              ({t('optional')})
            </label>
            <textarea
              rows={3}
              value={formData.description}
              onChange={e => setFormData({ ...formData, description: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder={t('description_placeholder')}
            />
          </div>

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-700 border border-gray-300 rounded hover:bg-gray-50"
              disabled={isSubmitting}
            >
              {t('cancel')}
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
              disabled={isSubmitting}
            >
              {isSubmitting ? t('creating') : t('create')}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
