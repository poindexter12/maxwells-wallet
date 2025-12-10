/**
 * Hook for translating API error responses.
 *
 * The backend returns structured errors in the format:
 * {
 *   "error_code": "TAG_NOT_FOUND",
 *   "message": "Optional fallback message",
 *   "context": { "tag_id": 123 }  // For interpolation
 * }
 *
 * This hook maps error_code to translated messages using next-intl.
 */

import { useTranslations } from 'next-intl'

interface ApiErrorDetail {
  error_code: string
  message?: string | null
  context?: Record<string, string | number | Date>
}

interface ApiErrorResponse {
  detail: ApiErrorDetail | string
}

/**
 * Hook for translating API error responses.
 *
 * Usage:
 * ```tsx
 * const { translateError } = useApiError()
 *
 * try {
 *   await api.deleteTag(tagId)
 * } catch (error) {
 *   const message = translateError(error.response?.data)
 *   toast.error(message)
 * }
 * ```
 */
export function useApiError() {
  const t = useTranslations('errors')

  /**
   * Translate an API error response to a user-friendly message.
   *
   * @param response The error response from the API (response.data)
   * @returns Translated error message
   */
  const translateError = (response: ApiErrorResponse | unknown): string => {
    // Handle null/undefined
    if (!response) {
      return t('generic')
    }

    // Type guard for ApiErrorResponse
    const isApiError = (r: unknown): r is ApiErrorResponse => {
      return typeof r === 'object' && r !== null && 'detail' in r
    }

    if (!isApiError(response)) {
      return t('generic')
    }

    const { detail } = response

    // Legacy format: detail is a string
    if (typeof detail === 'string') {
      return detail
    }

    // New structured format: detail has error_code
    const { error_code, context } = detail

    // Try to translate the error code
    try {
      // Attempt to get translation with context interpolation
      const translated = t(error_code, context || {})

      // If we get the key back, translation doesn't exist
      if (translated === error_code) {
        // Fall back to generic error with code for debugging
        return `${t('generic')} (${error_code})`
      }

      return translated
    } catch {
      // Translation key doesn't exist - show generic error with code
      return `${t('generic')} (${error_code})`
    }
  }

  /**
   * Get an error message from a fetch response.
   *
   * @param response The fetch Response object
   * @returns Translated error message
   */
  const translateFetchError = async (response: Response): Promise<string> => {
    try {
      const data = await response.json()
      return translateError(data)
    } catch {
      return t('generic')
    }
  }

  return {
    translateError,
    translateFetchError,
  }
}
