/**
 * Admin service — user/role/project/authority management.
 */

import { apiClient } from './api'
import { authService } from './auth.service'
import * as adminUserRoleService from './adminUserRole.service'
import { projectService } from './project.service'
import type {
  AdminUser,
  Role,
  AdminProject,
  Authority,
  AuditLogEntry,
  CreateUserInput,
  CreateUserResult,
  PermissionMap,
  EngineeringRole,
  StakeholderUser,
} from '../types/admin.types'
import { emptyPermissionMap } from '../types/admin.types'

/**
 * #302: the admin service used to seed fake `Project Alpha` / `admin.demo`
 * rows into module-local arrays and serve them from getUsers / getUser /
 * getAuthorities / etc. Real admins saw fake data mixed in with their
 * tenant rows. The lists are now empty — populated only when the UI
 * creates entries — and the fake seed has been removed.
 */
let users: AdminUser[] = []
let projects: AdminProject[] = []
let authorities: Authority[] = []

function uuid(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

// --- Users ---
export async function getUsers(): Promise<AdminUser[]> {
  // TODO: replace with API
  return [...users]
}

export async function getUser(id: string): Promise<AdminUser | null> {
  // TODO: replace with API
  return users.find((u) => u.id === id) ?? null
}

export async function createUser(input: CreateUserInput): Promise<CreateUserResult> {
  const res = await authService.createAdminUser({
    email: input.email.trim(),
    name: input.name?.trim() || undefined,
    company: input.company?.trim() || undefined,
  })
  if (!res.success || !res.data) {
    throw new Error(res.error ?? 'Failed to create user')
  }
  const { user: created, generatedPassword } = res.data
  const adminUser: AdminUser = {
    id: created.id,
    username: created.email,
    name: created.name,
    status: 'active',
    projects: input.projects ?? [],
    roles: input.roles ?? [],
    authorities: input.authorities ?? [],
    permissions: input.permissions ?? emptyPermissionMap(),
    createdAt: created.createdAt,
    mustChangePasswordOnFirstLogin: true,
  }
  // Add to projects (if any)
  for (const projectId of input.projects ?? []) {
    const addRes = await projectService.addProjectMember(projectId, created.id, 'member')
    if (!addRes.success) {
      console.warn(`Failed to add user to project ${projectId}:`, addRes.error)
    }
  }
  // Persist admin (permission) role assignments to the backend (issue #166).
  if (input.roles && input.roles.length > 0) {
    await Promise.all(
      input.roles.map((adminRoleId) =>
        adminUserRoleService.assignRole(created.id, adminRoleId)
      )
    )
  }
  return { user: adminUser, generatedPassword }
}

export async function updateUser(
  id: string,
  updates: Partial<Pick<AdminUser, 'status' | 'projects' | 'roles' | 'authorities' | 'permissions'>>
): Promise<AdminUser | null> {
  // TODO: replace with API
  const idx = users.findIndex((u) => u.id === id)
  if (idx === -1) return null
  users[idx] = { ...users[idx], ...updates }
  return users[idx]
}

// --- Roles ---
export async function getRoles(): Promise<Role[]> {
  const res = await apiClient.get<{ id: string; name: string; defaultPermissions: PermissionMap }[]>('/admin/roles')
  if (!res.success || !Array.isArray(res.data)) {
    throw new Error(res.error ?? 'Failed to load roles')
  }
  return res.data.map((r) => ({
    id: r.id,
    name: r.name,
    defaultPermissions: (r.defaultPermissions ?? {}) as PermissionMap,
  }))
}

export async function getRole(id: string): Promise<Role | null> {
  const roles = await getRoles()
  return roles.find((r) => r.id === id) ?? null
}

export async function createRole(name: string, defaultPermissions: PermissionMap): Promise<Role> {
  const res = await apiClient.post<{ id: string; name: string; defaultPermissions: PermissionMap }>('/admin/roles', {
    name,
    defaultPermissions,
  })
  if (!res.success || !res.data) {
    throw new Error(res.error ?? 'Failed to create role')
  }
  return {
    id: res.data.id,
    name: res.data.name,
    defaultPermissions: (res.data.defaultPermissions ?? {}) as PermissionMap,
  }
}

export async function updateRole(
  id: string,
  updates: Partial<Pick<Role, 'name' | 'defaultPermissions'>>
): Promise<Role | null> {
  const res = await apiClient.put<{ id: string; name: string; defaultPermissions: PermissionMap }>(`/admin/roles/${id}`, updates)
  if (!res.success || !res.data) {
    throw new Error(res.error ?? 'Failed to update role')
  }
  return {
    id: res.data.id,
    name: res.data.name,
    defaultPermissions: (res.data.defaultPermissions ?? {}) as PermissionMap,
  }
}

// --- Projects (admin view): real projects from API ---
export async function getProjects(): Promise<AdminProject[]> {
  const res = await projectService.getProjects()
  if (!res.success || !Array.isArray(res.data)) {
    throw new Error(res.error || 'Failed to load projects')
  }
  return res.data.map((p) => ({
    id: p.id,
    name: p.name,
    members: p.teamMembers?.map((m) => m.userId) ?? [],
  }))
}

export async function getProject(id: string): Promise<AdminProject | null> {
  const res = await projectService.getProject(id)
  if (!res.success || !res.data) return null
  const p = res.data
  return {
    id: p.id,
    name: p.name,
    members: p.teamMembers?.map((m) => m.userId) ?? [],
  }
}

function slugFromName(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '') || 'project'
}

export async function createProject(name: string, members: string[] = []): Promise<AdminProject> {
  const res = await projectService.createProject({
    name: name.trim(),
    domain: slugFromName(name),
  })
  if (!res.success || !res.data) {
    throw new Error(res.error || 'Failed to create project')
  }
  const p = res.data
  return {
    id: p.id,
    name: p.name,
    members: p.teamMembers?.map((m) => m.userId) ?? [],
  }
}

export async function updateProject(
  id: string,
  updates: Partial<Pick<AdminProject, 'name' | 'members'>>
): Promise<AdminProject | null> {
  const res = await projectService.updateProject(id, {
    ...(updates.name !== undefined && { name: updates.name }),
  })
  if (!res.success || !res.data) return null
  const p = res.data
  return {
    id: p.id,
    name: p.name,
    members: updates.members ?? p.teamMembers?.map((m) => m.userId) ?? [],
  }
}

// --- Authorities ---
export async function getAuthorities(): Promise<Authority[]> {
  // TODO: replace with API
  return [...authorities]
}

export async function getAuthority(id: string): Promise<Authority | null> {
  return authorities.find((a) => a.id === id) ?? null
}

export async function createAuthority(
  name: string,
  permissions: PermissionMap,
  opts?: { version?: string; deprecated?: boolean }
): Promise<Authority> {
  // TODO: replace with API
  const authority: Authority = {
    id: uuid(),
    name,
    permissions,
    version: opts?.version,
    deprecated: opts?.deprecated,
  }
  authorities.push(authority)
  return authority
}

export async function updateAuthority(
  id: string,
  updates: Partial<Pick<Authority, 'name' | 'permissions' | 'version' | 'deprecated'>>
): Promise<Authority | null> {
  // TODO: replace with API
  const idx = authorities.findIndex((a) => a.id === id)
  if (idx === -1) return null
  authorities[idx] = { ...authorities[idx], ...updates }
  return authorities[idx]
}

// --- Audit log ---
export interface AuditLogParams {
  limit?: number
  from?: string
  to?: string
  actor?: string
  action?: string
  target?: string
}

export async function getAuditLog(params: AuditLogParams | number = 50): Promise<AuditLogEntry[]> {
  const opts: AuditLogParams = typeof params === 'number' ? { limit: params } : params
  const search = new URLSearchParams()
  if (opts.limit != null) search.set('limit', String(opts.limit))
  if (opts.from) search.set('from', opts.from)
  if (opts.to) search.set('to', opts.to)
  if (opts.actor) search.set('actor', opts.actor)
  if (opts.action) search.set('action', opts.action)
  if (opts.target) search.set('target', opts.target)
  const qs = search.toString()
  const res = await apiClient.get<AuditLogEntry[]>(`/admin/audit-log${qs ? `?${qs}` : ''}`)
  if (!res.success || !Array.isArray(res.data)) {
    throw new Error(res.error ?? 'Failed to load audit log')
  }
  return res.data
}

// --- Helpers (apply template to users/roles — placeholder) ---
// #302: these two functions used to return `true` without doing any
// work. The Authorities tab called them and told the admin
// "permissions applied" — but the backend was never contacted. An
// admin could be confident a user was restricted when they were not.
// Throw instead so callers must handle the not-implemented state.
export async function applyAuthorityToUsers(
  _authorityId: string,
  _userIds: string[]
): Promise<boolean> {
  throw new Error(
    'Apply authority to users is not implemented — no backend endpoint exists yet.',
  )
}

export async function applyAuthorityToRoles(
  _authorityId: string,
  _roleIds: string[]
): Promise<boolean> {
  throw new Error(
    'Apply authority to roles is not implemented — no backend endpoint exists yet.',
  )
}

// --- Engineering Roles ---
export async function getEngineeringRoles(): Promise<EngineeringRole[]> {
  const res = await apiClient.get<EngineeringRole[]>('/admin/engineering-roles')
  if (!res.success || !Array.isArray(res.data)) {
    throw new Error(res.error ?? 'Failed to load engineering roles')
  }
  return res.data
}

export async function createEngineeringRole(
  name: string,
  description?: string
): Promise<EngineeringRole> {
  const res = await apiClient.post<EngineeringRole>('/admin/engineering-roles', {
    name,
    description,
  })
  if (!res.success || !res.data) {
    throw new Error(res.error ?? 'Failed to create engineering role')
  }
  return res.data
}

export async function updateEngineeringRole(
  id: string,
  updates: { name?: string; description?: string }
): Promise<EngineeringRole> {
  const res = await apiClient.put<EngineeringRole>(`/admin/engineering-roles/${id}`, updates)
  if (!res.success || !res.data) {
    throw new Error(res.error ?? 'Failed to update engineering role')
  }
  return res.data
}

export async function deleteEngineeringRole(id: string): Promise<void> {
  const res = await apiClient.delete<{ id: string }>(`/admin/engineering-roles/${id}`)
  if (!res.success) {
    throw new Error(res.error ?? 'Failed to delete engineering role')
  }
}

export async function assignEngineeringRole(
  roleId: string,
  userIds: string[]
): Promise<void> {
  const res = await apiClient.post(`/admin/engineering-roles/${roleId}/assign`, { userIds })
  if (!res.success) {
    throw new Error(res.error ?? 'Failed to assign engineering role')
  }
}

export async function unassignEngineeringRole(
  roleId: string,
  userIds: string[]
): Promise<void> {
  const res = await apiClient.post(`/admin/engineering-roles/${roleId}/unassign`, { userIds })
  if (!res.success) {
    throw new Error(res.error ?? 'Failed to unassign engineering role')
  }
}

// --- Users with engineering roles (stakeholder directory) ---
export async function getUsersWithRoles(): Promise<StakeholderUser[]> {
  const res = await apiClient.get<StakeholderUser[]>('/admin/users-with-roles')
  if (!res.success || !Array.isArray(res.data)) {
    throw new Error(res.error ?? 'Failed to load users with roles')
  }
  return res.data
}
