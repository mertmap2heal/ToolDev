import { apiClient } from './api'
import type { Requirement, CreateRequirementDto, UpdateRequirementDto, RequirementComment, BulkImportRequest, BulkImportResult } from 'shared/types/engineering.types'
import type { ApiResponse, PaginatedResponse } from 'shared/types/api.types'

export type RequirementSubscriptionSnapshot = {
  subscribed: boolean
  subscriberCount: number
  preview: Array<{ id: string; name: string; avatarUrl: string | null }>
}

export interface RequirementFilters {
  page?: number
  pageSize?: number
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
  search?: string
  status?: string
  priority?: string
  owner?: string
  requirementType?: string
  category?: string
  source?: string
  componentId?: string
  verificationStatus?: string
  reviewStatus?: string
}

export const requirementService = {
  async getRequirements(projectId: string, filters?: RequirementFilters): Promise<ApiResponse<PaginatedResponse<Requirement>>> {
    const params = new URLSearchParams()

    if (filters) {
      if (filters.page) params.append('page', String(filters.page))
      if (filters.pageSize) params.append('pageSize', String(filters.pageSize))
      if (filters.sortBy) params.append('sortBy', filters.sortBy)
      if (filters.sortOrder) params.append('sortOrder', filters.sortOrder)
      if (filters.search) params.append('search', filters.search)
      if (filters.status) params.append('status', filters.status)
      if (filters.priority) params.append('priority', filters.priority)
      if (filters.owner) params.append('owner', filters.owner)
      if (filters.requirementType) params.append('requirementType', filters.requirementType)
      if (filters.category) params.append('category', filters.category)
      if (filters.source) params.append('source', filters.source)
      if (filters.componentId) params.append('componentId', filters.componentId)
      if (filters.verificationStatus) params.append('verificationStatus', filters.verificationStatus)
      if (filters.reviewStatus) params.append('reviewStatus', filters.reviewStatus)
    }

    const queryString = params.toString()
    return apiClient.get<PaginatedResponse<Requirement>>(`/requirements/${projectId}${queryString ? `?${queryString}` : ''}`)
  },

  async getAllRequirements(projectId: string): Promise<ApiResponse<Requirement[]>> {
    const response = await apiClient.get<Requirement[]>(`/requirements/${projectId}/all`)
    if (response.success && response.data && !Array.isArray(response.data)) {
      return {
        ...response,
        data: [],
      }
    }
    return response
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

  async deleteRequirement(projectId: string, requirementId: string, reason?: string, childrenToDelete?: string[], linkedItemsToDelete?: { type: string, id: string }[]): Promise<ApiResponse<void>> {
    return apiClient.delete<void>(`/requirements/${projectId}/${requirementId}`, { reason, childrenToDelete, linkedItemsToDelete })
  },

  async restoreRequirement(projectId: string, requirementId: string): Promise<ApiResponse<void>> {
    return apiClient.post<void>(`/requirements/${projectId}/${requirementId}/restore`, {})
  },

  async permanentDeleteRequirement(projectId: string, requirementId: string): Promise<ApiResponse<void>> {
    return apiClient.delete<void>(`/requirements/${projectId}/${requirementId}/permanent`)
  },

  async getRecentlyDeletedRequirements(projectId: string): Promise<ApiResponse<Requirement[]>> {
    return apiClient.get<Requirement[]>(`/requirements/${projectId}/archive/recently-deleted`)
  },

  async lockRequirement(projectId: string, requirementId: string): Promise<ApiResponse<Requirement>> {
    return apiClient.post<Requirement>(`/requirements/${projectId}/${requirementId}/lock`, {})
  },

  async unlockRequirement(projectId: string, requirementId: string): Promise<ApiResponse<Requirement>> {
    return apiClient.post<Requirement>(`/requirements/${projectId}/${requirementId}/unlock`, {})
  },

  async getRequirementChildren(projectId: string, requirementId: string): Promise<ApiResponse<Requirement[]>> {
    return apiClient.get<Requirement[]>(`/requirements/${projectId}/${requirementId}/children`)
  },

  async getRequirementSubscription(projectId: string, requirementId: string): Promise<ApiResponse<RequirementSubscriptionSnapshot>> {
    return apiClient.get<RequirementSubscriptionSnapshot>(`/requirements/${projectId}/${requirementId}/subscription`)
  },

  async subscribeToRequirement(projectId: string, requirementId: string): Promise<ApiResponse<RequirementSubscriptionSnapshot>> {
    return apiClient.post<RequirementSubscriptionSnapshot>(`/requirements/${projectId}/${requirementId}/subscribe`, {})
  },

  async unsubscribeFromRequirement(projectId: string, requirementId: string): Promise<ApiResponse<RequirementSubscriptionSnapshot>> {
    return apiClient.post<RequirementSubscriptionSnapshot>(`/requirements/${projectId}/${requirementId}/unsubscribe`, {})
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

  async getRequirementsDashboard(projectId: string): Promise<
    ApiResponse<{
      totalRequirements: number
      byReviewStatus: Record<string, number>
      byVerificationStatus: Record<string, number>
      coveragePercent: number
      coverageCount: number
      totalWithTestLink: number
      suspectLinksCount: number
      baselineCount: number
      recentBaselines: Array<{ id: string; name: string; createdAt: string; status: string }>
    }>
  > {
    return apiClient.get(`/requirements/${projectId}/dashboard`)
  },

  async getAuditEvents(
    projectId: string,
    entityType: string,
    entityId: string
  ): Promise<ApiResponse<Array<{ id: string; action: string; oldValue?: unknown; newValue?: unknown; performedByUserId?: string; performedAt: string }>>> {
    return apiClient.get(
      `/requirements/${projectId}/audit?entityType=${encodeURIComponent(entityType)}&entityId=${encodeURIComponent(entityId)}`
    )
  },

  async bulkImportRequirements(projectId: string, data: BulkImportRequest): Promise<ApiResponse<BulkImportResult>> {
    return apiClient.post<BulkImportResult>(`/requirements/${projectId}/bulk-import`, data)
  },

  /** Import requirements from ReqIF XML. Body: { content: string }. Returns created, skipped, linksCreated, errors. */
  async importReqif(
    projectId: string,
    content: string
  ): Promise<
    ApiResponse<{
      created: number
      skipped: number
      linksCreated: number
      errors: Array<{ row?: number; message: string }>
    }>
  > {
    return apiClient.post<{ created: number; skipped: number; linksCreated: number; errors: Array<{ row?: number; message: string }> }>(
      `/requirements/${projectId}/import/reqif`,
      { content }
    )
  },

  // Custom Requirement Types
  async getCustomRequirementTypes(projectId: string): Promise<ApiResponse<Array<{ id: string; typeName: string; createdAt: string }>>> {
    return apiClient.get<Array<{ id: string; typeName: string; createdAt: string }>>(`/requirements/${projectId}/custom-types`)
  },

  async addCustomRequirementType(projectId: string, typeName: string): Promise<ApiResponse<{ id: string; typeName: string; createdAt: string }>> {
    return apiClient.post<{ id: string; typeName: string; createdAt: string }>(`/requirements/${projectId}/custom-types`, { typeName })
  },

  async deleteCustomRequirementType(projectId: string, typeId: string): Promise<ApiResponse<void>> {
    return apiClient.delete<void>(`/requirements/${projectId}/custom-types/${typeId}`)
  },

  updateRequirementComponent: (projectId: string, requirementId: string, componentId: string | null): Promise<ApiResponse<{ success: boolean; data: any }>> =>
    apiClient.patch<{ success: boolean; data: any }>(`/requirements/${projectId}/${requirementId}/component`, { componentId }),
}

