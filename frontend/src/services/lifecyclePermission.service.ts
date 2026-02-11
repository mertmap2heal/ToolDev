import { apiClient } from './api'

/**
 * Lifecycle permission service adapter.
 * Fetches user roles from User Groups for transition rule enforcement.
 * When backend absent, returns mock roles (fail-open for dev).
 */
export const lifecyclePermissionService = {
  /**
   * Get roles for a user. Used to filter transitions by allowedUserGroups.
   */
  async getUserRoles(userId?: string): Promise<{ success: boolean; roles: string[] }> {
    try {
      if (!userId) return { success: true, roles: [] }
      const response = await apiClient.get<{ roles: string[] }>(
        `/lifecycle/user-roles?userId=${encodeURIComponent(userId)}`
      )
      if (response.success && response.data?.roles) {
        return { success: true, roles: response.data.roles }
      }
    } catch {
      // Backend not available - fail open
    }
    return {
      success: true,
      roles: ['Requirements Engineer'], // Mock default for dev when backend absent
    }
  },

  /**
   * Check if user has any of the allowed user group roles.
   */
  async canTransition(
    userId: string | undefined,
    allowedUserGroups: string[]
  ): Promise<boolean> {
    if (!allowedUserGroups.length) return true
    const { roles } = await this.getUserRoles(userId)
    if (roles.length === 0) return true // Fail open when no roles
    return allowedUserGroups.some((g) => roles.includes(g))
  },
}
