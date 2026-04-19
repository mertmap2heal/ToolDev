export interface User {
  id: string
  email: string
  name: string
  company?: string
  avatarUrl?: string
  createdAt: string
  /** ISO date string of last successful login. */
  lastLoginAt?: string
  /** True if user can access Admin Panel. Set by backend (e.g. env ADMIN_EMAILS or DB). */
  isAdmin?: boolean
  /** Platform-level role, e.g. SUPERIOR_ADMIN. Null/undefined = normal user. */
  role?: string | null
  /** True when user has role SUPERIOR_ADMIN (platform owner). */
  isSuperiorAdmin?: boolean
  /** True when user must change password (e.g. after first login with temp invite password). */
  mustChangePassword?: boolean
}

export interface Project {
  id: string
  name: string
  description?: string
  domain: string
  slug: string
  companyName?: string
  progress: number
  status: 'active' | 'completed' | 'archived'
  deadline?: string
  createdAt: string
  updatedAt: string
  userId: string
  teamMembers?: ProjectMember[]
  /** Per-project AI opt-in (ai-ready-vision.md §5). */
  aiEnabled?: boolean
  aiEnabledAt?: string | null
  aiEnabledBy?: string | null
  strictLifecycleGates?: boolean | null
}

export interface ProjectMember {
  id: string
  projectId: string
  userId: string
  role: 'owner' | 'member' | 'viewer'
  status?: 'pending' | 'accepted'
  joinedAt: string
  user?: User
}

export interface Notification {
  id: string
  userId: string
  type: string
  title: string
  message: string
  projectId: string | null
  read: boolean
  createdAt: string
}

export interface CreateProjectDto {
  name: string
  description?: string
  domain: string
  companyName?: string
  deadline?: string
}

export interface UpdateProjectDto {
  name?: string
  description?: string
  domain?: string
  companyName?: string
  progress?: number
  status?: 'active' | 'completed' | 'archived'
  deadline?: string
  /** Toggle per-project AI features. Tracked server-side with timestamp + user id. */
  aiEnabled?: boolean
  strictLifecycleGates?: boolean
}

// PBS (Product Breakdown Structure) / Component types
export interface Component {
  id: string
  projectId: string
  parentId: string | null
  name: string
  pbsCode?: string | null
  description?: string | null
  sortOrder: number
  createdAt: string
  updatedAt: string
  isRoot?: boolean
  children?: ComponentTreeNode[]
}

export interface ComponentTreeNode extends Component {
  children?: ComponentTreeNode[]
}

export interface CreateComponentDto {
  projectId?: string
  parentId?: string | null
  name: string
  description?: string | null
  sortOrder?: number
}

export interface UpdateComponentDto {
  name?: string
  description?: string | null
  parentId?: string | null
  sortOrder?: number
}
