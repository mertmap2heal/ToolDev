import { apiClient } from './api'
import type { ChangeRequest, CreateChangeRequestDto } from '../../../shared/types/engineering.types'
import type { ApiResponse } from '../../../shared/types/api.types'

export const changeRequestService = {
  async getChangeRequests(projectId: string): Promise<ApiResponse<ChangeRequest[]>> {
    return apiClient.get<ChangeRequest[]>(`/change-requests/${projectId}`)
  },

  async getChangeRequest(projectId: string, changeRequestId: string): Promise<ApiResponse<ChangeRequest>> {
    return apiClient.get<ChangeRequest>(`/change-requests/${projectId}/${changeRequestId}`)
  },

  async createChangeRequest(projectId: string, data: CreateChangeRequestDto): Promise<ApiResponse<ChangeRequest>> {
    return apiClient.post<ChangeRequest>(`/change-requests/${projectId}`, data)
  },

  async updateChangeRequest(projectId: string, changeRequestId: string, data: Partial<CreateChangeRequestDto>): Promise<ApiResponse<ChangeRequest>> {
    return apiClient.put<ChangeRequest>(`/change-requests/${projectId}/${changeRequestId}`, data)
  },

  async deleteChangeRequest(projectId: string, changeRequestId: string): Promise<ApiResponse<void>> {
    return apiClient.delete<void>(`/change-requests/${projectId}/${changeRequestId}`)
  },

  async uploadAttachment(projectId: string, changeRequestId: string, file: File): Promise<ApiResponse<any>> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = async () => {
        const fileData = reader.result as string
        const result = await apiClient.post<any>(`/change-requests/${projectId}/${changeRequestId}/attachments`, {
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

  async getAttachments(projectId: string, changeRequestId: string): Promise<ApiResponse<any[]>> {
    return apiClient.get<any[]>(`/change-requests/${projectId}/${changeRequestId}/attachments`)
  },

  async deleteAttachment(projectId: string, changeRequestId: string, attachmentId: string): Promise<ApiResponse<void>> {
    return apiClient.delete<void>(`/change-requests/${projectId}/${changeRequestId}/attachments/${attachmentId}`)
  },
}
