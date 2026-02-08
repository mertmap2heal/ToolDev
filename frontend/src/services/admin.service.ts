/**
 * Admin service — user/role/project/authority management.
 * TODO: replace with API calls when backend admin endpoints exist.
 */

import type {
  AdminUser,
  Role,
  AdminProject,
  Authority,
  AuditLogEntry,
  CreateUserInput,
  CreateUserResult,
  PermissionMap,
} from '../types/admin.types'
import { emptyPermissionMap } from '../types/admin.types'

// --- In-memory store (mock) ---
let users: AdminUser[] = []
let roles: Role[] = []
let projects: AdminProject[] = []
let authorities: Authority[] = []
let auditLog: AuditLogEntry[] = []

function uuid(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

function randomPassword(length = 16): string {
  const chars =
    'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%&*'
  let s = ''
  for (let i = 0; i < length; i++) {
    s += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return s
}

function usernameFromInput(): string {
  const n = users.length + 1
  return `user.${n}`
}

// Seed initial mock data
function seed() {
  if (roles.length > 0) return
  roles = [
    {
      id: 'role-1',
      name: 'Viewer',
      defaultPermissions: {
        requirements: { view: true },
        verification: { view: true },
        documentation: { view: true },
        riskManagement: { view: true },
        changeRequests: { view: true },
        configurationManagement: { view: true },
      },
    },
    {
      id: 'role-2',
      name: 'Editor',
      defaultPermissions: {
        requirements: { view: true, create: true, edit: true, export: true },
        verification: { view: true, create: true, edit: true, export: true },
        documentation: { view: true, create: true, edit: true, export: true },
        riskManagement: { view: true, create: true, edit: true, export: true },
        changeRequests: { view: true, create: true, edit: true },
        configurationManagement: { view: true, create: true, compare: true, export: true },
      },
    },
    {
      id: 'role-3',
      name: 'Admin',
      defaultPermissions: {
        requirements: { view: true, create: true, edit: true, delete: true, export: true },
        verification: { view: true, create: true, edit: true, execute: true, approve: true, export: true },
        documentation: { view: true, create: true, edit: true, import: true, export: true, manageTemplates: true },
        riskManagement: { view: true, create: true, edit: true, mitigate: true, approve: true, export: true },
        changeRequests: { view: true, create: true, edit: true, approve: true, close: true },
        configurationManagement: { view: true, create: true, baseline: true, compare: true, export: true },
        admin: { manageUsers: true, manageRoles: true, manageProjects: true, auditLog: true },
      },
    },
  ]
  authorities = [
    {
      id: 'auth-1',
      name: 'Read-only template',
      permissions: {
        requirements: { view: true },
        verification: { view: true },
        documentation: { view: true },
      },
      version: '1',
    },
  ]
  projects = [
    { id: 'proj-1', name: 'Project Alpha', members: [] },
    { id: 'proj-2', name: 'Project Beta', members: [] },
  ]
  users = [
    {
      id: 'user-1',
      username: 'admin.demo',
      status: 'active',
      projects: ['proj-1', 'proj-2'],
      roles: ['role-3'],
      authorities: [],
      permissions: emptyPermissionMap(),
      lastLoginAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
    },
  ]
  auditLog = [
    {
      id: 'audit-1',
      timestamp: new Date(Date.now() - 86400000).toISOString(),
      actor: 'admin.demo',
      action: 'user.created',
      target: 'user-1',
      summary: 'User admin.demo created',
    },
    {
      id: 'audit-2',
      timestamp: new Date().toISOString(),
      actor: 'system',
      action: 'login',
      target: 'admin.demo',
      summary: 'User logged in',
    },
  ]
}
seed()

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
  // TODO: replace with API
  const username = usernameFromInput()
  const generatedPassword = randomPassword()
  const id = uuid()
  const user: AdminUser = {
    id,
    username,
    status: 'active',
    projects: input.projects ?? [],
    roles: input.roles ?? [],
    authorities: input.authorities ?? [],
    permissions: input.permissions ?? emptyPermissionMap(),
    createdAt: new Date().toISOString(),
    mustChangePasswordOnFirstLogin: true,
  }
  users.push(user)
  auditLog.push({
    id: uuid(),
    timestamp: new Date().toISOString(),
    actor: 'admin',
    action: 'user.created',
    target: id,
    summary: `User ${username} created`,
  })
  return { user, generatedPassword }
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
  // TODO: replace with API
  return [...roles]
}

export async function getRole(id: string): Promise<Role | null> {
  return roles.find((r) => r.id === id) ?? null
}

export async function createRole(name: string, defaultPermissions: PermissionMap): Promise<Role> {
  // TODO: replace with API
  const role: Role = { id: uuid(), name, defaultPermissions }
  roles.push(role)
  return role
}

export async function updateRole(
  id: string,
  updates: Partial<Pick<Role, 'name' | 'defaultPermissions'>>
): Promise<Role | null> {
  // TODO: replace with API
  const idx = roles.findIndex((r) => r.id === id)
  if (idx === -1) return null
  roles[idx] = { ...roles[idx], ...updates }
  return roles[idx]
}

// --- Projects (admin view) ---
export async function getProjects(): Promise<AdminProject[]> {
  // TODO: replace with API or sync from projectService
  return [...projects]
}

export async function getProject(id: string): Promise<AdminProject | null> {
  return projects.find((p) => p.id === id) ?? null
}

export async function createProject(name: string, members: string[] = []): Promise<AdminProject> {
  // TODO: replace with API
  const project: AdminProject = { id: uuid(), name, members }
  projects.push(project)
  return project
}

export async function updateProject(
  id: string,
  updates: Partial<Pick<AdminProject, 'name' | 'members'>>
): Promise<AdminProject | null> {
  // TODO: replace with API
  const idx = projects.findIndex((p) => p.id === id)
  if (idx === -1) return null
  projects[idx] = { ...projects[idx], ...updates }
  return projects[idx]
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
export async function getAuditLog(limit = 50): Promise<AuditLogEntry[]> {
  // TODO: replace with API
  return [...auditLog].reverse().slice(0, limit)
}

// --- Helpers (apply template to users/roles — placeholder) ---
export async function applyAuthorityToUsers(
  _authorityId: string,
  _userIds: string[]
): Promise<boolean> {
  // TODO: implement when backend supports it
  return true
}

export async function applyAuthorityToRoles(
  _authorityId: string,
  _roleIds: string[]
): Promise<boolean> {
  // TODO: implement when backend supports it
  return true
}
