import axios, { AxiosInstance, AxiosError } from 'axios'
import type { ApiResponse } from '../../../shared/types/api.types'

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api/v1'

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
        const token = localStorage.getItem('token') ?? sessionStorage.getItem('token')
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
        // Handle both 401 (Unauthorized - no token) and 403 (Forbidden - invalid/expired token)
        if (error.response?.status === 401 || error.response?.status === 403) {
          const token = localStorage.getItem('token') ?? sessionStorage.getItem('token')
          if (token) {
            console.log('Token is invalid or expired, removing from storage')
            localStorage.removeItem('token')
            sessionStorage.removeItem('token')
            window.dispatchEvent(new CustomEvent('token-expired'))
          }
        }
        return Promise.reject(error)
      }
    )
  }

  async get<T>(url: string): Promise<ApiResponse<T>> {
    try {
      const response = await this.client.get<ApiResponse<T>>(url)
      return response.data
    } catch (error) {
      return this.handleError(error)
    }
  }

  async post<T>(url: string, data?: any, headers?: Record<string, string>): Promise<ApiResponse<T>> {
    try {
      const response = await this.client.post<ApiResponse<T>>(url, data, { headers })
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

  async delete<T>(url: string, headers?: Record<string, string>): Promise<ApiResponse<T>> {
    try {
      const response = await this.client.delete<ApiResponse<T>>(url, { headers })
      return response.data
    } catch (error) {
      return this.handleError(error)
    }
  }

  private handleError(error: any): ApiResponse {
    if (error.response) {
      return {
        success: false,
        error: error.response.data?.error || error.response.data?.message || 'An error occurred',
        statusCode: error.response.status,
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
