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
}
