/**
 * Admin user-role service: persists AdminRole (permission template) assignments
 * via the backend. Replaces the previous localStorage-only implementation.
 */
import { apiClient } from './api'

export interface AdminUserRoleAssignment {
  id: string
  userId: string
  adminRoleId: string
  assignedAt: string
  assignedBy: string | null
}

/** List all admin user-role assignments (optionally scoped to one user). */
export async function listAssignments(userId?: string): Promise<AdminUserRoleAssignment[]> {
  const qs = userId ? `?userId=${encodeURIComponent(userId)}` : ''
  const res = await apiClient.get<AdminUserRoleAssignment[]>(`/admin/user-roles${qs}`)
  if (!res.success || !Array.isArray(res.data)) {
    throw new Error(res.error ?? 'Failed to load admin user-role assignments')
  }
  return res.data
}

/** Assign an admin (permission) role to a user. */
export async function assignRole(
  userId: string,
  adminRoleId: string
): Promise<AdminUserRoleAssignment> {
  const res = await apiClient.post<AdminUserRoleAssignment>('/admin/user-roles', {
    userId,
    adminRoleId,
  })
  if (!res.success || !res.data) {
    throw new Error(res.error ?? 'Failed to assign admin role')
  }
  return res.data
}

/** Revoke an admin role assignment. */
export async function revokeRole(userId: string, adminRoleId: string): Promise<void> {
  const qs = `userId=${encodeURIComponent(userId)}&adminRoleId=${encodeURIComponent(adminRoleId)}`
  const res = await apiClient.delete<{ userId: string; adminRoleId: string }>(
    `/admin/user-roles?${qs}`
  )
  if (!res.success) {
    throw new Error(res.error ?? 'Failed to revoke admin role')
  }
}

/**
 * Diff two sets of role ids and sync to the server.
 * Fires parallel assign/revoke calls for the delta.
 */
export async function syncUserRoles(
  userId: string,
  previousRoleIds: string[],
  nextRoleIds: string[]
): Promise<void> {
  const prev = new Set(previousRoleIds)
  const next = new Set(nextRoleIds)
  const toAdd = [...next].filter((id) => !prev.has(id))
  const toRemove = [...prev].filter((id) => !next.has(id))

  await Promise.all([
    ...toAdd.map((adminRoleId) => assignRole(userId, adminRoleId)),
    ...toRemove.map((adminRoleId) => revokeRole(userId, adminRoleId)),
  ])
}
