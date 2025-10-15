'use client'

import React from 'react'
import Link from 'next/link'

/**
 * 빠른 시작 버튼 컴포넌트
 * Agent, Workflow, Dataset 생성 페이지로 빠르게 이동
 */
export function QuickStartButtons() {
  const quickActions = [
    {
      label: 'Agent 생성',
      description: '대화형 AI Agent 만들기',
      icon: '🤖',
      href: '/student/agents/create',
      color: 'bg-blue-600 hover:bg-blue-700'
    },
    {
      label: 'Workflow 생성',
      description: 'AI 워크플로우 구성하기',
      icon: '🔄',
      href: '/student/workflows/create',
      color: 'bg-green-600 hover:bg-green-700'
    },
    {
      label: 'Dataset 생성',
      description: 'RAG 지식베이스 만들기',
      icon: '📚',
      href: '/student/datasets/create',
      color: 'bg-purple-600 hover:bg-purple-700'
    }
  ]

  return (
    <div className="bg-white rounded-lg shadow p-6" data-testid="quick-start-buttons">
      <h3 className="text-lg font-semibold mb-4">빠른 시작</h3>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {quickActions.map((action) => (
          <Link
            key={action.label}
            href={action.href}
            className={`${action.color} text-white rounded-lg p-4 hover:shadow-lg transition-all duration-200 block`}
          >
            <div className="text-3xl mb-2">{action.icon}</div>
            <div className="font-medium">{action.label}</div>
            <div className="text-sm text-white/80 mt-1">{action.description}</div>
          </Link>
        ))}
      </div>
    </div>
  )
}
