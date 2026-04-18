/**
 * Admin module types: users, roles, projects, authorities, permissions.
 */

export type UserStatus = 'active' | 'disabled'

export interface AdminUser {
  id: string
  username: string
  /** Display name (e.g. from backend auth user). */
  name?: string
  /** Invite/contact email (for invite emails; may differ from username). */
  inviteEmail?: string | null
  status: UserStatus
  projects: string[]
  roles: string[]
  authorities: string[]
  permissions: PermissionMap
  lastLoginAt?: string
  createdAt: string
  mustChangePasswordOnFirstLogin?: boolean
}

// --- Permissions (matrix of module -> action -> boolean) ---
export type PermissionMap = Partial<{
  requirements: Record<string, boolean>
  verification: Record<string, boolean>
  documentation: Record<string, boolean>
  riskManagement: Record<string, boolean>
  changeRequests: Record<string, boolean>
  configurationManagement: Record<string, boolean>
  admin: Record<string, boolean>
}>

export type PermissionGroupId = keyof NonNullable<PermissionMap>

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

export function emptyPermissionMap(): PermissionMap {
  const map: PermissionMap = {}
    ; (Object.keys(PERMISSION_GROUPS) as PermissionGroupId[]).forEach((g) => {
      const actions = PERMISSION_GROUPS[g].actions
      const groupMap: Record<string, boolean> = {}
      actions.forEach((a) => {
        groupMap[a] = false
      })
      map[g] = groupMap
    })
  return map
}

// --- Roles ---
export interface Role {
  id: string
  name: string
  defaultPermissions: PermissionMap
}

// --- Admin project (id, name, member ids) ---
export interface AdminProject {
  id: string
  name: string
  members: string[]
}

// --- Authority (permission template) ---
export interface Authority {
  id: string
  name: string
  permissions: PermissionMap
  version?: string
  deprecated?: boolean
}

// --- Engineering roles (discipline-based) ---
export interface EngineeringRole {
  id: string
  name: string
  description?: string | null
  isSystem: boolean
  userCount: number
  assignedUsers?: { id: string; name: string; email: string }[]
}

// --- Stakeholder user (for stakeholder directory) ---
export interface StakeholderUser {
  id: string
  name: string
  email: string
  company?: string | null
  status: 'Active' | 'Inactive'
  engineeringRoles: { id: string; name: string }[]
  lastLoginAt?: string | null
  createdAt: string
  updatedAt: string
}

// --- Audit log ---
export interface AuditLogEntry {
  id: string
  timestamp: string
  actor: string
  action: string
  target: string
  summary: string
  /** verification | tasks | inventory | project | saved_views */
  source?: string
}

// --- Create user ---
export interface CreateUserInput {
  email: string
  name?: string
  company?: string
  projects?: string[]
  roles?: string[]
  authorities?: string[]
  permissions?: PermissionMap
}

export interface CreateUserResult {
  user: AdminUser
  generatedPassword: string
}
