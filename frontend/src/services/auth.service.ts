import { apiClient } from './api'
import type { User } from '../../../shared/types/project.types'
import type { ApiResponse } from '../../../shared/types/api.types'

interface LoginDto {
  email: string
  password: string
}

interface RegisterDto {
  email: string
  password: string
  name: string
  company?: string
}

interface AuthResponse {
  user: User
  token: string
}

export const authService = {
  async login(data: LoginDto): Promise<ApiResponse<AuthResponse>> {
    const response = await apiClient.post<AuthResponse>('/auth/login', data)
    if (response.success && response.data) {
      localStorage.setItem('token', response.data.token)
    }
    return response
  },

  async register(data: RegisterDto): Promise<ApiResponse<AuthResponse>> {
    const response = await apiClient.post<AuthResponse>('/auth/register', data)
    if (response.success && response.data) {
      localStorage.setItem('token', response.data.token)
    }
    return response
  },

  async getCurrentUser(): Promise<ApiResponse<User>> {
    return apiClient.get<User>('/auth/me')
  },

  logout(): void {
    localStorage.removeItem('token')
  },

  getToken(): string | null {
    return localStorage.getItem('token')
  },
}
