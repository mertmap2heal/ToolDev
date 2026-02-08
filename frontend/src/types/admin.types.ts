/**
 * Admin panel types — user/role/authority management and permissions.
 * Structure supports global permissions and future per-project overrides.
 */

/** Permission group id (key in PermissionMap) */
export type PermissionGroupId =
  | 'requirements'
  | 'verification'
  | 'documentation'
  | 'riskManagement'
  | 'changeRequests'
  | 'configurationManagement'
  | 'admin'

/** Actions per group (spec-aligned) */
export const PERMISSION_GROUPS: Record<
  PermissionGroupId,
  { label: string; actions: string[] }
> = {
  requirements: {
    label: 'Requirements',
    actions: ['view', 'create', 'edit', 'delete', 'export'],
  },
  verification: {
    label: 'Verification',
    actions: ['view', 'create', 'edit', 'execute', 'approve', 'export'],
  },
  documentation: {
    label: 'Documentation',
    actions: ['view', 'create', 'edit', 'import', 'export', 'manageTemplates'],
  },
  riskManagement: {
    label: 'Risk Management',
    actions: ['view', 'create', 'edit', 'mitigate', 'approve', 'export'],
  },
  changeRequests: {
    label: 'Change Requests',
    actions: ['view', 'create', 'edit', 'approve', 'close'],
  },
  configurationManagement: {
    label: 'Configuration Management',
    actions: ['view', 'create', 'baseline', 'compare', 'export'],
  },
  admin: {
    label: 'Admin',
    actions: ['manageUsers', 'manageRoles', 'manageProjects', 'auditLog'],
  },
}

/** Map: group -> set of enabled action keys */
export type PermissionMap = Partial<
  Record<PermissionGroupId, Record<string, boolean>>
>

/** Returns a new PermissionMap with all actions set to false. */
export function emptyPermissionMap(): PermissionMap {
  const map: PermissionMap = {}
  for (const g of Object.keys(PERMISSION_GROUPS) as PermissionGroupId[]) {
    const actions = PERMISSION_GROUPS[g].actions
    map[g] = Object.fromEntries(actions.map((a) => [a, false]))
  }
  return map
}

export type UserStatus = 'active' | 'disabled'

export interface AdminUser {
  id: string
  username: string
  /** Display name (e.g. from backend auth user). */
  name?: string
  status: UserStatus
  projects: string[]
  roles: string[]
  authorities: string[]
  permissions: PermissionMap
  lastLoginAt?: string
  createdAt: string
  mustChangePasswordOnFirstLogin?: boolean
}

export interface Role {
  id: string
  name: string
  defaultPermissions: PermissionMap
}

export interface AdminProject {
  id: string
  name: string
  members: string[]
}

export interface Authority {
  id: string
  name: string
  permissions: PermissionMap
  version?: string
  deprecated?: boolean
}

export interface AuditLogEntry {
  id: string
  timestamp: string
  actor: string
  action: string
  target: string
  summary: string
}

export interface CreateUserInput {
  projects?: string[]
  roles?: string[]
  authorities?: string[]
  permissions?: PermissionMap
}

export interface CreateUserResult {
  user: AdminUser
  generatedPassword: string
}
