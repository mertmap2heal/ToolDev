export interface User {
  id: string
  email: string
  name: string
  company?: string
  avatarUrl?: string
  createdAt: string
}

export interface Project {
  id: string
  name: string
  description?: string
  domain: string
  companyName?: string
  progress: number
  status: 'active' | 'completed' | 'archived'
  deadline?: string
  createdAt: string
  updatedAt: string
  userId: string
  teamMembers?: ProjectMember[]
}

export interface ProjectMember {
  id: string
  projectId: string
  userId: string
  role: 'owner' | 'member' | 'viewer'
  joinedAt: string
  user?: User
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
}
