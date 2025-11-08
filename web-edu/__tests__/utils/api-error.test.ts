/**
 * API Error Utilities Tests
 */

import { APIError, handleAPIError, parseAPIError } from '@/utils/api-error'

describe('APIError', () => {
  it('should create an APIError instance with correct properties', () => {
    const error = new APIError(400, 'VALIDATION_ERROR', 'Invalid input')

    expect(error).toBeInstanceOf(Error)
    expect(error).toBeInstanceOf(APIError)
    expect(error.status).toBe(400)
    expect(error.code).toBe('VALIDATION_ERROR')
    expect(error.message).toBe('Invalid input')
    expect(error.name).toBe('APIError')
  })
})

describe('handleAPIError', () => {
  it('should return user-friendly message for known error codes', () => {
    const invalidKeyError = new APIError(401, 'INVALID_API_KEY', 'Invalid API Key')
    expect(handleAPIError(invalidKeyError)).toContain('API Key가 유효하지 않습니다')

    const rateLimitError = new APIError(429, 'RATE_LIMIT_EXCEEDED', 'Rate limit exceeded')
    expect(handleAPIError(rateLimitError)).toContain('요청 제한을 초과했습니다')

    const quotaError = new APIError(402, 'INSUFFICIENT_QUOTA', 'Insufficient quota')
    expect(handleAPIError(quotaError)).toContain('API 사용량이 제한을 초과했습니다')

    const validationError = new APIError(400, 'VALIDATION_ERROR', 'Validation failed')
    expect(handleAPIError(validationError)).toContain('입력값이 올바르지 않습니다')

    const unauthorizedError = new APIError(401, 'UNAUTHORIZED', 'Unauthorized')
    expect(handleAPIError(unauthorizedError)).toContain('인증에 실패했습니다')

    const forbiddenError = new APIError(403, 'FORBIDDEN', 'Forbidden')
    expect(handleAPIError(forbiddenError)).toContain('접근 권한이 없습니다')

    const notFoundError = new APIError(404, 'NOT_FOUND', 'Not found')
    expect(handleAPIError(notFoundError)).toContain('요청한 리소스를 찾을 수 없습니다')

    const serverError = new APIError(500, 'INTERNAL_SERVER_ERROR', 'Internal error')
    expect(handleAPIError(serverError)).toContain('서버 오류가 발생했습니다')
  })

  it('should return original message for unknown error codes', () => {
    const unknownError = new APIError(418, 'TEAPOT', 'I am a teapot')
    expect(handleAPIError(unknownError)).toBe('I am a teapot')
  })

  it('should handle generic Error instances', () => {
    const genericError = new Error('Something went wrong')
    expect(handleAPIError(genericError)).toBe('Something went wrong')
  })

  it('should handle unknown error types', () => {
    const unknownError = { foo: 'bar' }
    expect(handleAPIError(unknownError)).toContain('예상치 못한 오류가 발생했습니다')
  })

  it('should handle null/undefined', () => {
    expect(handleAPIError(null)).toContain('예상치 못한 오류가 발생했습니다')
    expect(handleAPIError(undefined)).toContain('예상치 못한 오류가 발생했습니다')
  })
})

describe('parseAPIError', () => {
  it('should parse error response with code and message', async () => {
    const mockResponse = {
      status: 400,
      statusText: 'Bad Request',
      json: jest.fn().mockResolvedValue({
        code: 'VALIDATION_ERROR',
        message: 'Invalid input data',
      }),
    } as unknown as Response

    const error = await parseAPIError(mockResponse)

    expect(error).toBeInstanceOf(APIError)
    expect(error.status).toBe(400)
    expect(error.code).toBe('VALIDATION_ERROR')
    expect(error.message).toBe('Invalid input data')
  })

  it('should handle response without error code', async () => {
    const mockResponse = {
      status: 500,
      statusText: 'Internal Server Error',
      json: jest.fn().mockResolvedValue({
        message: 'Something went wrong',
      }),
    } as unknown as Response

    const error = await parseAPIError(mockResponse)

    expect(error.status).toBe(500)
    expect(error.code).toBe('HTTP_500')
    expect(error.message).toBe('Something went wrong')
  })

  it('should handle response without JSON body', async () => {
    const mockResponse = {
      status: 404,
      statusText: 'Not Found',
      json: jest.fn().mockRejectedValue(new Error('No JSON')),
    } as unknown as Response

    const error = await parseAPIError(mockResponse)

    expect(error.status).toBe(404)
    expect(error.code).toBe('HTTP_404')
    expect(error.message).toBe('Not Found')
  })

  it('should handle empty response', async () => {
    const mockResponse = {
      status: 503,
      statusText: '',
      json: jest.fn().mockResolvedValue({}),
    } as unknown as Response

    const error = await parseAPIError(mockResponse)

    expect(error.status).toBe(503)
    expect(error.code).toBe('HTTP_503')
    expect(error.message).toBe('Unknown error')
  })
})
