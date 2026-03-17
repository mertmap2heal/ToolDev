import { apiClient } from './api'
import type { Issue, CreateIssueDto, UpdateIssueDto, IssueComment, CreateIssueCommentDto, UpdateIssueCommentDto, IssueActivity, IssueLabel, IssueLink } from 'shared/types/engineering.types'
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

  async updateIssue(projectId: string, issueId: string, data: Partial<UpdateIssueDto>): Promise<ApiResponse<Issue>> {
    return apiClient.patch<Issue>(`/issues/${projectId}/${issueId}`, data)
  },

  async deleteIssue(projectId: string, issueId: string): Promise<ApiResponse<void>> {
    return apiClient.delete<void>(`/issues/${projectId}/${issueId}`)
  },

  async getIssueActivity(projectId: string, issueId: string, filter?: string, sort?: string): Promise<ApiResponse<IssueActivity[]>> {
    const params = new URLSearchParams()
    if (filter) params.append('filter', filter)
    if (sort) params.append('sort', sort)
    return apiClient.get<IssueActivity[]>(`/issues/${projectId}/${issueId}/activity?${params.toString()}`)
  },

  async createComment(projectId: string, issueId: string, data: CreateIssueCommentDto): Promise<ApiResponse<IssueComment>> {
    return apiClient.post<IssueComment>(`/issues/${projectId}/${issueId}/comments`, data)
  },

  async updateComment(projectId: string, commentId: string, data: UpdateIssueCommentDto): Promise<ApiResponse<IssueComment>> {
    return apiClient.patch<IssueComment>(`/issues/${projectId}/comments/${commentId}`, data)
  },

  async deleteComment(projectId: string, commentId: string): Promise<ApiResponse<void>> {
    return apiClient.delete<void>(`/issues/${projectId}/comments/${commentId}`)
  },

  async subscribe(projectId: string, issueId: string): Promise<ApiResponse<void>> {
    return apiClient.post<void>(`/issues/${projectId}/${issueId}/subscribe`, {})
  },

  async unsubscribe(projectId: string, issueId: string): Promise<ApiResponse<void>> {
    return apiClient.delete<void>(`/issues/${projectId}/${issueId}/subscribe`)
  },

  async createLink(projectId: string, issueId: string, data: Partial<IssueLink>): Promise<ApiResponse<IssueLink>> {
    return apiClient.post<IssueLink>(`/issues/${projectId}/${issueId}/links`, data)
  },

  async deleteLink(projectId: string, linkId: string): Promise<ApiResponse<void>> {
    return apiClient.delete<void>(`/issues/${projectId}/links/${linkId}`)
  },

  async getProjectLabels(projectId: string): Promise<ApiResponse<IssueLabel[]>> {
    return apiClient.get<IssueLabel[]>(`/issues/${projectId}/labels`)
  },

  async createProjectLabel(projectId: string, data: { name: string; color?: string }): Promise<ApiResponse<IssueLabel>> {
    return apiClient.post<IssueLabel>(`/issues/${projectId}/labels`, data)
  },

  async uploadAttachment(projectId: string, issueId: string, file: File): Promise<ApiResponse<any>> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = async () => {
        const fileData = reader.result as string
        const result = await apiClient.post<any>(`/issues/${projectId}/${issueId}/attachments`, {
          fileName: file.name,
          fileData,
          mimeType: file.type,
        })
        resolve(result)
      }
      reader.onerror = reject
      reader.readAsDataURL(file)
    })
  },

  async getAttachments(projectId: string, issueId: string): Promise<ApiResponse<any[]>> {
    return apiClient.get<any[]>(`/issues/${projectId}/${issueId}/attachments`)
  },

  async deleteAttachment(projectId: string, issueId: string, attachmentId: string): Promise<ApiResponse<void>> {
    return apiClient.delete<void>(`/issues/${projectId}/${issueId}/attachments/${attachmentId}`)
  },
}
