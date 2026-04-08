/**
 * Unit Tests for middleware.ts
 * Tests Next.js middleware for route protection and JWT verification via jose
 * Priority: P0 (Security-critical functionality)
 *
 * jose is mocked to control verification outcomes (valid, invalid signature, expired).
 * All middleware() calls use await (middleware is async).
 */

import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { middleware } from '@/middleware'
import { jwtVerify } from 'jose'

// Mock jose
jest.mock('jose', () => ({
  jwtVerify: jest.fn(),
}))

// Mock NextResponse
jest.mock('next/server', () => ({
  NextResponse: {
    next: jest.fn(() => ({ type: 'next' })),
    redirect: jest.fn((url: URL) => ({ type: 'redirect', url: url.toString() })),
  },
}))

const mockedJwtVerify = jwtVerify as jest.MockedFunction<typeof jwtVerify>

describe('middleware', () => {
  const createMockRequest = (pathname: string, token?: string): NextRequest => {
    const url = `http://localhost:3001${pathname}`
    const mockCookies = new Map()
    if (token) {
      mockCookies.set('edu_access_token', { name: 'edu_access_token', value: token })
    }

    return {
      nextUrl: {
        pathname,
        searchParams: new URLSearchParams(),
      },
      url,
      cookies: {
        get: (name: string) => mockCookies.get(name),
      },
    } as unknown as NextRequest
  }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  // ── PUBLIC_PATHS: accessible without token ──

  describe('PUBLIC_PATHS — accessible without token', () => {
    const publicPaths = ['/signin', '/signup', '/callback', '/403']

    publicPaths.forEach((path) => {
      it(`should allow ${path} without token`, async () => {
        const request = createMockRequest(path)
        const response = await middleware(request)

        expect(NextResponse.next).toHaveBeenCalled()
        expect(response).toEqual({ type: 'next' })
        // jose should NOT be called for public paths
        expect(mockedJwtVerify).not.toHaveBeenCalled()
      })
    })

    it('should allow /signin/some-sub-path without token (startsWith match)', async () => {
      const request = createMockRequest('/signin/callback')
      const response = await middleware(request)

      expect(NextResponse.next).toHaveBeenCalled()
      expect(response).toEqual({ type: 'next' })
    })
  })

  // ── Protected paths: require valid JWT ──

  describe('protected paths — valid JWT', () => {
    it('should allow access to /dashboard with a valid JWT', async () => {
      mockedJwtVerify.mockResolvedValueOnce({
        payload: { user_id: 'test-user', exp: Math.floor(Date.now() / 1000) + 3600 },
        protectedHeader: { alg: 'HS256' },
      } as any)

      const request = createMockRequest('/dashboard', 'valid.jwt.token')
      const response = await middleware(request)

      expect(mockedJwtVerify).toHaveBeenCalledWith(
        'valid.jwt.token',
        expect.any(Uint8Array),
        { algorithms: ['HS256'] },
      )
      expect(NextResponse.next).toHaveBeenCalled()
      expect(response).toEqual({ type: 'next' })
    })
  })

  describe('protected paths — forged JWT (invalid signature)', () => {
    it('should redirect to /signin when JWT signature is invalid', async () => {
      mockedJwtVerify.mockRejectedValueOnce(new Error('JWSSignatureVerificationFailed'))

      const request = createMockRequest('/dashboard', 'forged.jwt.token')
      const response = await middleware(request)

      expect(mockedJwtVerify).toHaveBeenCalled()
      expect(NextResponse.redirect).toHaveBeenCalledWith(
        expect.objectContaining({ pathname: '/signin' }),
      )
      expect(response).toHaveProperty('type', 'redirect')
      expect((response as any).url).toContain('/signin')
      expect((response as any).url).toContain(`redirect=${encodeURIComponent('/dashboard')}`)
    })
  })

  describe('protected paths — expired JWT', () => {
    it('should redirect to /signin when JWT is expired', async () => {
      const expiredError = new Error('ERR_JWT_EXPIRED')
      expiredError.name = 'JWTExpired'
      mockedJwtVerify.mockRejectedValueOnce(expiredError)

      const request = createMockRequest('/agents', 'expired.jwt.token')
      const response = await middleware(request)

      expect(mockedJwtVerify).toHaveBeenCalled()
      expect(NextResponse.redirect).toHaveBeenCalledWith(
        expect.objectContaining({ pathname: '/signin' }),
      )
      expect(response).toHaveProperty('type', 'redirect')
      expect((response as any).url).toContain('/signin')
    })
  })

  describe('protected paths — no token', () => {
    const protectedPaths = ['/dashboard', '/agents', '/datasets', '/admin']

    protectedPaths.forEach((path) => {
      it(`should redirect to /signin when accessing ${path} without token`, async () => {
        const request = createMockRequest(path)
        const response = await middleware(request)

        // No token means jose should NOT be called
        expect(mockedJwtVerify).not.toHaveBeenCalled()
        expect(NextResponse.redirect).toHaveBeenCalledWith(
          expect.objectContaining({ pathname: '/signin' }),
        )
        expect(response).toHaveProperty('type', 'redirect')
        expect((response as any).url).toContain('/signin')
        expect((response as any).url).toContain(`redirect=${encodeURIComponent(path)}`)
      })
    })
  })

  // ── Whitelist enforcement: non-public paths must be protected ──

  describe('whitelist enforcement — non-public paths redirect without token', () => {
    // These paths are NOT in PUBLIC_PATHS so they must require auth
    const nonPublicPaths = ['/', '/about', '/owner', '/owner/dashboard', '/my-session', '/sessions']

    nonPublicPaths.forEach((path) => {
      it(`should redirect ${path} to /signin without token (whitelist enforcement)`, async () => {
        const request = createMockRequest(path)
        const response = await middleware(request)

        expect(NextResponse.redirect).toHaveBeenCalledWith(
          expect.objectContaining({ pathname: '/signin' }),
        )
        expect(response).toHaveProperty('type', 'redirect')
        expect((response as any).url).toContain('/signin')
      })
    })
  })

  // ── Redirect URL parameter ──

  describe('redirect URL parameter', () => {
    it('should include redirect parameter when redirecting from protected path', async () => {
      const protectedPath = '/dashboard/settings'
      const request = createMockRequest(protectedPath)
      const response = await middleware(request)

      expect(NextResponse.redirect).toHaveBeenCalled()
      expect((response as any).url).toContain('redirect=%2Fdashboard%2Fsettings')
    })
  })
})
