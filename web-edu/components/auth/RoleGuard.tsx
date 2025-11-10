'use client'

import type { FC, ReactNode } from 'react'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'

interface RoleGuardProps {
  allowedRoles: Array<'owner' | 'admin' | 'student'>
  children: ReactNode
}

/**
 * RoleGuard - 역할 기반 접근 제어 컴포넌트
 *
 * 허용된 역할만 자식 컴포넌트에 접근할 수 있도록 제한합니다.
 * 권한이 없는 경우 403 페이지로 리다이렉트합니다.
 *
 * @example
 * ```tsx
 * <RoleGuard allowedRoles={['owner']}>
 *   <OwnerDashboard />
 * </RoleGuard>
 * ```
 */
export const RoleGuard: FC<RoleGuardProps> = ({ allowedRoles, children }) => {
  const { user, isLoading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!isLoading && user && user.actualRole && !allowedRoles.includes(user.actualRole)) {
      router.push('/403')
    }
  }, [user, isLoading, allowedRoles, router])

  // 로딩 중일 때
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-gray-600">Loading...</div>
      </div>
    )
  }

  // 사용자가 없거나 actualRole이 없거나 권한이 없는 경우
  if (!user || !user.actualRole || !allowedRoles.includes(user.actualRole)) {
    return null
  }

  // 권한이 있는 경우 자식 컴포넌트 렌더링
  return <>{children}</>
}
