import axios, { AxiosInstance, AxiosError } from 'axios'
import type { ApiResponse } from 'shared/types/api.types'

// In dev, use relative URL so Vite proxy forwards /api to backend (avoids CORS and localhost vs 127.0.0.1 issues)
const API_BASE_URL = import.meta.env.VITE_API_URL || (import.meta.env.DEV ? '/api/v1' : 'http://localhost:5000/api/v1')

/**
 * Safe localStorage wrappers. Safari private mode and some sandboxed
 * iframes throw SecurityError on `localStorage` access; we don't want
 * that to crash the axios interceptor and block every request.
 */
function safeReadToken(): string | null {
  try {
    return localStorage.getItem('token') ?? sessionStorage.getItem('token')
  } catch {
    return null
  }
}
function safeRemoveToken(): void {
  try { localStorage.removeItem('token') } catch { /* private mode */ }
  try { sessionStorage.removeItem('token') } catch { /* private mode */ }
}

class ApiClient {
  private client: AxiosInstance

  constructor() {
    this.client = axios.create({
      baseURL: API_BASE_URL,
      headers: {
        'Content-Type': 'application/json',
      },
    })

    this.client.interceptors.request.use(
      (config) => {
        // ngrok free tier may return an HTML interstitial unless this header is present (breaks JSON APIs → blank UI).
        if (
          typeof window !== 'undefined' &&
          /(\.ngrok-free\.(app|dev)|\.ngrok\.(io|app))$/i.test(window.location.hostname)
        ) {
          config.headers['ngrok-skip-browser-warning'] = '1'
        }
        const token = safeReadToken()
        if (token) {
          config.headers.Authorization = `Bearer ${token}`
        }
        return config
      },
      (error) => {
        return Promise.reject(error)
      }
    )

    this.client.interceptors.response.use(
      (response) => response,
      (error: AxiosError) => {
        // Handle 401 (no token) and 403 (invalid/expired token).
        // NOT every 403 is a token problem -- permission denials (e.g.
        // requireAiEnabled returning AI_DISABLED_*, project-member
        // checks, admin-only checks) are legitimate 403s for a logged-in
        // user. Skip the token wipe when the backend sent a structured
        // error code that names a non-auth cause.
        if (error.response?.status === 401 || error.response?.status === 403) {
          const data = error.response?.data as { code?: string } | undefined
          const nonAuthCode = typeof data?.code === 'string' && (
            data.code === 'AI_DISABLED_GLOBAL' ||
            data.code === 'AI_DISABLED_PROJECT' ||
            data.code === 'PROJECT_NOT_FOUND' ||
            data.code === 'AI_MISSING_PROJECT_ID'
          )
          // N-2.1: a 401 on a CFR 21 Part 11 reauthentication-flow request
          // means the REAUTH credential failed (a wrong password on
          // POST /auth/reauth, or a lapsed X-Reauth-Token on a sign-off
          // request) — NOT that the session expired. Wiping the session token
          // and bouncing to /login here would close the signing modal on a
          // simple wrong-password retry. Detect such requests and skip the
          // token wipe; the calling code surfaces the error inline instead.
          const cfg = error.config
          const isReauthFlow =
            cfg?.url?.includes('/auth/reauth') === true ||
            (cfg?.headers != null &&
              Object.keys(cfg.headers).some(
                (h) => h.toLowerCase() === 'x-reauth-token',
              ))
          if (!nonAuthCode && !isReauthFlow) {
            const token = safeReadToken()
            if (token) {
              console.log('Token is invalid or expired, removing from storage')
              safeRemoveToken()
              window.dispatchEvent(new CustomEvent('token-expired'))
            }
          }
        }
        // When user no longer has access to a project (e.g. removed from project) or project doesn't exist
        // Only redirect on exact project match, not sub-resources like /projects/:id/documents
        if (error.response?.status === 404 && error.config?.url?.match(/^\/projects\/[^/]+$/)) {
          window.location.href = '/'
        }
        return Promise.reject(error)
      }
    )
  }

  async get<T>(url: string, config?: { params?: Record<string, unknown> }): Promise<ApiResponse<T>> {
    try {
      const response = await this.client.get<ApiResponse<T>>(url, config)
      return response.data
    } catch (error) {
      return this.handleError(error)
    }
  }

  /** For export endpoints that return a file (blob). Returns the Blob or throws. */
  async getBlob(url: string): Promise<Blob> {
    const response = await this.client.get(url, { responseType: 'blob' })
    return response.data as Blob
  }

  /** POST that returns a blob (e.g. ZIP bundle). */
  async postBlob(url: string, data?: unknown): Promise<Blob> {
    const response = await this.client.post(url, data, { responseType: 'blob' })
    return response.data as Blob
  }

  async post<T>(url: string, data?: any, headers?: Record<string, string>): Promise<ApiResponse<T>> {
    try {
      const response = await this.client.post<ApiResponse<T>>(url, data, { headers })
      return response.data
    } catch (error) {
      return this.handleError(error)
    }
  }

  /** POST a multipart/form-data body. Axios infers the boundary header. */
  async postForm<T>(url: string, form: FormData): Promise<ApiResponse<T>> {
    try {
      const response = await this.client.post<ApiResponse<T>>(url, form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      return response.data
    } catch (error) {
      return this.handleError(error)
    }
  }

  async put<T>(url: string, data?: any, headers?: Record<string, string>): Promise<ApiResponse<T>> {
    try {
      const response = await this.client.put<ApiResponse<T>>(url, data, { headers })
      return response.data
    } catch (error) {
      return this.handleError(error)
    }
  }

  async patch<T>(url: string, data?: any, headers?: Record<string, string>): Promise<ApiResponse<T>> {
    try {
      const response = await this.client.patch<ApiResponse<T>>(url, data, { headers })
      return response.data
    } catch (error) {
      return this.handleError(error)
    }
  }

  async delete<T>(url: string, data?: any, headers?: Record<string, string>): Promise<ApiResponse<T>> {
    try {
      const response = await this.client.delete<ApiResponse<T>>(url, { headers, data })
      return response.data
    } catch (error) {
      return this.handleError(error)
    }
  }

  private handleError(error: any): ApiResponse {
    if (error.response) {
      const status = error.response.status
      // Proxy returns 502/503 when backend is unreachable
      if (status === 502 || status === 503) {
        return {
          success: false,
          error: 'Backend unavailable. Make sure the backend is running (e.g. npm run dev in the backend folder).',
          statusCode: status,
        }
      }
      const data = error.response.data
      const message =
        (typeof data === 'object' && data !== null && (data.error ?? data.message)) ||
        (typeof data === 'string' && data) ||
        'An error occurred'
      // Preserve structured `code` if the backend set one (used by the
      // AI feature gate and any future branchable error).
      const code =
        typeof data === 'object' && data !== null && typeof data.code === 'string'
          ? data.code
          : undefined
      // N-2.3 (#428): preserve the INCOSE/EARS quality report from a 422 so
      // the requirement editor can render the server findings (Design item #4).
      const qualityReport =
        typeof data === 'object' && data !== null && data.qualityReport
          ? data.qualityReport
          : undefined
      return {
        success: false,
        error: String(message),
        statusCode: status,
        ...(code ? { code } : {}),
        ...(qualityReport ? { qualityReport } : {}),
      }
    }

    // Network errors (backend not running, CORS, etc.)
    if (error.code === 'ECONNREFUSED' || error.message?.includes('Network Error') || error.message?.includes('Failed to fetch')) {
      return {
        success: false,
        error: `Cannot connect to backend server. Please make sure the backend is running on ${API_BASE_URL}. Check the console for more details.`,
        statusCode: 0,
      }
    }

    return {
      success: false,
      error: error.message || 'Network error',
      statusCode: 0,
    }
  }
}

export const apiClient = new ApiClient()
