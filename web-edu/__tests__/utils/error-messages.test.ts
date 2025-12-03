/**
 * Error Messages Utility Tests
 * Tests for user-friendly error message mapping
 */

import { getErrorMessage, formatErrorForDisplay, logError, type ErrorInfo } from '@/utils/error-messages'

// Mock translation function
const mockT = (key: string): string => {
  const translations: Record<string, string> = {
    'errors.network': '서버에 연결할 수 없습니다.',
    'errors.generic': '예기치 않은 오류가 발생했습니다.',
    'errors.http.badRequest': '요청을 처리할 수 없습니다.',
    'errors.http.unauthorized': '세션이 만료되었습니다.',
    'errors.http.forbidden': '이 작업을 수행할 권한이 없습니다.',
    'errors.http.notFound': '요청한 항목을 찾을 수 없습니다.',
    'errors.http.timeout': '요청 시간이 초과되었습니다.',
    'errors.http.payloadTooLarge': '파일 크기가 너무 큽니다.',
    'errors.http.tooManyRequests': '요청이 너무 많습니다.',
    'errors.http.serverError': '서버 오류가 발생했습니다.',
    'errors.http.badGateway': '서비스를 일시적으로 사용할 수 없습니다.',
    'errors.http.serviceUnavailable': '서비스를 현재 사용할 수 없습니다.',
    'errors.http.gatewayTimeout': '서버 응답 시간이 초과되었습니다.',
    'errors.api.datasetNotFound': '지식베이스를 찾을 수 없습니다.',
    'errors.api.documentNotFound': '문서를 찾을 수 없습니다.',
    'errors.api.invalidRequest': '잘못된 요청입니다.',
    'errors.api.unauthorized': '이 작업을 수행하려면 로그인이 필요합니다.',
    'errors.api.permissionDenied': '이 리소스에 접근할 권한이 없습니다.',
    'errors.api.fileTooLarge': '파일이 최대 크기 제한을 초과합니다.',
    'errors.api.unsupportedFileType': '지원하지 않는 파일 형식입니다.',
    'errors.api.embeddingNotConfigured': '임베딩 모델이 설정되지 않았습니다.',
    'errors.api.rateLimitExceeded': '요청이 너무 많습니다.',
  }
  return translations[key] || key
}

describe('getErrorMessage', () => {
  describe('HTTP status code extraction', () => {
    it('should extract status code from "API Error: 500" format', () => {
      const result = getErrorMessage('API Error: 500 Internal Server Error', mockT)

      expect(result.code).toBe('ERR_500')
      expect(result.userMessage).toBe('서버 오류가 발생했습니다.')
      expect(result.originalMessage).toBe('API Error: 500 Internal Server Error')
    })

    it('should extract status code from "Error 404" format', () => {
      const result = getErrorMessage('Error 404', mockT)

      expect(result.code).toBe('ERR_404')
      expect(result.userMessage).toBe('요청한 항목을 찾을 수 없습니다.')
    })

    it('should extract status code from "status: 401" format', () => {
      const result = getErrorMessage('Request failed with status: 401', mockT)

      expect(result.code).toBe('ERR_401')
      expect(result.userMessage).toBe('세션이 만료되었습니다.')
    })

    it('should extract status code from "403 Forbidden" format', () => {
      const result = getErrorMessage('403 Forbidden', mockT)

      expect(result.code).toBe('ERR_403')
      expect(result.userMessage).toBe('이 작업을 수행할 권한이 없습니다.')
    })

    it('should handle all HTTP status codes', () => {
      const testCases = [
        { message: 'API Error: 400', expectedCode: 'ERR_400' },
        { message: 'API Error: 401', expectedCode: 'ERR_401' },
        { message: 'API Error: 403', expectedCode: 'ERR_403' },
        { message: 'API Error: 404', expectedCode: 'ERR_404' },
        { message: 'API Error: 408', expectedCode: 'ERR_408' },
        { message: 'API Error: 413', expectedCode: 'ERR_413' },
        { message: 'API Error: 429', expectedCode: 'ERR_429' },
        { message: 'API Error: 500', expectedCode: 'ERR_500' },
        { message: 'API Error: 502', expectedCode: 'ERR_502' },
        { message: 'API Error: 503', expectedCode: 'ERR_503' },
        { message: 'API Error: 504', expectedCode: 'ERR_504' },
      ]

      testCases.forEach(({ message, expectedCode }) => {
        const result = getErrorMessage(message, mockT)
        expect(result.code).toBe(expectedCode)
      })
    })
  })

  describe('Network error detection', () => {
    it('should detect "network" keyword', () => {
      const result = getErrorMessage('Network error occurred', mockT)

      expect(result.code).toBe('ERR_NETWORK')
      expect(result.userMessage).toBe('서버에 연결할 수 없습니다.')
    })

    it('should detect "failed to fetch" error', () => {
      const result = getErrorMessage('Failed to fetch', mockT)

      expect(result.code).toBe('ERR_NETWORK')
      expect(result.userMessage).toBe('서버에 연결할 수 없습니다.')
    })

    it('should detect "net::ERR" Chrome network errors', () => {
      const result = getErrorMessage('net::ERR_CONNECTION_REFUSED', mockT)

      expect(result.code).toBe('ERR_NETWORK')
    })

    it('should detect ECONNREFUSED error', () => {
      const result = getErrorMessage('connect ECONNREFUSED 127.0.0.1:5001', mockT)

      expect(result.code).toBe('ERR_NETWORK')
    })

    it('should detect ETIMEDOUT error', () => {
      const result = getErrorMessage('ETIMEDOUT: connection timed out', mockT)

      expect(result.code).toBe('ERR_NETWORK')
    })

    it('should detect ENOTFOUND error', () => {
      const result = getErrorMessage('getaddrinfo ENOTFOUND api.example.com', mockT)

      expect(result.code).toBe('ERR_NETWORK')
    })
  })

  describe('Known backend error messages', () => {
    it('should map "Dataset not found" to user-friendly message', () => {
      const result = getErrorMessage('Dataset not found', mockT)

      expect(result.code).toBe('DATASET_NOT_FOUND')
      expect(result.userMessage).toBe('지식베이스를 찾을 수 없습니다.')
    })

    it('should map "Document not found" to user-friendly message', () => {
      const result = getErrorMessage('Document not found', mockT)

      expect(result.code).toBe('DOCUMENT_NOT_FOUND')
      expect(result.userMessage).toBe('문서를 찾을 수 없습니다.')
    })

    it('should map "Invalid request" to user-friendly message', () => {
      const result = getErrorMessage('Invalid request: missing field', mockT)

      expect(result.code).toBe('INVALID_REQUEST')
      expect(result.userMessage).toBe('잘못된 요청입니다.')
    })

    it('should map "Unauthorized" to user-friendly message', () => {
      const result = getErrorMessage('Unauthorized access', mockT)

      expect(result.code).toBe('UNAUTHORIZED')
      expect(result.userMessage).toBe('이 작업을 수행하려면 로그인이 필요합니다.')
    })

    it('should map "Permission denied" to user-friendly message', () => {
      const result = getErrorMessage('Permission denied for this resource', mockT)

      expect(result.code).toBe('PERMISSION_DENIED')
      expect(result.userMessage).toBe('이 리소스에 접근할 권한이 없습니다.')
    })

    it('should map "File too large" to user-friendly message', () => {
      const result = getErrorMessage('File too large: max 15MB', mockT)

      expect(result.code).toBe('FILE_TOO_LARGE')
      expect(result.userMessage).toBe('파일이 최대 크기 제한을 초과합니다.')
    })

    it('should map "Unsupported file type" to user-friendly message', () => {
      const result = getErrorMessage('Unsupported file type: .exe', mockT)

      expect(result.code).toBe('UNSUPPORTED_FILE_TYPE')
      expect(result.userMessage).toBe('지원하지 않는 파일 형식입니다.')
    })

    it('should map "Embedding model not configured" to user-friendly message', () => {
      const result = getErrorMessage('Embedding model not configured', mockT)

      expect(result.code).toBe('EMBEDDING_MODEL_NOT_CONFIGURED')
      expect(result.userMessage).toBe('임베딩 모델이 설정되지 않았습니다.')
    })

    it('should map "Rate limit exceeded" to user-friendly message', () => {
      const result = getErrorMessage('Rate limit exceeded: try again later', mockT)

      expect(result.code).toBe('RATE_LIMIT_EXCEEDED')
      expect(result.userMessage).toBe('요청이 너무 많습니다.')
    })

    it('should be case-insensitive for backend errors', () => {
      const result = getErrorMessage('DATASET NOT FOUND', mockT)

      expect(result.code).toBe('DATASET_NOT_FOUND')
      expect(result.userMessage).toBe('지식베이스를 찾을 수 없습니다.')
    })
  })

  describe('Error input types', () => {
    it('should handle Error object', () => {
      const error = new Error('API Error: 500 Internal Server Error')
      const result = getErrorMessage(error, mockT)

      expect(result.code).toBe('ERR_500')
      expect(result.originalMessage).toBe('API Error: 500 Internal Server Error')
    })

    it('should handle string error', () => {
      const result = getErrorMessage('Something went wrong', mockT)

      expect(result.code).toBe('ERR_UNKNOWN')
      expect(result.originalMessage).toBe('Something went wrong')
    })

    it('should handle unknown error type', () => {
      const result = getErrorMessage({ foo: 'bar' }, mockT)

      expect(result.code).toBe('ERR_UNKNOWN')
      expect(result.originalMessage).toBe('Unknown error')
    })

    it('should handle null/undefined', () => {
      const resultNull = getErrorMessage(null, mockT)
      expect(resultNull.code).toBe('ERR_UNKNOWN')
      expect(resultNull.originalMessage).toBe('Unknown error')

      const resultUndefined = getErrorMessage(undefined, mockT)
      expect(resultUndefined.code).toBe('ERR_UNKNOWN')
      expect(resultUndefined.originalMessage).toBe('Unknown error')
    })
  })

  describe('Unknown errors', () => {
    it('should return ERR_UNKNOWN for unrecognized errors', () => {
      const result = getErrorMessage('Some random error message', mockT)

      expect(result.code).toBe('ERR_UNKNOWN')
      expect(result.userMessage).toBe('예기치 않은 오류가 발생했습니다.')
      expect(result.originalMessage).toBe('Some random error message')
    })

    it('should return ERR_UNKNOWN for unmapped status codes', () => {
      const result = getErrorMessage('API Error: 418 I am a teapot', mockT)

      // 418 is not in HTTP_ERROR_KEYS, so it should be unknown
      expect(result.code).toBe('ERR_UNKNOWN')
    })
  })

  describe('Priority order', () => {
    it('should prioritize network errors over HTTP status codes', () => {
      // Message contains both network keyword and status code
      const result = getErrorMessage('Network error: API Error: 500', mockT)

      expect(result.code).toBe('ERR_NETWORK')
    })

    it('should prioritize HTTP status codes over backend errors', () => {
      // Message contains both HTTP status and backend error text
      const result = getErrorMessage('API Error: 404 - Dataset not found', mockT)

      expect(result.code).toBe('ERR_404')
    })
  })
})

describe('formatErrorForDisplay', () => {
  it('should format error info with message and code', () => {
    const errorInfo: ErrorInfo = {
      code: 'ERR_500',
      userMessage: '서버 오류가 발생했습니다.',
      originalMessage: 'API Error: 500 Internal Server Error',
    }

    const result = formatErrorForDisplay(errorInfo)

    expect(result).toBe('서버 오류가 발생했습니다. (ERR_500)')
  })

  it('should handle different code formats', () => {
    const errorInfo: ErrorInfo = {
      code: 'DATASET_NOT_FOUND',
      userMessage: '지식베이스를 찾을 수 없습니다.',
      originalMessage: 'Dataset not found',
    }

    const result = formatErrorForDisplay(errorInfo)

    expect(result).toBe('지식베이스를 찾을 수 없습니다. (DATASET_NOT_FOUND)')
  })
})

describe('logError', () => {
  let consoleSpy: jest.SpyInstance

  beforeEach(() => {
    consoleSpy = jest.spyOn(console, 'error').mockImplementation()
  })

  afterEach(() => {
    consoleSpy.mockRestore()
  })

  it('should log error with code and original message', () => {
    const errorInfo: ErrorInfo = {
      code: 'ERR_500',
      userMessage: '서버 오류가 발생했습니다.',
      originalMessage: 'API Error: 500 Internal Server Error',
    }

    logError(errorInfo)

    expect(consoleSpy).toHaveBeenCalledWith('[ERR_500]: API Error: 500 Internal Server Error')
  })

  it('should include context when provided', () => {
    const errorInfo: ErrorInfo = {
      code: 'ERR_404',
      userMessage: '요청한 항목을 찾을 수 없습니다.',
      originalMessage: 'Not found',
    }

    logError(errorInfo, 'Step4Store.handleCreateRAG')

    expect(consoleSpy).toHaveBeenCalledWith('[ERR_404] [Step4Store.handleCreateRAG]: Not found')
  })

  it('should handle empty context', () => {
    const errorInfo: ErrorInfo = {
      code: 'ERR_UNKNOWN',
      userMessage: '예기치 않은 오류가 발생했습니다.',
      originalMessage: 'Unknown error',
    }

    logError(errorInfo, '')

    expect(consoleSpy).toHaveBeenCalledWith('[ERR_UNKNOWN]: Unknown error')
  })
})
