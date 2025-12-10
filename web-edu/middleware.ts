// Next.js Middleware for Route Protection
// Validates JWT tokens from cookies on server-side (TECH-001 risk mitigation)

import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// 보호된 경로 목록
const PROTECTED_PATHS = ['/dashboard', '/agents', '/datasets', '/admin']

// 인증이 필요 없는 공개 경로
const PUBLIC_PATHS = ['/signin', '/signup']

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // 공개 경로는 통과
  if (PUBLIC_PATHS.some(path => pathname.startsWith(path))) {
    return NextResponse.next()
  }

  // 보호된 경로 접근 시 토큰 검증
  if (PROTECTED_PATHS.some(path => pathname.startsWith(path))) {
    // 쿠키에서 토큰 읽기 (서버 사이드에서 접근 가능)
    const token = request.cookies.get('edu_access_token')?.value

    if (!token) {
      // 토큰 없으면 로그인 페이지로 리다이렉트
      const signInUrl = new URL('/signin', request.url)
      signInUrl.searchParams.set('redirect', pathname)
      return NextResponse.redirect(signInUrl)
    }

    // 토큰 만료 검증 (간단한 검증)
    try {
      const parts = token.split('.')
      if (parts.length !== 3 || !parts[1]) {
        return NextResponse.redirect(new URL('/signin', request.url))
      }

      const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString())
      if (payload.exp * 1000 < Date.now()) {
        // 토큰 만료 시 로그인 페이지로 리다이렉트
        return NextResponse.redirect(new URL('/signin', request.url))
      }
    }
    catch {
      // 토큰 파싱 실패 시 로그인 페이지로 리다이렉트
      return NextResponse.redirect(new URL('/signin', request.url))
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
}
