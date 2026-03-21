/**
 * Project-scoped engineering roles (Stakeholders / lifecycle consumer).
 */

import { apiClient } from './api'
import type { EngineeringRole, StakeholderUser } from '../types/admin.types'

export async function getProjectEngineeringRoles(projectId: string): Promise<EngineeringRole[]> {
  const res = await apiClient.get<EngineeringRole[]>(`/projects/${encodeURIComponent(projectId)}/engineering-roles`)
  if (!res.success || !Array.isArray(res.data)) {
    throw new Error(res.error ?? 'Failed to load project engineering roles')
  }
  return res.data
}

export async function getProjectUsersWithRoles(projectId: string): Promise<StakeholderUser[]> {
  const res = await apiClient.get<StakeholderUser[]>(
    `/projects/${encodeURIComponent(projectId)}/users-with-roles`
  )
  if (!res.success || !Array.isArray(res.data)) {
    throw new Error(res.error ?? 'Failed to load project users with roles')
  }
  return res.data
}

export interface MyProjectEngineeringRolesResponse {
  roles: { id: string; name: string }[]
  strictLifecycleGates: boolean
}

export async function getMyProjectEngineeringRoles(projectId: string): Promise<MyProjectEngineeringRolesResponse> {
  const res = await apiClient.get<MyProjectEngineeringRolesResponse>(
    `/projects/${encodeURIComponent(projectId)}/me/engineering-roles`
  )
  if (!res.success || !res.data) {
    throw new Error(res.error ?? 'Failed to load my engineering roles for project')
  }
  return res.data
}

export async function assignProjectEngineeringRole(
  projectId: string,
  roleId: string,
  userIds: string[]
): Promise<void> {
  const res = await apiClient.post(`/projects/${encodeURIComponent(projectId)}/engineering-roles/${encodeURIComponent(roleId)}/assign`, {
    userIds,
  })
  if (!res.success) {
    throw new Error(res.error ?? 'Failed to assign engineering role')
  }
}

export async function unassignProjectEngineeringRole(
  projectId: string,
  roleId: string,
  userIds: string[]
): Promise<void> {
  const res = await apiClient.post(
    `/projects/${encodeURIComponent(projectId)}/engineering-roles/${encodeURIComponent(roleId)}/unassign`,
    { userIds }
  )
  if (!res.success) {
    throw new Error(res.error ?? 'Failed to unassign engineering role')
  }
}
