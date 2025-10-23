'use client'

import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { sessionAPI } from '@/service/session-api'
import { useSession } from '@/context/SessionContext'
import type { Session, UpdateSessionRequest } from '@/types/session'

interface EditSessionModalProps {
  session: Session
  onClose: () => void
}

export const EditSessionModal: React.FC<EditSessionModalProps> = ({ session, onClose }) => {
  const { t } = useTranslation('session')
  const { refreshSessions } = useSession()
  const [formData, setFormData] = useState<UpdateSessionRequest>({
    session_name: session.session_name,
    start_date: session.start_date,
    end_date: session.end_date || '',
    max_students: session.max_students,
    is_active: session.is_active,
    description: session.description || '',
  })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    setError(null)

    try {
      // Convert dates to ISO 8601 with user's local timezone
      let startDateISO: string | undefined
      if (formData.start_date) {
        const startDate = new Date(formData.start_date)
        startDate.setHours(0, 0, 0, 0)
        startDateISO = startDate.toISOString()
      }

      let endDateISO: string | undefined
      if (formData.end_date) {
        const endDate = new Date(formData.end_date)
        endDate.setHours(23, 59, 59, 999)
        endDateISO = endDate.toISOString()
      }

      const data: UpdateSessionRequest = {
        session_name: formData.session_name,
        start_date: startDateISO,
        end_date: endDateISO,
        max_students: formData.max_students,
        is_active: formData.is_active,
        description: formData.description || undefined,
      }

      await sessionAPI.updateSession(session.id, data)
      await refreshSessions()
      onClose()
    }
    catch (err) {
      setError(err instanceof Error ? err.message : t('failed_to_update'))
    }
    finally {
      setIsSubmitting(false)
    }
  }

  // Convert ISO 8601 to date format (YYYY-MM-DD)
  const toDateOnly = (isoString?: string) => {
    if (!isoString)
      return ''
    return new Date(isoString).toISOString().slice(0, 10)
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md">
        <h2 className="text-xl font-bold mb-4">{t('edit_session')}</h2>

        {error && <div className="mb-4 p-3 bg-red-100 text-red-700 rounded">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label className="block text-sm font-medium mb-1">{t('session_name')}</label>
            <input
              type="text"
              value={formData.session_name}
              onChange={e => setFormData({ ...formData, session_name: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium mb-1">{t('session_tag')}</label>
            <input
              type="text"
              value={session.session_tag}
              disabled
              className="w-full px-3 py-2 border border-gray-300 rounded bg-gray-100 text-gray-500 cursor-not-allowed"
            />
            <p className="text-xs text-gray-500 mt-1">{t('tag_cannot_change')}</p>
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium mb-1">{t('start_date')}</label>
            <input
              type="date"
              value={toDateOnly(formData.start_date)}
              onChange={e => setFormData({ ...formData, start_date: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium mb-1">{t('end_date')}</label>
            <input
              type="date"
              value={toDateOnly(formData.end_date)}
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
              value={formData.max_students}
              onChange={e => setFormData({ ...formData, max_students: Number.parseInt(e.target.value) })}
              className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="mb-4">
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={formData.is_active}
                onChange={e => setFormData({ ...formData, is_active: e.target.checked })}
                className="mr-2"
              />
              <span className="text-sm font-medium">{t('active')}</span>
            </label>
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium mb-1">{t('description')}</label>
            <textarea
              rows={3}
              value={formData.description}
              onChange={e => setFormData({ ...formData, description: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
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
              {isSubmitting ? t('saving') : t('save')}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
