import { apiClient } from './api'
import type { ApiResponse } from 'shared/types/api.types'

export interface CorporateDocxTemplate {
  id: string
  projectId: string
  name: string
  description?: string | null
  placeholders?: string | null
  createdById?: string | null
  createdAt: string
  updatedAt: string
}

export interface CorporateDocxTemplateWithFile extends CorporateDocxTemplate {
  fileBase64: string
}

export const corporateDocxTemplateService = {
  async list(projectId: string): Promise<ApiResponse<CorporateDocxTemplate[]>> {
    return apiClient.get<CorporateDocxTemplate[]>(`/corporate-docx-templates/${projectId}`)
  },

  async getOne(projectId: string, id: string): Promise<ApiResponse<CorporateDocxTemplateWithFile>> {
    return apiClient.get<CorporateDocxTemplateWithFile>(`/corporate-docx-templates/${projectId}/${id}`)
  },

  async create(
    projectId: string,
    data: { name: string; description?: string; fileBase64: string; placeholders?: string[] }
  ): Promise<ApiResponse<CorporateDocxTemplate>> {
    return apiClient.post<CorporateDocxTemplate>(`/corporate-docx-templates/${projectId}`, data)
  },

  async remove(projectId: string, id: string): Promise<ApiResponse<{ id: string }>> {
    return apiClient.delete<{ id: string }>(`/corporate-docx-templates/${projectId}/${id}`)
  },
}
