import { apiClient } from './api'
import type { Issue, CreateIssueDto } from 'shared/types/engineering.types'
import type { ApiResponse } from 'shared/types/api.types'

export const issueService = {
  async getIssues(projectId: string): Promise<ApiResponse<Issue[]>> {
    return apiClient.get<Issue[]>(`/issues/${projectId}`)
  },

  async getIssue(projectId: string, issueId: string): Promise<ApiResponse<Issue>> {
    return apiClient.get<Issue>(`/issues/${projectId}/${issueId}`)
  },

  async createIssue(projectId: string, data: CreateIssueDto): Promise<ApiResponse<Issue>> {
    return apiClient.post<Issue>(`/issues/${projectId}`, data)
  },

  async updateIssue(projectId: string, issueId: string, data: Partial<CreateIssueDto>): Promise<ApiResponse<Issue>> {
    return apiClient.put<Issue>(`/issues/${projectId}/${issueId}`, data)
  },

  async deleteIssue(projectId: string, issueId: string): Promise<ApiResponse<void>> {
    return apiClient.delete<void>(`/issues/${projectId}/${issueId}`)
  },
}
