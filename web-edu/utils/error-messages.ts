/**
 * Error Message Utility
 * Maps technical error codes/messages to user-friendly messages
 *
 * Usage:
 * const { code, userMessage } = getErrorMessage(error, t)
 * // Display: userMessage to user, code for debugging/support
 */

import type { TFunction } from 'i18next'

export interface ErrorInfo {
  /** Error code for debugging/support (e.g., ERR_500, ERR_NETWORK) */
  code: string
  /** User-friendly message (translated) */
  userMessage: string
  /** Original error message (for logging) */
  originalMessage: string
}

/**
 * Known backend error messages and their i18n keys
 */
const KNOWN_BACKEND_ERRORS: Record<string, string> = {
  // Dataset errors
  'Dataset not found': 'errors.api.datasetNotFound',
  'Document not found': 'errors.api.documentNotFound',
  'Invalid request': 'errors.api.invalidRequest',
  'Unauthorized': 'errors.api.unauthorized',
  'Permission denied': 'errors.api.permissionDenied',
  'File too large': 'errors.api.fileTooLarge',
  'Unsupported file type': 'errors.api.unsupportedFileType',
  'Embedding model not configured': 'errors.api.embeddingNotConfigured',
  'Rate limit exceeded': 'errors.api.rateLimitExceeded',
  // Add more as needed
}

/**
 * HTTP status code to i18n key mapping
 */
const HTTP_ERROR_KEYS: Record<string, string> = {
  '400': 'errors.http.badRequest',
  '401': 'errors.http.unauthorized',
  '403': 'errors.http.forbidden',
  '404': 'errors.http.notFound',
  '408': 'errors.http.timeout',
  '413': 'errors.http.payloadTooLarge',
  '429': 'errors.http.tooManyRequests',
  '500': 'errors.http.serverError',
  '502': 'errors.http.badGateway',
  '503': 'errors.http.serviceUnavailable',
  '504': 'errors.http.gatewayTimeout',
}

/**
 * Extract HTTP status code from error message
 * Matches patterns like "API Error: 500" or "Error 404"
 */
function extractHttpStatusCode(message: string): string | null {
  const patterns = [
    /API Error:\s*(\d{3})/i,
    /Error\s*(\d{3})/i,
    /status[:\s]+(\d{3})/i,
    /(\d{3})\s+(?:Internal Server Error|Not Found|Bad Request|Unauthorized|Forbidden)/i,
  ]

  for (const pattern of patterns) {
    const match = message.match(pattern)
    if (match && match[1]) {
      return match[1]
    }
  }
  return null
}

/**
 * Check if error is a network error
 */
function isNetworkError(message: string): boolean {
  const networkPatterns = [
    /network/i,
    /failed to fetch/i,
    /net::ERR/i,
    /ECONNREFUSED/i,
    /ETIMEDOUT/i,
    /ENOTFOUND/i,
  ]
  return networkPatterns.some(pattern => pattern.test(message))
}

/**
 * Get user-friendly error message from an error
 *
 * @param error - Error object or string
 * @param t - i18next translation function (should be from useTranslation('dataset'))
 * @returns ErrorInfo with code, userMessage, and originalMessage
 */
export function getErrorMessage(
  error: Error | string | unknown,
  t: TFunction
): ErrorInfo {
  // Extract error message
  let originalMessage: string
  if (error instanceof Error) {
    originalMessage = error.message
  } else if (typeof error === 'string') {
    originalMessage = error
  } else {
    originalMessage = 'Unknown error'
  }

  // Check for network errors first
  if (isNetworkError(originalMessage)) {
    return {
      code: 'ERR_NETWORK',
      userMessage: t('errors.network'),
      originalMessage,
    }
  }

  // Check for HTTP status codes
  const statusCode = extractHttpStatusCode(originalMessage)
  if (statusCode && HTTP_ERROR_KEYS[statusCode]) {
    return {
      code: `ERR_${statusCode}`,
      userMessage: t(HTTP_ERROR_KEYS[statusCode]),
      originalMessage,
    }
  }

  // Check for known backend error messages
  for (const [errorText, i18nKey] of Object.entries(KNOWN_BACKEND_ERRORS)) {
    if (originalMessage.toLowerCase().includes(errorText.toLowerCase())) {
      return {
        code: errorText.replace(/\s+/g, '_').toUpperCase(),
        userMessage: t(i18nKey),
        originalMessage,
      }
    }
  }

  // Default: unknown error
  return {
    code: 'ERR_UNKNOWN',
    userMessage: t('errors.generic'),
    originalMessage,
  }
}

/**
 * Format error for display
 * Returns a string that includes both user message and error code
 */
export function formatErrorForDisplay(errorInfo: ErrorInfo): string {
  return `${errorInfo.userMessage} (${errorInfo.code})`
}

/**
 * Log error with full details (for debugging)
 */
export function logError(errorInfo: ErrorInfo, context?: string): void {
  console.error(`[${errorInfo.code}]${context ? ` [${context}]` : ''}: ${errorInfo.originalMessage}`)
}
