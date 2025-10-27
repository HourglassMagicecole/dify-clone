/**
 * Help Modal Component (Story 1.8 - Task 13)
 *
 * Administrator guide and FAQ for API Key management
 */

'use client'

import React from 'react'
import { useTranslation } from 'react-i18next'
import { PROVIDER_METADATA, SUPPORTED_PROVIDERS } from '@/types/api-key'
import { Modal } from '@/components/common/Modal'
import { Button } from '@/components/common/Button'

interface HelpModalProps {
  isOpen: boolean
  onClose: () => void
}

export function HelpModal({ isOpen, onClose }: HelpModalProps) {
  const { t } = useTranslation('api-keys')

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={t('helpModal.title')}>
      <div className="space-y-6 max-h-[70vh] overflow-y-auto">
        {/* 지원되는 Provider 목록 */}
        <section>
          <h3 className="text-lg font-semibold text-gray-900 mb-3">
            {t('helpModal.sections.providers')}
          </h3>
          <div className="space-y-3">
            {SUPPORTED_PROVIDERS.map((provider) => {
              const metadata = PROVIDER_METADATA[provider]
              return (
                <div
                  key={provider}
                  className="bg-gray-50 rounded-md p-4 border border-gray-200"
                >
                  <div className="flex justify-between items-start mb-2">
                    <h4 className="font-medium text-gray-900">{metadata.name}</h4>
                    <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                      {metadata.free_tier}
                    </span>
                  </div>
                  <div className="flex gap-3 text-sm">
                    <a
                      href={metadata.guide_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:text-blue-800 underline"
                    >
                      {t('helpModal.links.getApiKey')}
                    </a>
                    <span className="text-gray-400">|</span>
                    <a
                      href={metadata.pricing_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:text-blue-800 underline"
                    >
                      {t('helpModal.links.pricing')}
                    </a>
                  </div>
                </div>
              )
            })}
          </div>
        </section>

        {/* 권장 Provider 조합 */}
        <section>
          <h3 className="text-lg font-semibold text-gray-900 mb-3">
            {t('helpModal.sections.recommended')}
          </h3>
          <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
            <ul className="space-y-2 text-sm text-gray-700">
              <li className="flex items-start gap-2">
                <span className="font-medium text-blue-700 min-w-[80px]">Primary:</span>
                <span>{t('helpModal.recommended.primary')}</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="font-medium text-blue-700 min-w-[80px]">Secondary:</span>
                <span>{t('helpModal.recommended.secondary')}</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="font-medium text-blue-700 min-w-[80px]">Tertiary:</span>
                <span>{t('helpModal.recommended.tertiary')}</span>
              </li>
            </ul>
          </div>
        </section>

        {/* FAQ */}
        <section>
          <h3 className="text-lg font-semibold text-gray-900 mb-3">
            {t('helpModal.sections.faq')}
          </h3>
          <div className="space-y-4">
            {/* FAQ 1 */}
            <div className="border-l-4 border-blue-500 pl-4">
              <h4 className="font-medium text-gray-900 mb-1">
                {t('helpModal.faq.q1')}
              </h4>
              <p className="text-sm text-gray-600">
                {t('helpModal.faq.a1')}
              </p>
            </div>

            {/* FAQ 2 */}
            <div className="border-l-4 border-blue-500 pl-4">
              <h4 className="font-medium text-gray-900 mb-1">
                {t('helpModal.faq.q2')}
              </h4>
              <p className="text-sm text-gray-600">
                {t('helpModal.faq.a2')}
              </p>
            </div>

            {/* FAQ 3 */}
            <div className="border-l-4 border-blue-500 pl-4">
              <h4 className="font-medium text-gray-900 mb-1">
                {t('helpModal.faq.q3')}
              </h4>
              <p className="text-sm text-gray-600">
                {t('helpModal.faq.a3')}
              </p>
            </div>

            {/* FAQ 4 */}
            <div className="border-l-4 border-blue-500 pl-4">
              <h4 className="font-medium text-gray-900 mb-1">
                {t('helpModal.faq.q4')}
              </h4>
              <p className="text-sm text-gray-600">
                {t('helpModal.faq.a4')}
              </p>
            </div>

            {/* FAQ 5 */}
            <div className="border-l-4 border-blue-500 pl-4">
              <h4 className="font-medium text-gray-900 mb-1">
                {t('helpModal.faq.q5')}
              </h4>
              <p className="text-sm text-gray-600">
                {t('helpModal.faq.a5')}
              </p>
            </div>
          </div>
        </section>

        {/* 요금 최적화 팁 */}
        <section>
          <h3 className="text-lg font-semibold text-gray-900 mb-3">
            {t('helpModal.sections.tips')}
          </h3>
          <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4">
            <ul className="space-y-2 text-sm text-gray-700">
              <li className="flex items-start gap-2">
                <span className="text-yellow-600 mt-0.5">•</span>
                <span>{t('helpModal.tips.tip1')}</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-yellow-600 mt-0.5">•</span>
                <span>{t('helpModal.tips.tip2')}</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-yellow-600 mt-0.5">•</span>
                <span>{t('helpModal.tips.tip3')}</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-yellow-600 mt-0.5">•</span>
                <span>{t('helpModal.tips.tip4')}</span>
              </li>
            </ul>
          </div>
        </section>

        {/* 보안 주의사항 */}
        <section>
          <h3 className="text-lg font-semibold text-gray-900 mb-3">
            {t('helpModal.sections.security')}
          </h3>
          <div className="bg-red-50 border border-red-200 rounded-md p-4">
            <ul className="space-y-2 text-sm text-gray-700">
              <li className="flex items-start gap-2">
                <svg
                  className="w-4 h-4 text-red-600 mt-0.5 flex-shrink-0"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                  />
                </svg>
                <span>{t('helpModal.security.warning1')}</span>
              </li>
              <li className="flex items-start gap-2">
                <svg
                  className="w-4 h-4 text-red-600 mt-0.5 flex-shrink-0"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                  />
                </svg>
                <span>{t('helpModal.security.warning2')}</span>
              </li>
              <li className="flex items-start gap-2">
                <svg
                  className="w-4 h-4 text-red-600 mt-0.5 flex-shrink-0"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
                  />
                </svg>
                <span>{t('helpModal.security.warning3')}</span>
              </li>
            </ul>
          </div>
        </section>

        {/* 닫기 버튼 */}
        <div className="flex justify-end pt-4 border-t">
          <Button onClick={onClose}>
            {t('helpModal.actions.close')}
          </Button>
        </div>
      </div>
    </Modal>
  )
}
