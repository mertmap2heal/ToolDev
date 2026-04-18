/**
 * Shared typed-error helper.
 *
 * #267: frontend onError / catch handlers used `error: any`, losing the
 * discriminated error shape returned by apiClient.handleError. This helper
 * narrows an unknown error to a safe display string while preserving type
 * safety at the call site.
 *
 * The apiClient wrapper resolves all calls to ApiResponse<T> with
 * `{ success, error, statusCode }`, so most "errors" inside mutations and
 * queries arrive as `ApiResponse`-shaped objects. Axios/network rejections
 * still produce Error instances.
 */

export interface ApiErrorLike {
  error?: string
  message?: string
  statusCode?: number
}

export function errorMessage(err: unknown, fallback = 'Something went wrong'): string {
  if (err == null) return fallback
  if (typeof err === 'string') return err
  if (err instanceof Error) return err.message || fallback
  if (typeof err === 'object') {
    const e = err as ApiErrorLike
    if (typeof e.error === 'string' && e.error.length > 0) return e.error
    if (typeof e.message === 'string' && e.message.length > 0) return e.message
  }
  return fallback
}

export function errorStatusCode(err: unknown): number | undefined {
  if (err && typeof err === 'object') {
    const e = err as ApiErrorLike
    if (typeof e.statusCode === 'number') return e.statusCode
  }
  return undefined
}
