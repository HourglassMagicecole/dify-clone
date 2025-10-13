/**
 * Unit Tests for service/auth.ts
 * Tests authentication API client functions
 * Priority: P0 (Security-critical functionality)
 */

import type { AccountProfile, SignInRequest, SignInResponse } from '@/types/auth'
import {
  getCurrentUser,
  refreshAccessToken,
  signIn,
  signOut,
} from '@/service/auth'

describe('service/auth', () => {
  const mockFetch = global.fetch as jest.Mock

  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('signIn', () => {
    it('should successfully sign in with valid credentials', async () => {
      // Arrange
      const credentials: SignInRequest = {
        email: 'test@example.com',
        password: 'password123',
      }

      const mockResponse: SignInResponse = {
        result: 'success',
        data: {
          access_token: 'mock-access-token',
          refresh_token: 'mock-refresh-token',
          account: {
            id: 'user-123',
            name: 'Test User',
            email: 'test@example.com',
            avatar: null,
          },
        },
      }

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
      })

      // Act
      const result = await signIn(credentials)

      // Assert
      expect(mockFetch).toHaveBeenCalledWith(
        '/console/api/login',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(credentials),
        }),
      )
      expect(result).toEqual(mockResponse)
    })

    it('should throw error when login fails with error message', async () => {
      // Arrange
      const credentials: SignInRequest = {
        email: 'invalid@example.com',
        password: 'wrongpassword',
      }

      mockFetch.mockResolvedValue({
        ok: false,
        json: async () => ({ message: 'Invalid credentials' }),
      })

      // Act & Assert
      await expect(signIn(credentials)).rejects.toThrow('Invalid credentials')
    })

    it('should throw generic error when login fails without error message', async () => {
      // Arrange
      const credentials: SignInRequest = {
        email: 'test@example.com',
        password: 'password123',
      }

      mockFetch.mockResolvedValue({
        ok: false,
        json: async () => ({}),
      })

      // Act & Assert
      await expect(signIn(credentials)).rejects.toThrow('Login failed')
    })
  })

  describe('signOut', () => {
    it('should successfully sign out with valid token', async () => {
      // Arrange
      const accessToken = 'valid-access-token'

      mockFetch.mockResolvedValue({
        ok: true,
      })

      // Act
      await signOut(accessToken)

      // Assert
      expect(mockFetch).toHaveBeenCalledWith(
        '/console/api/logout',
        expect.objectContaining({
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
        }),
      )
    })

    it('should throw error when logout fails', async () => {
      // Arrange
      const accessToken = 'invalid-token'

      mockFetch.mockResolvedValue({
        ok: false,
      })

      // Act & Assert
      await expect(signOut(accessToken)).rejects.toThrow('Logout failed')
    })
  })

  describe('getCurrentUser', () => {
    it('should fetch current user profile successfully', async () => {
      // Arrange
      const accessToken = 'valid-access-token'
      const mockProfile: AccountProfile = {
        id: 'user-123',
        name: 'Test User',
        email: 'test@example.com',
        avatar: 'https://example.com/avatar.jpg',
        avatar_url: 'https://example.com/avatar.jpg',
        interface_language: 'ko-KR',
        interface_theme: 'light',
        timezone: 'Asia/Seoul',
        last_login_at: 1704067200,
        last_login_ip: '127.0.0.1',
        created_at: 1704067200,
      }

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => mockProfile,
      })

      // Act
      const result = await getCurrentUser(accessToken)

      // Assert
      expect(mockFetch).toHaveBeenCalledWith(
        '/console/api/account/profile',
        expect.objectContaining({
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
          },
        }),
      )
      expect(result).toEqual(mockProfile)
    })

    it('should throw error when user fetch fails', async () => {
      // Arrange
      const accessToken = 'invalid-token'

      mockFetch.mockResolvedValue({
        ok: false,
      })

      // Act & Assert
      await expect(getCurrentUser(accessToken)).rejects.toThrow('Failed to fetch user info')
    })
  })

  describe('refreshAccessToken', () => {
    it('should refresh access token successfully', async () => {
      // Arrange
      const refreshToken = 'valid-refresh-token'
      const mockResponse: SignInResponse = {
        result: 'success',
        data: {
          access_token: 'new-access-token',
          refresh_token: 'new-refresh-token',
          account: {
            id: 'user-123',
            name: 'Test User',
            email: 'test@example.com',
            avatar: null,
          },
        },
      }

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
      })

      // Act
      const result = await refreshAccessToken(refreshToken)

      // Assert
      expect(mockFetch).toHaveBeenCalledWith(
        '/console/api/refresh-token',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refresh_token: refreshToken }),
        }),
      )
      expect(result).toEqual(mockResponse)
    })

    it('should throw error when token refresh fails with error message', async () => {
      // Arrange
      const refreshToken = 'expired-refresh-token'

      mockFetch.mockResolvedValue({
        ok: false,
        json: async () => ({ message: 'Refresh token expired' }),
      })

      // Act & Assert
      await expect(refreshAccessToken(refreshToken)).rejects.toThrow('Refresh token expired')
    })

    it('should throw generic error when token refresh fails without error message', async () => {
      // Arrange
      const refreshToken = 'invalid-token'

      mockFetch.mockResolvedValue({
        ok: false,
        json: async () => ({}),
      })

      // Act & Assert
      await expect(refreshAccessToken(refreshToken)).rejects.toThrow('Token refresh failed')
    })
  })
})
