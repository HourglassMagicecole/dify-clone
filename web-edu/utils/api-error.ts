/**
 * API Error Handling Utilities
 *
 * Provides custom error class and error message formatting for API responses
 */

export class APIError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message)
    this.name = 'APIError'
  }
}

/**
 * Convert unknown error to user-friendly message
 * @param error Error object (can be APIError, Error, or unknown)
 * @returns User-friendly error message
 */
export function handleAPIError(error: unknown): string {
  if (error instanceof APIError) {
    // API error codes to user-friendly messages
    switch (error.code) {
      case 'INVALID_API_KEY':
        return 'API Key가 유효하지 않습니다. 관리자에게 문의하세요.'
      case 'RATE_LIMIT_EXCEEDED':
        return '요청 제한을 초과했습니다. 잠시 후 다시 시도하세요.'
      case 'INSUFFICIENT_QUOTA':
        return 'API 사용량이 제한을 초과했습니다. 관리자에게 문의하세요.'
      case 'VALIDATION_ERROR':
        return '입력값이 올바르지 않습니다. 다시 확인해주세요.'
      case 'UNAUTHORIZED':
        return '인증에 실패했습니다. 다시 로그인해주세요.'
      case 'FORBIDDEN':
        return '접근 권한이 없습니다. 관리자에게 문의하세요.'
      case 'NOT_FOUND':
        return '요청한 리소스를 찾을 수 없습니다.'
      case 'INTERNAL_SERVER_ERROR':
        return '서버 오류가 발생했습니다. 잠시 후 다시 시도하세요.'
      default:
        return error.message || '알 수 없는 오류가 발생했습니다.'
    }
  }

  if (error instanceof Error) {
    return error.message
  }

  return '예상치 못한 오류가 발생했습니다.'
}

/**
 * Parse HTTP response error and create APIError
 * @param response HTTP Response object
 * @returns APIError instance
 */
export async function parseAPIError(response: Response): Promise<APIError> {
  let errorData: { code?: string; message?: string } = {}

  try {
    errorData = await response.json()
  }
  catch {
    // Failed to parse JSON, use default error
    errorData = {}
  }

  const code = errorData.code || `HTTP_${response.status}`
  const message = errorData.message || response.statusText || 'Unknown error'

  return new APIError(response.status, code, message)
}
