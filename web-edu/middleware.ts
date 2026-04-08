// Next.js Middleware for Route Protection
// Validates JWT tokens from cookies using HS256 signature verification (jose)

import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { jwtVerify } from 'jose'

// Whitelist: only these paths are accessible without authentication
const PUBLIC_PATHS = ['/signin', '/signup', '/callback', '/403']

// SECRET_KEY for HS256 JWT verification (same key as backend api PassportService)
const SECRET_KEY = new TextEncoder().encode(process.env.SECRET_KEY || '')

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Public paths — allow without authentication
  if (PUBLIC_PATHS.some(path => pathname.startsWith(path))) {
    return NextResponse.next()
  }

  // All other paths require JWT verification
  const token = request.cookies.get('edu_access_token')?.value

  if (!token) {
    const signInUrl = new URL('/signin', request.url)
    signInUrl.searchParams.set('redirect', pathname)
    return NextResponse.redirect(signInUrl)
  }

  // Verify JWT signature using jose (HS256, Edge Runtime compatible)
  try {
    await jwtVerify(token, SECRET_KEY, { algorithms: ['HS256'] })
  }
  catch {
    // Invalid signature, expired, or malformed token — redirect to sign in
    const signInUrl = new URL('/signin', request.url)
    signInUrl.searchParams.set('redirect', pathname)
    return NextResponse.redirect(signInUrl)
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
}
