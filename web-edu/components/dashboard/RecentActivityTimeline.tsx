'use client'

import React from 'react'
import { useTranslation } from 'react-i18next'
import type { RecentActivity } from '../../types/dashboard'

interface RecentActivityTimelineProps {
  activities: RecentActivity[]
  isLoading?: boolean
  showUserName?: boolean // Owner/Admin 대시보드에서 사용자 이름 표시
}

/**
 * 최근 활동 타임라인 컴포넌트
 */
export function RecentActivityTimeline({ activities, isLoading = false, showUserName = false }: RecentActivityTimelineProps) {
  const { t } = useTranslation('dashboard')

  if (isLoading) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold mb-4">{t('recentActivity.title')}</h3>
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex items-start animate-pulse">
              <div className="w-2 h-2 bg-gray-200 rounded-full mt-2 mr-3"></div>
              <div className="flex-1">
                <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                <div className="h-3 bg-gray-200 rounded w-1/2"></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  // 빈 상태 처리
  if (activities.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold mb-4">{t('recentActivity.title')}</h3>
        <div className="text-center py-8">
          <div className="text-4xl mb-2">📋</div>
          <p className="text-gray-600">{t('recentActivity.empty')}</p>
        </div>
      </div>
    )
  }

  // 활동 타입별 아이콘 및 색상
  const getActivityStyle = (type: string) => {
    switch (type) {
      case 'agent':
        return { icon: '🤖', color: 'text-blue-600', bgColor: 'bg-blue-100' }
      case 'dataset':
        return { icon: '📚', color: 'text-purple-600', bgColor: 'bg-purple-100' }
      default:
        return { icon: '📄', color: 'text-gray-600', bgColor: 'bg-gray-100' }
    }
  }

  // 액션 텍스트 한글화
  const getActionText = (action: string) => {
    switch (action) {
      case 'created': return '생성됨'
      case 'updated': return '수정됨'
      case 'executed': return '실행됨'
      case 'deleted': return '삭제됨'
      default: return action
    }
  }

  // 상대 시간 표시 (예: "5분 전")
  const getRelativeTime = (timestamp: string) => {
    const now = new Date()
    const activityTime = new Date(timestamp)
    const diffInSeconds = Math.floor((now.getTime() - activityTime.getTime()) / 1000)

    if (diffInSeconds < 60) return '방금 전'
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}분 전`
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}시간 전`
    return `${Math.floor(diffInSeconds / 86400)}일 전`
  }

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h3 className="text-lg font-semibold mb-4">최근 활동</h3>
      <div className="space-y-4">
        {activities.map((activity) => {
          const style = getActivityStyle(activity.type)
          return (
            <div key={activity.id} className="flex items-start">
              <div className={`flex-shrink-0 w-8 h-8 ${style.bgColor} rounded-full flex items-center justify-center mr-3`}>
                <span className="text-sm">{style.icon}</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">
                  {activity.resourceName}
                </p>
                <p className={`text-xs ${style.color}`}>
                  {showUserName && activity.userName && (
                    <span className="text-gray-700 font-medium">{activity.userName}</span>
                  )}
                  {showUserName && activity.userName && ' · '}
                  {getActionText(activity.action)}
                  {activity.status && (
                    <span className={`ml-2 ${activity.status === 'success' ? 'text-green-600' : 'text-red-600'}`}>
                      {activity.status === 'success' ? '✓' : '✗'}
                    </span>
                  )}
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  {getRelativeTime(activity.timestamp)}
                </p>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
