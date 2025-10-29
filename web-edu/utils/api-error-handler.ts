/**
 * API Error Handling Utility
 * Provides user-friendly error messages for API errors
 */

/**
 * API Error structure
 */
export interface APIError {
  code?: string
  message: string
  status?: number
  details?: unknown
}

/**
 * Error codes and their messages
 */
const ERROR_MESSAGES: Record<string, string> = {
  // Authentication errors
  UNAUTHORIZED: '인증이 필요합니다. 다시 로그인해주세요.',
  FORBIDDEN: '이 작업을 수행할 권한이 없습니다.',
  INVALID_TOKEN: '인증 토큰이 유효하지 않습니다.',
  TOKEN_EXPIRED: '세션이 만료되었습니다. 다시 로그인해주세요.',

  // Validation errors
  VALIDATION_ERROR: '입력값을 확인해주세요.',
  INVALID_PARAM: '잘못된 파라미터입니다.',
  REQUIRED_FIELD: '필수 항목을 입력해주세요.',

  // Resource errors
  NOT_FOUND: '요청한 리소스를 찾을 수 없습니다.',
  ALREADY_EXISTS: '이미 존재하는 항목입니다.',
  DUPLICATE_NAME: '이미 사용 중인 이름입니다.',

  // Server errors
  INTERNAL_SERVER_ERROR: '서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요.',
  SERVICE_UNAVAILABLE: '서비스를 사용할 수 없습니다. 잠시 후 다시 시도해주세요.',
  TIMEOUT: '요청 시간이 초과되었습니다.',

  // Network errors
  NETWORK_ERROR: '네트워크 연결을 확인해주세요.',
  OFFLINE: '인터넷 연결이 없습니다.',

  // Default
  UNKNOWN_ERROR: '알 수 없는 오류가 발생했습니다.',
}

/**
 * Get error message by HTTP status code
 */
function getMessageByStatus(status: number): string {
  switch (status) {
    case 400:
      return ERROR_MESSAGES.VALIDATION_ERROR
    case 401:
      return ERROR_MESSAGES.UNAUTHORIZED
    case 403:
      return ERROR_MESSAGES.FORBIDDEN
    case 404:
      return ERROR_MESSAGES.NOT_FOUND
    case 409:
      return ERROR_MESSAGES.ALREADY_EXISTS
    case 500:
      return ERROR_MESSAGES.INTERNAL_SERVER_ERROR
    case 503:
      return ERROR_MESSAGES.SERVICE_UNAVAILABLE
    default:
      return ERROR_MESSAGES.UNKNOWN_ERROR
  }
}

/**
 * Handle API error and return user-friendly message
 */
export function handleAPIError(error: unknown): string {
  // Network error
  if (error instanceof TypeError && error.message.includes('fetch')) {
    return ERROR_MESSAGES.NETWORK_ERROR
  }

  // API Error object
  if (typeof error === 'object' && error !== null) {
    const apiError = error as APIError

    // Error code exists
    if (apiError.code && ERROR_MESSAGES[apiError.code]) {
      return ERROR_MESSAGES[apiError.code]
    }

    // HTTP status exists
    if (apiError.status) {
      return getMessageByStatus(apiError.status)
    }

    // Error message exists
    if (apiError.message) {
      return apiError.message
    }
  }

  // Standard Error
  if (error instanceof Error) {
    // Check for specific error patterns
    if (error.message.includes('401')) {
      return ERROR_MESSAGES.UNAUTHORIZED
    }
    if (error.message.includes('403')) {
      return ERROR_MESSAGES.FORBIDDEN
    }
    if (error.message.includes('404')) {
      return ERROR_MESSAGES.NOT_FOUND
    }
    if (error.message.includes('500')) {
      return ERROR_MESSAGES.INTERNAL_SERVER_ERROR
    }

    return error.message
  }

  // Unknown error
  return ERROR_MESSAGES.UNKNOWN_ERROR
}

/**
 * Parse API error response
 */
export function parseAPIError(response: Response): Promise<APIError> {
  return response.json().then(
    (data) => ({
      code: data.code,
      message: data.message || getMessageByStatus(response.status),
      status: response.status,
      details: data.details,
    }),
    () => ({
      message: getMessageByStatus(response.status),
      status: response.status,
    })
  )
}

/**
 * Check if error is due to authentication failure
 */
export function isAuthError(error: unknown): boolean {
  if (typeof error === 'object' && error !== null) {
    const apiError = error as APIError
    return (
      apiError.status === 401 ||
      apiError.code === 'UNAUTHORIZED' ||
      apiError.code === 'TOKEN_EXPIRED' ||
      apiError.code === 'INVALID_TOKEN'
    )
  }

  if (error instanceof Error) {
    return error.message.includes('401') || error.message.toLowerCase().includes('unauthorized')
  }

  return false
}

/**
 * Check if error is due to network failure
 */
export function isNetworkError(error: unknown): boolean {
  if (error instanceof TypeError && error.message.includes('fetch')) {
    return true
  }

  if (typeof error === 'object' && error !== null) {
    const apiError = error as APIError
    return apiError.code === 'NETWORK_ERROR' || apiError.code === 'OFFLINE'
  }

  return false
}
