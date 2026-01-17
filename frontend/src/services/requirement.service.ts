import { apiClient } from './api'
import type { Requirement, CreateRequirementDto, UpdateRequirementDto, RequirementComment, BulkImportRequest, BulkImportResult } from '../../../shared/types/engineering.types'
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

  async updateRequirementParent(projectId: string, requirementId: string, newParentId: string | null): Promise<ApiResponse<Requirement>> {
    return apiClient.put<Requirement>(`/requirements/${projectId}/${requirementId}/parent`, { newParentId })
  },

  async bulkUpdateRequirements(projectId: string, requirementIds: string[], updates: Partial<UpdateRequirementDto>): Promise<ApiResponse<{ count: number }>> {
    return apiClient.post<{ count: number }>(`/requirements/${projectId}/bulk-update`, { requirementIds, updates })
  },

  async createRequirementComment(projectId: string, requirementId: string, content: string): Promise<ApiResponse<RequirementComment>> {
    return apiClient.post<RequirementComment>(`/requirements/${projectId}/${requirementId}/comments`, { content })
  },

  async deleteRequirementComment(projectId: string, commentId: string): Promise<ApiResponse<void>> {
    return apiClient.delete<void>(`/requirements/${projectId}/comments/${commentId}`)
  },

  async bulkImportRequirements(projectId: string, data: BulkImportRequest): Promise<ApiResponse<BulkImportResult>> {
    return apiClient.post<BulkImportResult>(`/requirements/${projectId}/bulk-import`, data)
  },
}
