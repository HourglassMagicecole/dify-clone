'use client'

import { useTranslation } from 'react-i18next'

/**
 * ContextBanner Component
 * 역할별 색상 코딩과 컨텍스트 메시지를 표시하는 배너 컴포넌트
 */

interface ContextBannerProps {
  role: 'owner' | 'admin' | 'student'
  scope: 'system' | 'session' | 'my_resources'
  sessionName?: string // Administrator/Student가 선택한 세션명
}

interface RoleStyle {
  bgColor: string
  borderColor: string
  textColor: string
  icon: string
}

function getRoleStyle(role: 'owner' | 'admin' | 'student'): RoleStyle {
  switch (role) {
    case 'owner':
      return {
        bgColor: 'bg-blue-50',
        borderColor: 'border-blue-200',
        textColor: 'text-blue-800',
        icon: '👑',
      }
    case 'admin':
      return {
        bgColor: 'bg-green-50',
        borderColor: 'border-green-200',
        textColor: 'text-green-800',
        icon: '👤',
      }
    case 'student':
      return {
        bgColor: 'bg-orange-50',
        borderColor: 'border-orange-200',
        textColor: 'text-orange-800',
        icon: '🎓',
      }
  }
}

export function ContextBanner({ role, scope: _scope, sessionName }: ContextBannerProps) {
  const { t } = useTranslation('dashboard')
  const { bgColor, borderColor, textColor, icon } = getRoleStyle(role)

  // 역할별 메시지 생성 (모든 역할에서 세션명 표시)
  const getMessage = () => {
    // 세션이 없을 때는 별도의 메시지 표시
    if (!sessionName) {
      return {
        title: t('contextBanner.noSession.title'),
        description: t('contextBanner.noSession.description'),
      }
    }

    if (role === 'owner') {
      return {
        title: t('contextBanner.owner.title', { sessionName }),
        description: t('contextBanner.owner.description'),
      }
    }
    if (role === 'admin') {
      return {
        title: t('contextBanner.admin.title', { sessionName }),
        description: t('contextBanner.admin.description'),
      }
    }
    // Student
    return {
      title: t('contextBanner.student.title', { sessionName }),
      description: t('contextBanner.student.description'),
    }
  }

  const { title, description } = getMessage()

  return (
    <div className={`${bgColor} ${borderColor} border rounded-lg p-4 mb-6`}>
      <div className="flex items-center gap-3">
        <div className="text-2xl">{icon}</div>
        <div>
          <h2 className={`${textColor} font-semibold text-lg`}>{title}</h2>
          <p className={`${textColor} text-sm`}>{description}</p>
        </div>
      </div>
    </div>
  )
}
