'use client'

import React from 'react'
import { useTranslation } from 'react-i18next'
import type { ResourceSummary } from '../../types/dashboard'

interface ResourceSummaryCardProps {
  summary: ResourceSummary
  scope: 'system' | 'my_resources'
  sessionName?: string
  isLoading?: boolean
  memberCount?: number
  maxMembers?: number
}

/**
 * 리소스 요약 카드 컴포넌트
 * Agent, Dataset 개수를 카드 형태로 표시
 */
export function ResourceSummaryCard({
  summary,
  scope,
  sessionName,
  isLoading = false,
  memberCount,
  maxMembers,
}: ResourceSummaryCardProps) {
  const { t } = useTranslation('dashboard')

  // scope에 따른 라벨
  const scopeLabel = scope === 'system' ? t('scope.system') : t('scope.my')
  const showMembers = memberCount !== undefined && maxMembers !== undefined

  if (isLoading) {
    return (
      <div className={`grid grid-cols-1 ${showMembers ? 'md:grid-cols-3' : 'md:grid-cols-2'} gap-4`}>
        {[1, 2, showMembers ? 3 : null].filter(Boolean).map((i) => (
          <div key={i} className="bg-white rounded-lg shadow p-6 animate-pulse">
            <div className="h-4 bg-gray-200 rounded w-20 mb-2"></div>
            <div className="h-8 bg-gray-200 rounded w-12"></div>
          </div>
        ))}
      </div>
    )
  }

  const resources = [
    {
      label: t('resourceSummary.agents'),
      count: summary.agents,
      icon: '🤖',
      color: 'text-blue-600',
      bgColor: 'bg-blue-50',
    },
    {
      label: t('resourceSummary.datasets'),
      count: summary.datasets,
      icon: '📚',
      color: 'text-purple-600',
      bgColor: 'bg-purple-50',
    },
  ]

  return (
    <div>
      {/* scope 라벨 및 세션명 표시 */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-bold text-gray-900">
          {scopeLabel} 리소스
        </h3>
        {sessionName && (
          <span className="bg-gray-100 text-gray-700 px-2 py-1 rounded text-xs">
            세션: {sessionName}
          </span>
        )}
      </div>

      {/* 리소스 카드 */}
      <div className={`grid grid-cols-1 ${showMembers ? 'md:grid-cols-3' : 'md:grid-cols-2'} gap-4`}>
        {resources.map((resource) => (
          <div
            key={resource.label}
            className={`${resource.bgColor} rounded-lg shadow p-6 hover:shadow-lg transition-shadow duration-200`}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">{resource.label}</p>
                <p className={`text-3xl font-bold ${resource.color} mt-2`}>
                  {resource.count}
                </p>
              </div>
              <div className="text-4xl">{resource.icon}</div>
            </div>
          </div>
        ))}
        {showMembers && (
          <div className="bg-green-50 rounded-lg shadow p-6 hover:shadow-lg transition-shadow duration-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">{t('resourceSummary.members')}</p>
                <p className="text-3xl font-bold text-green-600 mt-2">
                  {memberCount} <span className="text-lg font-normal text-gray-500">/ {maxMembers}</span>
                </p>
              </div>
              <div className="text-4xl">👥</div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

/**
 * 리소스가 없을 때 표시할 빈 상태 컴포넌트
 */
export function EmptyResourceState() {
  const { t } = useTranslation('dashboard')

  const handleGetStarted = () => {
    // 빠른 시작 버튼 섹션으로 스크롤
    // QuickStartButtons 컴포넌트는 페이지 내에 이미 렌더링되어 있음
    const quickStartElement = document.querySelector('[data-testid="quick-start-buttons"]')
    if (quickStartElement) {
      quickStartElement.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  }

  return (
    <div className="bg-gray-50 rounded-lg border-2 border-dashed border-gray-300 p-12 text-center">
      <div className="text-6xl mb-4">📦</div>
      <h3 className="text-lg font-medium text-gray-900 mb-2">
        {t('empty.title')}
      </h3>
      <p className="text-gray-600 mb-6">
        {t('empty.description')}
      </p>
      <button
        className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        onClick={handleGetStarted}
      >
        {t('empty.button')}
      </button>
    </div>
  )
}
