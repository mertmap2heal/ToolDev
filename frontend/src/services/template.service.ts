import { apiClient } from './api'
import type { RequirementTemplate, CreateRequirementTemplateDto, UpdateRequirementTemplateDto } from 'shared/types/template.types'
import type { ApiResponse } from 'shared/types/api.types'

export const templateService = {
  async getTemplates(projectId: string): Promise<ApiResponse<RequirementTemplate[]>> {
    return apiClient.get<RequirementTemplate[]>(`/templates/${projectId}`)
  },

  async getTemplate(projectId: string, templateId: string): Promise<ApiResponse<RequirementTemplate>> {
    return apiClient.get<RequirementTemplate>(`/templates/${projectId}/${templateId}`)
  },

  async createTemplate(projectId: string, data: CreateRequirementTemplateDto): Promise<ApiResponse<RequirementTemplate>> {
    return apiClient.post<RequirementTemplate>(`/templates/${projectId}`, data)
  },

  async updateTemplate(projectId: string, templateId: string, data: UpdateRequirementTemplateDto): Promise<ApiResponse<RequirementTemplate>> {
    return apiClient.put<RequirementTemplate>(`/templates/${projectId}/${templateId}`, data)
  },

  async deleteTemplate(projectId: string, templateId: string): Promise<ApiResponse<void>> {
    return apiClient.delete<void>(`/templates/${projectId}/${templateId}`)
  },
}
