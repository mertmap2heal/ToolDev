import { apiClient } from './api'
import type { Requirement, CreateRequirementDto, UpdateRequirementDto } from '../../../shared/types/engineering.types'
import type { ApiResponse } from '../../../shared/types/api.types'

export const requirementService = {
  async getRequirements(projectId: string): Promise<ApiResponse<Requirement[]>> {
    return apiClient.get<Requirement[]>(`/requirements/${projectId}`)
  },

  async getRequirement(projectId: string, requirementId: string): Promise<ApiResponse<Requirement>> {
    return apiClient.get<Requirement>(`/requirements/${projectId}/${requirementId}`)
  },

  async createRequirement(projectId: string, data: CreateRequirementDto): Promise<ApiResponse<Requirement>> {
    return apiClient.post<Requirement>(`/requirements/${projectId}`, data)
  },

  async updateRequirement(projectId: string, requirementId: string, data: UpdateRequirementDto): Promise<ApiResponse<Requirement>> {
    return apiClient.put<Requirement>(`/requirements/${projectId}/${requirementId}`, data)
  },

  async deleteRequirement(projectId: string, requirementId: string): Promise<ApiResponse<void>> {
    return apiClient.delete<void>(`/requirements/${projectId}/${requirementId}`)
  },

  async getRequirementChildren(projectId: string, requirementId: string): Promise<ApiResponse<Requirement[]>> {
    return apiClient.get<Requirement[]>(`/requirements/${projectId}/${requirementId}/children`)
  },
}
