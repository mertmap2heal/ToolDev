import { apiClient } from './api'
import type { User } from 'shared/types/project.types'
import type { ApiResponse } from 'shared/types/api.types'
import type { AdminUser, PermissionMap } from '../types/admin.types'
import { emptyPermissionMap } from '../types/admin.types'

const ADMIN_PROFILES_KEY = 'adminUserProfiles'

/** Stored per-user overrides (roles, projects, etc.) so they persist across sessions. */
export type StoredAdminProfile = Partial<Pick<AdminUser, 'roles' | 'projects' | 'status' | 'authorities' | 'permissions'>>

function getStoredAdminProfiles(): Record<string, StoredAdminProfile> {
  try {
    const raw = localStorage.getItem(ADMIN_PROFILES_KEY)
    return raw ? JSON.parse(raw) : {}
  } catch {
    return {}
  }
}

/** Persist admin profile overrides for a user (roles, projects, status, etc.). */
export function setStoredAdminProfile(userId: string, profile: StoredAdminProfile): void {
  const all = getStoredAdminProfiles()
  all[userId] = profile
  localStorage.setItem(ADMIN_PROFILES_KEY, JSON.stringify(all))
}

/** Read current stored profile for a user (for merging). */
export function getStoredAdminProfile(userId: string): StoredAdminProfile {
  return getStoredAdminProfiles()[userId] ?? {}
}

/** Update only the roles array for a user, preserving other stored fields. */
export function updateStoredAdminProfileRoles(userId: string, newRoles: string[]): void {
  const current = getStoredAdminProfile(userId)
  setStoredAdminProfile(userId, { ...current, roles: newRoles })
}

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

  async getUsers(): Promise<
    ApiResponse<(Pick<User, 'id' | 'name' | 'email' | 'lastLoginAt'> & { inviteEmail?: string | null })[]>
  > {
    return apiClient.get<
      (Pick<User, 'id' | 'name' | 'email' | 'lastLoginAt'> & { inviteEmail?: string | null })[]
    >('/auth/users')
  },

  /** Admin: fetch real users from API and map to AdminUser[] (shared by Users tab and Roles tab). Merges stored profile overrides (roles, projects, etc.) from localStorage. */
  async getUsersAsAdminUsers(): Promise<AdminUser[]> {
    const res = await apiClient.get<
      (Pick<User, 'id' | 'name' | 'email' | 'lastLoginAt'> & { inviteEmail?: string | null })[]
    >('/auth/users')
    if (!res.success || !Array.isArray(res.data)) {
      throw new Error(res.error || 'Failed to load users')
    }
    const stored = getStoredAdminProfiles()
    return res.data.map((u) => {
      const base: AdminUser = {
        id: u.id,
        username: u.email,
        name: u.name ?? '',
        inviteEmail: u.inviteEmail ?? undefined,
        status: 'active',
        projects: [],
        roles: [],
        authorities: [],
        permissions: emptyPermissionMap(),
        lastLoginAt: u.lastLoginAt ?? (u as { last_login_at?: string | null }).last_login_at ?? undefined,
        createdAt: '',
      }
      const overrides = stored[u.id]
      if (!overrides) return base
      return {
        ...base,
        ...(overrides.roles !== undefined && { roles: overrides.roles }),
        ...(overrides.projects !== undefined && { projects: overrides.projects }),
        ...(overrides.status !== undefined && { status: overrides.status }),
        ...(overrides.authorities !== undefined && { authorities: overrides.authorities }),
        ...(overrides.permissions !== undefined && { permissions: overrides.permissions as PermissionMap }),
      }
    })
  },

  /** Admin only: create a new user with generated temporary password. Returns user + generatedPassword. */
  async createAdminUser(data: {
    email: string
    name?: string
    company?: string
  }): Promise<
    ApiResponse<{
      user: { id: string; email: string; name: string; company?: string | null; createdAt: string }
      generatedPassword: string
    }>
  > {
    return apiClient.post('/auth/users', data)
  },

  /** Admin only: set a new password for a user. */
  async resetUserPassword(
    userId: string,
    newPassword: string,
    options?: { forceChangeOnNextLogin?: boolean }
  ): Promise<ApiResponse<{ message: string }>> {
    const body: { newPassword: string; forceChangeOnNextLogin?: boolean } = { newPassword }
    if (options?.forceChangeOnNextLogin !== undefined) {
      body.forceChangeOnNextLogin = options.forceChangeOnNextLogin
    }
    return apiClient.put<{ message: string }>(`/auth/users/${userId}/password`, body)
  },

  /** Admin only: update a user's invite email. */
  async updateUserInviteEmail(
    userId: string,
    inviteEmail: string | null
  ): Promise<ApiResponse<{ message: string }>> {
    return apiClient.patch<{ message: string }>(`/auth/users/${userId}`, { inviteEmail })
  },

  /** Admin only: send invite email with app URL and temporary password. */
  async sendInvite(userId: string): Promise<ApiResponse<{ message: string }>> {
    return apiClient.post<{ message: string }>(`/auth/users/${userId}/send-invite`, {})
  },

  /** Change own password (e.g. after first login with temp password). */
  async changeMyPassword(newPassword: string): Promise<ApiResponse<{ message: string }>> {
    return apiClient.patch<{ message: string }>('/auth/me/password', { newPassword })
  },

  /** Update own profile (name, company). */
  async updateMyProfile(data: { name?: string; company?: string }): Promise<ApiResponse<User>> {
    return apiClient.patch<User>('/auth/me/profile', data)
  },

  /** Request password reset: sends temporary password to user's email if account exists. */
  async requestPasswordReset(loginIdentifier: string): Promise<ApiResponse<{ message: string }>> {
    return apiClient.post<{ message: string }>('/auth/forgot-password', {
      email: loginIdentifier.trim(),
    })
  },
}
