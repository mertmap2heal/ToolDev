import { apiClient } from './api'
import type { ApiResponse } from 'shared/types/api.types'

export type RequirementExportTemplateFormat = 'csv' | 'excel' | 'pdf' | 'word' | 'reqif'

export interface RequirementExportTemplate {
  id: string
  projectId: string
  name: string
  format: RequirementExportTemplateFormat
  payload: unknown
  visibility?: string
  createdById?: string | null
  createdAt: string
  updatedAt: string
  deletedAt?: string | null
  deletedById?: string | null
}

export interface CreateRequirementExportTemplateDto {
  name: string
  format: RequirementExportTemplateFormat
  payload: unknown
  visibility?: string
}

export interface UpdateRequirementExportTemplateDto {
  name?: string
  format?: RequirementExportTemplateFormat
  payload?: unknown
  visibility?: string
}

export const requirementExportTemplateService = {
  async list(projectId: string): Promise<ApiResponse<RequirementExportTemplate[]>> {
    return apiClient.get<RequirementExportTemplate[]>(`/templates/${projectId}`)
  },

  async listDeleted(projectId: string): Promise<ApiResponse<RequirementExportTemplate[]>> {
    return apiClient.get<RequirementExportTemplate[]>(`/templates/${projectId}/archive/deleted`)
  },

  async getOne(projectId: string, id: string): Promise<ApiResponse<RequirementExportTemplate>> {
    return apiClient.get<RequirementExportTemplate>(`/templates/${projectId}/${id}`)
  },

  async create(projectId: string, data: CreateRequirementExportTemplateDto): Promise<ApiResponse<RequirementExportTemplate>> {
    return apiClient.post<RequirementExportTemplate>(`/templates/${projectId}`, data)
  },

  async update(
    projectId: string,
    id: string,
    data: UpdateRequirementExportTemplateDto
  ): Promise<ApiResponse<RequirementExportTemplate>> {
    return apiClient.put<RequirementExportTemplate>(`/templates/${projectId}/${id}`, data)
  },

  async remove(projectId: string, id: string): Promise<ApiResponse<{ id: string }>> {
    return apiClient.delete<{ id: string }>(`/templates/${projectId}/${id}`)
  },

  async restore(projectId: string, id: string): Promise<ApiResponse<RequirementExportTemplate>> {
    return apiClient.post<RequirementExportTemplate>(`/templates/${projectId}/${id}/restore`, {})
  },

  async permanentDelete(projectId: string, id: string): Promise<ApiResponse<{ id: string }>> {
    return apiClient.delete<{ id: string }>(`/templates/${projectId}/${id}/permanent`)
  },
}
