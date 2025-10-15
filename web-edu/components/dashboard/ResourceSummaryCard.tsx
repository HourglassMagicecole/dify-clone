'use client'

import React from 'react'
import type { ResourceSummary } from '../../types/dashboard'

interface ResourceSummaryCardProps {
  summary: ResourceSummary
  isLoading?: boolean
}

/**
 * 리소스 요약 카드 컴포넌트
 * Agent, Workflow, Dataset 개수를 카드 형태로 표시
 */
export function ResourceSummaryCard({ summary, isLoading = false }: ResourceSummaryCardProps) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[1, 2, 3].map((i) => (
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
      label: 'Agents',
      count: summary.agents,
      icon: '🤖',
      color: 'text-blue-600',
      bgColor: 'bg-blue-50'
    },
    {
      label: 'Workflows',
      count: summary.workflows,
      icon: '🔄',
      color: 'text-green-600',
      bgColor: 'bg-green-50'
    },
    {
      label: 'Datasets',
      count: summary.datasets,
      icon: '📚',
      color: 'text-purple-600',
      bgColor: 'bg-purple-50'
    }
  ]

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
    </div>
  )
}

/**
 * 리소스가 없을 때 표시할 빈 상태 컴포넌트
 */
export function EmptyResourceState() {
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
        아직 생성한 리소스가 없습니다
      </h3>
      <p className="text-gray-600 mb-6">
        Agent, Workflow, Dataset을 생성하여 AI 학습을 시작하세요
      </p>
      <button
        className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        onClick={handleGetStarted}
      >
        시작하기
      </button>
    </div>
  )
}
