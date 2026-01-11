import { apiClient } from './api'
import type { Project, CreateProjectDto, UpdateProjectDto } from '../../../shared/types/project.types'
import type { ApiResponse } from '../../../shared/types/api.types'

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
}
