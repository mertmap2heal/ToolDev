import { apiClient } from './api'
import type {
  Project,
  ProjectMember,
  CreateProjectDto,
  UpdateProjectDto,
} from 'shared/types/project.types'
import type { ApiResponse } from 'shared/types/api.types'

export const projectService = {
  async getProjects(): Promise<ApiResponse<Project[]>> {
    return apiClient.get<Project[]>('/projects')
  },

  async getProject(id: string): Promise<ApiResponse<Project>> {
    return apiClient.get<Project>(`/projects/${id}`)
  },

  async createProject(data: CreateProjectDto): Promise<ApiResponse<Project>> {
    return apiClient.post<Project>('/projects', data)
  },

  async updateProject(id: string, data: UpdateProjectDto): Promise<ApiResponse<Project>> {
    return apiClient.put<Project>(`/projects/${id}`, data)
  },

  async deleteProject(id: string): Promise<ApiResponse<void>> {
    return apiClient.delete<void>(`/projects/${id}`)
  },

  async getProjectMembers(projectId: string): Promise<ApiResponse<ProjectMember[]>> {
    return apiClient.get<ProjectMember[]>(`/projects/${projectId}/members`)
  },

  async addProjectMember(
    projectId: string,
    userId: string,
    role: 'member' | 'viewer'
  ): Promise<ApiResponse<ProjectMember>> {
    return apiClient.post<ProjectMember>(`/projects/${projectId}/members`, { userId, role })
  },

  async removeProjectMember(projectId: string, userId: string): Promise<ApiResponse<void>> {
    return apiClient.delete<void>(`/projects/${projectId}/members/${userId}`)
  },

  async acceptInvitation(projectId: string): Promise<ApiResponse<{ message: string }>> {
    return apiClient.post<{ message: string }>(`/projects/${projectId}/invitations/accept`, {})
  },

  async declineInvitation(projectId: string): Promise<ApiResponse<{ message: string }>> {
    return apiClient.post<{ message: string }>(`/projects/${projectId}/invitations/decline`, {})
  },

  async getProjectAuditLogs(projectId: string) {
    return apiClient.get(`/projects/${projectId}/audit-logs`)
  },

  async getProjectAnalytics(projectId: string) {
    return apiClient.get(`/projects/${projectId}/analytics`)
  },

  async bulkUpdateProjects(ids: string[], updates: Record<string, any>) {
    return apiClient.post('/projects/bulk-update', { ids, updates })
  },

  async exportProjects() {
    return apiClient.get('/projects/export')
  },

  async importProjects(projects: any[]) {
    return apiClient.post('/projects/import', { projects })
  },
}
