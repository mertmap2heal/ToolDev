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

const TOKEN_KEY = 'token'

function getStoredToken(): string | null {
  return localStorage.getItem(TOKEN_KEY) ?? sessionStorage.getItem(TOKEN_KEY)
}

function setStoredToken(token: string, remember: boolean): void {
  if (remember) {
    localStorage.setItem(TOKEN_KEY, token)
    sessionStorage.removeItem(TOKEN_KEY)
  } else {
    sessionStorage.setItem(TOKEN_KEY, token)
    localStorage.removeItem(TOKEN_KEY)
  }
}

export const authService = {
  async login(data: LoginDto, remember = true): Promise<ApiResponse<AuthResponse>> {
    const response = await apiClient.post<AuthResponse>('/auth/login', data)
    if (response.success && response.data) {
      setStoredToken(response.data.token, remember)
    }
    return response
  },

  async register(data: RegisterDto): Promise<ApiResponse<AuthResponse>> {
    const response = await apiClient.post<AuthResponse>('/auth/register', data)
    if (response.success && response.data) {
      setStoredToken(response.data.token, true)
    }
    return response
  },

  async getCurrentUser(): Promise<ApiResponse<User>> {
    return apiClient.get<User>('/auth/me')
  },

  logout(): void {
    localStorage.removeItem(TOKEN_KEY)
    sessionStorage.removeItem(TOKEN_KEY)
  },

  getToken(): string | null {
    return getStoredToken()
  },

  async getUsers(): Promise<ApiResponse<Pick<User, 'id' | 'name' | 'email'>[]>> {
    return apiClient.get<Pick<User, 'id' | 'name' | 'email'>[]>('/auth/users')
  },
}
