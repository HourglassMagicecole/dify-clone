/**
 * Unit Tests for middleware.ts
 * Tests Next.js middleware for route protection and JWT validation
 * Priority: P0 (Security-critical functionality)
 */

import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { middleware } from '@/middleware'

// Mock NextResponse
jest.mock('next/server', () => ({
  NextResponse: {
    next: jest.fn(() => ({ type: 'next' })),
    redirect: jest.fn((url: URL) => ({ type: 'redirect', url: url.toString() })),
  },
}))

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

  const createValidToken = (expInSeconds: number): string => {
    const payload = {
      user_id: 'test-user',
      exp: Math.floor(Date.now() / 1000) + expInSeconds,
    }
    const base64Payload = Buffer.from(JSON.stringify(payload)).toString('base64')
    return `header.${base64Payload}.signature`
  }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('public paths', () => {
    it('should allow access to /signin without token', () => {
      // Arrange
      const request = createMockRequest('/signin')

      // Act
      const response = middleware(request)

      // Assert
      expect(NextResponse.next).toHaveBeenCalled()
      expect(response).toEqual({ type: 'next' })
    })

    it('should allow access to /signup without token', () => {
      // Arrange
      const request = createMockRequest('/signup')

      // Act
      const response = middleware(request)

      // Assert
      expect(NextResponse.next).toHaveBeenCalled()
      expect(response).toEqual({ type: 'next' })
    })
  })

  describe('protected paths', () => {
    const protectedPaths = ['/dashboard', '/agents', '/workflows', '/datasets', '/admin']

    protectedPaths.forEach((path) => {
      it(`should redirect to /signin when accessing ${path} without token`, () => {
        // Arrange
        const request = createMockRequest(path)

        // Act
        const response = middleware(request)

        // Assert
        expect(NextResponse.redirect).toHaveBeenCalledWith(
          expect.objectContaining({
            pathname: '/signin',
          }),
        )
        expect(response).toHaveProperty('type', 'redirect')
        expect(response).toHaveProperty('url')
        expect((response as { type: string; url: string }).url).toContain('/signin')
        expect((response as { type: string; url: string }).url).toContain(`redirect=${encodeURIComponent(path)}`)
      })

      it(`should allow access to ${path} with valid non-expired token`, () => {
        // Arrange
        const validToken = createValidToken(3600) // 1 hour from now
        const request = createMockRequest(path, validToken)

        // Act
        const response = middleware(request)

        // Assert
        expect(NextResponse.next).toHaveBeenCalled()
        expect(response).toEqual({ type: 'next' })
      })

      it(`should redirect to /signin when accessing ${path} with expired token`, () => {
        // Arrange
        const expiredToken = createValidToken(-3600) // 1 hour ago
        const request = createMockRequest(path, expiredToken)

        // Act
        middleware(request)

        // Assert
        expect(NextResponse.redirect).toHaveBeenCalledWith(
          expect.objectContaining({
            pathname: '/signin',
          }),
        )
      })

      it(`should redirect to /signin when accessing ${path} with malformed token`, () => {
        // Arrange
        const malformedToken = 'invalid-token-structure'
        const request = createMockRequest(path, malformedToken)

        // Act
        middleware(request)

        // Assert
        expect(NextResponse.redirect).toHaveBeenCalled()
      })

      it(`should redirect to /signin when accessing ${path} with token missing payload`, () => {
        // Arrange
        const invalidToken = 'header..signature'
        const request = createMockRequest(path, invalidToken)

        // Act
        middleware(request)

        // Assert
        expect(NextResponse.redirect).toHaveBeenCalled()
      })

      it(`should redirect to /signin when accessing ${path} with invalid JSON payload`, () => {
        // Arrange
        const invalidJsonToken = 'header.invalid-base64.signature'
        const request = createMockRequest(path, invalidJsonToken)

        // Act
        middleware(request)

        // Assert
        expect(NextResponse.redirect).toHaveBeenCalled()
      })
    })
  })

  describe('unprotected paths', () => {
    it('should allow access to root path without token', () => {
      // Arrange
      const request = createMockRequest('/')

      // Act
      const response = middleware(request)

      // Assert
      expect(NextResponse.next).toHaveBeenCalled()
      expect(response).toEqual({ type: 'next' })
    })

    it('should allow access to /about without token', () => {
      // Arrange
      const request = createMockRequest('/about')

      // Act
      const response = middleware(request)

      // Assert
      expect(NextResponse.next).toHaveBeenCalled()
      expect(response).toEqual({ type: 'next' })
    })
  })

  describe('redirect URL parameter', () => {
    it('should include redirect parameter when redirecting from protected path', () => {
      // Arrange
      const protectedPath = '/dashboard/settings'
      const request = createMockRequest(protectedPath)

      // Act
      const response = middleware(request)

      // Assert
      expect(NextResponse.redirect).toHaveBeenCalled()
      expect((response as { type: string; url: string }).url).toContain('redirect=%2Fdashboard%2Fsettings')
    })
  })
})
